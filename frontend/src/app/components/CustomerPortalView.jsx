import React, { useState, useEffect } from 'react';

export default function CustomerPortalView({ slug }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [rating, setRating] = useState(5);
  const [highlights, setHighlights] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reviewOptions, setReviewOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  
  // Feedback state for 1-3 stars
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackPhone, setFeedbackPhone] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchBusiness();
  }, [slug]);

  const fetchBusiness = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/public/business/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        throw new Error('Business profile not found');
      }
      const data = await res.json();
      setBusiness(data);
      // Auto-generate 5 reviews for 5-star rating on load
      generateReviewOptions(data.name, data.category, 5);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReviewOptions = async (bName, bCategory, bRating, bHighlights = '') => {
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/public/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: bName,
          category: bCategory,
          rating: bRating,
          userHighlights: bHighlights
        })
      });
      const data = await res.json();
      if (data.options && data.options.length > 0) {
        setReviewOptions(data.options);
        setSelectedOptionId(data.options[0].id);
      }
    } catch (err) {
      console.error('Failed to generate reviews:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRatingChange = (newRating) => {
    setRating(newRating);
    if (newRating >= 4 && business) {
      generateReviewOptions(business.name, business.category, newRating, highlights);
    }
  };

  const handleCopyAndRedirect = (optionText, optId) => {
    navigator.clipboard.writeText(optionText);
    setCopiedId(optId);

    setTimeout(() => {
      setCopiedId(null);
      const googleUrl = business?.google_review_link || 'https://search.google.com/local/writereview';
      window.open(googleUrl, '_blank');
    }, 1000);
  };

  const handlePrivateFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;

    setSubmittingFeedback(true);
    try {
      const res = await fetch('/api/v1/public/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          customerName: feedbackName,
          customerPhone: feedbackPhone,
          rating,
          message: feedbackMsg
        })
      });
      if (res.ok) {
        setFeedbackSubmitted(true);
      }
    } catch (err) {
      console.error('Submit feedback error:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-medium">Loading Business Profile...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-white mb-2">Business Profile Not Found</h2>
          <p className="text-slate-400 mb-6">The review link you scanned may be incorrect or no longer active.</p>
          <a href="/" className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">

        {/* Business Header Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center shadow-xl backdrop-blur">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 rounded-2xl flex items-center justify-center text-3xl font-extrabold mx-auto shadow-lg mb-3">
            {business.name ? business.name.charAt(0).toUpperCase() : '★'}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{business.name}</h1>
          <p className="text-sm font-medium text-amber-400 mt-1 uppercase tracking-wider">
            {business.category} {business.city ? `• ${business.city}` : ''}
          </p>
          <p className="text-slate-400 text-sm mt-2">How was your visit today?</p>
        </div>

        {/* Star Rating Picker */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Tap to Rate
          </label>
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingChange(star)}
                className={`text-4xl sm:text-5xl transition-transform transform active:scale-125 focus:outline-none ${
                  star <= rating ? 'text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]' : 'text-slate-700'
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {rating >= 4 ? 'Great! Pick an AI-crafted review option below to post on Google.' : 'We value your feedback. Tell us how we can improve.'}
          </p>
        </div>

        {/* 4 or 5 Star Flow: 5 AI Review Options */}
        {rating >= 4 ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>✨ 5 AI Review Options</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Select a review text to copy and post to Google</p>
              </div>
              <button
                onClick={() => generateReviewOptions(business.name, business.category, rating, highlights)}
                disabled={generating}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition disabled:opacity-50"
              >
                {generating ? 'Refreshing...' : '🔄 Refresh AI'}
              </button>
            </div>

            {generating ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-medium text-slate-400">Drafting 5 unique customer review suggestions...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewOptions.map((opt, idx) => {
                  const isCopied = copiedId === opt.id;
                  return (
                    <div
                      key={opt.id || idx}
                      className="bg-slate-800/80 border border-slate-700 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          {opt.tag || `Option ${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">5-Star Review</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed mb-4">{opt.text}</p>
                      
                      <button
                        onClick={() => handleCopyAndRedirect(opt.text, opt.id)}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md ${
                          isCopied
                            ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                            : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300'
                        }`}
                      >
                        <span>{isCopied ? '✓ Copied! Opening Google...' : '📋 Copy Review & Post to Google'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* 1 to 3 Star Flow: Private Feedback Gate */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-1">Send Private Feedback</h3>
            <p className="text-xs text-slate-400 mb-4">
              We are sorry we didn't meet your expectations. Your message will be sent directly to the owner.
            </p>

            {feedbackSubmitted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-2">
                <div className="text-4xl">🙏</div>
                <h4 className="text-base font-bold text-emerald-400">Thank You For Your Feedback</h4>
                <p className="text-xs text-slate-300">
                  Your message has been sent directly to management. We appreciate your input and hope to serve you better next time.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePrivateFeedbackSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="e.g. John Miller"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Your Phone / Email (Optional)</label>
                  <input
                    type="text"
                    value={feedbackPhone}
                    onChange={(e) => setFeedbackPhone(e.target.value)}
                    placeholder="So we can contact you to fix this"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">What went wrong?</label>
                  <textarea
                    rows={4}
                    required
                    value={feedbackMsg}
                    onChange={(e) => setFeedbackMsg(e.target.value)}
                    placeholder="Please let us know how we can make things right..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingFeedback || !feedbackMsg.trim()}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-bold py-3 px-4 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {submittingFeedback ? 'Sending Privately...' : '✉️ Send Private Feedback to Owner'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="text-center py-4">
        <p className="text-[11px] text-slate-500 font-medium">
          Powered by <span className="text-amber-400 font-semibold">ReplyDesk AI</span> • Smart Review Acquisition
        </p>
      </div>
    </div>
  );
}
