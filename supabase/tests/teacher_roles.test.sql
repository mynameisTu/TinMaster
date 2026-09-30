begin;

select plan(17);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'auth_time', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'auth-admin@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Admin"}',
    now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invited-teacher@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Teacher"}',
    now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other-student@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Student"}',
    now(), now()
  );

select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'student',
  'new Auth users start as students'
);

update public.profiles
set role = 'admin'
where id = '10000000-0000-0000-0000-000000000001';

create temporary table auth_test_invitation (token text, invited_email text);
grant all on auth_test_invitation to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select id, email, role from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'$$,
  'students cannot read another user profile'
);
select is_empty(
  $$select id, invited_email from public.teacher_invitations$$,
  'students cannot read teacher invitations'
);

select throws_ok(
  $$select public.set_user_role(
    '10000000-0000-0000-0000-000000000002',
    'teacher'
  )$$,
  '42501',
  'Administrator access required',
  'students cannot grant teacher privileges'
);
select throws_ok(
  $$select * from public.create_teacher_invitation('attacker@example.test')$$,
  '42501',
  'Administrator access required',
  'students cannot create teacher invitations'
);
select throws_ok(
  $$select public.revoke_teacher_invitation(
    '10000000-0000-0000-0000-000000000099'
  )$$,
  '42501',
  'Administrator access required',
  'students cannot revoke teacher invitations'
);
select throws_ok(
  $$update public.profiles set role = 'admin'
    where id = '10000000-0000-0000-0000-000000000003'$$,
  '42501',
  null,
  'users cannot edit their own role column'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'auth_time', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'oauth_provider/authorization_code',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select throws_ok(
  $$select * from public.create_teacher_invitation('unauthorized@example.test')$$,
  '42501',
  'Administrator access required',
  'admin role without a recent password method cannot use admin RPCs'
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'auth_time', floor(extract(epoch from now()))::bigint - 901,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint - 901
    ))
  )::text,
  true
);
select throws_ok(
  $$select * from public.create_teacher_invitation('expired@example.test')$$,
  '42501',
  'Administrator access required',
  'admin password authentication older than 15 minutes is rejected'
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'auth_time', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select throws_ok(
  $$select public.set_user_role(
    '10000000-0000-0000-0000-000000000003',
    'teacher'
  )$$,
  '22023',
  'Teacher access must be granted through an invitation',
  'admins must use invitations to grant teacher privileges'
);
insert into auth_test_invitation (token, invited_email)
select token, 'invited-teacher@example.test'
from public.create_teacher_invitation('invited-teacher@example.test');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.redeem_teacher_invitation((select token from auth_test_invitation))$$,
  'the verified invited user can redeem an invitation'
);
select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'teacher',
  'invitation redemption grants teacher role'
);
select throws_ok(
  $$select public.redeem_teacher_invitation((select token from auth_test_invitation))$$,
  '22023',
  'Invitation is invalid, expired, revoked, or does not match this account',
  'an invitation cannot be redeemed twice'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.set_user_role(
    '10000000-0000-0000-0000-000000000002',
    'student'
  )$$,
  'admin can revoke teacher privileges'
);
select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'student',
  'teacher revocation returns the profile to student'
);

insert into auth_test_invitation (token, invited_email)
select token, 'other-student@example.test'
from public.create_teacher_invitation('other-student@example.test');
select lives_ok(
  $$select public.revoke_teacher_invitation(
    (select id from public.teacher_invitations
     where invited_email = 'other-student@example.test'
     order by created_at desc limit 1)
  )$$,
  'admin can revoke an unused invitation'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.redeem_teacher_invitation(
    (select token from auth_test_invitation where invited_email = 'other-student@example.test')
  )$$,
  '22023',
  null,
  'a revoked invitation cannot be redeemed'
);

select * from finish();
rollback;
