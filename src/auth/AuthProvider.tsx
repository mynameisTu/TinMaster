import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getOrCreateProfile,
  recoverSession,
  signInWithGoogle as startGoogleSignIn,
  signOutUser,
  type AuthProfile,
} from '../services/authService';
import { supabase, supabaseConfigurationError } from '../services/supabaseClient';

type AuthStatus = 'loading' | 'authenticated' | 'signed_out' | 'error';
type AuthErrorKind = 'authentication' | 'profile' | 'configuration';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: AuthProfile | null;
  error: string | null;
  errorKind: AuthErrorKind | null;
  passwordRecoveryReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryProfileLoad: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi xác thực.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);
  const [passwordRecoveryReady, setPasswordRecoveryReady] = useState(false);

  const applySession = useCallback(async (nextSession: Session | null, generation: number) => {
    if (!supabase) return;
    setSession(nextSession);
    setError(null);
    setErrorKind(null);
    if (!nextSession) {
      setProfile(null);
      setStatus('signed_out');
      return;
    }

    setStatus('loading');
    try {
      const nextProfile = await getOrCreateProfile(supabase, nextSession.user);
      if (generation !== sessionGeneration.current) return;
      setProfile(nextProfile);
      setStatus('authenticated');
    } catch (profileError) {
      if (generation !== sessionGeneration.current) return;
      setProfile(null);
      setErrorKind('profile');
      setError(
        'Không thể tải hồ sơ hoặc vai trò từ Supabase. Kiểm tra quyền truy cập database rồi thử lại.'
      );
      setStatus('error');
    }
  }, []);

  const sessionGeneration = useMemo(() => ({ current: 0 }), []);

  useEffect(() => {
    if (!supabase) {
      setError(supabaseConfigurationError);
      setErrorKind('configuration');
      setStatus('error');
      return;
    }

    let active = true;
    const syncSession = (nextSession: Session | null) => {
      const generation = ++sessionGeneration.current;
      if (active) void applySession(nextSession, generation);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setPasswordRecoveryReady(event === 'PASSWORD_RECOVERY');
      queueMicrotask(() => syncSession(nextSession));
    });

    void recoverSession(supabase).then((recoveredSession) => {
      if (!active) return;
      syncSession(recoveredSession);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      setError(errorMessage(sessionError));
      setErrorKind('authentication');
      setStatus('error');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession, sessionGeneration]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setError(supabaseConfigurationError);
      setErrorKind('configuration');
      setStatus('error');
      return;
    }
    setError(null);
    setErrorKind(null);
    try {
      await startGoogleSignIn(supabase);
    } catch (signInError) {
      setError(errorMessage(signInError));
      setErrorKind('authentication');
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    setErrorKind(null);
    try {
      await signOutUser(supabase);
      const generation = ++sessionGeneration.current;
      await applySession(null, generation);
    } catch (signOutError) {
      setError(errorMessage(signOutError));
      setErrorKind('authentication');
    }
  }, [applySession, sessionGeneration]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session) return;
    const generation = ++sessionGeneration.current;
    setStatus('loading');
    try {
      const nextProfile = await getOrCreateProfile(supabase, session.user);
      if (generation !== sessionGeneration.current) return;
      setProfile(nextProfile);
      setError(null);
      setErrorKind(null);
      setStatus('authenticated');
    } catch (profileError) {
      if (generation !== sessionGeneration.current) return;
      setError(
        'Không thể tải hồ sơ hoặc vai trò từ Supabase. Kiểm tra quyền truy cập database rồi thử lại.'
      );
      setErrorKind('profile');
      setStatus('error');
    }
  }, [session, sessionGeneration]);

  const retryProfileLoad = refreshProfile;

  const value = useMemo(
    () => ({
      status,
      session,
      profile,
      error,
      errorKind,
      passwordRecoveryReady,
      signInWithGoogle,
      signOut,
      refreshProfile,
      retryProfileLoad,
    }),
    [status, session, profile, error, errorKind, passwordRecoveryReady, signInWithGoogle, signOut, refreshProfile, retryProfileLoad]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
