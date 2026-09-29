import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  authErrorMessage,
  getOrCreateProfile,
  recoverSession,
  signInWithGoogle as startGoogleSignIn,
  signOutUser,
  type AuthProfile,
} from '../services/authService';
import { supabase, supabaseConfigurationError } from '../services/supabaseClient';
import {
  authStateReducer,
  initialAuthState,
  type AuthErrorKind,
  type AuthStatus,
} from './authState';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authStateReducer, initialAuthState);
  const generation = useRef(0);

  const syncSession = useCallback(async (
    nextSession: Session | null,
    source: 'auth_event' | 'session_restored',
    event?: string
  ) => {
    if (!supabase) return;
    const requestGeneration = ++generation.current;
    dispatch(source === 'auth_event'
      ? {
          type: 'auth_event',
          event: event ?? '',
          session: nextSession,
          generation: requestGeneration,
        }
      : { type: 'session_restored', session: nextSession, generation: requestGeneration });
    if (!nextSession) {
      return;
    }

    try {
      const nextProfile = await getOrCreateProfile(supabase, nextSession.user);
      dispatch({
        type: 'profile_loaded',
        profile: nextProfile,
        generation: requestGeneration,
      });
    } catch {
      dispatch({
        type: 'profile_failed',
        message: 'Không thể tải hồ sơ hoặc quyền hạn. Vui lòng thử lại.',
        generation: requestGeneration,
      });
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      dispatch({ type: 'configuration_failed', message: supabaseConfigurationError });
      return;
    }

    let active = true;
    let authEventReceived = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true;
      queueMicrotask(() => {
        if (active) void syncSession(nextSession, 'auth_event', event);
      });
    });

    void recoverSession(supabase).then((recoveredSession) => {
      if (!active || authEventReceived) return;
      void syncSession(recoveredSession, 'session_restored');
    }).catch((sessionError: unknown) => {
      if (!active || authEventReceived) return;
      const requestGeneration = ++generation.current;
      dispatch({
        type: 'session_failed',
        message: authErrorMessage(sessionError, 'session'),
        generation: requestGeneration,
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      dispatch({ type: 'configuration_failed', message: supabaseConfigurationError });
      return;
    }
    try {
      await startGoogleSignIn(supabase);
    } catch (signInError) {
      dispatch({
        type: 'operation_failed',
        message: authErrorMessage(signInError, 'oauth'),
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await signOutUser(supabase);
      await syncSession(null, 'auth_event', 'SIGNED_OUT');
    } catch (signOutError) {
      dispatch({
        type: 'operation_failed',
        message: authErrorMessage(signOutError, 'logout'),
      });
    }
  }, [syncSession]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !state.session) return;
    const requestGeneration = ++generation.current;
    dispatch({
      type: 'session_restored',
      session: state.session,
      generation: requestGeneration,
    });
    try {
      const nextProfile = await getOrCreateProfile(supabase, state.session.user);
      dispatch({
        type: 'profile_loaded',
        profile: nextProfile,
        generation: requestGeneration,
      });
    } catch {
      dispatch({
        type: 'profile_failed',
        message: 'Không thể tải hồ sơ hoặc quyền hạn. Vui lòng thử lại.',
        generation: requestGeneration,
      });
    }
  }, [state.session]);

  const retryProfileLoad = refreshProfile;

  const value = useMemo(
    () => ({
      status: state.status,
      session: state.session,
      profile: state.profile,
      error: state.error,
      errorKind: state.errorKind,
      passwordRecoveryReady: state.passwordRecoveryReady,
      signInWithGoogle,
      signOut,
      refreshProfile,
      retryProfileLoad,
    }),
    [state, signInWithGoogle, signOut, refreshProfile, retryProfileLoad]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
