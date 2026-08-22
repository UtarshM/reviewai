"use client";

import React, { useState } from 'react';

export default function ReviewTab({ activeBusiness, token, onGenerationSuccess }) {
  const [rating, setRating] = useState(5);
  const [liked, setLiked] = useState('');
  const [disliked, setDisliked] = useState('');
  const [tone, setTone] = useState('friendly');
  const [variants, setVariants] = useState([]);
  const [generationId, setGenerationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setVariants([]);
    setGenerationId(null);
    setCopiedIndex(null);

    try {
      const response = await fetch('/api/v1/reviews/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_id: activeBusiness.id,
          rating,
          liked,
          disliked,
          tone
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
        await fetch(`/api/v1/history/review/${generationId}/text`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text })
        });
        await fetch(`/api/v1/history/review/${generationId}/status`, {
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
        <h3>Customer Experience Intake</h3>
        <form id="review-generator-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Target Star Rating</label>
            <div className="star-rating" id="review-star-picker">
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
            <label htmlFor="review-liked">What did the customer like?</label>
            <textarea
              id="review-liked"
              rows="3"
              required
              placeholder="e.g., the sourdough bread, very fast service, friendly cashier"
              value={liked}
              onChange={(e) => setLiked(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="review-disliked">What did they dislike? (Optional)</label>
            <textarea
              id="review-disliked"
              rows="3"
              placeholder="e.g., parking was a bit tight, table was wobbly"
              value={disliked}
              onChange={(e) => setDisliked(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="review-tone">Tone / Voice</label>
            <div className="select-wrapper">
              <select
                id="review-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={loading}
              >
                <option value="friendly">Casual & Friendly</option>
                <option value="professional">Polished / Business-like</option>
                <option value="direct">Direct & Plainspoken</option>
                <option value="empathetic">Enthusiastic</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            id="btn-generate-reviews"
            disabled={loading}
          >
            {loading ? 'Drafting...' : 'Generate Review Drafts'}
          </button>
        </form>
      </div>

      {/* Variants Results Output */}
      <div className="card results-card">
        <div className="results-header">
          <h3>Generated Review Drafts</h3>
          <span className="results-hint">Hand a variant to the customer to edit or post</span>
        </div>

        {loading && (
          <div id="review-loading" className="spinner-overlay">
            <div className="spinner"></div>
            <p>Drafting review options in customer's voice...</p>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        {!loading && variants.length === 0 && (
          <div id="review-placeholder" className="results-placeholder">
            <span className="placeholder-icon">📝</span>
            <p>Fill in what the customer liked and experienced, then click Generate to draft 3 honest variants.</p>
          </div>
        )}

        {!loading && variants.length > 0 && (
          <div id="review-variants-container" className="variants-container">
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
                        🔗 Customer Review Link
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
