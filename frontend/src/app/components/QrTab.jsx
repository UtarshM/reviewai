"use client";

import React, { useState, useEffect } from 'react';
import { Star, Copy, Download, Printer, ExternalLink, ArrowRight, MessageSquare, Award, Calendar } from 'lucide-react';

export default function QrTab({ activeBusiness, token, onTabChange }) {
  const [campaign, setCampaign] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (activeBusiness && token) fetchCampaignAndReviews();
  }, [activeBusiness, token]);

  const fetchCampaignAndReviews = async () => {
    setLoading(true); setError('');
    try {
      const campaignResponse = await fetch(`/api/v1/qr?business_id=${activeBusiness.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const campaignData = await campaignResponse.json();
      if (campaignData.error) { setError(campaignData.message || 'Failed to load QR'); setLoading(false); return; }
      const activeCampaign = campaignData[0] || null;
      setCampaign(activeCampaign);
      if (activeCampaign) {
        const reviewsResponse = await fetch(`/api/v1/qr/reviews?business_id=${activeBusiness.id}&rating=all&search=&sort=newest`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const reviewsData = await reviewsResponse.json();
        if (reviewsData.error) setError(reviewsData.message || 'Failed to load reviews');
        else { setReviews(reviewsData.reviews || []); setStats(reviewsData.stats || null); }
      }
    } catch (err) { setError('Connection failed.'); } finally { setLoading(false); }
  };

  const addToast = (msg) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const getPublicUrl = (cToken) => typeof window !== 'undefined' ? `${window.location.origin}/review/${cToken}` : `/review/${cToken}`;
  const getQrUrl = (cToken, size = '300x300') => `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(getPublicUrl(cToken))}&color=000000&bgcolor=FFFFFF&ecc=M`;

  const handleCopyLink = () => { if (!campaign) return; navigator.clipboard.writeText(getPublicUrl(campaign.token)); addToast('URL copied!'); };
  const handlePreviewLink = () => { if (!campaign) return; window.open(getPublicUrl(campaign.token), '_blank'); };
  const handleDownloadQr = () => {
    if (!campaign) return;
    const link = document.createElement('a');
    link.href = getQrUrl(campaign.token, '1000x1000');
    link.download = `${activeBusiness.name}_QR.png`;
    link.target = '_blank';
    link.click();
    addToast('Download started!');
  };
  const handlePrint = () => window.print();

  const renderStars = (rating) => (
    <div className="flex gap-0.5 text-[var(--gold)]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-current' : 'text-slate-200'}`} />
      ))}
    </div>
  );

  if (loading && !campaign) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-[var(--accent)]">sync</span>
        <p className="text-xs text-[var(--text-muted)] mt-2">Loading QR station...</p>
      </div>
    );
  }

  const publicUrl = campaign ? getPublicUrl(campaign.token) : '';
  const qrUrl = campaign ? getQrUrl(campaign.token, '500x500') : '';
  const qrUrlPrint = campaign ? getQrUrl(campaign.token, '1000x1000') : '';
  const recentReviews = reviews.slice(0, 3);
  const totalReviews = stats?.totalReviews || 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => { const s = Math.round(r.rating); if (distribution[s] !== undefined) distribution[s]++; });
  const locationParts = [activeBusiness?.city, activeBusiness?.state].filter(Boolean);

  return (
    <div className="relative">
      {/* Print poster */}
      {campaign && (
        <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:text-center print:h-screen print:bg-white print:p-12 print:border-8 print:border-double print:border-slate-800">
          <h1 className="text-5xl font-bold mb-4 text-slate-800">Reply Desk</h1>
          <h2 className="text-2xl text-slate-600 mb-8">Scan to Leave a Review ⭐</h2>
          <div className="w-80 h-80 border-4 border-slate-800 p-4 rounded-3xl mb-8 flex items-center justify-center bg-white shadow-lg">
            <img src={qrUrlPrint} alt="QR Code" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-4xl font-bold text-slate-800">{activeBusiness.name}</h3>
          <p className="text-xl text-slate-500 italic capitalize">{activeBusiness.category}{locationParts.length > 0 && ` • ${locationParts.join(', ')}`}</p>
          <p className="mt-12 text-sm text-slate-400">{publicUrl}</p>
        </div>
      )}

      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[var(--c-d7e3fc)] shadow-lg text-xs font-semibold animate-fade-in">
            <span className="text-emerald-500">✓</span>{t.msg}
          </div>
        ))}
      </div>

      {/* Screen Layout */}
      <div className="print:hidden space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--c-e2eafc)]">
          <div>
            <h2 className="text-lg font-bold">QR Review Station</h2>
            <p className="text-xs text-[var(--text-muted)]">Share your QR code and track feedback</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs">{error}</div>}

        {/* 2-Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* QR Card */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-5 shadow-xs space-y-5 text-center">
              {/* Logo */}
              <div className="flex justify-center">
                {campaign?.qr_logo ? (
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
                    <img src={campaign.qr_logo} alt="Logo" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                    {(activeBusiness?.name || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold">{activeBusiness?.name}</h3>
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
                <p className="text-[11px] text-[var(--text-muted)] capitalize">{activeBusiness?.category}{locationParts.length > 0 && ` • ${locationParts.join(', ')}`}</p>
              </div>

              {/* QR */}
              <div className="flex justify-center">
                <div className="bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] rounded-xl p-3 w-56">
                  <div className="bg-white p-2 rounded-lg shadow-xs">
                    {campaign?.token ? (
                      <img src={qrUrl} alt="QR Code" className="w-full aspect-square object-contain" />
                    ) : (
                      <div className="animate-pulse bg-slate-200 w-full aspect-square rounded-lg" />
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Scan to Leave a Review ⭐</p>

              <div onClick={handleCopyLink} title="Click to copy"
                className="text-xs text-[var(--text-secondary)] bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] py-2 px-3 rounded-lg truncate font-mono cursor-pointer hover:bg-[var(--c-e2eafc)] transition">
                {publicUrl}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Copy, label: 'Copy', fn: handleCopyLink },
                  { icon: ExternalLink, label: 'Preview', fn: handlePreviewLink },
                  { icon: Download, label: 'Download', fn: handleDownloadQr },
                  { icon: Printer, label: 'Print', fn: handlePrint },
                ].map(({ icon: Icon, label, fn }) => (
                  <button key={label} onClick={fn}
                    className="flex flex-col items-center gap-1 py-2 bg-[var(--bg-muted)] hover:bg-[var(--c-e2eafc)] border border-[var(--c-d7e3fc)] rounded-lg text-[10px] font-semibold transition cursor-pointer">
                    <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Stats + Reviews */}
          <div className="lg:col-span-7 space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[var(--c-d7e3fc)] p-4 rounded-xl shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Avg Rating</span>
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                {totalReviews > 0 ? (
                  <span className="text-2xl font-extrabold">{stats?.avgRating || '—'}<span className="text-xs text-[var(--text-muted)] font-normal">/5</span></span>
                ) : <span className="text-sm font-bold text-[var(--text-muted)]">No ratings</span>}
              </div>

              <div className="bg-white border border-[var(--c-d7e3fc)] p-4 rounded-xl shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total</span>
                  <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <span className="text-2xl font-extrabold">{totalReviews}</span>
              </div>

              <div className="bg-white border border-[var(--c-d7e3fc)] p-4 rounded-xl shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Distribution</span>
                  <Award className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-1.5">
                  {totalReviews > 0 ? (
                    [5, 4, 3, 2, 1].map((s) => {
                      const count = distribution[s] || 0;
                      const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                      return (
                        <div key={s} className="flex items-center gap-2 text-xs leading-none">
                          <span className="w-4 text-right font-semibold text-[10px]">{s}★</span>
                          <div className="flex-grow h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-4 text-right font-semibold text-[10px] text-[var(--text-muted)]">{count}</span>
                        </div>
                      );
                    })
                  ) : <span className="text-lg font-extrabold text-[var(--text-muted)]">—</span>}
                </div>
              </div>

              <div className="bg-white border border-[var(--c-d7e3fc)] p-4 rounded-xl shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Last 30 Days</span>
                  <Calendar className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="text-2xl font-extrabold">{totalReviews > 0 ? (stats?.recentReviews || 0) : '—'}</span>
              </div>
            </div>

            {/* Recent Reviews */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Latest Reviews</h3>
                {totalReviews > 0 && (
                  <button onClick={() => onTabChange('tab-customer-reviews')}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                    View All <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {totalReviews === 0 ? (
                <div className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-8 text-center shadow-xs">
                  <div className="text-2xl mb-2">💬</div>
                  <h4 className="text-xs font-bold mb-1">No reviews yet</h4>
                  <p className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto mb-3">Share your QR code to start collecting feedback.</p>
                  <button onClick={handlePreviewLink} className="btn btn-secondary text-xs">Preview Page</button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-3.5 shadow-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        {renderStars(review.rating)}
                        <span className="text-[10px] text-[var(--text-muted)]">{new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] italic truncate">"{review.final_review}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
