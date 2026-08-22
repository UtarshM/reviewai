"use client";

import React from 'react';

export default function PacingRibbon({ pacingWarning, dailyCount }) {
  if (!pacingWarning) return null;

  return (
    <div className="flex items-center justify-between p-3 px-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="material-symbols-outlined text-amber-500 text-[20px] shrink-0">warning</span>
        <p className="text-xs font-medium truncate">
          <span className="font-semibold">Pacing Alert:</span> {dailyCount} generations today. Consider spacing them out.
        </p>
      </div>
      <span className="text-[11px] font-bold bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
        {dailyCount}/20
      </span>
    </div>
  );
}
