"use client";

import React, { useState, useEffect } from 'react';
import AuthView from './AuthView';
import Header from './Header';
import PacingRibbon from './PacingRibbon';
import TabsNav from './TabsNav';
import BusinessModal from './BusinessModal';
import ReplyTab from './ReplyTab';
import ReviewTab from './ReviewTab';
import HistoryTab from './HistoryTab';
import QrTab from './QrTab';
import CustomerReviewsTab from './CustomerReviewsTab';

export default function App() {
  const [token, setToken] = useState(null);
  const [userEmail, setUserEmail] = useState('...');
  const [businesses, setBusinesses] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(null);
  const [activeTab, setActiveTab] = useState('tab-reply');
  const [pacingWarning, setPacingWarning] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [reviewAlerts, setReviewAlerts] = useState([]);

  // Load saved token and business ID from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        setToken(savedToken);
      }
      const savedId = localStorage.getItem('activeBusinessId');
      if (savedId) {
        setActiveBusinessId(parseInt(savedId, 10));
      }
    }
  }, []);

  // Decode user email on mount or token changes
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.email || 'Business Owner');
        fetchBusinesses(token);
      } catch (e) {
        handleLogout();
      }
    }
  }, [token]);

  const fetchBusinesses = async (authToken) => {
    try {
      const response = await fetch('/api/v1/businesses', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();
      if (data.error) {
        console.error('Failed to fetch businesses:', data.message);
        return;
      }

      const bizList = data || [];
      setBusinesses(bizList);

      if (bizList.length > 0) {
        // Restore active business if it still exists in the fetched list
        const savedId = localStorage.getItem('activeBusinessId');
        const parsedId = savedId ? parseInt(savedId, 10) : null;
        if (parsedId && bizList.some((b) => b.id === parsedId)) {
          setActiveBusinessId(parsedId);
        } else {
          setActiveBusinessId(bizList[0].id);
          localStorage.setItem('activeBusinessId', bizList[0].id);
        }
      } else {
        setActiveBusinessId(null);
      }
    } catch (err) {
      console.error('Error fetching businesses:', err);
    }
  };

  const handleLoginSuccess = (newToken, email) => {
    setToken(newToken);
    setUserEmail(email);
    localStorage.setItem('token', newToken);
  };

  const handleLogout = () => {
    setToken(null);
    setUserEmail('...');
    setBusinesses([]);
    setActiveBusinessId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
  };

  const handleBusinessChange = (id) => {
    setActiveBusinessId(id);
    if (id) {
      localStorage.setItem('activeBusinessId', id);
    } else {
      localStorage.removeItem('activeBusinessId');
    }
  };

  const handleBusinessSubmit = async (newBiz) => {
    try {
      const response = await fetch('/api/v1/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newBiz)
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();
      if (data.error) {
        alert('Failed to save business profile: ' + data.message);
        return;
      }

      setIsBusinessModalOpen(false);
      await fetchBusinesses(token);
      handleBusinessChange(data.id);
    } catch (err) {
      alert('Failed to save business due to network error.');
    }
  };

  const handlePacingUpdated = (warning, count) => {
    setPacingWarning(warning);
    setDailyCount(count);
  };

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) || null;

  if (!token) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <div className="workspace">
        <Header
          businesses={businesses}
          activeBusinessId={activeBusinessId}
          userEmail={userEmail}
          onBusinessChange={handleBusinessChange}
          onAddProfileClick={() => setIsBusinessModalOpen(true)}
          onLogout={handleLogout}
        />

        <PacingRibbon pacingWarning={pacingWarning} dailyCount={dailyCount} />

        <main className="desk-main">
          <TabsNav activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="desk-folder-body">
            {!activeBusinessId ? (
              <div id="no-business-overlay" className="empty-state">
                <div className="empty-state-icon">🏢</div>
                <h2>No Active Business Selected</h2>
                <p>
                  To start generating replies or draft reviews, please select a business profile from the
                  dropdown above or create a new one.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsBusinessModalOpen(true)}
                >
                  Create Business Profile
                </button>
              </div>
            ) : (
              <div id="workspace-content">
                {activeTab === 'tab-reply' && (
                  <ReplyTab
                    activeBusiness={activeBusiness}
                    token={token}
                    onGenerationSuccess={handlePacingUpdated}
                  />
                )}
                {activeTab === 'tab-review' && (
                  <ReviewTab
                    activeBusiness={activeBusiness}
                    token={token}
                    onGenerationSuccess={handlePacingUpdated}
                  />
                )}
                {activeTab === 'tab-history' && (
                  <HistoryTab
                    activeBusiness={activeBusiness}
                    token={token}
                    onPacingUpdated={handlePacingUpdated}
                  />
                )}
                {activeTab === 'tab-qr' && (
                  <QrTab
                    activeBusiness={activeBusiness}
                    token={token}
                    onTabChange={setActiveTab}
                    onNewReviewAlert={(alertText) => {
                      setReviewAlerts((prev) => [alertText, ...prev]);
                    }}
                  />
                )}
                {activeTab === 'tab-customer-reviews' && (
                  <CustomerReviewsTab
                    activeBusiness={activeBusiness}
                    token={token}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <BusinessModal
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        onSubmit={handleBusinessSubmit}
      />
    </div>
  );
}
