import { createClient, type User } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import type { UserRole } from '../types';

type AccessTokenVerifier = (token: string) => Promise<User | null>;
type ProfileRoleResolver = (userId: string, token: string) => Promise<UserRole | null>;

class SupabaseAuthConfigurationError extends Error {}

let cachedClient: ReturnType<typeof createClient> | null = null;

async function verifySupabaseAccessToken(token: string): Promise<User | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseAuthConfigurationError('Supabase Auth is not configured.');
  }

  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  const { data, error } = await cachedClient.auth.getUser(token);
  if (error) {
    const status = (error as { status?: unknown }).status;
    if (status === 401 || status === 403) return null;
    throw error;
  }
  return data.user;
}

async function resolveSupabaseProfileRole(
  userId: string,
  token: string
): Promise<UserRole | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseAuthConfigurationError('Supabase Auth is not configured.');
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !['student', 'teacher', 'admin'].includes(data.role)) return null;
  return data.role as UserRole;
}

const verifierKey = Symbol.for('tinmaster.access-token-verifier');
const profileRoleResolverKey = Symbol.for('tinmaster.profile-role-resolver');

function currentVerifier(): AccessTokenVerifier {
  return (Reflect.get(globalThis, verifierKey) as AccessTokenVerifier | undefined) ??
    verifySupabaseAccessToken;
}

function currentProfileRoleResolver(): ProfileRoleResolver {
  return (Reflect.get(globalThis, profileRoleResolverKey) as ProfileRoleResolver | undefined) ??
    resolveSupabaseProfileRole;
}

export function configureAccessTokenVerifier(
  verifier: AccessTokenVerifier
): () => void {
  const previousVerifier = Reflect.get(globalThis, verifierKey) as AccessTokenVerifier | undefined;
  Reflect.set(globalThis, verifierKey, verifier);
  return () => {
    if (previousVerifier) Reflect.set(globalThis, verifierKey, previousVerifier);
    else Reflect.deleteProperty(globalThis, verifierKey);
  };
}

export function configureProfileRoleResolver(
  resolver: ProfileRoleResolver
): () => void {
  const previousResolver = Reflect.get(globalThis, profileRoleResolverKey) as ProfileRoleResolver | undefined;
  Reflect.set(globalThis, profileRoleResolverKey, resolver);
  return () => {
    if (previousResolver) Reflect.set(globalThis, profileRoleResolverKey, previousResolver);
    else Reflect.deleteProperty(globalThis, profileRoleResolverKey);
  };
}

export const requireSupabaseUser: RequestHandler = async (req, res, next) => {
  const authorization = req.header('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    const user = await currentVerifier()(match[1]);
    if (!user) {
      res.status(401).json({
        error: 'Invalid or expired authentication session',
        code: 'AUTH_INVALID',
      });
      return;
    }
    res.locals.authenticatedUserId = user.id;
    next();
  } catch (error) {
    if (error instanceof SupabaseAuthConfigurationError) {
      res.status(503).json({
        error: 'Authentication service is not configured',
        code: 'AUTH_CONFIGURATION',
      });
      return;
    }
    console.error('[auth] Supabase token verification failed.');
    res.status(503).json({
      error: 'Authentication service is temporarily unavailable',
      code: 'AUTH_UNAVAILABLE',
    });
  }
};

export function requireSupabaseRole(allowedRoles: readonly UserRole[]): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    const userId = res.locals.authenticatedUserId as string | undefined;

    if (!match || !userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    try {
      const role = await currentProfileRoleResolver()(userId, match[1]);
      if (!role) {
        res.status(403).json({
          error: 'Tài khoản chưa có hồ sơ hoặc vai trò hợp lệ.',
          code: 'PROFILE_UNAVAILABLE',
        });
        return;
      }
      if (!allowedRoles.includes(role)) {
        res.status(403).json({
          error: 'Bạn không có quyền sử dụng chức năng này.',
          code: 'FORBIDDEN',
        });
        return;
      }
      res.locals.authenticatedUserRole = role;
      next();
    } catch (error) {
      if (error instanceof SupabaseAuthConfigurationError) {
        res.status(503).json({
          error: 'Dịch vụ hồ sơ chưa được cấu hình.',
          code: 'PROFILE_CONFIGURATION',
        });
        return;
      }
      console.error('[auth] Supabase profile role lookup failed.');
      res.status(503).json({
        error: 'Không thể tải hồ sơ quyền hạn. Vui lòng thử lại.',
        code: 'PROFILE_LOOKUP_FAILED',
      });
    }
  };
}
