"use client";

import React from 'react';

export default function Header({
  businesses,
  activeBusinessId,
  userEmail,
  activeTab,
  onBusinessChange,
  onAddProfileClick,
  onUpgradeClick,
  onLogout
}) {
  const getTabTitle = (tab) => {
    switch (tab) {
      case 'tab-reply': return 'AI Replies';
      case 'tab-review': return 'Review Drafts';
      case 'tab-history': return 'Activity History';
      case 'tab-qr': return 'QR Campaigns';
      case 'tab-customer-reviews': return 'Customer Feedback';
      case 'tab-analytics': return 'Analytics Dashboard';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="w-full z-50 flex justify-between items-center px-4 md:px-lg h-16 bg-white/85 backdrop-blur-xl border-b border-outline-variant shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 md:gap-md min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm shrink-0"><span className="material-symbols-outlined text-[18px]">rate_review</span></div>
        <span className="text-[18px] md:text-headline-md font-headline-md font-bold text-primary whitespace-nowrap">Reply Desk</span>
        <div className="hidden sm:block h-6 w-px bg-outline-variant mx-sm"></div>
        <span className="hidden sm:block font-label-md text-label-md text-on-surface-variant truncate">
          {getTabTitle(activeTab)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-md">
        {/* Search */}
        <div className="relative hidden lg:block">
          <input
            className="bg-surface-container-high border border-outline-variant rounded-full pl-10 pr-4 py-1.5 text-body-sm focus:ring-2 focus:ring-primary outline-none transition-all w-64"
            placeholder="Search insights..."
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        </div>

        {/* Business Selector */}
        <select
          value={activeBusinessId || ''}
          onChange={(e) => {
            const val = e.target.value;
            onBusinessChange(val ? parseInt(val, 10) : null);
          }}
          className="bg-surface-container-high border border-outline-variant text-body-sm text-on-surface rounded-lg px-2 md:px-md py-1.5 outline-none cursor-pointer hover:bg-surface-bright transition max-w-[125px] md:max-w-[200px]"
        >
          <option value="">Select Business</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Add Business */}
        <button
          onClick={onAddProfileClick}
          className="bg-primary text-on-primary font-label-md text-label-md px-md py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span className="hidden sm:inline">Add Business</span>
        </button>

        {/* Icons */}
        <div className="hidden md:flex items-center gap-sm text-on-surface-variant">
          <button className="p-2 hover:bg-surface-bright rounded-full transition-colors relative cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-white"></span>
          </button>
          <button className="p-2 hover:bg-surface-bright rounded-full transition-colors cursor-pointer" onClick={onLogout} title="Sign Out">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>

        {/* Avatar */}
        <div className="hidden sm:flex w-8 h-8 rounded-full bg-primary-container text-on-primary-container items-center justify-center font-bold text-xs uppercase overflow-hidden border border-outline select-none">
          {userEmail ? userEmail.substring(0, 2) : 'RD'}
        </div>
      </div>
    </header>
  );
}
