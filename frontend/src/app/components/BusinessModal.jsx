"use client";

import React, { useState, useEffect } from 'react';

export default function BusinessModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [tone, setTone] = useState('friendly');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(''); setCategory(''); setTone('friendly');
      setCity(''); setState(''); setCountry('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, category, tone_default: tone, city, state, country });
  };

  const fieldClass = "w-full text-sm px-3.5 py-2.5 border border-[var(--c-ccdbfd)] rounded-lg outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition bg-white";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[var(--c-d7e3fc)] w-full max-w-md rounded-2xl shadow-xl animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--c-e2eafc)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Create Business Profile</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Add your business details</p>
          </div>
          <button className="w-8 h-8 rounded-lg hover:bg-[var(--bg-muted)] flex items-center justify-center transition cursor-pointer" onClick={onClose}>
            <span className="material-symbols-outlined text-[var(--text-muted)] text-[18px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Business Name</label>
            <input type="text" required placeholder="e.g., Downtown Bistro" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Category</label>
            <input type="text" required placeholder="e.g., Restaurant & Cafe" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Default Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={fieldClass}>
              <option value="friendly">Warm & Friendly</option>
              <option value="professional">Professional</option>
              <option value="empathetic">Empathetic</option>
              <option value="direct">Direct & Concise</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">City</label>
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">State</label>
              <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Country</label>
              <input type="text" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--c-e2eafc)]">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
}
