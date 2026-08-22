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
    setLoading(false);

    if (password.length < 6 && !isLogin) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setLoading(false);

      if (response.status === 401 || data.error) {
        setError(data.message || 'Authentication failed. Please check your credentials.');
        return;
      }

      if (data.token) {
        onLoginSuccess(data.token, data.user?.email || email);
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed. Please check if the server is running.');
    }
  };

  return (
    <div id="auth-view" className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">✍️</span>
          <h1>Reply Desk</h1>
          <p className="subtitle">AI Correspondence Assistant</p>
        </div>

        {isLogin ? (
          <form id="login-form" className="auth-form" onSubmit={handleSubmit}>
            <h2>Sign In</h2>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                type="email"
                id="login-email"
                required
                placeholder="name@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Entering Desk...' : 'Enter Desk'}
            </button>
            <p className="auth-toggle">
              New to Reply Desk?{' '}
              <a
                href="#"
                id="show-register"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLogin(false);
                  setError('');
                }}
              >
                Create an account
              </a>
            </p>
          </form>
        ) : (
          <form id="register-form" className="auth-form" onSubmit={handleSubmit}>
            <h2>Create Account</h2>
            <div className="form-group">
              <label htmlFor="register-email">Email Address</label>
              <input
                type="email"
                id="register-email"
                required
                placeholder="name@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Password (min 6 chars)</label>
              <input
                type="password"
                id="register-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating Account...' : 'Register Account'}
            </button>
            <p className="auth-toggle">
              Already have an account?{' '}
              <a
                href="#"
                id="show-login"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLogin(true);
                  setError('');
                }}
              >
                Sign in
              </a>
            </p>
          </form>
        )}

        {error && (
          <div id="auth-error" className="error-banner">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
