"use client";

import React, { useState, useEffect } from 'react';
import AuthView from './AuthView';
import Header from './Header';
import Sidebar from './Sidebar';
import PacingRibbon from './PacingRibbon';
import BusinessModal from './BusinessModal';
import ReplyTab from './ReplyTab';
import HistoryTab from './HistoryTab';
import AnalyticsTab from './AnalyticsTab';
import CustomerPortalView from './CustomerPortalView';
import QrShareStudio from './QrShareStudio';
import PrivateFeedbackInbox from './PrivateFeedbackInbox';
import GooglePostGenerator from './GooglePostGenerator';

export default function App() {
  const [token, setToken] = useState(null);
  const [userEmail, setUserEmail] = useState('...');
  const [businesses, setBusinesses] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(null);
  const [activeTab, setActiveTab] = useState('tab-qr-studio');
  const [pacingWarning, setPacingWarning] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [publicSlug, setPublicSlug] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/r/')) {
        const slug = path.replace('/r/', '').trim();
        if (slug) {
          setPublicSlug(slug);
          return;
        }
      }
      const savedToken = localStorage.getItem('token');
      if (savedToken) setToken(savedToken);
      const savedId = localStorage.getItem('activeBusinessId');
      if (savedId) setActiveBusinessId(parseInt(savedId, 10));
    }
  }, []);

  useEffect(() => {
    if (token && !publicSlug) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.email || 'Business Owner');
        fetchBusinesses(token);
      } catch (e) { handleLogout(); }
    }
  }, [token, publicSlug]);

  const fetchBusinesses = async (authToken) => {
    try {
      const response = await fetch('/api/v1/businesses', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (response.status === 401) { handleLogout(); return; }
      const data = await response.json();
      if (data.error) return;
      const bizList = data || [];
      setBusinesses(bizList);
      if (bizList.length > 0) {
        const savedId = localStorage.getItem('activeBusinessId');
        const parsedId = savedId ? parseInt(savedId, 10) : null;
        if (parsedId && bizList.some((b) => b.id === parsedId)) setActiveBusinessId(parsedId);
        else { setActiveBusinessId(bizList[0].id); localStorage.setItem('activeBusinessId', bizList[0].id); }
      } else setActiveBusinessId(null);
    } catch (err) { console.error('Error fetching businesses:', err); }
  };

  const handleLoginSuccess = (newToken, email) => { setToken(newToken); setUserEmail(email); localStorage.setItem('token', newToken); };
  const handleLogout = () => { setToken(null); setUserEmail('...'); setBusinesses([]); setActiveBusinessId(null); localStorage.removeItem('token'); localStorage.removeItem('activeBusinessId'); };
  const handleBusinessChange = (id) => { setActiveBusinessId(id); if (id) localStorage.setItem('activeBusinessId', id); else localStorage.removeItem('activeBusinessId'); };

  const handleBusinessSubmit = async (newBiz) => {
    try {
      const response = await fetch('/api/v1/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newBiz) });
      if (response.status === 401) { handleLogout(); return; }
      const data = await response.json();
      if (data.error) { alert('Failed to save: ' + data.message); return; }
      setIsBusinessModalOpen(false);
      await fetchBusinesses(token);
      handleBusinessChange(data.id);
    } catch (err) { alert('Network error.'); }
  };

  const handlePacingUpdated = (warning, count) => { setPacingWarning(warning); setDailyCount(count); };
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) || null;

  // Direct Public Portal View (/r/:slug)
  if (publicSlug) {
    return <CustomerPortalView slug={publicSlug} />;
  }

  if (!token) return <AuthView onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="flex flex-col min-h-screen h-screen overflow-hidden bg-background text-on-surface">
      {/* Top Navbar */}
      <Header
        businesses={businesses}
        activeBusinessId={activeBusinessId}
        userEmail={userEmail}
        activeTab={activeTab}
        onBusinessChange={handleBusinessChange}
        onAddProfileClick={() => setIsBusinessModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeBusiness={activeBusiness}
          businesses={businesses}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddProfileClick={() => setIsBusinessModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content Panel */}
        <main className="flex-1 overflow-y-auto p-5 md:p-xl bg-background pb-24 md:pb-xl">
          <div className="max-w-[1280px] mx-auto space-y-lg">
            <PacingRibbon pacingWarning={pacingWarning} dailyCount={dailyCount} />

            {!activeBusinessId ? (
              <div className="glass-card rounded-2xl p-3xl text-center max-w-[420px] mx-auto mt-2xl shadow-xl animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-lg">
                  <span className="material-symbols-outlined text-primary text-3xl">store</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">No Business Selected</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg leading-relaxed">
                  Create or select a business profile to start generating AI review acquisition QR links and Google Business posts.
                </p>
                <button className="bg-primary text-on-primary font-label-md text-label-md px-lg py-3 rounded-xl hover:brightness-110 active:scale-98 transition-all cursor-pointer" onClick={() => setIsBusinessModalOpen(true)}>
                  Create Business Profile
                </button>
              </div>
            ) : (
              <div className="animate-fade-in">
                {activeTab === 'tab-qr-studio' && <QrShareStudio currentBusiness={activeBusiness} />}
                {activeTab === 'tab-google-posts' && <GooglePostGenerator currentBusiness={activeBusiness} />}
                {activeTab === 'tab-private-inbox' && <PrivateFeedbackInbox currentBusiness={activeBusiness} />}
                {activeTab === 'tab-reply' && <ReplyTab activeBusiness={activeBusiness} token={token} onGenerationSuccess={handlePacingUpdated} />}
                {activeTab === 'tab-analytics' && <AnalyticsTab activeBusiness={activeBusiness} token={token} />}
                {activeTab === 'tab-history' && <HistoryTab activeBusiness={activeBusiness} token={token} onPacingUpdated={handlePacingUpdated} />}
              </div>
            )}
          </div>
        </main>
      </div>

      <BusinessModal isOpen={isBusinessModalOpen} onClose={() => setIsBusinessModalOpen(false)} onSubmit={handleBusinessSubmit} />
    </div>
  );
}
