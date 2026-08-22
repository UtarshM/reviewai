"use client";

import React from 'react';

export default function PacingRibbon({ pacingWarning, dailyCount }) {
  if (!pacingWarning) return null;

  return (
    <div id="pacing-ribbon" className="pacing-ribbon">
      <div className="ribbon-content">
        <span className="ribbon-icon">⚠️</span>
        <p id="pacing-message">
          Google Pacing Alert: You have generated/posted {dailyCount} reviews/replies today.
          Bulk-posting templates can read as spammy to search crawlers. Consider spacing them out.
        </p>
      </div>
      <div className="ribbon-stats">
        <span className="badge badge-outline">
          Generations Today: <strong id="ribbon-count">{dailyCount}</strong>/20
        </span>
      </div>
    </div>
  );
}
