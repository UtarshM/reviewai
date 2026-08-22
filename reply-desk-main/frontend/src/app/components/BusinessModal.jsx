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
      setName('');
      setCategory('');
      setTone('friendly');
      setCity('');
      setState('');
      setCountry('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name,
      category,
      tone_default: tone,
      city,
      state,
      country
    });
  };

  return (
    <div id="business-modal" className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="business-modal-title">Create Business Profile</h2>
          <button className="modal-close" id="btn-close-business-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <form id="business-form" className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="business-name">Business Name</label>
            <input
              type="text"
              id="business-name"
              required
              placeholder="e.g., Corner Bakery Cafe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="business-category">Business Category / Industry</label>
            <input
              type="text"
              id="business-category"
              required
              placeholder="e.g., Restaurant & Catering"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="business-tone">Default Tone Settings</label>
            <div className="select-wrapper">
              <select
                id="business-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="friendly">Warm & Friendly (Default)</option>
                <option value="professional">Polished & Professional</option>
                <option value="empathetic">Empathetic & Attentive</option>
                <option value="direct">Direct & Concise</option>
              </select>
            </div>
          </div>
          <div className="grid-2-col">
            <div className="form-group">
              <label htmlFor="business-city">City</label>
              <input
                type="text"
                id="business-city"
                placeholder="e.g., San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="business-state">State / Province</label>
              <input
                type="text"
                id="business-state"
                placeholder="e.g., California"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="business-country">Country</label>
            <input
              type="text"
              id="business-country"
              placeholder="e.g., United States"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              id="btn-cancel-business"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="btn-submit-business"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
