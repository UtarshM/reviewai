"use client";

import React, { useState, useEffect } from 'react';
import { Star, Sparkles, Search, MessageSquare, Edit2, RotateCcw, X, User } from 'lucide-react';

export default function CustomerReviewsTab({ activeBusiness, token }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  const [selectedReview, setSelectedReview] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (activeBusiness && token) fetchReviews();
  }, [activeBusiness, token, ratingFilter, statusFilter, searchTerm, sortOrder]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedReview) {
        if (e.key === 'Escape') handleCancelReply();
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveReply(selectedReview.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReview, replyDraft]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const fetchReviews = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(
        `/api/v1/qr/reviews?business_id=${activeBusiness.id}&rating=${ratingFilter}&status=${statusFilter}&search=${encodeURIComponent(searchTerm)}&sort=${sortOrder}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.error) setError(data.message || 'Failed to load reviews');
      else { setReviews(data.reviews || []); setStats(data.stats || null); }
    } catch (err) { setError('Connection failed.'); } finally { setLoading(false); }
  };

  const handleOpenReply = (review) => { setSelectedReview(review); setReplyDraft(review.business_reply || ''); };
  const handleCancelReply = () => { setSelectedReview(null); setReplyDraft(''); };

  const handleSaveReply = async (reviewId) => {
    if (!replyDraft.trim()) return;
    setSaveLoading(true);
    try {
      const response = await fetch(`/api/v1/qr/reviews/${reviewId}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reply: replyDraft })
      });
      const data = await response.json();
      if (data.error) addToast(data.message || 'Failed', 'error');
      else { addToast('Reply saved!'); setSelectedReview(null); setReplyDraft(''); fetchReviews(); }
    } catch (err) { addToast('Network error.', 'error'); } finally { setSaveLoading(false); }
  };

  const handleGenerateAiReply = async (reviewId) => {
    setAiGenerating(true);
    try {
      const response = await fetch(`/api/v1/qr/reviews/${reviewId}/ai-reply`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.error) addToast(data.message || 'Failed', 'error');
      else { setReplyDraft(data.reply || ''); addToast('AI suggestion loaded!'); }
    } catch (err) { addToast('Network error.', 'error'); } finally { setAiGenerating(false); }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name[0].toUpperCase();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return { date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) };
  };

  const renderStars = (rating) => (
    <div className="flex gap-0.5 text-[var(--gold)]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-current' : 'text-slate-200'}`} />
      ))}
    </div>
  );

  const total = stats?.totalReviews || 0;
  const awaiting = stats?.newReviewsCount || 0;
  const replied = total - awaiting;

  const PillGroup = ({ items, active, onChange }) => (
    <div className="flex gap-0.5 bg-[var(--bg-muted)] p-0.5 rounded-lg border border-[var(--c-d7e3fc)]">
      {items.map((item) => (
        <button key={item.id} onClick={() => onChange(item.id)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer ${
            active === item.id ? 'bg-[var(--accent)] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}>{item.label}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 relative">
      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[var(--c-d7e3fc)] shadow-lg text-xs font-semibold animate-fade-in">
            <span className={t.type === 'success' ? 'text-emerald-500' : 'text-red-500'}>✓</span>{t.msg}
          </div>
        ))}
      </div>

      {/* Backdrop */}
      {selectedReview && <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-40" onClick={handleCancelReply} />}

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white border-l border-[var(--c-d7e3fc)] shadow-2xl transition-transform duration-300 ease-in-out ${
        selectedReview ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col`}>
        {selectedReview && (
          <>
            <div className="p-5 border-b border-[var(--c-e2eafc)] bg-[var(--bg-muted)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold">Review Details</h3>
                <p className="text-[10px] text-[var(--text-muted)]">Reply to feedback</p>
              </div>
              <button className="w-7 h-7 rounded-lg hover:bg-[var(--c-e2eafc)] flex items-center justify-center transition cursor-pointer" onClick={handleCancelReply}>
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  {renderStars(selectedReview.rating)}
                  <span className="text-[10px] text-[var(--text-muted)]">{formatDate(selectedReview.created_at).date}</span>
                </div>
                <p className="text-xs italic leading-relaxed">"{selectedReview.final_review}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Your Reply</label>
                <textarea rows="5" className="w-full p-3 rounded-xl bg-white border border-[var(--c-ccdbfd)] text-xs outline-none focus:border-[var(--accent)] transition resize-y"
                  placeholder="Type your response..." value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
              </div>

              <button type="button" disabled={aiGenerating}
                className="w-full btn py-2.5 bg-[var(--bg-muted)] hover:bg-[var(--c-e2eafc)] border border-[var(--c-d7e3fc)] text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                onClick={() => handleGenerateAiReply(selectedReview.id)}>
                <Sparkles className="w-4 h-4 text-yellow-500 fill-current" />
                {aiGenerating ? 'Generating...' : 'AI Suggest Reply'}
              </button>
            </div>

            <div className="p-5 border-t border-[var(--c-e2eafc)] bg-[var(--bg-muted)] flex justify-end gap-2 shrink-0">
              <button className="btn btn-secondary" onClick={handleCancelReply} disabled={saveLoading || aiGenerating}>Cancel</button>
              <button className="btn btn-primary disabled:opacity-50" onClick={() => handleSaveReply(selectedReview.id)}
                disabled={saveLoading || aiGenerating || !replyDraft.trim()}>
                {saveLoading ? 'Saving...' : 'Save Reply'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--c-e2eafc)]">
        <div>
          <h2 className="text-lg font-bold">Customer Reviews</h2>
          <p className="text-xs text-[var(--text-muted)]">Manage feedback and responses</p>
        </div>
        <button className="btn btn-secondary text-xs px-3 py-1.5" onClick={fetchReviews}>
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {!loading && total === 0 ? (
        <div className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-16 text-center shadow-xs">
          <div className="text-3xl mb-2">💬</div>
          <h3 className="text-sm font-bold mb-1">No reviews yet</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">Share your QR code to start collecting customer feedback.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: total },
              { label: 'Avg Rating', value: `${stats?.avgRating || '0.0'}/5` },
              { label: 'Awaiting', value: awaiting, color: 'text-slate-500' },
              { label: 'Replied', value: replied, color: 'text-emerald-600' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-[var(--c-d7e3fc)] p-4 rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">{s.label}</span>
                <span className={`text-xl font-extrabold ${s.color || ''}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-[var(--c-d7e3fc)] p-3 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-56">
              <input type="text" placeholder="Search reviews..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] rounded-lg outline-none focus:border-[var(--accent)]" />
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <PillGroup items={[{id:'all',label:'All'},{id:'5',label:'5★'},{id:'4',label:'4★'},{id:'3',label:'3★'},{id:'2',label:'2★'},{id:'1',label:'1★'}]} active={ratingFilter} onChange={setRatingFilter} />
              <PillGroup items={[{id:'all',label:'All'},{id:'awaiting',label:'Awaiting'},{id:'replied',label:'Replied'}]} active={statusFilter} onChange={setStatusFilter} />
              <PillGroup items={[{id:'newest',label:'Newest'},{id:'oldest',label:'Oldest'}]} active={sortOrder} onChange={setSortOrder} />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white border border-[var(--c-d7e3fc)] rounded-xl p-5 h-32 shadow-xs" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-12 text-center shadow-xs">
              <div className="text-3xl mb-2">🔍</div>
              <h3 className="text-sm font-bold mb-1">No matches</h3>
              <p className="text-xs text-[var(--text-muted)]">No reviews match your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const dt = formatDate(review.created_at);
                const hasReply = review.business_reply?.trim();
                return (
                  <div key={review.id} className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-4 shadow-xs hover:shadow-sm transition space-y-3">
                    {/* Meta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] flex items-center justify-center font-bold text-[var(--text-muted)] text-[10px] shrink-0">
                          {review.customer_name ? getInitials(review.customer_name) : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">{review.customer_name || 'Anonymous'}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {renderStars(review.rating)}
                            <span className="text-[10px] text-[var(--text-muted)]">• {dt.date} • {dt.time}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {review.ai_suggestion && <span className="bg-blue-50 text-[var(--accent)] border border-blue-100 text-[9px] font-bold px-1.5 py-0.5 rounded-full">🤖 AI</span>}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                          hasReply ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${hasReply ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {hasReply ? 'Replied' : 'Awaiting'}
                        </span>
                      </div>
                    </div>

                    {/* Text */}
                    <p className="text-xs italic leading-relaxed text-[var(--text-secondary)] pl-3 border-l-2 border-[var(--c-d7e3fc)]">"{review.final_review}"</p>

                    {/* Reply section */}
                    {hasReply ? (
                      <div className="bg-[var(--bg-muted)] border border-[var(--c-d7e3fc)] rounded-lg p-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Your Reply</span>
                          {review.reply_updated_at && <span className="text-[10px] text-[var(--text-muted)]">{formatDate(review.reply_updated_at).date}</span>}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{review.business_reply}</p>
                        <div className="flex justify-end">
                          <button className="text-xs text-[var(--accent)] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            onClick={() => handleOpenReply(review)}>
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end pt-1 border-t border-[var(--c-e2eafc)]">
                        <button className="btn btn-secondary text-xs px-3 py-1.5" onClick={() => handleOpenReply(review)}>
                          <MessageSquare className="w-3 h-3" /> Reply
                        </button>
                        <button className="btn btn-primary text-xs px-3 py-1.5"
                          onClick={() => { handleOpenReply(review); handleGenerateAiReply(review.id); }}>
                          <Sparkles className="w-3 h-3 text-yellow-300 fill-current" /> AI Reply
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
