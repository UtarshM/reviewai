"use client";

import React, { useState } from 'react';

export default function AuthView({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6 && !isLogin) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.status === 401 || data.error) {
        setError(data.message || 'Authentication failed.');
        return;
      }
      if (data.token) onLoginSuccess(data.token, data.user?.email || email);
    } catch (err) {
      setLoading(false);
      setError('Connection failed. Please check if the server is running.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg-body)] flex items-center justify-center p-4">
      {/* Decorative bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[var(--c-d7e3fc)] rounded-full opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[var(--c-abc4ff)] rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative bg-white border border-[var(--c-d7e3fc)] w-full max-w-sm rounded-2xl p-8 shadow-lg animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-white text-2xl">rate_review</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Reply Desk</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">AI-Powered Review Management</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              placeholder="name@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full text-sm px-3.5 py-2.5 border border-[var(--c-ccdbfd)] rounded-lg outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
              Password {!isLogin && <span className="normal-case text-[var(--text-muted)]">(min 6 chars)</span>}
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full text-sm px-3.5 py-2.5 border border-[var(--c-ccdbfd)] rounded-lg outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full justify-center py-2.5 text-sm"
            disabled={loading}
          >
            {loading
              ? (isLogin ? 'Signing in...' : 'Creating...')
              : (isLogin ? 'Sign In' : 'Create Account')
            }
          </button>

          <p className="text-xs text-center text-[var(--text-muted)] pt-2">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); setError(''); }}
              className="text-[var(--accent)] font-semibold hover:underline"
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </a>
          </p>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs text-center font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
