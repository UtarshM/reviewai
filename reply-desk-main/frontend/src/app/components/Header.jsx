"use client";

import React from 'react';

export default function Header({
  businesses,
  activeBusinessId,
  userEmail,
  onBusinessChange,
  onAddProfileClick,
  onLogout
}) {
  return (
    <header className="desk-header">
      <div className="header-brand">
        <span className="brand-icon">🖋️</span>
        <div>
          <h1>Reply Desk</h1>
          <span className="brand-tag">AI-Assisted Review Management</span>
        </div>
      </div>

      <div className="header-controls">
        <div className="control-group">
          <label htmlFor="business-select">Active Client Profile:</label>
          <div className="select-wrapper">
            <select
              id="business-select"
              value={activeBusinessId || ''}
              onChange={(e) => {
                const val = e.target.value;
                onBusinessChange(val ? parseInt(val) : null);
              }}
            >
              <option value="">-- Select a Business --</option>
              {businesses.map((b) => {
                const locationParts = [b.city, b.state, b.country].filter(Boolean);
                const locationStr = locationParts.length > 0 ? ` - ${locationParts.join(', ')}` : '';
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.category}{locationStr})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <button
          id="btn-new-business"
          className="btn btn-secondary btn-sm"
          onClick={onAddProfileClick}
        >
          + Add Profile
        </button>

        <div className="user-profile">
          <span id="user-display-email" className="user-email">
            {userEmail || '...'}
          </span>
          <button
            id="btn-logout"
            className="btn btn-text btn-sm btn-logout"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
