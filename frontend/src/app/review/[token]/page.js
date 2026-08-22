"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function PublicReviewPage() {
  const params = useParams();
  const token = params?.token;

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(0);              
  const [hoverRating, setHoverRating] = useState(0);    
  const [variants, setVariants] = useState([]);          
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(-1); 
  const [editorText, setEditorText] = useState('');      

  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState('idle');       

  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [fingerprint, setFingerprint] = useState('');
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchCampaignDetails();
      startTimeRef.current = Date.now();
      const fp = `${navigator.userAgent}-${navigator.language}-${window.screen.width}x${window.screen.height}`;
      setFingerprint(btoa(fp).substring(0, 32));
    }
  }, [token]);

  const fetchCampaignDetails = async () => {
    try {
      const response = await fetch(`/api/v1/public/campaign/${token}`);
      const data = await response.json();

      if (data.error) {
        setError(data.message || 'This review link is inactive or expired.');
      } else {
        setCampaign(data);

        if (data.behavior === 'redirect_immediate' && data.google_review_link) {
          window.location.href = getDirectReviewUrl(data.google_review_link);
        }

        fetch(`/api/v1/public/scan/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ browser_fingerprint: fingerprint })
        }).catch(err => console.error('Scan logging failed', err));
      }
    } catch (err) {
      setError('Failed to fetch business details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSelect = async (stars) => {
    if (isSubmitted || aiLoading) return;
    setRating(stars);
    setHoverRating(0); 
    setVariants([]);
    setSelectedVariantIndex(-1);
    setEditorText('');

    setAiLoading(true);
    setAiStage('generating');

    const fetchSuggestionsPromise = triggerSuggestions(stars, null);

    await new Promise((resolve) => setTimeout(resolve, 800));
    setAiStage('writing');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const suggestedVariants = await fetchSuggestionsPromise;

    setAiLoading(false);
    setAiStage('idle');

    if (suggestedVariants && suggestedVariants.length > 0) {
      setVariants(suggestedVariants);
    }
  };

  const triggerSuggestions = async (stars, modifierText = null) => {
    try {
      const response = await fetch('/api/v1/public/review/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.campaign_id,
          rating: stars,
          liked_aspects: '',
          modifier: modifierText,
          previous_suggestion: editorText
        })
      });

      const data = await response.json();

      if (data.variants && data.variants.length > 0) {
        return data.variants;
      } else if (data.suggestion) {
        return [
          { label: 'Friendly', text: data.suggestion },
          { label: 'Professional', text: data.suggestion + ' Highly recommended.' },
          { label: 'Detailed', text: data.suggestion + ' The attention to detail was exceptional.' }
        ];
      }
    } catch (e) {
      console.error('Fetch review suggestions error:', e);
    }
    return [];
  };

  const handleSelectVariant = (index, text) => {
    setSelectedVariantIndex(index);
    setEditorText(text);
  };

  const handleSubmit = async () => {
    const finalReviewText = editorText.trim();
    if (!finalReviewText || submitting) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(finalReviewText);
      }
    } catch (clipErr) {
      console.error('Clipboard copy failed:', clipErr);
    }

    setSubmitting(true);
    const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;

    try {
      const response = await fetch('/api/v1/public/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.campaign_id,
          rating,
          ai_suggestion: variants[selectedVariantIndex]?.text || '',
          final_review: finalReviewText,
          time_to_complete: duration,
          browser_fingerprint: fingerprint
        })
      });

      const data = await response.json();
      if (data.error) {
        alert(data.message);
        setSubmitting(false);
        return;
      }

      setIsSubmitted(true);

      if (redirectUrl) {
        setTimeout(() => {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = redirectUrl;
          } else {
            window.open(redirectUrl, '_blank');
          }
        }, 2000);
      }
    } catch (e) {
      alert('Submission failed due to a network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (stars) => {
    switch (stars) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Great';
      case 5: return 'Excellent';
      default: return '';
    }
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getDirectReviewUrl = (url) => {
    if (!url) return null;
    if (url.includes('search.google.com/local/writereview')) return url;

    const placeIdMatch = url.match(/place_id=([^&]+)/i);
    if (placeIdMatch) {
      return `https://search.google.com/local/writereview?placeid=${placeIdMatch[1]}`;
    }

    const cleanUrl = url.split('#')[0];
    return `${cleanUrl}#write-review`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--c-edf2fb)] flex flex-col items-center justify-center text-[var(--color-ink-dark)] font-sans">
        <span className="material-symbols-outlined text-4xl animate-spin text-[var(--color-sage-accent)]">sync</span>
        <p className="text-xs font-semibold tracking-wider text-[var(--color-ink-light)] uppercase mt-2">Loading review station...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--c-edf2fb)] flex flex-col items-center justify-center text-[var(--color-ink-dark)] p-6 text-center font-sans">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-base font-bold text-red-600 mb-2">Review Campaign Unavailable</h2>
        <p className="max-w-md text-xs text-[var(--color-ink-light)] italic">{error}</p>
      </div>
    );
  }

  const initials = getInitials(campaign.business_name);
  const locationParts = [campaign.city, campaign.state, campaign.country].filter(Boolean);

  const hasGoogleLink = campaign.google_review_link && campaign.google_review_link.trim() !== '';
  let redirectUrl = null;
  if (hasGoogleLink) {
    redirectUrl = getDirectReviewUrl(campaign.google_review_link);
  } else if (campaign.business_name || locationParts.length > 0) {
    const fallbackQuery = [campaign.business_name, ...locationParts].filter(Boolean).join(' ');
    redirectUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}#write-review`;
  }

  const isSubmitReady = editorText.trim().length > 0;

  return (
    <div className="min-h-screen bg-[var(--c-edf2fb)] text-[var(--color-ink-dark)] font-sans pb-24 pt-12 px-4 flex flex-col items-center justify-start sm:justify-center overflow-x-hidden relative">
      
      {/* Brand Technology Attribution */}
      <div className="text-center mb-6 opacity-60">
        <span className="text-[10px] font-bold tracking-widest text-[var(--color-sage-accent)] uppercase">Reply Desk</span>
        <p className="text-[8px] text-[var(--color-ink-light)] uppercase tracking-wider mt-0.5">AI-Powered Review Assistant</p>
      </div>

      {/* Main Review Card Shell */}
      <div className="w-full max-w-sm bg-white border border-[var(--c-ccdbfd)] rounded-3xl shadow-xl p-6 space-y-6 flex flex-col items-center">

        {!isSubmitted ? (
          <>
            {/* Logo / Initials Avatar */}
            <div className="flex justify-center pt-2">
              {campaign.qr_logo ? (
                <div className="w-16 h-16 rounded-full bg-white border border-[var(--c-ccdbfd)] flex items-center justify-center shadow-md overflow-hidden">
                  <img src={campaign.qr_logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--color-sage-accent)] to-indigo-600 border-4 border-white text-white flex items-center justify-center font-bold text-lg shadow-md font-sans tracking-wide">
                  {initials}
                </div>
              )}
            </div>

            {/* Business Identity */}
            <div className="text-center space-y-1.5 w-full px-2">
              <h2 className="text-lg font-bold text-[var(--color-ink-dark)] font-sans tracking-tight leading-tight">
                {campaign.business_name}
              </h2>

              <div className="flex justify-center">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  ✓ Verified Business
                </span>
              </div>

              <div className="text-[10px] text-[var(--color-ink-light)] capitalize font-semibold tracking-wide">
                <span>{campaign.business_category}</span>
                {locationParts.length > 0 && ` • ${locationParts.join(', ')}`}
              </div>

              <p className="text-xs font-bold text-[var(--color-ink-dark)] font-sans pt-2">
                How was your visit today?
              </p>
            </div>

            {/* Stars Intake */}
            <div className="flex flex-col items-center space-y-2 w-full">
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Rate ${star} stars`}
                      className="outline-none transition duration-150 transform hover:scale-110 active:scale-95 cursor-pointer w-10 h-10 flex items-center justify-center"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleRatingSelect(star)}
                    >
                      <svg 
                        className="w-8 h-8 transition-colors duration-150"
                        viewBox="0 0 24 24"
                        fill={isFilled ? "var(--color-gold-star)" : "none"}
                        stroke={isFilled ? "var(--color-gold-star)" : "#CBD5E1"}
                        strokeWidth="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-[var(--color-ink-medium)] font-sans tracking-wider min-h-[16px]">
                {rating > 0 ? getRatingLabel(rating) : "Tap a star to rate"}
              </span>
            </div>

            {/* AI Loading Stages */}
            {aiLoading && (
              <div className="bg-[var(--c-edf2fb)] border border-[var(--c-ccdbfd)] rounded-2xl p-5 text-center space-y-2 animate-pulse w-full">
                <div className="text-xs text-[var(--color-sage-accent)] font-bold flex items-center justify-center gap-1.5 font-sans">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                  {aiStage === 'generating' ? 'Generating review...' : '✨ AI is writing...'}
                </div>
                <p className="text-[10px] text-[var(--color-ink-light)] italic">
                  Crafting 3 tailored review drafts for you...
                </p>
              </div>
            )}

            {/* Suggested Drafts section */}
            {!aiLoading && rating > 0 && variants.length > 0 && (
              <div className="space-y-3 w-full text-left pt-2 border-t border-[var(--c-ccdbfd)]">
                <span className="text-[10px] text-[var(--color-ink-light)] font-bold tracking-wide uppercase block px-1">
                  Select a draft suggestion to edit
                </span>
                <div className="flex gap-3 overflow-x-auto pb-3 pt-0.5 -mx-6 px-6 scrollbar-none snap-x snap-mandatory">
                  {variants.map((v, idx) => {
                    const isSelected = selectedVariantIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`flex-shrink-0 w-[240px] p-4 text-xs text-left rounded-2xl border transition-all duration-200 relative cursor-pointer flex flex-col snap-align-start ${
                          isSelected
                            ? 'bg-[var(--c-edf2fb)] border-[var(--color-sage-accent)] text-[var(--color-ink-dark)] ring-2 ring-blue-100'
                            : 'bg-slate-50/50 border-[var(--c-ccdbfd)] text-[var(--color-ink-medium)] hover:bg-slate-100/50'
                        }`}
                        onClick={() => handleSelectVariant(idx, v.text)}
                      >
                        <p className="font-serif italic leading-relaxed pr-6 text-[11px] select-none">"{v.text}"</p>
                        {isSelected && (
                          <span className="absolute top-4 right-4 text-[var(--color-sage-accent)]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Low-rating Handling Banner */}
            {!aiLoading && rating > 0 && rating <= 2 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-left space-y-1 w-full shadow-sm">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Direct Feedback</span>
                <p className="text-xs text-red-900 italic leading-relaxed">
                  We're sorry to hear about your experience. Please let us know what went wrong so we can address your concerns.
                </p>
              </div>
            )}

            {/* Review Editor Textarea */}
            {rating > 0 && (
              <div className="space-y-4 w-full pt-2 border-t border-[var(--c-ccdbfd)]">
                <div className="bg-white border border-[var(--c-ccdbfd)] p-3.5 rounded-2xl w-full shadow-inner">
                  <textarea
                    rows={4}
                    className="w-full bg-transparent text-sm text-[var(--color-ink-dark)] outline-none leading-relaxed resize-none text-left"
                    value={editorText}
                    onChange={(e) => setEditorText(e.target.value)}
                    placeholder={
                      rating <= 2 
                        ? "Tell us what went wrong. Your feedback helps us improve." 
                        : "Select an AI suggested draft above or type your own review here..."
                    }
                  />
                </div>

                {/* Submit Action Button */}
                <button
                  className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
                    isSubmitReady 
                      ? "bg-[var(--color-sage-accent)] hover:bg-[var(--color-sage-hover)] text-white shadow-sm" 
                      : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
                  onClick={handleSubmit}
                  disabled={submitting || !isSubmitReady}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                  <span>Submit review</span>
                </button>

              </div>
            )}
          </>
        ) : (
          /* Thank You Celebration Screen */
          <div className="text-center space-y-6 py-6 text-[var(--color-ink-dark)] w-full flex flex-col items-center">
            <div className="flex justify-center">
              <svg className="w-16 h-16 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold font-sans">🎉 Thank you!</h3>
              <p className="text-xs text-[var(--color-ink-medium)] max-w-xs mx-auto leading-relaxed">
                Your review has been saved. We copied your review text to the clipboard so you can easily paste it.
              </p>
            </div>

            {redirectUrl ? (
              <div className="bg-[var(--c-edf2fb)] p-5 rounded-2xl border border-[var(--c-ccdbfd)] space-y-4 w-full max-w-sm mx-auto shadow-inner flex flex-col items-center">
                <p className="text-[9px] text-[var(--color-ink-medium)] font-sans leading-normal font-semibold text-center uppercase tracking-wider">
                  Copied your review — just paste it on Google
                </p>
                <div className="text-xs text-[var(--color-sage-accent)] font-bold flex items-center justify-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                  Redirecting you to Google Maps...
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--color-ink-light)] italic text-center">
                Your feedback has been saved internally.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
