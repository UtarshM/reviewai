import React, { useState, useEffect } from 'react';
import { Star, Sparkles, Search, MessageSquare, Edit2, RotateCcw, X, ShieldAlert, ArrowRight, User } from 'lucide-react';

export default function CustomerReviewsTab({ activeBusiness, token }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'awaiting', 'replied'
  const [sortOrder, setSortOrder] = useState('newest');

  // Slide-over Drawer State
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (activeBusiness && token) {
      fetchReviews();
    }
  }, [activeBusiness, token, ratingFilter, statusFilter, searchTerm, sortOrder]);

  // Keyboard Shortcuts inside the Reply Drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedReview) {
        if (e.key === 'Escape') {
          handleCancelReply();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          handleSaveReply(selectedReview.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReview, replyDraft]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/v1/qr/reviews?business_id=${activeBusiness.id}&rating=${ratingFilter}&status=${statusFilter}&search=${encodeURIComponent(searchTerm)}&sort=${sortOrder}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.error) {
        setError(data.message || 'Failed to load reviews');
      } else {
        setReviews(data.reviews || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      setError('Connection failed while retrieving customer reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReply = (review) => {
    setSelectedReview(review);
    setReplyDraft(review.business_reply || '');
  };

  const handleCancelReply = () => {
    setSelectedReview(null);
    setReplyDraft('');
  };

  const handleSaveReply = async (reviewId) => {
    if (!replyDraft.trim()) return;
    setSaveLoading(true);
    try {
      const response = await fetch(`/api/v1/qr/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyDraft })
      });
      const data = await response.json();
      if (data.error) {
        addToast(data.message || 'Failed to save reply', 'error');
      } else {
        addToast('Reply saved successfully!');
        setSelectedReview(null);
        setReplyDraft('');
        fetchReviews();
      }
    } catch (err) {
      addToast('Network error while saving reply.', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGenerateAiReply = async (reviewId) => {
    setAiGenerating(true);
    try {
      const response = await fetch(`/api/v1/qr/reviews/${reviewId}/ai-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.error) {
        addToast(data.message || 'Failed to generate AI reply', 'error');
      } else {
        setReplyDraft(data.reply || '');
        addToast('AI suggestion loaded!');
      }
    } catch (err) {
      addToast('Network error while generating AI reply.', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 1).toUpperCase();
  };

  const formatReviewDate = (dateStr) => {
    const d = new Date(dateStr);
    const optionsDate = { day: 'numeric', month: 'short' };
    const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
    return {
      date: d.toLocaleDateString('en-US', optionsDate),
      time: d.toLocaleTimeString('en-US', optionsTime)
    };
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5 text-[#FBBF24]">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i < rating ? 'fill-current' : 'text-slate-200'}`}
          />
        ))}
      </div>
    );
  };

  const getPublicUrl = () => {
    if (campaign && typeof window !== 'undefined') {
      return `${window.location.origin}/review/${campaign.token}`;
    }
    return '';
  };

  const handlePreviewLink = () => {
    const url = getPublicUrl();
    if (url) window.open(url, '_blank');
  };

  const totalReviewsCount = stats?.totalReviews || 0;
  const awaitingCount = stats?.newReviewsCount || 0;
  const repliedCount = totalReviewsCount - awaitingCount;

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 relative">
      
      {/* Inline styles for Drawer Translate, Value Change Animation & Scrollbar-none */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>

      {/* Floating Toasts container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-xl text-xs font-semibold text-slate-800 animate-slide-in-right"
          >
            <span className={t.type === 'success' ? 'text-emerald-500 text-sm' : 'text-red-500 text-sm'}>
              ✓
            </span>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Backdrop overlay for slide-over Drawer */}
      {selectedReview && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 transition-opacity animate-fade-in print:hidden"
          onClick={handleCancelReply}
        />
      )}

      {/* Slide-over drawer panel (Right on desktop, full-screen bottom sheet on mobile) */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ease-in-out transform ${
        selectedReview ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col justify-between h-full print:hidden`}>
        
        {selectedReview && (
          <>
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-[#1C2541]">Review Details</h3>
                <p className="text-[10px] text-slate-400 font-sans tracking-wide">Reply to feedback</p>
              </div>
              <button 
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition border border-transparent focus-visible:border-[#2563EB] outline-none min-h-[44px]"
                onClick={handleCancelReply}
                aria-label="Close reply panel"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              
              {/* Customer Review Info */}
              <div className="bg-[#FAF8F5] border border-[#E6DCD2] p-5 rounded-3xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  {renderStars(selectedReview.rating)}
                  <span className="text-[10px] text-slate-400 font-sans font-medium">
                    {formatReviewDate(selectedReview.created_at).date}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-serif italic text-left">
                  "{selectedReview.final_review}"
                </p>
              </div>

              {/* Reply Textarea Editor */}
              <div className="space-y-2">
                <label htmlFor="drawer-reply-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Your Reply
                </label>
                <textarea
                  id="drawer-reply-input"
                  rows="6"
                  className="w-full p-4 rounded-3xl bg-white border border-[#E6DCD2] text-xs text-slate-800 outline-none focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-blue-100 transition font-sans text-left"
                  placeholder="Type your response here..."
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                />
              </div>

              {/* AI generator assistance */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  className="w-full btn py-3.5 bg-slate-50 hover:bg-slate-100 hover:-translate-y-0.5 border border-[#E6DCD2] text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px]"
                  onClick={() => handleGenerateAiReply(selectedReview.id)}
                  disabled={aiGenerating}
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 fill-current" />
                  {aiGenerating ? 'Generating suggestions...' : 'AI Suggest Reply'}
                </button>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-[#FAF8F5] flex justify-end gap-3">
              <button
                className="btn btn-secondary py-3.5 px-6 rounded-2xl text-xs font-semibold hover:-translate-y-0.5 transition min-h-[44px]"
                onClick={handleCancelReply}
                disabled={saveLoading || aiGenerating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary py-3.5 px-6 rounded-2xl text-xs font-bold text-white bg-[#2563EB] border-[#2563EB] hover:bg-blue-700 hover:-translate-y-0.5 transition shadow-md min-h-[44px]"
                onClick={() => handleSaveReply(selectedReview.id)}
                disabled={saveLoading || aiGenerating || !replyDraft.trim()}
              >
                {saveLoading ? 'Saving...' : 'Save Reply'}
              </button>
            </div>
          </>
        )}

      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold font-serif text-[#1C2541]">Customer Reviews</h2>
          <p className="text-xs text-slate-500 font-serif italic mt-0.5">
            Manage customer feedback and replies.
          </p>
        </div>
        <button 
          className="btn btn-secondary btn-sm flex items-center gap-1.5 self-start min-h-[44px]"
          onClick={fetchReviews}
          aria-label="Refresh reviews feed"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Empty Dashboard Card State if 0 reviews */}
      {!loading && totalReviewsCount === 0 ? (
        <div className="bg-white border border-[#E6DCD2] rounded-3xl p-16 text-center space-y-5">
          <div className="text-5xl">💬</div>
          <h3 className="text-lg font-bold text-slate-700">No reviews yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-serif italic">
            Share your QR code to start collecting feedback. Reviews submitted by customers will automatically appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Statistics Row Card */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Reviews */}
            <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-0.5 transition duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Total Reviews</span>
              <span className="text-3xl font-extrabold block mt-2 text-[#1C2541] font-sans">
                {totalReviewsCount}
              </span>
            </div>

            {/* Average Rating */}
            <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-0.5 transition duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Average Rating</span>
              <span className="text-3xl font-extrabold block mt-2 text-[#1C2541] font-sans flex items-baseline gap-0.5">
                {stats?.avgRating || '0.0'}<span className="text-xs text-slate-400 font-normal">/5</span>
              </span>
            </div>

            {/* Awaiting Replies */}
            <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-0.5 transition duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Awaiting Replies</span>
              <span className="text-3xl font-extrabold block mt-2 text-slate-500 font-sans">
                {awaitingCount}
              </span>
            </div>

            {/* Replied */}
            <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-0.5 transition duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Replied</span>
              <span className="text-3xl font-extrabold block mt-2 text-emerald-600 font-sans">
                {repliedCount}
              </span>
            </div>
          </div>

          {/* Filter pills bar */}
          <div className="bg-white border border-[#E6DCD2] p-4 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search reviews..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-[#FAF8F5] text-slate-800 border border-[#E6DCD2] rounded-xl outline-none focus-visible:border-[#2563EB] transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Pill Groups - Horizontally scrollable snap scroll on mobile */}
            <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory w-full md:w-auto justify-start md:justify-end pb-1 md:pb-0">
              
              {/* Rating Pills */}
              <div className="flex gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2] snap-start whitespace-nowrap">
                {['all', '5', '4', '3', '2', '1'].map((stars) => (
                  <button
                    key={stars}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition min-h-[32px] cursor-pointer ${
                      ratingFilter === stars
                        ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setRatingFilter(stars)}
                  >
                    {stars === 'all' ? 'All' : `${stars}★`}
                  </button>
                ))}
              </div>

              {/* Status Pills */}
              <div className="flex gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2] snap-start whitespace-nowrap">
                {[
                  { id: 'all', label: 'All Status' },
                  { id: 'awaiting', label: 'Awaiting' },
                  { id: 'replied', label: 'Replied' }
                ].map((s) => (
                  <button
                    key={s.id}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition min-h-[32px] cursor-pointer ${
                      statusFilter === s.id
                        ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setStatusFilter(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Sort Pills */}
              <div className="flex gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2] snap-start whitespace-nowrap">
                {[
                  { id: 'newest', label: 'Newest' },
                  { id: 'oldest', label: 'Oldest' }
                ].map((o) => (
                  <button
                    key={o.id}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition min-h-[32px] cursor-pointer ${
                      sortOrder === o.id
                        ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setSortOrder(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Inbox Feed List */}
          {loading ? (
            /* Pulsing loading skeleton cards */
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white border border-[#E6DCD2] rounded-3xl p-6 h-40 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                  </div>
                  <div className="h-3 bg-slate-200 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                  <div className="h-8 bg-slate-200 rounded w-1/4 self-end"></div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white border border-[#E6DCD2] rounded-3xl p-16 text-center space-y-4">
              <div className="text-5xl">💬</div>
              <h3 className="text-lg font-bold text-slate-700">No customer reviews found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-serif italic">
                No submissions match your filters or search terms.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const dateData = formatReviewDate(review.created_at);
                const hasReplied = review.business_reply && review.business_reply.trim();
                const reviewInitials = getInitials(review.customer_name);

                return (
                  <div 
                    key={review.id} 
                    className="bg-white border border-[#E6DCD2] rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 space-y-4 text-left"
                  >
                    
                    {/* Top Meta info */}
                    <div className="flex items-start justify-between gap-4">
                      
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm select-none">
                          {review.customer_name ? reviewInitials : <User className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">
                            {review.customer_name || 'Anonymous Customer'}
                          </h4>
                          <div className="flex gap-2 items-center text-[10px] text-slate-400 mt-0.5">
                            {renderStars(review.rating)}
                            <span>•</span>
                            <span>{dateData.date}</span>
                            <span>•</span>
                            <span>{dateData.time}</span>
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5">
                        {review.ai_suggestion && (
                          <span className="bg-blue-50 text-[#2563EB] border border-blue-100 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            🤖 AI Assisted
                          </span>
                        )}
                        {hasReplied ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Replied
                          </span>
                        ) : (
                          <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                            Awaiting Reply
                          </span>
                        )}
                      </div>

                    </div>

                    {/* Review text */}
                    <p className="text-xs text-slate-800 leading-relaxed font-serif italic pl-1 border-l-2 border-slate-100">
                      "{review.final_review}"
                    </p>

                    {/* Business reply or reply prompts */}
                    {hasReplied ? (
                      /* Repiled view */
                      <div className="bg-[#FAF8F5] border border-[#E6DCD2] rounded-2xl p-4 space-y-2 mt-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-200/50 pb-1.5 font-sans">
                          <span className="font-bold text-[#1C2541]">YOUR REPLY</span>
                          {review.reply_updated_at && (
                            <span className="font-serif italic text-slate-400">
                              Updated {formatReviewDate(review.reply_updated_at).date}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-sans">
                          {review.business_reply}
                        </p>
                        <div className="flex justify-end pt-1">
                          <button 
                            className="text-xs text-[#2563EB] hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer min-h-[44px]"
                            onClick={() => handleOpenReply(review)}
                          >
                            <Edit2 className="w-3 h-3" /> Edit Reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Prompt actions */
                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
                        <button
                          className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs min-h-[44px]"
                          onClick={() => handleOpenReply(review)}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Reply
                        </button>
                        <button
                          className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs bg-[#2563EB] border-[#2563EB] min-h-[44px]"
                          onClick={() => {
                            handleOpenReply(review);
                            handleGenerateAiReply(review.id);
                          }}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300 fill-current" /> AI Suggest Reply
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
