import React, { useState } from 'react';

export default function QrShareStudio({ currentBusiness }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWaMsg, setCopiedWaMsg] = useState(false);

  if (!currentBusiness) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4">
        <div className="text-5xl">🏪</div>
        <h3 className="text-xl font-bold text-white">No Business Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create a business profile to view your Review Acquisition QR Code & Link Studio.
        </p>
      </div>
    );
  }

  const slug = currentBusiness.slug || (currentBusiness.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const fullReviewUrl = `${window.location.origin}/r/${slug}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullReviewUrl)}`;

  const whatsappMessage = `Hi! Thank you for visiting ${currentBusiness.name}. We'd love to get your feedback! Tap here to leave a quick 5-second Google review: ${fullReviewUrl}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullReviewUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyWaMsg = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedWaMsg(true);
    setTimeout(() => setCopiedWaMsg(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
            Review Acquisition Studio
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Get 5-Star Reviews Effortlessly
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Share your custom review link or print your counter QR code. Customers scan, pick an AI review, and post to Google in 5 seconds.
          </p>
        </div>
        <a
          href={`/r/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg transition flex items-center gap-2 text-sm shrink-0"
        >
          <span>👁️ Preview Customer Portal</span>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: QR Code & Printable Stand */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📱 Printable Counter QR Code</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">/r/{slug}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
            <div className="inline-block p-4 bg-white rounded-2xl shadow-2xl">
              <img
                src={qrApiUrl}
                alt="Review QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">{currentBusiness.name}</p>
              <p className="text-xs text-amber-400 font-medium">Scan to leave a 5-star review</p>
            </div>

            <div className="pt-2 flex flex-wrap gap-3 justify-center">
              <a
                href={qrApiUrl}
                download={`${slug}-qr-code.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
              >
                <span>📥 Download QR Code PNG</span>
              </a>
              <button
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
              >
                <span>🖨️ Print Counter Display</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Link & WhatsApp Suite */}
        <div className="space-y-6">
          {/* Direct Link Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔗 Shareable Customer Review Link</span>
            </h3>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2.5">
              <input
                type="text"
                readOnly
                value={fullReviewUrl}
                className="bg-transparent text-sm font-mono text-amber-400 w-full px-2 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shrink-0 transition"
              >
                {copiedLink ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Send this link to customers via SMS, Email, or add it to digital receipts.
            </p>
          </div>

          {/* WhatsApp Suite */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💬 WhatsApp Review Request</span>
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                High Conversion
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 leading-relaxed">
              {whatsappMessage}
            </div>

            <div className="flex gap-3">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs text-center transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <span>🚀 Open in WhatsApp</span>
              </a>
              <button
                onClick={handleCopyWaMsg}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-3 px-4 rounded-xl text-xs transition"
              >
                {copiedWaMsg ? '✓ Copied!' : 'Copy Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
