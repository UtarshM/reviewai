"use client";

import React from 'react';

export default function TabsNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'tab-reply', label: 'Reply to a Review' },
    { id: 'tab-review', label: 'Help Customer Write Review' },
    { id: 'tab-history', label: 'Review History & Log' },
    { id: 'tab-qr', label: 'QR Reviews' },
    { id: 'tab-customer-reviews', label: 'Customer Reviews' }
  ];

  return (
    <nav className="desk-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`desk-tab ${activeTab === tab.id ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
