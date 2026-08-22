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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setFetchingReviews(false);
      if (data.error) {
        setReviewsError(data.message || 'Failed to fetch reviews');
        return;
      }
      setGoogleReviews(data.reviews || []);
    } catch (err) {
      setFetchingReviews(false);
      setReviewsError('Network error. Failed to retrieve reviews.');
    }
  };

  const handleSelectGoogleReview = (rev) => {
    setCustomerName(rev.customer_name);
    setRating(rev.rating);
    setReviewText(rev.review_text);
    setShowReviewsDropdown(false);
  };

  // Set default tone when active business changes
  useEffect(() => {
    if (activeBusiness) {
      setTone(activeBusiness.tone_default || 'friendly');
    }
  }, [activeBusiness]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setVariants([]);
    setGenerationId(null);
    setCopiedIndex(null);

    try {
      const response = await fetch('/api/v1/replies/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_id: activeBusiness.id,
          customer_name: customerName,
          rating,
          review_text: reviewText,
          tone,
          context
        })
      });

      const data = await response.json();
      setLoading(false);

      if (data.error) {
        setError(data.message || 'Generation failed');
        return;
      }

      setVariants(data.variants || []);
      setGenerationId(data.id);
      onGenerationSuccess(data.pacing_warning, data.daily_count);
    } catch (err) {
      setLoading(false);
      setError('Failed to connect to generation service. Please check your network.');
    }
  };

  const handleCopyVariant = async (text, idx) => {
    // 1. Copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      alert('Could not copy to clipboard. Please copy text manually.');
    }

    // 2. Save choice to database history
    if (generationId) {
      try {
        await fetch(`/api/v1/history/reply/${generationId}/text`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text })
        });
        await fetch(`/api/v1/history/reply/${generationId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'posted' })
        });
      } catch (err) {
        console.error('Failed to update chosen variant in DB:', err);
      }
    }
  };

  return (
    <div className="grid-container">
      {/* Inputs Form */}
      <div className="card form-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>Review Details</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleFetchReviews}
            disabled={fetchingReviews}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            {fetchingReviews ? 'Fetching...' : '📥 Pull from Google'}
          </button>
        </div>

        {showReviewsDropdown && (
          <div className="google-reviews-panel" style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: 'var(--color-bg-neutral-light)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>Select Google Review:</span>
              <button 
                type="button" 
                onClick={() => setShowReviewsDropdown(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-ink-medium)' }}
              >
                &times;
              </button>
            </div>
            
            {fetchingReviews && <p style={{ fontSize: '12px', margin: '0' }}>Loading reviews from Google Maps...</p>}
            {reviewsError && <p style={{ fontSize: '12px', color: 'var(--color-status-error)', margin: '0' }}>{reviewsError}</p>}
            
            {!fetchingReviews && !reviewsError && googleReviews.length === 0 && (
              <p style={{ fontSize: '12px', margin: '0' }}>No reviews found for this business profile.</p>
            )}
            
            {!fetchingReviews && !reviewsError && googleReviews.length > 0 && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {googleReviews.map((rev, index) => (
                  <div 
                    key={index} 
                    onClick={() => handleSelectGoogleReview(rev)}
                    style={{
                      padding: '8px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--border-radius-sm)',
                      cursor: 'pointer',
                      backgroundColor: 'var(--color-card-bg)',
                      fontSize: '12px',
                      transition: 'background-color 0.2s'
                    }}
                    className="google-review-item-hover"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '2px' }}>
                      <span>{rev.customer_name}</span>
                      <span style={{ color: '#F59E0B' }}>{'★'.repeat(rev.rating)}</span>
                    </div>
                    <div style={{ 
                      color: 'var(--color-ink-medium)', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      {rev.review_text || '(No text review)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form id="reply-generator-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reply-customer">Customer Name</label>
            <input
              type="text"
              id="reply-customer"
              required
              placeholder="e.g., Sarah Jenkins"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Review Star Rating</label>
            <div className="star-rating" id="reply-star-picker">
              {[5, 4, 3, 2, 1].map((val) => (
                <span
                  key={val}
                  className={`star-picker-icon ${rating >= val ? 'active' : ''}`}
                  onClick={() => !loading && setRating(val)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="reply-text">Review Text</label>
            <textarea
              id="reply-text"
              rows="5"
              required
              placeholder="Paste the customer's raw review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid-2-col">
            <div className="form-group">
              <label htmlFor="reply-tone">Override Tone</label>
              <div className="select-wrapper">
                <select
                  id="reply-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  disabled={loading}
                >
                  <option value="friendly">Warm & Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="direct">Direct / Concise</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="reply-context">Extra Context (Optional)</label>
              <input
                type="text"
                id="reply-context"
                placeholder="e.g., we offered a full refund on this order"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            id="btn-generate-replies"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Draft Replies'}
          </button>
        </form>
      </div>

      {/* Variants Results Output */}
      <div className="card results-card">
        <div className="results-header">
          <h3>Generated Draft Options</h3>
          <span className="results-hint">Choose a draft to copy and track</span>
        </div>

        {loading && (
          <div id="reply-loading" className="spinner-overlay">
            <div className="spinner"></div>
            <p>Generating draft variants on the desk...</p>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        {!loading && variants.length === 0 && (
          <div id="reply-placeholder" className="results-placeholder">
            <span className="placeholder-icon">✉️</span>
            <p>Complete the review details and click Generate to see 3 tailored draft options.</p>
          </div>
        )}

        {!loading && variants.length > 0 && (
          <div id="reply-variants-container" className="variants-container">
            {variants.map((v, index) => {
              const wordCount = v.text.split(/\s+/).filter((w) => w.length > 0).length;
              return (
                <div key={index} className="variant-card">
                  <div className="variant-meta">
                    <span className="variant-label">{v.label || `Option ${index + 1}`}</span>
                    <span className="variant-word-count">{wordCount} words</span>
                  </div>
                  <div className="variant-text">{v.text}</div>
                  <div className="variant-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                    {activeBusiness?.google_review_link ? (
                      <a
                        href={activeBusiness.google_review_link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '8px', textDecoration: 'none' }}
                      >
                        🔗 Go to Google Reviews
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--color-ink-medium)', marginRight: 'auto', alignSelf: 'center' }}>
                        ⚠️ No review link saved.
                      </span>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCopyVariant(v.text, index)}
                      style={copiedIndex === index ? { backgroundColor: '#1D4ED8' } : {}}
                    >
                      {copiedIndex === index ? '✓ Copied!' : 'Select & Copy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
