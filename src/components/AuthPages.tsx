import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  AdminAccessDeniedError,
  AuthProfileLoadError,
  adminDashboardAccess,
  authErrorMessage,
  beginAdminPasswordSetup,
  finishAdminPasswordSetup,
  passwordRecoveryState,
  registerWithPassword,
  requestPasswordRecovery,
  signInAdministrator,
  signOutUser,
  updatePassword,
  verifyAdminPasswordSession,
} from '../services/authService';
import { supabase, supabaseConfigurationError } from '../services/supabaseClient';
import { AdminRoleManagement } from './AdminRoleManagement';
import { AdminResearchDashboard } from './AdminResearchDashboard';

const passwordRequirement = 'Ít nhất 10 ký tự, gồm chữ hoa, chữ thường và chữ số.';
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

function AuthFrame({ title, brand = 'TinMaster', children }: {
  title?: string;
  brand?: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">T</span>
          <h1>{brand}</h1>
        </header>
        {title && <h2 className="auth-title">{title}</h2>}
        {children}
      </section>
    </main>
  );
}

function AuthMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p role="alert" className="auth-message auth-message-error">{error}</p>;
  if (success) return <p role="status" className="auth-message auth-message-success">{success}</p>;
  return null;
}

export function RegistrationPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!passwordPattern.test(password)) {
      setError(passwordRequirement);
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    setBusy(true);
    try {
      await registerWithPassword(supabase, fullName, email, password);
      setSuccess(true);
    } catch (registrationError) {
      setError(authErrorMessage(registrationError, 'registration'));
    } finally {
      setBusy(false);
      setPassword('');
      setConfirmation('');
    }
  };

  return (
    <AuthFrame title="Tạo tài khoản">
      <form onSubmit={(event) => void submit(event)} className="auth-form">
        <AuthMessage error={error} success={success
          ? 'Nếu địa chỉ email hợp lệ, hãy kiểm tra hộp thư để xác minh tài khoản trước khi đăng nhập.'
          : null} />
        <label className="auth-field">
          <span>Họ và tên</span>
          <input required maxLength={120} autoComplete="name" value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="auth-input" />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input required type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-input" />
        </label>
        <label className="auth-field">
          <span>Mật khẩu</span>
          <input required type="password" autoComplete="new-password" value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input" />
        </label>
        <label className="auth-field">
          <span>Xác nhận mật khẩu</span>
          <input required type="password" autoComplete="new-password" value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="auth-input" />
        </label>
        <button disabled={busy || success} className="auth-primary">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Tạo tài khoản
        </button>
        <a className="auth-footer-link" href="/">Đăng nhập</a>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) return;
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (!remaining) setCooldownUntil(0);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    if (cooldownSeconds > 0) return;
    setBusy(true);
    setCooldownUntil(Date.now() + 60_000);
    try {
      await requestPasswordRecovery(supabase, email);
      setSubmitted(true);
    } catch (recoveryError) {
      setError(authErrorMessage(recoveryError, 'recovery'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Khôi phục mật khẩu">
      <form onSubmit={(event) => void submit(event)} className="auth-form">
        <AuthMessage error={error} success={submitted
          ? 'Nếu tài khoản tồn tại và có thể khôi phục, hướng dẫn sẽ được gửi tới email đã nhập.'
          : null} />
        <label className="auth-field">
          <span>Email</span>
          <input required type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-input" />
        </label>
        <button disabled={busy || cooldownSeconds > 0} className="auth-primary">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {cooldownSeconds > 0 ? `Thử lại sau ${cooldownSeconds} giây` : 'Gửi hướng dẫn khôi phục'}
        </button>
        <a className="auth-footer-link" href="/">Quay lại đăng nhập</a>
      </form>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!passwordPattern.test(password)) {
      setError(passwordRequirement);
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!supabase || !auth.passwordRecoveryReady) {
      setError('Liên kết đặt lại không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(supabase, password);
      await signOutUser(supabase);
      window.location.replace('/');
    } catch {
      setError('Không thể cập nhật mật khẩu. Hãy yêu cầu liên kết đặt lại mới.');
    } finally {
      setBusy(false);
      setPassword('');
      setConfirmation('');
    }
  };

  const recoveryState = passwordRecoveryState(auth.status, auth.passwordRecoveryReady);
  return (
    <AuthFrame title="Đặt mật khẩu mới">
      {recoveryState === 'loading' ? (
        <p role="status" className="auth-muted">Đang xác minh liên kết…</p>
      ) : auth.status === 'error' ? (
        <div className="auth-form">
          <p role="alert" className="auth-message auth-message-error">
            {auth.errorKind === 'profile'
              ? 'Liên kết đã được xác thực nhưng không thể tải hồ sơ. Hãy thử tải hồ sơ lại.'
              : 'Không thể xác minh phiên đặt lại. Hãy yêu cầu liên kết mới.'}
          </p>
          {auth.errorKind === 'profile' && (
            <button onClick={() => void auth.retryProfileLoad()} className="auth-primary">
              Thử tải hồ sơ lại
            </button>
          )}
        </div>
      ) : recoveryState === 'ready' ? (
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <AuthMessage error={error} />
          <label className="auth-field">
            <span>Mật khẩu mới</span>
            <input required type="password" autoComplete="new-password" value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input" />
          </label>
          <label className="auth-field">
            <span>Xác nhận mật khẩu</span>
            <input required type="password" autoComplete="new-password" value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="auth-input" />
          </label>
          <button disabled={busy} className="auth-primary">
            {busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      ) : (
        <div className="auth-form">
          <p role="alert" className="auth-message auth-message-error">
            Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết đặt lại mới.
          </p>
          <a className="auth-footer-link" href="/forgot-password">Yêu cầu liên kết mới</a>
        </div>
      )}
    </AuthFrame>
  );
}

export function AdminSignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    setBusy(true);
    try {
      await signInAdministrator(supabase, email, password);
      window.location.replace('/admin/dashboard');
    } catch (signInError) {
      setError(signInError instanceof AdminAccessDeniedError ||
        signInError instanceof AuthProfileLoadError
        ? signInError.message
        : authErrorMessage(signInError, 'login'));
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <AuthFrame brand="TinMaster Admin">
      <form onSubmit={(event) => void submit(event)} className="auth-form">
        <AuthMessage error={error} />
        <label className="auth-field">
          <span>Email</span>
          <input required type="email" autoComplete="username" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-input" />
        </label>
        <label className="auth-field">
          <span>Mật khẩu</span>
          <input required type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} className="auth-input" />
        </label>
        <button disabled={busy} className="auth-primary">
          {busy ? 'Đang xác thực…' : 'Đăng nhập'}
        </button>
        <a className="auth-footer-link" href="/forgot-password">Quên mật khẩu?</a>
      </form>
    </AuthFrame>
  );
}

export function AdminPasswordSetupPage() {
  const auth = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const sendVerification = async () => {
    setError(null);
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    setBusy(true);
    try {
      setEmail(await beginAdminPasswordSetup(supabase));
    } catch (setupError) {
      setError(setupError instanceof AdminAccessDeniedError ||
        setupError instanceof AuthProfileLoadError
        ? setupError.message
        : 'Không thể gửi mã xác minh. Kiểm tra email đã xác minh và thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!passwordPattern.test(password)) {
      setError(passwordRequirement);
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    setBusy(true);
    try {
      await finishAdminPasswordSetup(supabase, verificationCode, password);
      setComplete(true);
      setPassword('');
      setConfirmation('');
      try {
        await auth.signOut();
        window.location.replace('/admin');
      } catch {
        setError('Mật khẩu đã được cập nhật. Đăng xuất rồi đăng nhập lại tại /admin.');
      }
    } catch (setupError) {
      setError(setupError instanceof AdminAccessDeniedError ||
        setupError instanceof AuthProfileLoadError
        ? setupError.message
        : 'Không thể xác minh mã hoặc cập nhật mật khẩu. Mã có thể đã hết hạn hoặc đã được dùng.');
      setPassword('');
      setConfirmation('');
    } finally {
      setBusy(false);
    }
  };

  if (auth.status === 'loading') {
    return <AuthFrame title="Thiết lập mật khẩu quản trị"><p role="status">Đang xác minh phiên…</p></AuthFrame>;
  }
  if (auth.status !== 'authenticated' || auth.profile?.role !== 'admin') {
    return (
      <AuthFrame title="Không có quyền thiết lập mật khẩu">
        <p role="alert" className="text-sm text-red-700">
          Hãy đăng nhập bằng Google vào tài khoản quản trị hiện có trước khi thiết lập mật khẩu.
        </p>
        <a href="/" className="block text-center text-sm text-blue-700 underline">Quay lại đăng nhập</a>
      </AuthFrame>
    );
  }
  if (complete) {
    return (
      <AuthFrame title="Đã cập nhật mật khẩu">
        <p role="status" className="text-sm text-emerald-800">
          Mật khẩu đã được cập nhật trên tài khoản hiện tại. UUID và vai trò quản trị được giữ nguyên.
        </p>
        <a href="/admin" className="block text-center text-sm text-blue-700 underline">
          Đăng nhập quản trị bằng email và mật khẩu
        </a>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Thiết lập mật khẩu quản trị">
      {!email ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            TinMaster sẽ gửi mã xác minh một lần tới email đã xác minh của tài khoản đang đăng nhập.
            Không tạo tài khoản mới và không thay đổi vai trò.
          </p>
          <AuthMessage error={error} />
          <button type="button" disabled={busy} onClick={() => void sendVerification()}
            className="var-btn w-full text-sm disabled:opacity-60">
            {busy ? 'Đang gửi mã…' : 'Gửi mã xác minh'}
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <p className="text-sm text-slate-600">
            Nhập mã gửi tới <strong>{email}</strong>. Mã có thời hạn theo cấu hình Supabase Auth.
          </p>
          <AuthMessage error={error} />
          <label className="block space-y-1 text-sm">
            <span>Mã xác minh</span>
            <input required autoComplete="one-time-code" inputMode="numeric" value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Mật khẩu mới</span>
            <input required type="password" autoComplete="new-password" value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="admin-password-requirements"
              className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <p id="admin-password-requirements" className="text-xs text-slate-500">{passwordRequirement}</p>
          <label className="block space-y-1 text-sm">
            <span>Xác nhận mật khẩu</span>
            <input required type="password" autoComplete="new-password" value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <button disabled={busy} className="var-btn w-full text-sm disabled:opacity-60">
            {busy ? 'Đang cập nhật…' : 'Thiết lập mật khẩu trên tài khoản này'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setEmail(null); setVerificationCode(''); }}
            className="w-full text-sm text-blue-700 underline">
            Yêu cầu mã mới
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

export function AdminDashboardPage() {
  const auth = useAuth();
  const [methodVerified, setMethodVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (auth.status === 'loading') return;
    if (auth.status === 'error') {
      setChecking(false);
      return;
    }
    if (auth.status !== 'authenticated' || !auth.profile) {
      window.location.replace('/admin');
      return;
    }
    if (auth.profile.role !== 'admin' || !supabase) {
      setChecking(false);
      return;
    }
    void verifyAdminPasswordSession(supabase, auth.profile, auth.session).then((verified) => {
      if (!active) return;
      setMethodVerified(verified);
      setChecking(false);
      if (!verified) window.location.replace('/admin');
    }).catch(() => {
      if (!active) return;
      setChecking(false);
      window.location.replace('/admin');
    });
    return () => { active = false; };
  }, [auth.profile, auth.session, auth.status]);

  const access = adminDashboardAccess(
    checking ? 'loading' : auth.status,
    auth.profile?.role ?? null,
    methodVerified
  );
  if (access === 'loading') {
    return <AuthFrame title="Quản trị viên TinMaster"><p role="status">Đang xác minh quyền truy cập…</p></AuthFrame>;
  }
  if (auth.status === 'error') {
    return (
      <AuthFrame title="Không thể xác minh quyền quản trị">
        <p role="alert" className="text-sm text-red-700">
          {auth.errorKind === 'profile'
            ? 'Không thể tải hồ sơ và quyền từ Supabase.'
            : 'Không thể khôi phục phiên xác thực.'}
        </p>
        <a className="text-sm text-blue-700 underline" href="/admin">Đăng nhập lại</a>
      </AuthFrame>
    );
  }
  if (access === 'sign_in') return null;
  if (access === 'forbidden') {
    return (
      <AuthFrame title="Không có quyền truy cập">
        <p role="alert" className="text-sm text-red-700">Tài khoản hiện tại không có quyền quản trị.</p>
        <button onClick={() => void auth.signOut()} className="var-btn w-full text-sm">Đăng xuất</button>
      </AuthFrame>
    );
  }
  if (!methodVerified) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4">
      <header className="mx-auto flex max-w-7xl items-center justify-between py-4">
        <h1 className="text-xl font-bold text-slate-900">Bảng điều khiển quản trị</h1>
        <button onClick={() => void auth.signOut().then(() => window.location.replace('/admin'))}
          className="var-btn-outline text-sm">Đăng xuất</button>
      </header>
      <AdminRoleManagement />
      <AdminResearchDashboard />
    </div>
  );
}

export function AuthenticationRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return <AdminSignInPage />;
  if (path === '/admin/dashboard') return <AdminDashboardPage />;
  if (path === '/admin/setup-password') return <AdminPasswordSetupPage />;
  if (path === '/register') return <RegistrationPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  return null;
}
