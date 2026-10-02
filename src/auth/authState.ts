import type { Session } from '@supabase/supabase-js';
import type { AuthProfile } from '../services/authService';

export type AuthStatus = 'loading' | 'authenticated' | 'signed_out' | 'error';
export type AuthErrorKind = 'authentication' | 'profile' | 'configuration';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: AuthProfile | null;
  error: string | null;
  errorKind: AuthErrorKind | null;
  passwordRecoveryReady: boolean;
  generation: number;
}

export type AuthStateAction =
  | {
      type: 'auth_event';
      event: string;
      session: Session | null;
      generation: number;
    }
  | { type: 'session_restored'; session: Session | null; generation: number }
  | { type: 'profile_loaded'; profile: AuthProfile; generation: number }
  | { type: 'target_score_updated'; userId: string; targetScore: number; generation: number }
  | { type: 'profile_failed'; message: string; generation: number }
  | { type: 'session_failed'; message: string; generation: number }
  | { type: 'operation_failed'; message: string }
  | { type: 'configuration_failed'; message: string };

export const initialAuthState: AuthState = {
  status: 'loading',
  session: null,
  profile: null,
  error: null,
  errorKind: null,
  passwordRecoveryReady: false,
  generation: 0,
};

function applySession(state: AuthState, session: Session | null, generation: number): AuthState {
  if (generation < state.generation) return state;
  return {
    ...state,
    status: session ? 'loading' : 'signed_out',
    session,
    profile: null,
    error: null,
    errorKind: null,
    generation,
  };
}

export function authStateReducer(state: AuthState, action: AuthStateAction): AuthState {
  switch (action.type) {
    case 'auth_event':
      if (action.generation < state.generation) return state;
      return {
        ...applySession(state, action.session, action.generation),
        passwordRecoveryReady: action.event === 'PASSWORD_RECOVERY',
      };
    case 'session_restored':
      return applySession(state, action.session, action.generation);
    case 'profile_loaded':
      if (
        action.generation !== state.generation ||
        state.session?.user.id !== action.profile.id
      ) return state;
      return {
        ...state,
        status: 'authenticated',
        profile: action.profile,
        error: null,
        errorKind: null,
      };
    case 'target_score_updated':
      if (
        action.generation !== state.generation ||
        state.session?.user.id !== action.userId ||
        state.profile?.id !== action.userId
      ) return state;
      return {
        ...state,
        profile: { ...state.profile, targetScore: action.targetScore },
      };
    case 'profile_failed':
      if (action.generation !== state.generation || !state.session) return state;
      return {
        ...state,
        status: 'error',
        profile: null,
        error: action.message,
        errorKind: 'profile',
      };
    case 'session_failed':
      if (action.generation < state.generation) return state;
      return {
        ...state,
        status: 'error',
        session: null,
        profile: null,
        error: action.message,
        errorKind: 'authentication',
        passwordRecoveryReady: false,
        generation: action.generation,
      };
    case 'operation_failed':
      return {
        ...state,
        status: state.session ? state.status : 'signed_out',
        error: action.message,
        errorKind: 'authentication',
      };
    case 'configuration_failed':
      return {
        ...state,
        status: 'error',
        session: null,
        profile: null,
        error: action.message,
        errorKind: 'configuration',
      };
  }
}
