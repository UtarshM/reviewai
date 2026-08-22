"use client";

import React, { useState, useEffect } from 'react';

export default function ReplyTab({ activeBusiness, token, onGenerationSuccess }) {
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [tone, setTone] = useState('friendly');
  const [context, setContext] = useState('');
  const [variants, setVariants] = useState([]);
  const [generationId, setGenerationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const [googleReviews, setGoogleReviews] = useState([]);
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [showReviewsDropdown, setShowReviewsDropdown] = useState(false);

  const handleFetchReviews = async () => {
    setFetchingReviews(true);
    setReviewsError('');
    setShowReviewsDropdown(true);
    try {
      const response = await fetch(`/api/v1/businesses/${activeBusiness.id}/google-reviews`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFetchingReviews(false);
      if (data.error) { setReviewsError(data.message || 'Failed to fetch reviews'); return; }
      setGoogleReviews(data.reviews || []);
    } catch (err) {
      setFetchingReviews(false);
      setReviewsError('Network error.');
    }
  };

  const handleSelectGoogleReview = (rev) => {
    setCustomerName(rev.customer_name);
    setRating(rev.rating);
    setReviewText(rev.review_text);
    setShowReviewsDropdown(false);
  };

  useEffect(() => {
    if (activeBusiness) setTone(activeBusiness.tone_default || 'friendly');
  }, [activeBusiness]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true); setVariants([]); setGenerationId(null); setCopiedIndex(null);
    try {
      const response = await fetch('/api/v1/replies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ business_id: activeBusiness.id, customer_name: customerName, rating, review_text: reviewText, tone, context })
      });
      const data = await response.json();
      setLoading(false);
      if (data.error) { setError(data.message || 'Generation failed'); return; }
      setVariants(data.variants || []);
      setGenerationId(data.id);
      onGenerationSuccess(data.pacing_warning, data.daily_count);
    } catch (err) {
      setLoading(false);
      setError('Failed to connect to generation service.');
    }
  };

  const handleCopyVariant = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      alert('Could not copy to clipboard.');
    }
    if (generationId) {
      try {
        await fetch(`/api/v1/history/reply/${generationId}/text`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ text }) });
        await fetch(`/api/v1/history/reply/${generationId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: 'posted' }) });
      } catch (err) { console.error('Failed to update variant:', err); }
    }
  };

  const fieldClass = "w-full text-body-sm px-md py-2.5 border border-outline-variant rounded-lg bg-surface focus:border-primary outline-none transition";

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-end pb-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">AI Replies</h1>
          <p className="font-body-md text-on-surface-variant">Generate context-aware review replies instantly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Form Container */}
        <div className="lg:col-span-6 glass-card p-lg rounded-2xl space-y-md">
          <div className="flex justify-between items-center pb-sm border-b border-outline-variant">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary">rate_review</span>
              <span className="font-label-md font-bold uppercase tracking-wider text-on-surface">Review Details</span>
            </div>
            <button
              type="button"
              className="flex items-center gap-xs px-md py-1 bg-surface-bright border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              onClick={handleFetchReviews}
              disabled={fetchingReviews}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="text-xs">{fetchingReviews ? 'Pulling...' : 'Pull from Google'}</span>
            </button>
          </div>

          {showReviewsDropdown && (
            <div className="border border-outline-variant rounded-xl p-md bg-surface-container-low">
              <div className="flex justify-between items-center mb-sm">
                <span className="font-label-sm text-on-surface">Select a Google Review</span>
                <button type="button" onClick={() => setShowReviewsDropdown(false)} className="text-on-surface-variant hover:text-error cursor-pointer">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              {fetchingReviews && <p className="text-body-sm text-on-surface-variant">Loading reviews...</p>}
              {reviewsError && <p className="text-body-sm text-error">{reviewsError}</p>}
              {!fetchingReviews && !reviewsError && googleReviews.length === 0 && <p className="text-body-sm text-on-surface-variant">No reviews found.</p>}
              {!fetchingReviews && !reviewsError && googleReviews.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-md pr-xs">
                  {googleReviews.map((rev, i) => (
                    <div key={i} onClick={() => handleSelectGoogleReview(rev)}
                      className="p-md border border-outline-variant rounded-lg cursor-pointer bg-surface hover:bg-surface-container-high transition text-left">
                      <div className="flex justify-between items-center mb-xs">
                        <span className="font-label-md text-on-surface font-semibold">{rev.customer_name}</span>
                        <span className="text-[var(--gold)] text-xs">{'★'.repeat(rev.rating)}</span>
                      </div>
                      <p className="font-body-sm text-on-surface-variant truncate">"{rev.review_text || '(No text review)'}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Customer Name</label>
              <input type="text" required placeholder="e.g., Sarah Jenkins" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={loading} className={fieldClass} />
            </div>

            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Star Rating</label>
              <div className="flex gap-sm text-2xl">
                {[1, 2, 3, 4, 5].map((val) => (
                  <span key={val} className={`cursor-pointer transition-all ${rating >= val ? 'text-[var(--gold)] scale-110' : 'text-outline hover:text-[var(--gold)]'}`}
                    onClick={() => !loading && setRating(val)}>★</span>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Review Text</label>
              <textarea rows="4" required placeholder="Paste the customer's raw review here..." value={reviewText} onChange={(e) => setReviewText(e.target.value)} disabled={loading} className={fieldClass + " resize-y"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Override Tone</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={loading} className={fieldClass}>
                  <option value="friendly">Warm & Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="direct">Direct / Concise</option>
                </select>
              </div>
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Extra Context (Optional)</label>
                <input type="text" placeholder="e.g., offered full refund" value={context} onChange={(e) => setContext(e.target.value)} disabled={loading} className={fieldClass} />
              </div>
            </div>

            <button type="submit" className="bg-primary text-on-primary font-label-md text-label-md w-full py-3 rounded-lg hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-sm disabled:opacity-50 cursor-pointer" disabled={loading}>
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {loading ? 'Generating draft replies...' : 'Generate Draft Replies'}
            </button>
          </form>
        </div>

        {/* Results Container */}
        <div className="lg:col-span-6 glass-card p-lg rounded-2xl flex flex-col min-h-[460px]">
          <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">verified</span>
              <span className="font-label-md font-bold uppercase tracking-wider text-on-surface">Generated Options</span>
            </div>
            <span className="font-label-sm text-on-surface-variant">Choose a variant</span>
          </div>

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-3xl">
              <span className="material-symbols-outlined text-[32px] text-primary animate-spin">sync</span>
              <p className="text-body-sm text-on-surface-variant mt-md">Drafting responses on the desk...</p>
            </div>
          )}

          {error && (
            <div className="bg-error-container border border-error/20 text-on-error-container p-md rounded-xl text-body-sm font-medium mb-md">
              {error}
            </div>
          )}

          {!loading && variants.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-3xl">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-lg">
                <span className="material-symbols-outlined text-on-surface-variant text-3xl">mail</span>
              </div>
              <h4 className="font-headline-md text-[16px] text-on-surface mb-xs">No drafts generated yet</h4>
              <p className="font-body-sm text-on-surface-variant max-w-xs leading-relaxed">
                Complete the details on the left, then click Generate to create tailored options.
              </p>
            </div>
          )}

          {!loading && variants.length > 0 && (
            <div className="space-y-lg flex-1">
              {variants.map((v, i) => {
                const wc = v.text.split(/\s+/).filter(w => w.length > 0).length;
                return (
                  <div key={i} className="border border-outline-variant rounded-xl p-lg bg-surface-container-low space-y-md hover:border-outline transition">
                    <div className="flex justify-between items-center">
                      <span className="font-label-sm text-primary uppercase font-bold tracking-wider">{v.label || `Option ${i + 1}`}</span>
                      <span className="font-label-sm text-on-surface-variant">{wc} words</span>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary">
                      <p className="font-body-sm text-on-surface leading-relaxed italic">
                        "{v.text}"
                      </p>
                    </div>
                    <div className="flex justify-between items-center pt-xs">
                      {activeBusiness?.google_review_link ? (
                        <a href={activeBusiness.google_review_link} target="_blank" rel="noreferrer"
                          className="font-label-sm text-primary hover:underline flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[16px]">link</span>
                          <span>Go to Google Reviews</span>
                        </a>
                      ) : (
                        <span className="font-label-sm text-[var(--gold)]">⚠️ No review link saved</span>
                      )}
                      <button
                        className={`btn font-label-md text-label-md rounded-lg px-md py-sm ${copiedIndex === i ? 'bg-secondary text-on-secondary' : 'btn-secondary'}`}
                        onClick={() => handleCopyVariant(v.text, i)}
                      >
                        {copiedIndex === i ? '✓ Copied!' : 'Select & Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
