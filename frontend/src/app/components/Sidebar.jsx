"use client";

import React from 'react';

export default function Sidebar({
  activeBusiness,
  businesses,
  activeTab,
  onTabChange,
  onAddProfileClick,
  onLogout
}) {
  const navItems = [
    { id: 'tab-qr-studio', label: 'Get Reviews & QR', icon: 'qr_code_2' },
    { id: 'tab-google-posts', label: 'AI Google Posts', icon: 'campaign' },
    { id: 'tab-private-inbox', label: 'Private Feedback', icon: 'mark_email_unread' },
    { id: 'tab-reply', label: 'AI Review Replies', icon: 'auto_awesome' },
    { id: 'tab-analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'tab-history', label: 'History Log', icon: 'history' }
  ];

  const renderItem = (item, mobile = false) => {
    const isActive = activeTab === item.id;
    return <button key={item.id} onClick={() => onTabChange(item.id)} aria-current={isActive ? 'page' : undefined}
      title={item.label}
      className={mobile ? `flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-1 py-1.5 rounded-xl text-[10px] transition ${isActive ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant'}` : `w-full flex items-center gap-md px-md py-3 rounded-xl transition-all duration-200 text-left cursor-pointer ${isActive ? 'bg-primary text-white font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
      <span className="material-symbols-outlined pointer-events-none">{item.icon}</span>
      <span className="font-label-md text-label-md pointer-events-none">{item.label}</span>
    </button>;
  };

  return (
    <>
    <aside className="hidden md:flex w-[260px] h-full bg-white/70 border-r border-outline-variant flex-col py-lg px-md gap-sm justify-between shrink-0 select-none">
      <div>
        {/* Active Business Profile Card */}
        <div className="mb-lg px-sm mt-sm">
          <div className="flex items-center gap-md p-sm bg-surface-container-highest rounded-xl border border-outline-variant">
            <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-secondary-container">storefront</span>
            </div>
            <div className="overflow-hidden">
              <p className="font-label-md text-label-md truncate text-on-surface font-semibold leading-tight">
                {activeBusiness ? activeBusiness.name : 'Select Business'}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate leading-normal">
                {activeBusiness ? (activeBusiness.category || 'Premium Plan') : 'No Active Business'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          {navItems.map((item) => renderItem(item))}
        </div>
      </div>

      {/* Support & Sign Out */}
      <div className="space-y-1 border-t border-outline-variant pt-md mb-sm">
        <button
          onClick={() => alert('Contact support@replydesk.ai')}
          className="w-full flex items-center gap-md px-md py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all duration-200 rounded-lg text-left cursor-pointer"
        >
          <span className="material-symbols-outlined">help</span>
          <span className="font-label-md text-label-md">Support</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-md px-md py-3 text-red-500 hover:bg-red-50/50 hover:text-red-600 transition-all duration-200 rounded-lg text-left cursor-pointer"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-md text-label-md">Sign Out</span>
        </button>
      </div>
    </aside>
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around gap-1 px-2 py-2 bg-white/95 backdrop-blur-xl border-t border-outline-variant shadow-[0_-8px_24px_rgba(15,23,42,.08)] overflow-x-auto">
      {navItems.map((item) => renderItem(item, true))}
    </nav>
    </>
  );
}
