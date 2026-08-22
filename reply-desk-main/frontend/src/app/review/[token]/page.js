// "use client";

// import React, { useState, useEffect, useRef } from 'react';
// import { useParams } from 'next/navigation';

// export default function PublicReviewPage() {
//   const params = useParams();
//   const token = params?.token;

//   const [campaign, setCampaign] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // Client-Side States
//   const [rating, setRating] = useState(0);              // Selected rating (0 to 5)
//   const [hoverRating, setHoverRating] = useState(0);    // Hover rating state
//   const [variants, setVariants] = useState([]);          // AI draft variations
//   const [selectedVariantIndex, setSelectedVariantIndex] = useState(-1); // Selected draft index (0=Friendly, 1=Professional, 2=Detailed)
//   const [editorText, setEditorText] = useState('');      // Review text in editor

//   // AI Loading
//   const [aiLoading, setAiLoading] = useState(false);
//   const [aiStage, setAiStage] = useState('idle');       // 'idle', 'generating', 'writing'

//   // Submission
//   const [submitting, setSubmitting] = useState(false);
//   const [isSubmitted, setIsSubmitted] = useState(false);

//   const [fingerprint, setFingerprint] = useState('');
//   const startTimeRef = useRef(null);

//   useEffect(() => {
//     if (token) {
//       fetchCampaignDetails();
//       startTimeRef.current = Date.now();
//       const fp = `${navigator.userAgent}-${navigator.language}-${window.screen.width}x${window.screen.height}`;
//       setFingerprint(btoa(fp).substring(0, 32));
//     }
//   }, [token]);

//   const fetchCampaignDetails = async () => {
//     try {
//       const response = await fetch(`/api/v1/public/campaign/${token}`);
//       const data = await response.json();

//       if (data.error) {
//         setError(data.message || 'This review link is inactive or expired.');
//       } else {
//         setCampaign(data);

//         // Immediate redirect option
//         if (data.behavior === 'redirect_immediate' && data.google_review_link) {
//           window.location.href = data.google_review_link;
//         }

//         // Log scan
//         fetch(`/api/v1/public/scan/${token}`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ browser_fingerprint: fingerprint })
//         }).catch(err => console.error('Scan logging failed', err));
//       }
//     } catch (err) {
//       setError('Failed to fetch business details.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleRatingSelect = async (stars) => {
//     if (isSubmitted || aiLoading) return;
//     setRating(stars);
//     setHoverRating(0); // Clear hover rating explicitly on selection
//     setVariants([]);
//     setSelectedVariantIndex(-1);
//     setEditorText('');

//     setAiLoading(true);
//     setAiStage('generating');

//     const fetchSuggestionsPromise = triggerSuggestions(stars, null);

//     // Staged animation duration
//     await new Promise((resolve) => setTimeout(resolve, 800));
//     setAiStage('writing');
//     await new Promise((resolve) => setTimeout(resolve, 1200));

//     const suggestedVariants = await fetchSuggestionsPromise;

//     setAiLoading(false);
//     setAiStage('idle');

//     if (suggestedVariants && suggestedVariants.length > 0) {
//       setVariants(suggestedVariants);
//     }
//   };

//   const triggerSuggestions = async (stars, modifierText = null) => {
//     try {
//       const response = await fetch('/api/v1/public/review/suggest', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           campaign_id: campaign.campaign_id,
//           rating: stars,
//           liked_aspects: '',
//           modifier: modifierText,
//           previous_suggestion: editorText
//         })
//       });

//       const data = await response.json();

//       if (data.variants && data.variants.length > 0) {
//         return data.variants;
//       } else if (data.suggestion) {
//         return [
//           { label: 'Friendly', text: data.suggestion },
//           { label: 'Professional', text: data.suggestion + ' Highly recommended.' },
//           { label: 'Detailed', text: data.suggestion + ' The attention to detail was exceptional.' }
//         ];
//       }
//     } catch (e) {
//       console.error('Fetch review suggestions error:', e);
//     }
//     return [];
//   };

//   const handleSelectVariant = (index, text) => {
//     setSelectedVariantIndex(index);
//     setEditorText(text);
//   };

//   const handleSubmit = async () => {
//     const finalReviewText = editorText.trim();
//     if (!finalReviewText || submitting) return;

//     // Secure clipboard copy directly inside the user gesture handler (before await)
//     try {
//       if (navigator.clipboard && navigator.clipboard.writeText) {
//         await navigator.clipboard.writeText(finalReviewText);
//       }
//     } catch (clipErr) {
//       console.error('Clipboard copy failed:', clipErr);
//     }

//     setSubmitting(true);

//     const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;

//     try {
//       const response = await fetch('/api/v1/public/review/submit', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           campaign_id: campaign.campaign_id,
//           rating,
//           ai_suggestion: variants[selectedVariantIndex]?.text || '',
//           final_review: finalReviewText,
//           time_to_complete: duration,
//           browser_fingerprint: fingerprint
//         })
//       });

//       const data = await response.json();
//       if (data.error) {
//         alert(data.message);
//         setSubmitting(false);
//         return;
//       }

//       setIsSubmitted(true);

//       // Delay redirect by 1.5s to show confirmation
//       if (redirectUrl) {
//         setTimeout(() => {
//           const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
//           if (isMobile) {
//             window.location.href = redirectUrl;
//           } else {
//             window.open(redirectUrl, '_blank');
//           }
//         }, 1500);
//       }
//     } catch (e) {
//       alert('Submission failed due to a network connection error.');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const getRatingLabel = (stars) => {
//     switch (stars) {
//       case 1: return 'Poor';
//       case 2: return 'Fair';
//       case 3: return 'Good';
//       case 4: return 'Great';
//       case 5: return 'Excellent';
//       default: return '';
//     }
//   };

//   // SVGs for Friendly (speech bubble), Professional (briefcase), and Detailed (document)
//   const renderStyleIcon = (label, isSelected) => {
//     const labelLower = (label || '').toLowerCase();
//     const strokeColor = isSelected ? '#2563EB' : '#64748B';

//     if (labelLower.includes('friendly')) {
//       return (
//         <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//           <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//         </svg>
//       );
//     }
//     if (labelLower.includes('prof')) {
//       return (
//         <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//           <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
//           <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
//         </svg>
//       );
//     }
//     return (
//       <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
//         <polyline points="14 2 14 8 20 8" />
//         <line x1="16" y1="13" x2="8" y2="13" />
//         <line x1="16" y1="17" x2="8" y2="17" />
//         <polyline points="10 9 9 9 8 9" />
//       </svg>
//     );
//   };

//   const getInitials = (name) => {
//     if (!name) return '';
//     const parts = name.trim().split(/\s+/);
//     if (parts.length >= 2) {
//       return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
//     }
//     return name.slice(0, 2).toUpperCase();
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center text-slate-800 font-sans" style={{ colorScheme: 'light' }}>
//         <div className="animate-spin text-4xl mb-4 text-[#2563EB]">✨</div>
//         <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-sans">Loading review station...</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center text-slate-800 p-6 text-center font-sans" style={{ colorScheme: 'light' }}>
//         <div className="text-5xl mb-4">🏪</div>
//         <h2 className="text-lg font-bold text-red-700 mb-2 font-sans">Review Campaign Unavailable</h2>
//         <p className="max-w-md text-xs text-slate-500 font-serif italic">{error}</p>
//       </div>
//     );
//   }

//   const initials = getInitials(campaign.business_name);
//   const locationParts = [campaign.city, campaign.state, campaign.country].filter(Boolean);

//   const hasGoogleLink = campaign.google_review_link && campaign.google_review_link.trim() !== '';
//   let redirectUrl = null;
//   if (hasGoogleLink) {
//     redirectUrl = campaign.google_review_link;
//   } else if (campaign.business_name || locationParts.length > 0) {
//     const fallbackQuery = [campaign.business_name, ...locationParts].filter(Boolean).join(' ');
//     redirectUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`;
//   }

//   // Submit Ready Check
//   const isSubmitReady = editorText.trim().length > 0;

//   return (
//     <div className="review-route min-h-screen bg-[#FAF8F5] text-slate-800 font-sans pb-24 pt-12 px-4 flex flex-col items-center justify-start sm:justify-center overflow-x-hidden relative" style={{ colorScheme: 'light' }}>

//       {/* Brand Technology Attribution */}
//       <div className="text-center mb-6 opacity-60">
//         <span className="text-[9px] font-bold tracking-widest text-[#2563EB] uppercase">RevMeAI</span>
//         <p className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">AI-Powered Review Assistant</p>
//       </div>

//       {/* Main Review Card Shell - Premium Light Mode */}
//       <div className="w-full max-w-sm bg-white border border-[#E6DCD2] rounded-[2rem] shadow-xl p-6 space-y-6 flex flex-col items-center">

//         {!isSubmitted ? (
//           <>
//             {/* Logo / Initials Avatar */}
//             <div className="flex justify-center pt-2">
//               {campaign.qr_logo ? (
//                 <div className="w-16 h-16 rounded-full bg-white border-2 border-[#E6DCD2] flex items-center justify-center shadow-lg overflow-hidden">
//                   <img src={campaign.qr_logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
//                 </div>
//               ) : (
//                 <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#2563EB] to-indigo-600 border-4 border-white text-white flex items-center justify-center font-bold text-lg shadow-lg font-sans tracking-wide">
//                   {initials}
//                 </div>
//               )}
//             </div>

//             {/* Business Identity */}
//             <div className="text-center space-y-1 w-full px-2">
//               <h2 className="text-xl font-bold text-[#1C2541] font-sans tracking-tight leading-tight">
//                 {campaign.business_name}
//               </h2>

//               <div className="flex justify-center">
//                 <span className="bg-[#EBF2ED] text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
//                   ✓ Verified Business
//                 </span>
//               </div>

//               {/* Category • Location (Single bullet-separated line) */}
//               <div className="text-[10px] text-slate-400 capitalize font-semibold tracking-wide">
//                 {campaign.business_category}
//                 {locationParts.length > 0 && ` • ${locationParts.join(', ')}`}
//               </div>

//               {/* Heading */}
//               <p className="text-xs font-bold text-slate-800 font-sans pt-2">
//                 How was your visit today?
//               </p>
//             </div>

//             {/* Stars Intake (Inline SVGs with warning/amber coloring) */}
//             <div className="flex flex-col items-center space-y-2 w-full">
//               <div className="flex gap-2.5 justify-center">
//                 {[1, 2, 3, 4, 5].map((star) => {
//                   const isFilled = (hoverRating || rating) >= star;
//                   return (
//                     <button
//                       key={star}
//                       type="button"
//                       aria-label={`Rate ${star} stars`}
//                       className="outline-none transition duration-150 transform hover:scale-125 active:scale-95 cursor-pointer w-11 h-11 flex items-center justify-center"
//                       onMouseEnter={() => setHoverRating(star)}
//                       onMouseLeave={() => setHoverRating(0)}
//                       onClick={() => handleRatingSelect(star)}
//                     >
//                       <svg 
//                         className={`w-8 h-8 transition-colors duration-150`}
//                         viewBox="0 0 24 24"
//                         fill={isFilled ? "#FF9800" : "none"}
//                         stroke={isFilled ? "#FF9800" : "#CBD5E1"}
//                         strokeWidth="2"
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                       >
//                         <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
//                       </svg>
//                     </button>
//                   );
//                 })}
//               </div>
//               <span className="text-xs text-slate-500 font-sans tracking-wider min-h-[16px]">
//                 {rating > 0 ? getRatingLabel(rating) : "Tap a star to rate"}
//               </span>
//             </div>

//             {/* AI Loading Stages */}
//             {aiLoading && (
//               <div className="bg-[#FAF6F0] border border-[#E6DCD2] rounded-2xl p-5 text-center space-y-2 animate-pulse w-full">
//                 <div className="text-xs text-[#2563EB] font-bold flex items-center justify-center gap-1.5 font-sans">
//                   <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
//                   {aiStage === 'generating' ? 'Generating review...' : '✨ AI is writing...'}
//                 </div>
//                 <p className="text-[10px] text-slate-400 font-serif italic">
//                   Crafting 3 tailored review drafts for you...
//                 </p>
//               </div>
//             )}

//             {/* Suggested Drafts section (Plain text cards, hidden until selected) */}
//             {!aiLoading && rating > 0 && variants.length > 0 && (
//               <div className="space-y-3 w-full text-left pt-2 border-t border-slate-100">
//                 <span className="text-xs text-slate-400 font-bold tracking-wide uppercase text-[10px] block px-2">
//                   Select a draft suggestion to edit
//                 </span>
//                 <div className="flex gap-3 overflow-x-auto pb-3 pt-0.5 -mx-6 px-6 scrollbar-none snap-x snap-mandatory">
//                   {variants.map((v, idx) => {
//                     const isSelected = selectedVariantIndex === idx;
//                     return (
//                       <button
//                         key={idx}
//                         type="button"
//                         className={`flex-shrink-0 w-[260px] p-4 text-xs text-left rounded-2xl border transition-all duration-200 relative cursor-pointer flex flex-col snap-align-start ${
//                           isSelected
//                             ? 'bg-blue-50/50 border-[#2563EB] text-slate-800 ring-2 ring-blue-100'
//                             : 'bg-slate-50/50 border-[#E6DCD2] text-slate-600 hover:bg-slate-100/50'
//                         }`}
//                         onClick={() => handleSelectVariant(idx, v.text)}
//                       >
//                         <p className="font-serif italic leading-relaxed pr-6 text-[11px] sm:text-xs select-none">"{v.text}"</p>
//                         {isSelected && (
//                           <span className="absolute top-4 right-4 text-[#2563EB] animate-scale-in">
//                             <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
//                               <polyline points="20 6 9 17 4 12" />
//                             </svg>
//                           </span>
//                         )}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>
//             )}

//             {/* Low-rating Handling Banner */}
//             {!aiLoading && rating > 0 && rating <= 2 && (
//               <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-left space-y-1 w-full">
//                 <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Direct Feedback</span>
//                 <p className="text-xs text-red-900 font-serif italic">
//                   We're sorry to hear about your experience. Please let us know what went wrong so we can address your concerns.
//                 </p>
//               </div>
//             )}

//             {/* Review Editor Textarea (pre-filled with selected draft, ~3-4 visible lines) */}
//             {rating > 0 && (
//               <div className="space-y-4 w-full pt-2 border-t border-slate-100">
//                 <div className="bg-white border border-[#E6DCD2] p-3.5 rounded-2xl w-full shadow-inner">
//                   <textarea
//                     rows={4}
//                     className="w-full bg-transparent text-base text-slate-800 outline-none leading-relaxed resize-none text-left"
//                     value={editorText}
//                     onChange={(e) => setEditorText(e.target.value)}
//                     placeholder={
//                       rating <= 2 
//                         ? "Tell us what went wrong. Your feedback helps us improve." 
//                         : "Select an AI suggested draft above or type your own review here..."
//                     }
//                   />
//                 </div>

//                 {/* Submit Action Button (Sentence case: "Submit review", dynamic visual states, paper-plane SVG) */}
//                 <button
//                   className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
//                     isSubmitReady 
//                       ? "bg-[#2563EB] hover:bg-blue-600 text-white" 
//                       : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none"
//                   }`}
//                   onClick={handleSubmit}
//                   disabled={submitting || !isSubmitReady}
//                 >
//                   <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
//                     <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
//                   </svg>
//                   Submit review
//                 </button>

//               </div>
//             )}
//           </>
//         ) : (
//           /* Thank You Celebration Screen with Redirect / Copy-paste Assist */
//           <div className="text-center space-y-6 py-6 text-slate-800 w-full flex flex-col items-center">
//             <div className="flex justify-center">
//               <svg className="w-16 h-16 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
//               </svg>
//             </div>

//             <div className="space-y-2">
//               <h3 className="text-2xl font-extrabold font-sans">🎉 Thank you!</h3>
//               <p className="text-xs text-slate-500 max-w-xs mx-auto font-serif italic leading-relaxed">
//                 Your review has been saved. We copied your review text to the clipboard so you can easily paste it.
//               </p>
//             </div>

//             {redirectUrl ? (
//               <div className="bg-[#FAF6F0] p-5 rounded-2xl border border-[#E6DCD2] space-y-4 w-full max-w-sm mx-auto shadow-inner flex flex-col items-center">
//                 <p className="text-[10px] text-slate-500 font-sans leading-normal font-semibold text-center uppercase tracking-wider">
//                   Copied your review — just paste it on Google
//                 </p>
//                 <div className="text-xs text-[#2563EB] font-bold flex items-center justify-center gap-1.5 animate-pulse">
//                   <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
//                   Redirecting you to Google Maps...
//                 </div>
//               </div>
//             ) : (
//               <p className="text-[10px] text-slate-400 font-serif italic text-center">
//                 Your feedback has been saved internally.
//               </p>
//             )}
//           </div>
//         )}

//       </div>
//     </div>
//   );
// }
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function PublicReviewPage() {
  const params = useParams();
  const token = params?.token;

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Client-Side States
  const [rating, setRating] = useState(0);              // Selected rating (0 to 5)
  const [hoverRating, setHoverRating] = useState(0);    // Hover rating state
  const [variants, setVariants] = useState([]);          // AI draft variations
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(-1); // Selected draft index (0=Friendly, 1=Professional, 2=Detailed)
  const [editorText, setEditorText] = useState('');      // Review text in editor

  // AI Loading
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState('idle');       // 'idle', 'generating', 'writing'

  // Submission
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

        // Immediate redirect option (FIX APPLIED HERE)
        if (data.behavior === 'redirect_immediate' && data.google_review_link) {
          window.location.href = getDirectReviewUrl(data.google_review_link);
        }

        // Log scan
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
    setHoverRating(0); // Clear hover rating explicitly on selection
    setVariants([]);
    setSelectedVariantIndex(-1);
    setEditorText('');

    setAiLoading(true);
    setAiStage('generating');

    const fetchSuggestionsPromise = triggerSuggestions(stars, null);

    // Staged animation duration
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

    // Secure clipboard copy directly inside the user gesture handler (before await)
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

      // Delay redirect by 5s to show confirmation
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

  // SVGs for Friendly (speech bubble), Professional (briefcase), and Detailed (document)
  const renderStyleIcon = (label, isSelected) => {
    const labelLower = (label || '').toLowerCase();
    const strokeColor = isSelected ? '#2563EB' : '#64748B';

    if (labelLower.includes('friendly')) {
      return (
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    }
    if (labelLower.includes('prof')) {
      return (
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center text-slate-800 font-sans" style={{ colorScheme: 'light' }}>
        <div className="animate-spin text-4xl mb-4 text-[#2563EB]">✨</div>
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-sans">Loading review station...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center text-slate-800 p-6 text-center font-sans" style={{ colorScheme: 'light' }}>
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-lg font-bold text-red-700 mb-2 font-sans">Review Campaign Unavailable</h2>
        <p className="max-w-md text-xs text-slate-500 font-serif italic">{error}</p>
      </div>
    );
  }

  const initials = getInitials(campaign.business_name);
  const locationParts = [campaign.city, campaign.state, campaign.country].filter(Boolean);

  // HELPER FUNCTION ADDED HERE
  const getDirectReviewUrl = (url) => {
    if (!url) return null;

    // 1. If your database already has the perfect link, leave it alone
    if (url.includes('search.google.com/local/writereview')) return url;

    // 2. If the URL contains a place_id parameter, rebuild it into the direct review link
    const placeIdMatch = url.match(/place_id=([^&]+)/i);
    if (placeIdMatch) {
      return `https://search.google.com/local/writereview?placeid=${placeIdMatch[1]}`;
    }

    // 3. Fallback: Append the write-review hash to the end of the URL
    const cleanUrl = url.split('#')[0]; // Prevent duplicate hashes
    return `${cleanUrl}#write-review`;
  };

  // FIX APPLIED HERE TO REDIRECT URL LOGIC
  const hasGoogleLink = campaign.google_review_link && campaign.google_review_link.trim() !== '';
  let redirectUrl = null;
  if (hasGoogleLink) {
    redirectUrl = getDirectReviewUrl(campaign.google_review_link);
  } else if (campaign.business_name || locationParts.length > 0) {
    const fallbackQuery = [campaign.business_name, ...locationParts].filter(Boolean).join(' ');
    redirectUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}#write-review`;
  }

  // Submit Ready Check
  const isSubmitReady = editorText.trim().length > 0;

  return (
    <div className="review-route min-h-screen bg-[#FAF8F5] text-slate-800 font-sans pb-24 pt-12 px-4 flex flex-col items-center justify-start sm:justify-center overflow-x-hidden relative" style={{ colorScheme: 'light' }}>

      {/* Brand Technology Attribution */}
      <div className="text-center mb-6 opacity-60">
        <span className="text-[9px] font-bold tracking-widest text-[#2563EB] uppercase">RevMeAI</span>
        <p className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">AI-Powered Review Assistant</p>
      </div>

      {/* Main Review Card Shell - Premium Light Mode */}
      <div className="w-full max-w-sm bg-white border border-[#E6DCD2] rounded-[2rem] shadow-xl p-6 space-y-6 flex flex-col items-center">

        {!isSubmitted ? (
          <>
            {/* Logo / Initials Avatar */}
            <div className="flex justify-center pt-2">
              {campaign.qr_logo ? (
                <div className="w-16 h-16 rounded-full bg-white border-2 border-[#E6DCD2] flex items-center justify-center shadow-lg overflow-hidden">
                  <img src={campaign.qr_logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#2563EB] to-indigo-600 border-4 border-white text-white flex items-center justify-center font-bold text-lg shadow-lg font-sans tracking-wide">
                  {initials}
                </div>
              )}
            </div>

            {/* Business Identity */}
            <div className="text-center space-y-1 w-full px-2">
              <h2 className="text-xl font-bold text-[#1C2541] font-sans tracking-tight leading-tight">
                {campaign.business_name}
              </h2>

              <div className="flex justify-center">
                <span className="bg-[#EBF2ED] text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  ✓ Verified Business
                </span>
              </div>

              {/* Category • Location (Single bullet-separated line) */}
              <div className="text-[10px] text-slate-400 capitalize font-semibold tracking-wide">
                {campaign.business_category}
                {locationParts.length > 0 && ` • ${locationParts.join(', ')}`}
              </div>

              {/* Heading */}
              <p className="text-xs font-bold text-slate-800 font-sans pt-2">
                How was your visit today?
              </p>
            </div>

            {/* Stars Intake (Inline SVGs with warning/amber coloring) */}
            <div className="flex flex-col items-center space-y-2 w-full">
              <div className="flex gap-2.5 justify-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Rate ${star} stars`}
                      className="outline-none transition duration-150 transform hover:scale-125 active:scale-95 cursor-pointer w-11 h-11 flex items-center justify-center"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleRatingSelect(star)}
                    >
                      <svg
                        className={`w-8 h-8 transition-colors duration-150`}
                        viewBox="0 0 24 24"
                        fill={isFilled ? "#FF9800" : "none"}
                        stroke={isFilled ? "#FF9800" : "#CBD5E1"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-500 font-sans tracking-wider min-h-[16px]">
                {rating > 0 ? getRatingLabel(rating) : "Tap a star to rate"}
              </span>
            </div>

            {/* AI Loading Stages */}
            {aiLoading && (
              <div className="bg-[#FAF6F0] border border-[#E6DCD2] rounded-2xl p-5 text-center space-y-2 animate-pulse w-full">
                <div className="text-xs text-[#2563EB] font-bold flex items-center justify-center gap-1.5 font-sans">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                  {aiStage === 'generating' ? 'Generating review...' : '✨ AI is writing...'}
                </div>
                <p className="text-[10px] text-slate-400 font-serif italic">
                  Crafting 3 tailored review drafts for you...
                </p>
              </div>
            )}

            {/* Suggested Drafts section (Plain text cards, hidden until selected) */}
            {!aiLoading && rating > 0 && variants.length > 0 && (
              <div className="space-y-3 w-full text-left pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-bold tracking-wide uppercase text-[10px] block px-2">
                  Select a draft suggestion to edit
                </span>
                <div className="flex gap-3 overflow-x-auto pb-3 pt-0.5 -mx-6 px-6 scrollbar-none snap-x snap-mandatory">
                  {variants.map((v, idx) => {
                    const isSelected = selectedVariantIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`flex-shrink-0 w-[260px] p-4 text-xs text-left rounded-2xl border transition-all duration-200 relative cursor-pointer flex flex-col snap-align-start ${isSelected
                          ? 'bg-blue-50/50 border-[#2563EB] text-slate-800 ring-2 ring-blue-100'
                          : 'bg-slate-50/50 border-[#E6DCD2] text-slate-600 hover:bg-slate-100/50'
                          }`}
                        onClick={() => handleSelectVariant(idx, v.text)}
                      >
                        <p className="font-serif italic leading-relaxed pr-6 text-[11px] sm:text-xs select-none">"{v.text}"</p>
                        {isSelected && (
                          <span className="absolute top-4 right-4 text-[#2563EB] animate-scale-in">
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
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-left space-y-1 w-full">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Direct Feedback</span>
                <p className="text-xs text-red-900 font-serif italic">
                  We're sorry to hear about your experience. Please let us know what went wrong so we can address your concerns.
                </p>
              </div>
            )}

            {/* Review Editor Textarea (pre-filled with selected draft, ~3-4 visible lines) */}
            {rating > 0 && (
              <div className="space-y-4 w-full pt-2 border-t border-slate-100">
                <div className="bg-white border border-[#E6DCD2] p-3.5 rounded-2xl w-full shadow-inner">
                  <textarea
                    rows={4}
                    className="w-full bg-transparent text-base text-slate-800 outline-none leading-relaxed resize-none text-left"
                    value={editorText}
                    onChange={(e) => setEditorText(e.target.value)}
                    placeholder={
                      rating <= 2
                        ? "Tell us what went wrong. Your feedback helps us improve."
                        : "Select an AI suggested draft above or type your own review here..."
                    }
                  />
                </div>

                {/* Submit Action Button (Sentence case: "Submit review", dynamic visual states, paper-plane SVG) */}
                <button
                  className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${isSubmitReady
                    ? "bg-[#2563EB] hover:bg-blue-600 text-white"
                    : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  onClick={handleSubmit}
                  disabled={submitting || !isSubmitReady}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                  Submit review
                </button>

              </div>
            )}
          </>
        ) : (
          /* Thank You Celebration Screen with Redirect / Copy-paste Assist */
          <div className="text-center space-y-6 py-6 text-slate-800 w-full flex flex-col items-center">
            <div className="flex justify-center">
              <svg className="w-16 h-16 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold font-sans">🎉 Thank you!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto font-serif italic leading-relaxed">
                Your review has been saved. We copied your review text to the clipboard so you can easily paste it.
              </p>
            </div>

            {redirectUrl ? (
              <div className="bg-[#FAF6F0] p-5 rounded-2xl border border-[#E6DCD2] space-y-4 w-full max-w-sm mx-auto shadow-inner flex flex-col items-center">
                <p className="text-[10px] text-slate-500 font-sans leading-normal font-semibold text-center uppercase tracking-wider">
                  Copied your review — just paste it on Google
                </p>
                <div className="text-xs text-[#2563EB] font-bold flex items-center justify-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                  Redirecting you to Google Maps...
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-serif italic text-center">
                Your feedback has been saved internally.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}