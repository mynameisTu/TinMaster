# TinMaster Supabase Authentication Setup

## Apply the migration

Apply these migrations in timestamp order to the intended Supabase project:

1. `20260401000000_profiles_and_teacher_invitations.sql`
2. `20260926150000_gemini_api_rate_limits.sql`
3. `20260927120000_require_recent_password_for_admin.sql`

The profile migration creates profiles for existing Auth users and assigns new
users the `student` role. The last migration requires an admin role **and** a
recent, verified password authentication method (15 minutes) for administrator
RPCs and admin-only profile/invitation visibility. It preserves the existing
single-admin constraint and invitation RPCs. It must be applied before enabling
the dedicated administrator dashboard.

## Configure Google OAuth

1. In Google Cloud Console, configure the OAuth consent screen and create a
   Web application OAuth client.
2. Add the callback URI displayed in Supabase Authentication → Providers →
   Google to the Google OAuth client's authorized redirect URIs.
3. Enable Google in Supabase Authentication → Providers and set the Google
   client ID and client secret there. Those credentials must not be added to
   the Vite environment or committed.
4. Add the local origin and each required Vercel Preview/production origin to
   Supabase Authentication → URL Configuration redirect allowlist. Preview
   URLs should be narrowly scoped to the project/team as supported by Supabase;
   do not allow arbitrary external redirects.
5. Enable **Confirm email** under Supabase Authentication → Providers → Email.
   Keep sign-up email verification enabled in every environment. Configure the
   confirmation email link to return to the allowed application origin.

## Browser environment

Set these public project values in the local `.env` and Vercel Preview and
Production environments:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the project's public publishable/anon key)
- `VITE_AUTH_ALLOWED_ORIGINS` — comma-separated, exact HTTPS origins for
  production and each approved Vercel Preview origin. Local `http://localhost`
  and `http://127.0.0.1` origins are allowed by the app; also add the exact
  local callback URL to Supabase's redirect allowlist.

These are public browser credentials. Database access is protected by RLS and
the authenticated user's JWT. Never use `SUPABASE_SERVICE_ROLE_KEY` or another
secret key in a `VITE_` variable. The existing `GEMINI_API_KEY` remains
server-only. The shared Express/Vercel AI and extraction routes use the same
public project URL/key on the server to verify bearer access tokens; they reject
requests without a valid Supabase session. No service-role key is needed for
that verification. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` as
server-only environment variables in local and Vercel runtimes to avoid relying
on build-prefixed variables in server functions.

The document-extraction API additionally queries the caller's current
`profiles.role` with the user's JWT on each request and permits only
`teacher`/`admin`. The client-side menu is not the authorization boundary.

## Shared Gemini API rate limits

Apply `supabase/migrations/20260926150000_gemini_api_rate_limits.sql` after
the authentication migration. The rate-limit state and configurable endpoint
limits live in the private Postgres schema, not process memory, so local
Express and concurrent Vercel Functions share the same atomic per-user,
per-endpoint counters. The RPC derives identity from `auth.uid()` and callers
cannot access the private config/counter tables or choose their own limit.

Defaults are 30 `/api/ai/explain` requests per 60 seconds, 5
`/api/ai/video-script` requests per 60 seconds, and 5
`/api/exercises/extract-file` requests per 60 seconds. A rejected request
returns HTTP 429 and `Retry-After`. Missing/unavailable limiter configuration
or database service fails closed with HTTP 503. Authentication (and the
extraction teacher/admin role check) happens before consuming quota.

Change an endpoint's limit/window using privileged SQL, for example:

```sql
update private.api_rate_limit_config
set limit_count = 20, window_seconds = 60, updated_at = now()
where endpoint = '/api/ai/explain';
```

These per-user limits do not prevent abuse by creating multiple accounts and
are not a project-wide Gemini spending cap. Add billing alerts and monitor
Gemini usage; stricter global/IP controls would require a separate shared
gateway or edge rate limiter.

## Provision the one initial administrator

1. Sign in through Google once with the intended administrator account.
2. In Supabase Authentication → Users, verify the account's email and copy its
   Supabase Auth user UUID. Confirm the email is marked verified.
3. In the Supabase SQL Editor, replace the UUID literal below and run the
   statement once. This is deliberately a privileged SQL Editor operation,
   not an RPC callable by browser users. It refuses to run if an admin already
   exists or the UUID is not a verified Auth user.

```sql
begin;
do $$
declare
  verified_user_id uuid := 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An administrator is already provisioned';
  end if;
  if not exists (
    select 1 from auth.users
    where id = verified_user_id and email_confirmed_at is not null
  ) then
    raise exception 'The supplied Auth UUID is not a verified user';
  end if;
  update public.profiles
  set role = 'admin', updated_at = now()
  where id = verified_user_id;
  if not found then
    raise exception 'No profile exists for that Auth UUID';
  end if;
end
$$;
commit;
```

The partial unique index permits only one administrator. The application
cannot set the `admin` role: role changes are limited to the `student` and
`teacher` values, and direct client updates cannot modify `role`.
After running the SQL, reload TinMaster (or sign out and back in) so the
session reloads the database-backed role. Administrator features are available
only through `/admin/dashboard` after a fresh email/password sign-in.

### Dedicated administrator password credential

For the existing Google-created administrator, do **not** create another Auth
user and do not rely on a password-recovery email as the initial setup method.
Sign in to TinMaster with Google as the existing admin, open **Thiết lập mật
khẩu admin** in the admin navigation (or visit `/admin/setup-password`), and
request the one-time verification code. TinMaster first verifies the current
Auth user with Supabase and reloads that user's database profile; only a
confirmed email and current `admin` profile may continue. The user enters the
code sent to that same verified email and sets/confirms a password. The client
uses Supabase Auth's supported `reauthenticate()` and
`updateUser({ password, nonce })` APIs. This updates the password on that
existing `auth.users.id`, preserving its UUID, Google identity, profile, admin
role, and associated data; it does not call sign-up or any role RPC. The flow
also works to change a password when one is already configured.

After a successful change, TinMaster signs out and sends the administrator to
`/admin`. They must explicitly sign in with the new email/password. Password
recovery by itself is not accepted as the admin portal's password login or as
proof of a fresh `password` AMR claim.

Enable Supabase Email provider **Secure password change** and configure email
delivery so the reauthentication nonce reaches the verified address. This
flow requires the nonce even when a session is recent, and the server must
validate the nonce. The admin setup page is available only to a currently
authenticated user whose profile currently has `role = 'admin'`; a URL or
frontend role value cannot grant the role. If the provider does not deliver or
validate the reauthentication nonce, do not bypass the check or set the
password through SQL—fix the Supabase Auth email/provider configuration.

For accounts that already have a password, `/admin` links to the standard
email-based `/forgot-password` recovery page. That path uses
`resetPasswordForEmail()` and `updateUser()` after Supabase verifies the
time-limited recovery link. Responses are generic and do not confirm whether an
email is registered. OAuth-only administrators should use the authenticated
setup flow above rather than assume the recovery endpoint is configured for
their account.

`/admin/dashboard` checks the profile role from the database and asks Supabase
to verify the signed JWT claims. The admin RPC guard independently checks the
role, `amr` password method, and a 15-minute authentication freshness window.
Changing the URL, local storage, user metadata, or client state cannot grant
admin access. Supabase custom access-token hooks must preserve standard `amr`
and `auth_time` claims.

## Email/password, recovery, and session configuration

- The registration flow supplies only a display name in user metadata. The
  Auth-user database trigger assigns `student`; teacher status remains
  invitation-only.
- Configure the Supabase Email provider's password policy to match the UI:
  minimum 10 characters, uppercase, lowercase, and a digit. Email confirmation
  is a required project setting; the application uses generic recovery
  responses so it does not reveal whether an address is registered.
- Enable **Secure password change** in the Supabase Email provider and verify
  the reauthentication email template includes the OTP token and that the
  configured OTP expiry is appropriate. Configure production SMTP and test OTP
  delivery; never disable nonce verification to work around delivery problems.
- Set `VITE_AUTH_ALLOWED_ORIGINS` per local/Vercel environment and list the same
  origins under Supabase Authentication → URL Configuration. Do not use a
  wildcard for unrelated Vercel projects or external domains. Ensure the
  password recovery redirect `/reset-password` and OAuth callback are covered.
- Supabase Auth's built-in rate limits apply to signup, password sign-in, and
  recovery requests. Review and configure Authentication → Rate Limits and
  SMTP/email sending limits; this app does not add a password proxy or custom
  credential store. Production custom SMTP may be necessary for reliable
  delivery and has provider-dependent cost/quotas.
- The checkbox selects Supabase's own session storage: unchecked uses browser
  `sessionStorage`; checked uses Supabase-managed `localStorage`. Passwords and
  tokens are never written under TinMaster-specific keys. Sign-out clears both
  Supabase storage locations for this browser.
- Browser persistence is **not** a 30-day expiry. Supabase sessions refresh
  until revoked or until the project expires them. To enforce a 30-day maximum,
  set the Supabase Auth **time-boxed session maximum lifetime** to `2,592,000`
  seconds where available (project/plan dependent; session-lifetime controls
  require an eligible paid plan). The checkbox only controls whether the local
  browser keeps the session between browser sessions. Without the server-side
  limit, “30 days” is a requested preference, not a guaranteed maximum.

## Teacher invitations and roles

An authenticated admin can issue a seven-day invitation in TinMaster's admin
area. The random token is displayed once; only its SHA-256 digest is stored.
The admin must deliver the token to the invited email recipient through a
trusted channel. Redemption requires a verified Supabase Auth email that
matches the invitation. Invitations can be revoked before redemption.
Administrators grant teacher eligibility only by issuing invitations and can
revoke teacher status using the role-management panel; revocation returns the
profile to `student`. Database functions verify the caller's current profile
role for every privileged action, and an admin cannot bypass invitation
redemption to directly assign the teacher role.

## Local data and limitations

The existing `tinmaster_*` learning records remain in this browser's
localStorage and are not copied to Supabase, linked to an Auth UUID, or
deleted. Profile display/role data now comes from Supabase. Local exam,
question-bank, and mastery state remains local and is not yet shared across
devices. Teacher/admin dashboards still contain their existing demonstration
data; this authentication phase does not add persistent classroom data.

Google OAuth, role changes, and RLS need to be verified against the configured
Supabase project before enabling production sign-in. No service-role key is
needed by the current browser authentication flow.
