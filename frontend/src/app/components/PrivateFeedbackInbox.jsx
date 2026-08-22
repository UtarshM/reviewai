import React, { useState, useEffect } from 'react';

export default function PrivateFeedbackInbox({ currentBusiness }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentBusiness?.id) {
      fetchFeedbacks();
    }
  }, [currentBusiness]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('replydesk_auth_token');
      const res = await fetch(`/api/v1/business/${currentBusiness.id}/feedback`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedback || []);
      }
    } catch (err) {
      console.error('Fetch feedback error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4">
        <div className="text-5xl">📩</div>
        <h3 className="text-xl font-bold text-white">No Business Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select a business profile to view your private customer feedback inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
            Protected Public Rating
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-2">
            Private Customer Feedback Inbox
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Direct 1-3 star messages submitted by customers privately. Address issues directly to improve customer retention.
          </p>
        </div>
        <button
          onClick={fetchFeedbacks}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-4 py-2.5 rounded-xl border border-slate-700 text-xs transition"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Inbox'}
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Loading private feedback messages...</p>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <h4 className="text-lg font-bold text-white">No Complaints Received</h4>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            You have zero private negative feedback messages for {currentBusiness.name}. Your public 5-star ratings are protected!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center font-bold text-sm">
                    {fb.rating}★
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{fb.customer_name || 'Anonymous Customer'}</h4>
                    {fb.customer_phone && (
                      <p className="text-xs text-amber-400 font-mono">📞 {fb.customer_phone}</p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {new Date(fb.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-300 leading-relaxed">
                "{fb.message}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
