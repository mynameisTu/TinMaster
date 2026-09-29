import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  adminDashboardAccess,
  createTeacherInvitation,
  getOrCreateProfile,
  hasRecentPasswordAuthentication,
  redeemTeacherInvitation,
  registerWithPassword,
  recoverSession,
  requestPasswordRecovery,
  revokeTeacherInvitation,
  signInAdministrator,
  signInWithPassword,
  setUserRole,
  safeAuthRedirectUrl,
  signOutUser,
  signInWithGoogle,
  updatePassword,
  verifyAdminPasswordSession,
  AdminAccessDeniedError,
  beginAdminPasswordSetup,
  finishAdminPasswordSetup,
  passwordRecoveryState,
  authErrorMessage,
  AuthConfigurationError,
} from '../src/services/authService';
import { createAuthStorageAdapter } from '../src/services/authStorage';
import {
  authStateReducer,
  initialAuthState,
} from '../src/auth/authState';

const authUser = {
  id: 'verified-supabase-auth-uuid',
  email: 'student@example.com',
  user_metadata: { role: 'admin', name: 'Student Name' },
} as unknown as User;

const verifiedAdminUser = {
  id: 'existing-google-admin-auth-uuid',
  email: 'admin@example.com',
  email_confirmed_at: '2026-09-26T10:00:00.000Z',
  user_metadata: { role: 'student' },
} as unknown as User;

function clientStub(overrides: Record<string, unknown> = {}): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

function adminProfileClient(auth: Record<string, unknown>): SupabaseClient {
  return clientStub({
    auth,
    from: (table: string) => {
      assert.equal(table, 'profiles');
      return {
        select: () => ({
          eq: (_column: string, id: string) => {
            assert.equal(id, verifiedAdminUser.id);
            return {
              maybeSingle: async () => ({
                data: {
                  id: verifiedAdminUser.id,
                  email: verifiedAdminUser.email,
                  display_name: 'Existing Admin',
                  role: 'admin',
                  target_score: 8.5,
                },
                error: null,
              }),
            };
          },
        }),
      };
    },
  });
}

test('first-time users receive the database-created student profile keyed by Auth UUID', async () => {
  let profileReads = 0;
  let ensureCalls = 0;
  const client = clientStub({
    from: (table: string) => {
      assert.equal(table, 'profiles');
      return {
        select: () => ({
          eq: (_column: string, id: string) => {
            assert.equal(id, authUser.id);
            return {
              maybeSingle: async () => {
                profileReads += 1;
                return profileReads === 1
                  ? { data: null, error: null }
                  : {
                      data: {
                        id: authUser.id,
                        email: authUser.email,
                        display_name: 'Student Name',
                        role: 'student',
                        target_score: 8.5,
                      },
                      error: null,
                    };
              },
            };
          },
        }),
      };
    },
    rpc: async (name: string) => {
      assert.equal(name, 'ensure_my_profile');
      ensureCalls += 1;
      return { data: null, error: null };
    },
  });

  const profile = await getOrCreateProfile(client, authUser);
  assert.equal(profile.id, authUser.id);
  assert.equal(profile.role, 'student');
  assert.equal(ensureCalls, 1);
  assert.equal(profileReads, 2);
});

test('profile refresh after a later sign-in reads the current database role again', async () => {
  let role: 'student' | 'teacher' = 'student';
  const client = clientStub({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: authUser.id,
              email: authUser.email,
              display_name: 'Student Name',
              role,
              target_score: 8.5,
            },
            error: null,
          }),
        }),
      }),
    }),
  });

  const firstLogin = await getOrCreateProfile(client, authUser);
  role = 'teacher';
  const subsequentLogin = await getOrCreateProfile(client, authUser);
  assert.equal(firstLogin.role, 'student');
  assert.equal(subsequentLogin.role, 'teacher');
});

test('session recovery returns the persisted Supabase session', async () => {
  const session = { user: authUser, access_token: 'test-token' } as Session;
  const recovered = await recoverSession(clientStub({
    auth: { getSession: async () => ({ data: { session }, error: null }) },
  }));
  assert.equal(recovered, session);
});

test('sign-out delegates to Supabase and surfaces provider errors', async () => {
  let signOutCalls = 0;
  await signOutUser(clientStub({
    auth: { signOut: async () => { signOutCalls += 1; return { error: null }; } },
  }));
  assert.equal(signOutCalls, 1);

  await assert.rejects(
    signOutUser(clientStub({
      auth: { signOut: async () => ({ error: new Error('sign out rejected') }) },
    })),
    /sign out rejected/
  );
});

test('auth state reducer restores sessions and handles authentication-state events', () => {
  const session = { user: authUser, access_token: 'restored-token' } as Session;
  const profile = {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName: 'Student',
    role: 'student' as const,
    targetScore: 8.5,
  };

  const restoring = authStateReducer(initialAuthState, {
    type: 'session_restored',
    session,
    generation: 1,
  });
  assert.equal(restoring.status, 'loading');
  assert.equal(restoring.session, session);

  const signedIn = authStateReducer(restoring, {
    type: 'profile_loaded',
    profile,
    generation: 1,
  });
  assert.equal(signedIn.status, 'authenticated');
  assert.equal(signedIn.profile, profile);

  const recovering = authStateReducer(signedIn, {
    type: 'auth_event',
    event: 'PASSWORD_RECOVERY',
    session,
    generation: 2,
  });
  assert.equal(recovering.status, 'loading');
  assert.equal(recovering.passwordRecoveryReady, true);

  const signedOut = authStateReducer(recovering, {
    type: 'auth_event',
    event: 'SIGNED_OUT',
    session: null,
    generation: 3,
  });
  assert.equal(signedOut.status, 'signed_out');
  assert.equal(signedOut.session, null);
  assert.equal(signedOut.profile, null);
  assert.equal(signedOut.passwordRecoveryReady, false);
});

test('stale asynchronous profile loads cannot overwrite a newer session or sign-out', () => {
  const firstSession = {
    user: authUser,
    access_token: 'first-session',
  } as Session;
  const secondUser = { ...authUser, id: 'second-user-uuid' } as User;
  const secondSession = {
    user: secondUser,
    access_token: 'second-session',
  } as Session;
  const firstProfile = {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName: 'First user',
    role: 'student' as const,
    targetScore: 8.5,
  };
  const secondProfile = {
    ...firstProfile,
    id: secondUser.id,
    displayName: 'Second user',
  };

  let state = authStateReducer(initialAuthState, {
    type: 'auth_event',
    event: 'SIGNED_IN',
    session: firstSession,
    generation: 1,
  });
  state = authStateReducer(state, {
    type: 'auth_event',
    event: 'TOKEN_REFRESHED',
    session: secondSession,
    generation: 2,
  });
  const afterStaleResult = authStateReducer(state, {
    type: 'profile_loaded',
    profile: firstProfile,
    generation: 1,
  });
  assert.equal(afterStaleResult.session, secondSession);
  assert.equal(afterStaleResult.profile, null);

  state = authStateReducer(afterStaleResult, {
    type: 'profile_loaded',
    profile: secondProfile,
    generation: 2,
  });
  assert.equal(state.profile, secondProfile);

  state = authStateReducer(state, {
    type: 'auth_event',
    event: 'SIGNED_OUT',
    session: null,
    generation: 3,
  });
  state = authStateReducer(state, {
    type: 'profile_loaded',
    profile: secondProfile,
    generation: 2,
  });
  assert.equal(state.status, 'signed_out');
  assert.equal(state.profile, null);
});

test('Google sign-in uses OAuth and the current origin as the redirect', async () => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        protocol: 'http:',
      },
    },
  });
  let request: unknown;
  try {
    await signInWithGoogle(clientStub({
      auth: {
        signInWithOAuth: async (value: unknown) => {
          request = value;
          return { error: null };
        },
      },
    }));
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: previousWindow,
    });
  }
  assert.deepEqual(request, {
    provider: 'google',
    options: { redirectTo: 'http://localhost:3000/' },
  });
});

  test('email registration requests verification without assigning a role from user metadata', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' } },
    });
    let request: Record<string, unknown> | undefined;
    try {
      await registerWithPassword(clientStub({
        auth: {
          signUp: async (args: Record<string, unknown>) => {
            request = args;
            return { data: { user: authUser, session: null }, error: null };
          },
        },
      }), 'Learner Name', ' learner@example.com ', 'StrongPassword9');
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
    assert.equal(request?.email, 'learner@example.com');
    assert.deepEqual(request?.options, {
      data: { full_name: 'Learner Name' },
      emailRedirectTo: 'http://localhost:3000/',
    });
  });

  test('standalone email registration requires email confirmation and never invokes Google OAuth', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' } },
    });
    let oauthCalls = 0;
    try {
      await registerWithPassword(clientStub({
        auth: {
          signUp: async () => ({ data: { user: authUser, session: null }, error: null }),
          signInWithOAuth: async () => {
            oauthCalls += 1;
            return { data: {}, error: null };
          },
        },
      }), 'New Learner', 'new@example.com', 'StrongPassword9');
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
    assert.equal(oauthCalls, 0);
  });

  test('registration rejects and clears an immediate session when email confirmation is disabled', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' } },
    });
    let signOutScope: unknown;
    const result = {
      user: authUser,
      access_token: 'must-not-be-kept',
    } as Session;
    try {
      const error = await registerWithPassword(clientStub({
        auth: {
          signUp: async () => ({ data: { user: authUser, session: result }, error: null }),
          signOut: async (options: unknown) => {
            signOutScope = options;
            return { error: null };
          },
        },
      }), 'Learner', 'learner@example.com', 'StrongPassword9').then(
        () => null,
        (signupError: unknown) => signupError
      );
      assert.ok(error instanceof AuthConfigurationError);
      assert.equal(error.code, 'email_confirmation_required');
      assert.deepEqual(signOutScope, { scope: 'local' });
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
  });

  test('registration and recovery errors expose safe Auth codes without raw response text', () => {
    const smtpError = Object.assign(
      new Error('SMTP details include secret smtp credentials'),
      { code: 'unexpected_failure', status: 500 }
    );
    const registrationMessage = authErrorMessage(smtpError, 'registration');
    assert.match(registrationMessage, /Chưa thể gửi email xác minh/);
    assert.match(registrationMessage, /unexpected_failure/);
    assert.match(registrationMessage, /500/);
    assert.doesNotMatch(registrationMessage, /secret smtp credentials/i);
    assert.equal(
      authErrorMessage(Object.assign(new Error('missing account'), {
        code: 'user_not_found',
        status: 400,
      }), 'recovery'),
      'Nếu tài khoản có thể khôi phục, hướng dẫn sẽ được gửi tới email đã nhập.'
    );
  });

test('OAuth, session, and sign-out errors are safe Vietnamese messages', () => {
  const rawError = Object.assign(
    new Error('Raw provider response contains a private token abc-secret'),
    { code: 'provider_disabled', status: 400 }
  );
  const oauthMessage = authErrorMessage(rawError, 'oauth');
  assert.match(oauthMessage, /Đăng nhập Google chưa được bật/);
  assert.match(oauthMessage, /provider_disabled/);
  assert.doesNotMatch(oauthMessage, /abc-secret|Raw provider response/);

  const sessionMessage = authErrorMessage(
    Object.assign(new Error('refresh token value xyz-secret'), {
      code: 'invalid_refresh_token',
    }),
    'session'
  );
  assert.equal(sessionMessage, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  assert.doesNotMatch(sessionMessage, /xyz-secret/);

  const logoutMessage = authErrorMessage(
    new Error('server response includes authorization=secret'),
    'logout'
  );
  assert.match(logoutMessage, /Không thể đăng xuất an toàn/);
  assert.doesNotMatch(logoutMessage, /authorization=secret/);
});

  test('password sign-in uses Supabase credentials and returns its session', async () => {
    const session = { user: authUser, access_token: 'test-token' } as Session;
    let args: unknown;
    const returned = await signInWithPassword(clientStub({
      auth: {
        signInWithPassword: async (value: unknown) => {
          args = value;
          return { data: { session }, error: null };
        },
      },
    }), ' learner@example.com ', 'pass', false);
    assert.equal(returned, session);
    assert.deepEqual(args, { email: 'learner@example.com', password: 'pass' });
  });

  test('password sign-in propagates authentication errors without creating a session', async () => {
    const authError = Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' });
    await assert.rejects(
      signInWithPassword(clientStub({
        auth: {
          signInWithPassword: async () => ({ data: { session: null }, error: authError }),
        },
      }), 'student@example.com', 'incorrect', false),
      /Invalid login credentials/
    );
  });

  test('password recovery uses the reset route and password update calls Supabase Auth', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' } },
    });
    let recoveryRequest: unknown;
    let updatedPassword: unknown;
    try {
      const client = clientStub({
        auth: {
          resetPasswordForEmail: async (...args: unknown[]) => {
            recoveryRequest = args;
            return { error: null };
          },
          updateUser: async (args: unknown) => {
            updatedPassword = args;
            return { error: null };
          },
        },
      });
      await requestPasswordRecovery(client, ' student@example.com ');
      await updatePassword(client, 'UpdatedPassword9');
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
    assert.deepEqual(recoveryRequest, [
      'student@example.com',
      { redirectTo: 'http://localhost:3000/reset-password' },
    ]);
    assert.deepEqual(updatedPassword, { password: 'UpdatedPassword9' });
  });

  test('password recovery provider errors remain detectable by the generic recovery UI', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' } },
    });
    try {
      await assert.rejects(
        requestPasswordRecovery(clientStub({
          auth: {
            resetPasswordForEmail: async () => ({ error: new Error('rate limited') }),
          },
        }), 'student@example.com'),
        /rate limited/
      );
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
  });

  test('OAuth administrator password setup requires verified same-account reauthentication', async () => {
    let reauthenticateCalls = 0;
    let signUpCalls = 0;
    const client = adminProfileClient({
      getUser: async () => ({ data: { user: verifiedAdminUser }, error: null }),
      reauthenticate: async () => {
        reauthenticateCalls += 1;
        return { error: null };
      },
      signUp: async () => {
        signUpCalls += 1;
        return { error: null };
      },
    });

    const email = await beginAdminPasswordSetup(client);
    assert.equal(email, verifiedAdminUser.email);
    assert.equal(reauthenticateCalls, 1);
    assert.equal(signUpCalls, 0);
  });

  test('admin password setup updates the existing Auth account with the verified nonce', async () => {
    let updateArgs: unknown;
    let signUpCalls = 0;
    const client = adminProfileClient({
      getUser: async () => ({ data: { user: verifiedAdminUser }, error: null }),
      updateUser: async (args: unknown) => {
        updateArgs = args;
        return { error: null };
      },
      signUp: async () => {
        signUpCalls += 1;
        return { error: null };
      },
    });

    await finishAdminPasswordSetup(client, ' one-time-otp ', 'NewSecurePassword9');
    assert.deepEqual(updateArgs, {
      password: 'NewSecurePassword9',
      nonce: 'one-time-otp',
    });
    assert.equal(signUpCalls, 0);
  });

  test('expired or previously used reauthentication codes are rejected by Supabase', async () => {
    const authError = Object.assign(new Error('Reauthentication nonce is invalid'), {
      code: 'reauthentication_not_valid',
    });
    const client = adminProfileClient({
      getUser: async () => ({ data: { user: verifiedAdminUser }, error: null }),
      updateUser: async () => ({ error: authError }),
    });
    await assert.rejects(
      finishAdminPasswordSetup(client, 'expired-or-used-code', 'NewSecurePassword9'),
      /Reauthentication nonce is invalid/
    );
  });

  test('an account with an existing password can use the same reauthenticated password update flow', async () => {
    let updateCalls = 0;
    const client = adminProfileClient({
      getUser: async () => ({ data: { user: verifiedAdminUser }, error: null }),
      updateUser: async () => {
        updateCalls += 1;
        return { error: null };
      },
    });

    await finishAdminPasswordSetup(client, 'fresh-otp', 'RotatedPassword9');
    assert.equal(updateCalls, 1);
  });

  test('unverified or non-admin accounts cannot start or complete admin password setup', async () => {
    let reauthenticateCalls = 0;
    let updateCalls = 0;
    const unverifiedUser = { ...verifiedAdminUser, email_confirmed_at: null } as unknown as User;
    const unverifiedClient = clientStub({
      auth: {
        getUser: async () => ({ data: { user: unverifiedUser }, error: null }),
        reauthenticate: async () => {
          reauthenticateCalls += 1;
          return { error: null };
        },
      },
    });
    await assert.rejects(beginAdminPasswordSetup(unverifiedClient), AdminAccessDeniedError);

    const studentClient = clientStub({
      auth: {
        getUser: async () => ({ data: { user: verifiedAdminUser }, error: null }),
        updateUser: async () => {
          updateCalls += 1;
          return { error: null };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: verifiedAdminUser.id, role: 'student', email: verifiedAdminUser.email },
              error: null,
            }),
          }),
        }),
      }),
    });
    await assert.rejects(beginAdminPasswordSetup(studentClient), AdminAccessDeniedError);
    await assert.rejects(finishAdminPasswordSetup(studentClient, 'nonce', 'SecurePassword9'), AdminAccessDeniedError);
    assert.equal(reauthenticateCalls, 0);
    assert.equal(updateCalls, 0);
  });

  test('recovery page only accepts an active password recovery session', () => {
    assert.equal(passwordRecoveryState('loading', false), 'loading');
    assert.equal(passwordRecoveryState('authenticated', true), 'ready');
    assert.equal(passwordRecoveryState('authenticated', false), 'invalid');
    assert.equal(passwordRecoveryState('signed_out', true), 'invalid');
    assert.equal(passwordRecoveryState('error', true), 'invalid');
  });

  test('auth redirect origins reject unapproved production hosts', () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'https://attacker.example', hostname: 'attacker.example', protocol: 'https:' } },
    });
    try {
      assert.throws(() => safeAuthRedirectUrl('/reset-password'), /not allowed|cho phép/i);
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }
  });

  test('admin dashboard routes require an admin role and recent verified password method', () => {
    const now = 1_900_000_000_000;
    assert.equal(adminDashboardAccess('loading', null, false), 'loading');
    assert.equal(adminDashboardAccess('signed_out', null, false), 'sign_in');
    assert.equal(adminDashboardAccess('authenticated', 'student', true), 'forbidden');
    assert.equal(adminDashboardAccess('authenticated', 'admin', false), 'sign_in');
    assert.equal(adminDashboardAccess('authenticated', 'admin', true), 'allow');
    assert.equal(hasRecentPasswordAuthentication({
      auth_time: now / 1000,
      amr: [{ method: 'password', timestamp: now / 1000 }],
    }, now), true);
    assert.equal(hasRecentPasswordAuthentication({
      auth_time: now / 1000,
      amr: [{ method: 'oauth_provider/authorization_code', timestamp: now / 1000 }],
    }, now), false);
    assert.equal(hasRecentPasswordAuthentication({
      auth_time: now / 1000 - 901,
      amr: ['password'],
    }, now), false);
  });

  test('administrator login rejects non-admin profiles and signs the session out', async () => {
    const session = { user: authUser, access_token: 'test-token' } as Session;
    let signOutCalls = 0;
    const client = clientStub({
      auth: {
        signInWithPassword: async () => ({ data: { session }, error: null }),
        signOut: async () => { signOutCalls += 1; return { error: null }; },
        getClaims: async () => ({
          data: { claims: { auth_time: Date.now() / 1000, amr: ['password'] } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: authUser.id, email: authUser.email, display_name: 'Learner', role: 'student' },
              error: null,
            }),
          }),
        }),
      }),
    });
    await assert.rejects(signInAdministrator(client, 'student@example.com', 'password'), AdminAccessDeniedError);
    assert.equal(signOutCalls, 1);
  });

  test('correct administrator credentials verify the claims on the newly returned session', async () => {
    const loginTime = Math.floor(Date.now() / 1000);
    const session = {
      user: verifiedAdminUser,
      access_token: 'fresh-password-login-jwt',
    } as Session;
    let verifiedJwt: string | undefined;
    let signOutCalls = 0;
    const client = adminProfileClient({
      signInWithPassword: async () => ({ data: { session }, error: null }),
      getClaims: async (jwt: string) => {
        verifiedJwt = jwt;
        return {
          data: {
            claims: {
              sub: verifiedAdminUser.id,
              auth_time: loginTime - 3600,
              amr: [{ method: 'password', timestamp: loginTime }],
            },
          },
          error: null,
        };
      },
      signOut: async () => {
        signOutCalls += 1;
        return { error: null };
      },
    });
    await signInAdministrator(client, 'admin@example.com', 'correct-password');
    assert.equal(verifiedJwt, session.access_token);
    assert.equal(signOutCalls, 0);
  });

  test('incorrect administrator password preserves Supabase invalid-credentials failure', async () => {
    const invalidCredentials = Object.assign(new Error('Invalid login credentials'), {
      code: 'invalid_credentials',
      status: 400,
    });
    let profileReads = 0;
    const client = clientStub({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: invalidCredentials,
        }),
      },
      from: () => {
        profileReads += 1;
        throw new Error('must not query profiles before login succeeds');
      },
    });
    await assert.rejects(
      signInAdministrator(client, 'admin@example.com', 'wrong-password'),
      /Invalid login credentials/
    );
    assert.equal(profileReads, 0);
  });

  test('admin session restoration verifies the restored session JWT and profile identity', async () => {
    const loginTime = Math.floor(Date.now() / 1000);
    const restoredSession = {
      user: verifiedAdminUser,
      access_token: 'restored-admin-jwt',
    } as Session;
    let verifiedJwt: string | undefined;
    const client = clientStub({
      auth: {
        getSession: async () => ({ data: { session: restoredSession }, error: null }),
        getClaims: async (jwt: string) => {
          verifiedJwt = jwt;
          return {
            data: {
              claims: {
                sub: verifiedAdminUser.id,
                auth_time: loginTime,
                amr: [{ method: 'password', timestamp: loginTime }],
              },
            },
            error: null,
          };
        },
      },
    });
    assert.equal(await verifyAdminPasswordSession(client, {
      id: verifiedAdminUser.id,
      email: verifiedAdminUser.email ?? '',
      displayName: 'Existing Admin',
      role: 'admin',
      targetScore: 8.5,
    }), true);
    assert.equal(verifiedJwt, restoredSession.access_token);
  });

  test('password AMR timestamp controls its fifteen-minute freshness window', () => {
    const nowMilliseconds = 1_900_000_000_000;
    const nowSeconds = nowMilliseconds / 1000;
    assert.equal(hasRecentPasswordAuthentication({
      sub: verifiedAdminUser.id,
      auth_time: nowSeconds - 3600,
      amr: [{ method: 'password', timestamp: nowSeconds }],
    }, nowMilliseconds), true);
    assert.equal(hasRecentPasswordAuthentication({
      auth_time: nowSeconds,
      amr: [{ method: 'password', timestamp: nowSeconds - 901 }],
    }, nowMilliseconds), false);
    assert.equal(hasRecentPasswordAuthentication({
      auth_time: nowSeconds - 901,
      amr: ['password'],
    }, nowMilliseconds), false);
  });

  test('admin profile and signed password claims are both required for privileged session checks', async () => {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      user: verifiedAdminUser,
      access_token: 'verified-admin-token',
    } as Session;
    const client = clientStub({
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        getClaims: async (token: string) => ({
          data: { claims: {
            sub: verifiedAdminUser.id,
            token,
            auth_time: now,
            amr: [{ method: 'password', timestamp: now }],
          } },
          error: null,
        }),
      },
    });
    assert.equal(await verifyAdminPasswordSession(client, {
      id: verifiedAdminUser.id, email: verifiedAdminUser.email ?? '', displayName: 'Admin',
      role: 'admin', targetScore: 8.5,
    }), true);
    assert.equal(await verifyAdminPasswordSession(client, {
      id: verifiedAdminUser.id, email: verifiedAdminUser.email ?? '', displayName: 'Student',
      role: 'student', targetScore: 8.5,
    }), false);
  });

  test('Supabase auth storage selects session or persistent storage and clears both', async () => {
    const persistent = new Map<string, string>();
    const session = new Map<string, string>();
    const store = (values: Map<string, string>) => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    });
    const adapter = createAuthStorageAdapter({
      persistent: store(persistent),
      session: store(session),
    });
    await adapter.setItem('auth-token', 'short-lived');
    assert.equal(session.get('auth-token'), 'short-lived');
    adapter.setRememberMe(true);
    await adapter.setItem('auth-token', 'remembered');
    assert.equal(persistent.get('auth-token'), 'remembered');
    assert.equal(session.has('auth-token'), false);
    await adapter.removeItem('auth-token');
    assert.equal(persistent.has('auth-token'), false);
    assert.equal(session.has('auth-token'), false);
  });
test('teacher invitations are issued and redeemed only through server-checked RPCs', async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = clientStub({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'create_teacher_invitation') {
        return { data: [{ token: 'one-time-token', expires_at: '2030-01-01T00:00:00Z' }], error: null };
      }
      return { data: null, error: null };
    },
  });

  const invitation = await createTeacherInvitation(client, ' Teacher@Example.com ');
  await redeemTeacherInvitation(client, ' one-time-token ');
  assert.equal(invitation.token, 'one-time-token');
  assert.deepEqual(rpcCalls, [
    { name: 'create_teacher_invitation', args: { p_email: 'Teacher@Example.com' } },
    { name: 'redeem_teacher_invitation', args: { p_token: 'one-time-token' } },
  ]);
});

test('an attempted direct teacher-role RPC is rejected by the database response', async () => {
  const client = clientStub({
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, 'set_user_role');
      assert.deepEqual(args, {
        p_target_user_id: 'another-user',
        p_target_role: 'teacher',
      });
      return { data: null, error: new Error('Administrator access required') };
    },
  });

  await assert.rejects(
    async () => {
      const { error } = await client.rpc('set_user_role', {
        p_target_user_id: 'another-user',
        p_target_role: 'teacher',
      });
      if (error) throw error;
    },
    /Administrator access required/
  );
});

test('admin revokes an invitation and teacher privileges through protected RPCs', async () => {
  const rpcCalls: string[] = [];
  const client = clientStub({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push(`${name}:${Object.values(args).join(':')}`);
      return { data: null, error: null };
    },
  });
  await setUserRole(client, 'teacher-user', 'student');
  await revokeTeacherInvitation(client, 'invitation-id');
  assert.deepEqual(rpcCalls, [
    'set_user_role:teacher-user:student',
    'revoke_teacher_invitation:invitation-id',
  ]);
});
