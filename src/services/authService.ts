import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { UserRole } from '../types';
import { supabaseAuthStorage } from './authStorage';

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  school?: string;
  grade?: 10 | 11 | 12;
  examTrack?: 'CS' | 'ICT' | null;
  targetScore: number;
}

const PASSWORD_AUTH_MAX_AGE_SECONDS = 15 * 60;
const PROFILE_COLUMNS =
  'id,email,display_name,avatar_url,role,school,grade,exam_track,target_score';

export function safeAuthRedirectUrl(path: string): string {
  const location = window.location;
  const configuredOrigins = (import.meta.env?.VITE_AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);
  const hostname = location.hostname.toLowerCase();
  const localOrigin = ['localhost', '127.0.0.1'].includes(hostname) &&
    location.protocol === 'http:';
  if (!localOrigin && !configuredOrigins.includes(location.origin)) {
    throw new Error('Tên miền này chưa được cho phép dùng cho liên kết xác thực.');
  }
  return new URL(path, location.origin).toString();
}

export async function recoverSession(client: SupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function selectProfile(client: SupabaseClient, userId: string) {
  return client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
}

export async function getOrCreateProfile(
  client: SupabaseClient,
  user: User
): Promise<AuthProfile> {
  let { data, error } = await selectProfile(client, user.id);
  if (error) throw error;

  if (!data) {
    const ensureResult = await client.rpc('ensure_my_profile');
    if (ensureResult.error) throw ensureResult.error;
    ({ data, error } = await selectProfile(client, user.id));
    if (error) throw error;
  }

  if (!data) {
    throw new Error('Không thể tải hồ sơ Supabase cho tài khoản hiện tại.');
  }

  if (!['student', 'teacher', 'admin'].includes(data.role)) {
    throw new Error('Vai trò tài khoản không hợp lệ.');
  }

  return {
    id: data.id,
    email: data.email ?? user.email ?? '',
    displayName:
      data.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Học sinh',
    avatarUrl: data.avatar_url || user.user_metadata?.avatar_url || undefined,
    role: data.role as UserRole,
    school: data.school ?? undefined,
    grade: data.grade ?? undefined,
    examTrack: data.exam_track ?? null,
    targetScore: Number(data.target_score ?? 8.5),
  };
}

export async function signInWithGoogle(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: safeAuthRedirectUrl('/') },
  });
  if (error) throw error;
}

export async function signInWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
  rememberMe: boolean
): Promise<Session> {
  supabaseAuthStorage.setRememberMe(rememberMe);
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Không nhận được phiên đăng nhập hợp lệ.');
  return data.session;
}

export class AdminAccessDeniedError extends Error {}
export class AuthProfileLoadError extends Error {}
export class AuthConfigurationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number
  ) {
    super(message);
  }
}

export type AuthErrorFlow =
  | 'registration'
  | 'recovery'
  | 'login'
  | 'oauth'
  | 'session'
  | 'logout';

function authErrorDetails(error: unknown): { code: string | null; status: number | null } {
  if (!error || typeof error !== 'object') return { code: null, status: null };
  const candidate = error as { code?: unknown; status?: unknown };
  const code = typeof candidate.code === 'string' &&
    /^[a-z0-9_]+$/i.test(candidate.code)
    ? candidate.code.toLowerCase()
    : null;
  const status = typeof candidate.status === 'number' &&
    Number.isInteger(candidate.status) &&
    candidate.status >= 100 &&
    candidate.status <= 599
    ? candidate.status
    : null;
  return { code, status };
}

export function authErrorMessage(error: unknown, flow: AuthErrorFlow): string {
  if (error instanceof AuthConfigurationError) return error.message;
  const { code, status } = authErrorDetails(error);
  if (flow === 'recovery' && [
    'user_not_found',
    'email_not_found',
    'email_not_confirmed',
    'invalid_credentials',
  ].includes(code ?? '')) {
    return 'Nếu tài khoản có thể khôi phục, hướng dẫn sẽ được gửi tới email đã nhập.';
  }
  if (flow === 'registration' && code === 'user_already_exists') {
    return 'Nếu email đủ điều kiện đăng ký, hướng dẫn xác minh sẽ được gửi tới hộp thư.';
  }
  const identifier = code
    ? `Mã Supabase: ${code}${status ? ` (HTTP ${status})` : ''}.`
    : status
      ? `HTTP ${status} từ Supabase Auth.`
      : 'Không nhận được mã lỗi từ Supabase Auth.';

  if (flow === 'oauth' && ['provider_disabled', 'unsupported_provider'].includes(code ?? '')) {
    return `Đăng nhập Google chưa được bật. ${identifier}`;
  }
  if (flow === 'oauth' && (status !== null && status >= 500)) {
    return `Đăng nhập Google đang gặp sự cố tạm thời. Vui lòng thử lại sau. ${identifier}`;
  }
  if (flow === 'oauth' && (code === 'network_error' || code === 'fetch_error')) {
    return 'Không thể kết nối để đăng nhập Google. Kiểm tra mạng rồi thử lại.';
  }
  if (code === 'access_denied' || code === 'user_cancelled') {
    return 'Bạn đã hủy đăng nhập. Hãy thử lại nếu muốn tiếp tục.';
  }
  if (flow === 'session') {
    if (code === 'refresh_token_not_found' || code === 'invalid_refresh_token') {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return `Không thể khôi phục phiên đăng nhập. Vui lòng tải lại trang hoặc đăng nhập lại. ${identifier}`;
  }
  if (flow === 'logout') {
    return `Không thể đăng xuất an toàn lúc này. Vui lòng thử lại. ${identifier}`;
  }
  if (code === 'weak_password' || code === 'password_too_short') {
    return `Mật khẩu không đáp ứng chính sách bảo mật của Supabase. ${identifier}`;
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) {
    return `Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại. ${identifier}`;
  }
  if (code === 'email_provider_disabled' || code === 'signup_disabled') {
    return `Đăng ký email và mật khẩu hiện chưa khả dụng. Vui lòng liên hệ quản trị viên. ${identifier}`;
  }
  if (
    code === 'redirect_to_not_allowed' ||
    code === 'bad_redirect_url' ||
    code === 'validation_failed'
  ) {
    return `URL chuyển hướng chưa được cho phép trong Supabase Auth. ${identifier}`;
  }
  if (flow === 'recovery' && (status !== null && status >= 500)) {
    return `Chưa thể gửi email khôi phục lúc này. Vui lòng thử lại sau. ${identifier}`;
  }
  if (flow === 'registration' && (status !== null && status >= 500)) {
    return `Chưa thể gửi email xác minh lúc này. Vui lòng thử lại sau. ${identifier}`;
  }
  if (flow === 'login' && (code === 'invalid_credentials' || status === 400)) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  return `Không thể hoàn tất yêu cầu xác thực. ${identifier}`;
}

export async function signInAdministrator(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  const session = await signInWithPassword(client, email, password, false);
  try {
    let profile: AuthProfile;
    try {
      profile = await getOrCreateProfile(client, session.user);
    } catch {
      throw new AuthProfileLoadError('Không thể tải hồ sơ quyền quản trị.');
    }
    if (!await verifyAdminPasswordSession(client, profile, session)) {
      throw new AdminAccessDeniedError(
        profile.role === 'admin'
          ? 'Supabase chưa xác nhận phương thức mật khẩu mới đây cho phiên đăng nhập này.'
          : 'Tài khoản này không có quyền quản trị.'
      );
    }
  } catch (error) {
    await signOutUser(client);
    throw error;
  }
}

export async function registerWithPassword(
  client: SupabaseClient,
  fullName: string,
  email: string,
  password: string
): Promise<void> {
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: safeAuthRedirectUrl('/'),
    },
  });
  if (error) throw error;
  if (data.session) {
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    throw new AuthConfigurationError(
      'Supabase đã tạo phiên ngay lập tức. Bật xác minh email để yêu cầu học sinh xác nhận địa chỉ trước khi đăng nhập.',
      'email_confirmation_required'
    );
  }
}

export async function requestPasswordRecovery(
  client: SupabaseClient,
  email: string
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: safeAuthRedirectUrl('/reset-password'),
  });
  if (error) throw error;
}

async function requireVerifiedAdminAccount(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user || !user.email || !user.email_confirmed_at) {
    throw new AdminAccessDeniedError(
      'Cần đăng nhập bằng tài khoản quản trị có email đã xác minh.'
    );
  }
  const verifiedEmail = user.email;

  let profile: AuthProfile;
  try {
    profile = await getOrCreateProfile(client, user);
  } catch {
    throw new AuthProfileLoadError('Không thể tải hồ sơ quyền quản trị.');
  }
  if (profile.role !== 'admin') {
    throw new AdminAccessDeniedError('Tài khoản hiện tại không có quyền quản trị.');
  }
  return verifiedEmail;
}

export async function beginAdminPasswordSetup(client: SupabaseClient): Promise<string> {
  const email = await requireVerifiedAdminAccount(client);
  const { error } = await client.auth.reauthenticate();
  if (error) throw error;
  return email;
}

export async function finishAdminPasswordSetup(
  client: SupabaseClient,
  verificationCode: string,
  password: string
): Promise<void> {
  await requireVerifiedAdminAccount(client);
  const nonce = verificationCode.trim();
  if (!nonce) throw new Error('Mã xác minh là bắt buộc.');
  const { error } = await client.auth.updateUser({ password, nonce });
  if (error) throw error;
}

export async function updatePassword(
  client: SupabaseClient,
  password: string
): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export type PasswordRecoveryState = 'loading' | 'ready' | 'invalid';

export function passwordRecoveryState(
  authStatus: string,
  recoveryReady: boolean
): PasswordRecoveryState {
  if (authStatus === 'loading') return 'loading';
  return authStatus === 'authenticated' && recoveryReady ? 'ready' : 'invalid';
}

export function hasRecentPasswordAuthentication(
  claims: unknown,
  nowMilliseconds = Date.now()
): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const tokenClaims = claims as Record<string, unknown>;
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  if (!Array.isArray(tokenClaims.amr)) return false;
  return tokenClaims.amr.some((entry) => {
    let timestamp: number;
    if (entry === 'password') {
      timestamp = Number(tokenClaims.auth_time);
    } else if (entry && typeof entry === 'object') {
      const amr = entry as Record<string, unknown>;
      if (amr.method !== 'password') return false;
      timestamp = Number(amr.timestamp);
    } else {
      return false;
    }
    return Number.isFinite(timestamp) &&
      timestamp <= nowSeconds + 60 &&
      nowSeconds - timestamp >= 0 &&
      nowSeconds - timestamp <= PASSWORD_AUTH_MAX_AGE_SECONDS;
  });
}

export type AdminDashboardAccess = 'loading' | 'sign_in' | 'forbidden' | 'allow';

export function adminDashboardAccess(
  authStatus: string,
  role: UserRole | null,
  passwordMethodVerified: boolean
): AdminDashboardAccess {
  if (authStatus === 'loading') return 'loading';
  if (authStatus !== 'authenticated') return 'sign_in';
  if (role !== 'admin') return 'forbidden';
  return passwordMethodVerified ? 'allow' : 'sign_in';
}

export async function verifyAdminPasswordSession(
  client: SupabaseClient,
  profile: AuthProfile | null,
  session?: Session | null
): Promise<boolean> {
  if (profile?.role !== 'admin') return false;
  let accessToken = session?.access_token;
  if (!accessToken) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session || sessionData.session.user.id !== profile.id) return false;
    accessToken = sessionData.session.access_token;
  }
  const { data, error } = await client.auth.getClaims(accessToken);
  if (error) throw error;
  return data?.claims?.sub === profile.id &&
    hasRecentPasswordAuthentication(data?.claims);
}

export async function signOutUser(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function redeemTeacherInvitation(
  client: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await client.rpc('redeem_teacher_invitation', {
    p_token: token.trim(),
  });
  if (error) throw error;
}

export async function createTeacherInvitation(
  client: SupabaseClient,
  email: string
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await client.rpc('create_teacher_invitation', {
    p_email: email.trim(),
  });
  if (error) throw error;

  const invitation = Array.isArray(data) ? data[0] : data;
  if (!invitation?.token || !invitation?.expires_at) {
    throw new Error('Máy chủ không trả về thông tin lời mời hợp lệ.');
  }

  return { token: invitation.token, expiresAt: invitation.expires_at };
}

export async function setUserRole(
  client: SupabaseClient,
  userId: string,
  role: 'student'
): Promise<void> {
  const { error } = await client.rpc('set_user_role', {
    p_target_user_id: userId,
    p_target_role: role,
  });
  if (error) throw error;
}

export async function revokeTeacherInvitation(
  client: SupabaseClient,
  invitationId: string
): Promise<void> {
  const { error } = await client.rpc('revoke_teacher_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}
