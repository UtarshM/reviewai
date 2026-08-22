import React, { useState, useEffect } from 'react';
import { Star, Copy, Download, Printer, ExternalLink, ArrowRight, MessageSquare, Award, Calendar } from 'lucide-react';

export default function QrTab({ activeBusiness, token, onTabChange }) {
  const [campaign, setCampaign] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (activeBusiness && token) {
      fetchCampaignAndReviews();
    }
  }, [activeBusiness, token]);

  const fetchCampaignAndReviews = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch default campaign/QR config
      const campaignResponse = await fetch(`/api/v1/qr?business_id=${activeBusiness.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const campaignData = await campaignResponse.json();
      if (campaignData.error) {
        setError(campaignData.message || 'Failed to load QR details');
        setLoading(false);
        return;
      }
      
      const activeCampaign = campaignData[0] || null;
      setCampaign(activeCampaign);

      if (activeCampaign) {
        // 2. Fetch reviews and stats (always fetch fresh stats)
        const reviewsResponse = await fetch(
          `/api/v1/qr/reviews?business_id=${activeBusiness.id}&rating=all&search=&sort=newest`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        const reviewsData = await reviewsResponse.json();
        if (reviewsData.error) {
          setError(reviewsData.message || 'Failed to load reviews');
        } else {
          setReviews(reviewsData.reviews || []);
          setStats(reviewsData.stats || null);
        }
      }
    } catch (err) {
      setError('Connection failed while retrieving QR review details.');
    } finally {
      setLoading(false);
    }
  };

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const getPublicUrl = (cToken) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/review/${cToken}`;
    }
    return `/review/${cToken}`;
  };

  const getQrUrl = (cToken, size = '300x300') => {
    const publicUrl = getPublicUrl(cToken);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(publicUrl)}&color=000000&bgcolor=FFFFFF&ecc=M`;
  };

  const handleCopyLink = () => {
    if (!campaign) return;
    const url = getPublicUrl(campaign.token);
    navigator.clipboard.writeText(url);
    addToast('URL copied to clipboard!');
  };

  const handlePreviewLink = () => {
    if (!campaign) return;
    const url = getPublicUrl(campaign.token);
    window.open(url, '_blank');
  };

  const handleDownloadQr = () => {
    if (!campaign) return;
    const url = getQrUrl(campaign.token, '1000x1000');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeBusiness.name}_QR_HighRes.png`;
    link.target = '_blank';
    link.click();
    addToast('High-resolution QR Code download started!');
  };

  const handlePrint = () => {
    window.print();
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

  if (loading && !campaign) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <div className="animate-spin text-3xl text-[#2563EB] mb-3">✨</div>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Loading Station...</p>
      </div>
    );
  }

  const publicUrl = campaign ? getPublicUrl(campaign.token) : '';
  const qrUrl = campaign ? getQrUrl(campaign.token, '500x500') : '';
  const qrUrlPrint = campaign ? getQrUrl(campaign.token, '1000x1000') : '';
  
  // Latest 3 reviews
  const recentReviews = reviews.slice(0, 3);
  const totalReviews = stats?.totalReviews || 0;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    const star = Math.round(r.rating);
    if (distribution[star] !== undefined) {
      distribution[star]++;
    }
  });

  const locationParts = [activeBusiness?.city, activeBusiness?.state].filter(Boolean);

  return (
    <div className="text-slate-800 relative">
      
      {/* Inline styles for value change bounce animation and sliding toasts */}
      <style>{`
        @keyframes value-bounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .animate-value-change {
          display: inline-block;
          animation: value-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Print Poster Layout (Hidden in screen mode, visible during printing) */}
      {campaign && (
        <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:text-center print:h-screen print:bg-white print:p-12 print:border-8 print:border-double print:border-slate-800">
          <h1 className="text-5xl font-bold font-serif mb-4 text-slate-800">RevMeAI</h1>
          <h2 className="text-2xl font-serif text-slate-600 mb-8">Scan to Leave a Review ⭐</h2>
          
          <div className="w-80 h-80 border-4 border-slate-800 p-4 rounded-3xl mb-8 flex items-center justify-center bg-white shadow-lg">
            <img src={qrUrlPrint} alt="QR Code" className="w-full h-full object-contain" />
          </div>

          <div className="space-y-2">
            <h3 className="text-4xl font-bold text-slate-800 font-sans tracking-tight">{activeBusiness.name}</h3>
            <p className="text-xl text-slate-500 font-serif italic capitalize">
              {activeBusiness.category}
              {locationParts.length > 0 && ` • ${locationParts.join(', ')}`}
            </p>
          </div>
          
          <p className="mt-12 text-sm text-slate-400 font-sans tracking-wide">
            {publicUrl}
          </p>
        </div>
      )}

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

      {/* Screen Layout Dashboard */}
      <div className="print:hidden space-y-8 max-w-7xl mx-auto">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl font-bold font-serif text-[#1C2541]">QR Review Station</h2>
            <p className="text-xs text-slate-500 font-serif italic mt-0.5">
              Display your custom QR review station and monitor your rating stats.
            </p>
          </div>
        </div>

        {error && (
          <div className="error-banner p-4 border border-red-200 bg-red-50 text-red-700 rounded-2xl text-center text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Main 2-Column Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Section 1: QR Card (Takes 5 cols on desktop, centered) */}
          <div className="lg:col-span-5 flex flex-col items-stretch sm:items-center w-full">
            <div className="w-full max-w-md bg-white border border-[#E6DCD2] rounded-[2.5rem] shadow-xl p-8 space-y-8 text-center hover:shadow-2xl transition duration-300 flex-shrink-0">
              
              {/* Logo / Initials */}
              <div className="flex justify-center">
                {campaign?.qr_logo ? (
                  <div className="w-20 h-20 rounded-full bg-white border-4 border-white p-1 flex items-center justify-center shadow-lg overflow-hidden">
                    <img src={campaign.qr_logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#2563EB] to-indigo-600 border-4 border-white text-white flex items-center justify-center font-bold text-2xl shadow-lg font-sans">
                    {(activeBusiness?.name || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Title & Category */}
              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold text-[#1C2541] font-sans tracking-tight">{activeBusiness?.name}</h3>
                
                <div className="flex justify-center">
                  <span className="bg-[#EBF2ED] text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    ✓ Verified Business
                  </span>
                </div>

                <div className="text-xs text-slate-400 capitalize font-semibold tracking-wide">
                  <span className="font-serif italic font-medium">{activeBusiness?.category}</span>
                  {locationParts.length > 0 && ` • ${locationParts.join(', ')}`}
                </div>
              </div>

              {/* QR Code Container (Scaled up for high scannability) */}
              <div className="flex justify-center p-4 bg-[#FAF8F5] border border-[#E6DCD2] rounded-[2rem] w-72 mx-auto shadow-inner">
                <div className="w-60 h-60 flex items-center justify-center bg-white p-3 rounded-2xl shadow-sm">
                  {campaign?.token ? (
                    <img src={qrUrl} alt="QR Code" className="w-full h-full object-contain" />
                  ) : (
                    <div className="animate-pulse bg-slate-200 w-full h-full rounded-xl"></div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Scan to Leave a Review ⭐
              </div>

              <div 
                onClick={handleCopyLink}
                title="Click to copy link"
                className="text-xs text-slate-500 bg-[#FAF8F5] border border-slate-200/50 py-2.5 px-4 rounded-xl truncate select-all font-mono cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition active:scale-98"
              >
                {publicUrl}
              </div>

              {/* Equal Width Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-2">
                <button
                  onClick={handleCopyLink}
                  aria-label="Copy public review link to clipboard"
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-50 hover:bg-slate-100 hover:-translate-y-0.5 border border-[#E6DCD2] rounded-2xl text-[10px] font-bold text-slate-700 transition active:scale-95 min-h-[44px]"
                >
                  <Copy className="w-4 h-4 text-slate-500" /> Copy
                </button>
                <button
                  onClick={handlePreviewLink}
                  aria-label="Preview public review page in new tab"
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-50 hover:bg-slate-100 hover:-translate-y-0.5 border border-[#E6DCD2] rounded-2xl text-[10px] font-bold text-slate-700 transition active:scale-95 min-h-[44px]"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" /> Preview
                </button>
                <button
                  onClick={handleDownloadQr}
                  aria-label="Download QR code image as PNG"
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-50 hover:bg-slate-100 hover:-translate-y-0.5 border border-[#E6DCD2] rounded-2xl text-[10px] font-bold text-slate-700 transition active:scale-95 min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-slate-500" /> Download
                </button>
                <button
                  onClick={handlePrint}
                  aria-label="Print review stand poster"
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-50 hover:bg-slate-100 hover:-translate-y-0.5 border border-[#E6DCD2] rounded-2xl text-[10px] font-bold text-slate-700 transition active:scale-95 min-h-[44px]"
                >
                  <Printer className="w-4 h-4 text-slate-500" /> Print
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: Statistics & Recent Reviews Preview */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Section 2: Overview Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-serif text-[#1C2541]">Review Overview</h3>
              
              <div className="grid grid-cols-2 gap-4">
                
                {/* Avg Rating */}
                <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-1 transition duration-300 min-h-[120px] flex flex-col justify-between group">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Average Rating</span>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 group-hover:scale-110 transition" />
                  </div>
                  <div className="mt-2">
                    {totalReviews > 0 ? (
                      <span key={stats?.avgRating} className="text-4xl font-extrabold text-[#1C2541] font-sans animate-value-change flex items-baseline gap-1">
                        {stats?.avgRating || '—'}<span className="text-xs text-slate-400 font-normal">/5</span>
                      </span>
                    ) : (
                      <span className="text-base font-bold text-slate-400 font-sans tracking-wide uppercase">
                        No ratings yet
                      </span>
                    )}
                    <p className="text-[10px] text-slate-400 font-serif italic mt-0.5">Based on customer feedback</p>
                  </div>
                </div>

                {/* Total Reviews */}
                <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-1 transition duration-300 min-h-[120px] flex flex-col justify-between group">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Reviews</span>
                    <MessageSquare className="w-4 h-4 text-[#2563EB] group-hover:scale-110 transition" />
                  </div>
                  <div className="mt-2">
                    <span key={totalReviews} className="text-4xl font-extrabold text-[#1C2541] font-sans animate-value-change">
                      {totalReviews}
                    </span>
                    <p className="text-[10px] text-slate-400 font-serif italic mt-0.5">Total reviews submitted</p>
                  </div>
                </div>

                {/* Rating Spread */}
                <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-1 transition duration-300 h-auto min-h-[180px] flex flex-col justify-between group">
                  <div className="flex justify-between items-center text-slate-400 pb-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Rating Spread</span>
                    <Award className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
                  </div>
                  <div className="space-y-3 flex-grow flex flex-col justify-center">
                    {totalReviews > 0 ? (
                      [5, 4, 3, 2, 1].map((stars) => {
                        const count = distribution[stars] || 0;
                        const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2.5 text-xs font-sans text-slate-600 leading-none">
                            <span className="w-5 text-right font-bold flex items-center justify-end">{stars}★</span>
                            <div className="flex-grow h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-5 text-right font-bold text-slate-400">{count}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-2xl font-extrabold text-slate-300 font-sans tracking-tight">
                        —
                      </span>
                    )}
                  </div>
                </div>

                {/* Last 30 Days */}
                <div className="bg-gradient-to-br from-white to-slate-50/50 border border-[#E6DCD2] p-5 rounded-3xl shadow-sm hover:border-slate-300 hover:-translate-y-1 transition duration-300 min-h-[120px] flex flex-col justify-between group">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Last 30 Days</span>
                    <Calendar className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
                  </div>
                  <div className="mt-2">
                    <span key={stats?.recentReviews} className="text-4xl font-extrabold text-[#1C2541] font-sans animate-value-change">
                      {totalReviews > 0 ? (stats?.recentReviews || 0) : '—'}
                    </span>
                    <p className="text-[10px] text-indigo-500 font-serif italic mt-0.5">Recent scanner activity</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Section 3: Recent Reviews Preview */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-serif text-[#1C2541]">Latest Customer Reviews</h3>
                {totalReviews > 0 && (
                  <button
                    onClick={() => onTabChange('tab-customer-reviews')}
                    className="text-xs font-bold text-[#2563EB] hover:text-blue-800 flex items-center gap-1 transition"
                  >
                    View All Reviews <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Display empty dashboard state if no reviews */}
              {totalReviews === 0 ? (
                <div className="bg-white border border-[#E6DCD2] rounded-3xl p-10 text-center space-y-4">
                  <div className="text-4xl">💬</div>
                  <h4 className="text-base font-bold text-slate-700">No reviews yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-serif italic">
                    Share your QR code to start collecting feedback. Customer submissions will automatically appear here.
                  </p>
                  <button
                    onClick={handlePreviewLink}
                    className="btn btn-sm bg-[#2563EB] border-[#2563EB] text-xs px-5 rounded-xl shadow-sm min-h-[44px] hover:bg-blue-700 text-white cursor-pointer"
                  >
                    Preview Review Page
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentReviews.map((review) => {
                    const dateStr = new Date(review.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div 
                        key={review.id} 
                        className="bg-white border border-[#E6DCD2] rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 space-y-2.5"
                      >
                        <div className="flex justify-between items-center text-xs">
                          {renderStars(review.rating)}
                          <span className="text-[10px] text-slate-400 font-sans font-medium">{dateStr}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-serif italic truncate">
                          "{review.final_review}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
