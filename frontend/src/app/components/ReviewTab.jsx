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
    setError(''); setLoading(true); setVariants([]); setGenerationId(null); setCopiedIndex(null);
    try {
      const response = await fetch('/api/v1/reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ business_id: activeBusiness.id, rating, liked, disliked, tone })
      });
      const data = await response.json();
      setLoading(false);
      if (data.error) { setError(data.message || 'Failed'); return; }
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
    } catch (err) { alert('Could not copy.'); }
    if (generationId) {
      try {
        await fetch(`/api/v1/history/review/${generationId}/text`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ text }) });
        await fetch(`/api/v1/history/review/${generationId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: 'posted' }) });
      } catch (err) { console.error('Update failed:', err); }
    }
  };

  const fieldClass = "w-full text-body-sm px-md py-2.5 border border-outline-variant rounded-lg bg-surface focus:border-primary outline-none transition";

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-end pb-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Review Drafts</h1>
          <p className="font-body-md text-on-surface-variant">Draft custom customer reviews based on specific experiences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Form Container */}
        <div className="lg:col-span-6 glass-card p-lg rounded-2xl space-y-md">
          <div className="flex items-center gap-sm pb-sm border-b border-outline-variant mb-md">
            <span className="material-symbols-outlined text-primary">edit_note</span>
            <span className="font-label-md font-bold uppercase tracking-wider text-on-surface">Experience Intake</span>
          </div>

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Target Star Rating</label>
              <div className="flex gap-sm text-2xl">
                {[1, 2, 3, 4, 5].map((val) => (
                  <span key={val} className={`cursor-pointer transition-all ${rating >= val ? 'text-[var(--gold)] scale-110' : 'text-outline hover:text-[var(--gold)]'}`}
                    onClick={() => !loading && setRating(val)}>★</span>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">What did they like?</label>
              <textarea rows="3" required placeholder="e.g., the sourdough bread, very fast service, friendly cashier" value={liked} onChange={(e) => setLiked(e.target.value)} disabled={loading} className={fieldClass + " resize-y"} />
            </div>

            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">What did they dislike? (Optional)</label>
              <textarea rows="3" placeholder="e.g., parking was a bit tight" value={disliked} onChange={(e) => setDisliked(e.target.value)} disabled={loading} className={fieldClass + " resize-y"} />
            </div>

            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Tone / Voice</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={loading} className={fieldClass}>
                <option value="friendly">Casual & Friendly</option>
                <option value="professional">Polished / Business-like</option>
                <option value="direct">Direct & Plainspoken</option>
                <option value="empathetic">Enthusiastic</option>
              </select>
            </div>

            <button type="submit" className="bg-primary text-on-primary font-label-md text-label-md w-full py-3 rounded-lg hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-sm disabled:opacity-50 cursor-pointer" disabled={loading}>
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {loading ? 'Drafting customer reviews...' : 'Generate Review Drafts'}
            </button>
          </form>
        </div>

        {/* Results Container */}
        <div className="lg:col-span-6 glass-card p-lg rounded-2xl flex flex-col min-h-[460px]">
          <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">verified</span>
              <span className="font-label-md font-bold uppercase tracking-wider text-on-surface">Generated Review Drafts</span>
            </div>
            <span className="font-label-sm text-on-surface-variant">Hand to customer</span>
          </div>

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-3xl">
              <span className="material-symbols-outlined text-[32px] text-primary animate-spin">sync</span>
              <p className="text-body-sm text-on-surface-variant mt-md">Drafting options in customer's voice...</p>
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
                <span className="material-symbols-outlined text-on-surface-variant text-3xl">edit</span>
              </div>
              <h4 className="font-headline-md text-[16px] text-on-surface mb-xs">No drafts generated yet</h4>
              <p className="font-body-sm text-on-surface-variant max-w-xs leading-relaxed">
                Fill in the customer's experience on the left, then click Generate to draft variants.
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
                          <span>Customer Review Link</span>
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
