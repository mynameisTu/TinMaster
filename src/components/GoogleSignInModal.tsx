import React, { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { authErrorMessage, signInWithPassword } from '../services/authService';
import { supabaseAuthStorage } from '../services/authStorage';
import { supabase, supabaseConfigurationError } from '../services/supabaseClient';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  errorKind: 'authentication' | 'profile' | 'configuration' | null;
  onRetryProfileLoad?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onSignIn,
  isLoading,
  error,
  errorKind,
  onRetryProfileLoad,
  onSignOut,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  if (!isOpen) return null;

  const handlePasswordSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setLocalError(supabaseConfigurationError);
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      await signInWithPassword(supabase, email, password, rememberMe);
    } catch (signInError) {
      setLocalError(authErrorMessage(signInError, 'login'));
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      supabaseAuthStorage.setRememberMe(rememberMe);
      await onSignIn();
    } catch (signInError) {
      setLocalError(authErrorMessage(signInError, 'login'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">T</span>
          <h1>TinMaster</h1>
        </header>
        <h2 className="auth-title">Đăng nhập</h2>

        {(localError || error) && (
          <div role="alert" className="auth-message auth-message-error">
            {localError || error}
          </div>
        )}

        {errorKind === 'profile' && onRetryProfileLoad ? (
          <div className="auth-form">
            <button
              type="button"
              onClick={() => void onRetryProfileLoad()}
              disabled={isLoading}
              className="auth-primary"
            >
              Thử tải lại hồ sơ
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="auth-secondary"
              >
                Đăng xuất
              </button>
            )}
          </div>
        ) : (
          <>
            <form onSubmit={(event) => void handlePasswordSignIn(event)} className="auth-form">
              <label className="auth-field">
                <span>Địa chỉ email</span>
                <input required type="email" autoComplete="email" value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="auth-input" />
              </label>
              <label className="auth-field">
                <span>Mật khẩu</span>
                <span className="auth-password">
                  <input required type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    value={password} onChange={(event) => setPassword(event.target.value)}
                    className="auth-input auth-password-input" />
                  <button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="auth-password-toggle">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              <div className="auth-options">
                <label className="auth-remember">
                  <input type="checkbox" checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)} />
                  <span>Ghi nhớ đăng nhập trong 30 ngày</span>
                </label>
                <a href="/forgot-password" className="auth-link">Quên mật khẩu?</a>
              </div>
              <button disabled={busy || isLoading} className="auth-primary">
                {busy ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" /> : 'Đăng nhập'}
              </button>
            </form>
            <div className="auth-divider">
              <span>Hoặc</span>
            </div>
            <button type="button" onClick={() => void handleGoogleSignIn()}
              disabled={busy || isLoading || errorKind === 'configuration'}
              className="auth-secondary">
              {busy && !password
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <span aria-hidden="true" className="auth-google-mark">G</span>}
              Đăng nhập bằng Google
            </button>
            <p className="auth-footer-copy">
              Chưa có tài khoản? <a href="/register" className="auth-link">Đăng ký</a>
            </p>
          </>
        )}
      </section>
    </main>
  );
};
