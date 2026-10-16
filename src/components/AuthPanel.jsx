import React, { useState } from 'react';
import confetti from 'canvas-confetti';

export default function AuthPanel({ onToggle }) {
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('alex@atelier.art');
  const [password, setPassword] = useState('Masterpiece2026!');
  const [remember, setRemember] = useState(true);
  const touchStartY = React.useRef(0);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchEndY - touchStartY.current;
    // If swiped down > 35px, collapse the sheet
    if (diff > 35 && onToggle) {
      onToggle();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    confetti({ particleCount: 75, spread: 80, origin: { x: 0.2, y: 0.6 } });
  };

  return (
    <div className="auth-scroll-wrapper">
      {/* Mobile sheet drag/peek handle bar */}
      <div
        className="bottom-sheet-handle-bar"
        onClick={onToggle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        title="Swipe down or tap to view full 3D scene"
        role="button"
        tabIndex={0}
        aria-label="Toggle Full 3D Scene"
      >
        <div className="bottom-sheet-handle" />
      </div>

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          {/* Palette Logo */}
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M24 4C12.95 4 4 12.95 4 24c0 11.05 8.95 20 20 20 2.21 0 4-1.79 4-4 0-1.04-.42-1.96-1.06-2.64-.62-.66-1.02-1.54-1.02-2.52 0-2.21 1.79-4 4-4h4.72C39.72 30.84 44 26.56 44 21.16 44 11.66 35.05 4 24 4z"
                fill="#C48C58"
              />
              <path
                d="M24 4C12.95 4 4 12.95 4 24c0 11.05 8.95 20 20 20 2.21 0 4-1.79 4-4 0-1.04-.42-1.96-1.06-2.64-.62-.66-1.02-1.54-1.02-2.52 0-2.21 1.79-4 4-4h4.72C39.72 30.84 44 26.56 44 21.16 44 11.66 35.05 4 24 4z"
                fill="url(#woodGrainAuth)"
                opacity="0.18"
              />
              <circle cx="13" cy="15" r="3.5" fill="#ef4444" />
              <circle cx="10" cy="24" r="3.5" fill="#f97316" />
              <circle cx="14" cy="33" r="3.5" fill="#facc15" />
              <circle cx="24" cy="37" r="3" fill="#10b981" />
              <circle cx="22" cy="11" r="3.5" fill="#3b82f6" />
              <circle cx="33" cy="14" r="3.5" fill="#8b5cf6" />
              <circle cx="34" cy="24" r="4" fill="#f7faf5" />
              <defs>
                <linearGradient id="woodGrainAuth" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#8B6914" />
                  <stop offset="0.5" stopColor="#C48C58" />
                  <stop offset="1" stopColor="#8B6914" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="auth-badge">
            <span className="badge-dot" />
            <span>ART STUDIO</span>
          </div>

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your creative workspace and live 3D plein-air studio.</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <div className="input-wrapper">
              <svg
                className="input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder="artist@studio.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <a href="#forgot" className="forgot-link">
                Forgot password?
              </a>
            </div>
            <div className="input-wrapper">
              <svg
                className="input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                id="password"
                className="form-input"
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn-toggle-pw"
                title={showPw ? 'Hide Password' : 'Show Password'}
                aria-label="Toggle password visibility"
                onClick={() => setShowPw((v) => !v)}
              >
                <svg
                  className="icon-eye"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={showPw ? '#4a7c59' : 'currentColor'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="custom-checkbox" />
              <span className="checkbox-label">Keep me signed in</span>
            </label>
          </div>

          {/* Submit */}
          <button type="submit" className="btn-primary-auth">
            <span>Sign In to Studio</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>

          {/* Divider */}
          <div className="divider">
            <span>or continue with</span>
          </div>

          {/* Social Logins */}
          <div className="social-login-grid">
            <button type="button" className="btn-social">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>
            <button type="button" className="btn-social">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.76 1.05-1.82.93-2.87-.9.04-2 .6-2.64 1.36-.57.65-1.07 1.73-.93 2.76 1.01.08 2.02-.49 2.64-1.25z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>
        </form>

        {/* Footer */}
        <footer className="auth-footer">
          <p>
            Don't have an artist account? <a href="#signup" className="signup-link">Create Account</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
