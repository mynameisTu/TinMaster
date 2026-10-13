begin;

select plan(37);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-one@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Member One"}',
    now(), now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-two@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Member Two"}',
    now(), now()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-admin@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Member Admin"}',
    now(), now()
  );

update public.profiles
set username = 'member_one'
where id = '40000000-0000-0000-0000-000000000001';
update public.profiles
set username = 'member_two'
where id = '40000000-0000-0000-0000-000000000002';
update public.profiles
set role = 'admin'
where id = '40000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::integer
   from public.profiles
   where id in (
     '40000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000002',
     '40000000-0000-0000-0000-000000000003'
   )
     and public_member_id ~ '^TM-[A-F0-9]{16}$'),
  3,
  'every existing account receives a public member ID'
);
select is(
  (select count(*)::integer
   from (
     select public_member_id
     from public.profiles
     where id in (
       '40000000-0000-0000-0000-000000000001',
       '40000000-0000-0000-0000-000000000002',
       '40000000-0000-0000-0000-000000000003'
     )
     group by public_member_id
   ) ids),
  3,
  'generated public member IDs are unique'
);
select is(
  (select b.public from storage.buckets b where b.id = 'tinmaster-avatars'),
  false,
  'avatar storage is private'
);
select is(
  (select b.file_size_limit::integer
   from storage.buckets b where b.id = 'tinmaster-avatars'),
  4194304,
  'avatar bucket enforces a four-megabyte limit'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select * from public.update_my_member_profile(
    'Member One Updated', 'member_one_new', 'CS'
  )$$,
  'a signed-in user can update permitted profile fields'
);
select is(
  (select username from public.profiles
   where id = auth.uid()),
  'member_one_new',
  'username is stored in normalized lowercase form'
);
select throws_ok(
  $$select * from public.update_my_member_profile(
    'Bad Handle', 'bad-handle', null
  )$$,
  '22023',
  'Username must be 3-24 lowercase letters, digits, or underscores',
  'invalid usernames are rejected'
);
select throws_ok(
  $$select * from public.update_my_member_profile(
    'Duplicate', 'member_two', null
  )$$,
  '23505',
  null,
  'duplicate usernames are rejected by the unique index'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501',
  null,
  'users cannot change their own role'
);
select throws_ok(
  $$update public.profiles set public_member_id = 'TM-AAAAAAAAAAAAAAAA'
    where id = auth.uid()$$,
  '42501',
  null,
  'users cannot directly change their public member ID'
);
select throws_ok(
  $$update public.profiles set username = 'another_handle'
    where id = auth.uid()$$,
  '42501',
  null,
  'users must use the rate-limited profile update RPC'
);
select throws_ok(
  $$update public.profiles set display_name = 'Bypass Name'
    where id = auth.uid()$$,
  '42501',
  null,
  'users cannot bypass rate limits by updating display_name directly'
);
select throws_ok(
  $$update public.profiles set exam_track = 'ICT'
    where id = auth.uid()$$,
  '42501',
  null,
  'users cannot bypass rate limits by updating exam_track directly'
);
select throws_ok(
  $$update public.profiles set avatar_url = 'https://evil.example/avatar.png'
    where id = auth.uid()$$,
  '42501',
  null,
  'users cannot set arbitrary avatar_url outside the private avatar pipeline'
);
select throws_ok(
  $$update public.profiles set school = 'Hacked School', grade = 12, target_score = 9.5
    where id = auth.uid()$$,
  '42501',
  null,
  'legacy profile column updates are no longer granted to authenticated clients'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated role has no table UPDATE privilege on profiles'
);
reset role;
select lives_ok(
  $$update public.profiles
      set avatar_url = 'https://lh3.googleusercontent.com/a/oauth-compat'
    where id = '40000000-0000-0000-0000-000000000001'$$,
  'privileged writers can still store OAuth avatar_url for compatibility'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);
select ok(
  not exists (
    select 1
    from public.get_public_member('member_one_new') p
    cross join lateral jsonb_object_keys(to_jsonb(p)) as keys(key)
    where key in ('email', 'id', 'exam_answers')
  ),
  'public profiles do not expose email, Auth UUID, or private answers'
);
select is(
  (select count(*)::integer
   from public.list_public_members('', 50, 0)
   where username = 'member_one_new'),
  1,
  'authenticated members can find public usernames in the directory'
);
select is(
  (select count(*)::integer
   from public.list_public_members('%', 50, 0)),
  0,
  'directory search treats percent as a literal character'
);
select is(
  (select count(*)::integer
   from public.list_public_members('member_one_', 50, 0)
   where username = 'member_one_new'),
  1,
  'directory search still matches literal underscores inside usernames'
);
select throws_ok(
  $$select * from public.list_public_members(repeat('x', 65), 50, 0)$$,
  '22023',
  'Invalid directory query or pagination',
  'directory queries are bounded'
);
select throws_ok(
  $$select public.reserve_my_avatar_upload(
    '40000000-0000-0000-0000-000000000002/11111111-1111-1111-1111-111111111111.jpg'
  )$$,
  '22023',
  'Invalid avatar upload path',
  'users cannot reserve an avatar path owned by another account'
);
select lives_ok(
  $$select public.reserve_my_avatar_upload(
    '40000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.jpg'
  )$$,
  'a user can reserve a validated avatar path under their own UUID'
);
select lives_ok(
  $$
    select public.reserve_my_avatar_upload(
      auth.uid()::text || '/' || lpad(to_hex(n), 8, '0') ||
        '-1111-1111-1111-111111111111.jpg'
    )
    from generate_series(2, 5) n
  $$,
  'the avatar upload allowance permits the configured number of reservations'
);
select throws_ok(
  $$select public.reserve_my_avatar_upload(
    auth.uid()::text || '/00000006-1111-1111-1111-111111111111.jpg'
  )$$,
  'P0001',
  'Avatar upload limit exceeded; try again later',
  'avatar upload reservations are rate-limited'
);
reset role;
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'private.member_avatar_upload_reservations', 'SELECT'
  ),
  'authenticated users cannot read private avatar upload reservations'
);
update public.profiles
set avatar_path = id::text || '/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg'
where id = '40000000-0000-0000-0000-000000000001';
select throws_ok(
  $$delete from auth.users
    where id = '40000000-0000-0000-0000-000000000001'$$,
  '23503',
  'Avatar cleanup is required before account deletion',
  'account deletion is blocked while an avatar is still attached'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);
select is(
  public.remove_my_avatar(),
  '40000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
  'the avatar removal RPC returns the previous object path for cleanup'
);
reset role;
select throws_ok(
  $$delete from auth.users
    where id = '40000000-0000-0000-0000-000000000001'$$,
  '23503',
  'Avatar cleanup is required before account deletion',
  'account deletion is blocked until orphan cleanup is acknowledged'
);
delete from private.member_profile_update_limits
where user_id = '40000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);
-- Call the RPC once per outer row. CROSS JOIN LATERAL against the SETOF
-- result can collapse rate-limit increments under one statement snapshot.
select lives_ok(
  $$
    select public.update_my_member_profile(
      'Member One Updated', 'member_one_new', 'CS'
    )
    from generate_series(1, 10) n
  $$,
  'the configured profile update allowance succeeds'
);
select throws_ok(
  $$select * from public.update_my_member_profile(
    'Member One Updated', 'member_one_new', 'CS'
  )$$,
  'P0001',
  'Profile update limit exceeded; try again later',
  'profile updates are rate-limited after the allowance'
);

select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '40000000-0000-0000-0000-000000000002',
    'auth_time', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select throws_ok(
  $$select public.admin_set_public_member_id(
    '40000000-0000-0000-0000-000000000001',
    'TM-AAAAAAAAAAAAAAAA'
  )$$,
  '42501',
  'Recent administrator authentication required',
  'non-admin users cannot change public member IDs'
);

select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '40000000-0000-0000-0000-000000000003',
    'auth_time', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select lives_ok(
  $$select public.admin_set_public_member_id(
    '40000000-0000-0000-0000-000000000001',
    'TM-AAAAAAAAAAAAAAAA'
  )$$,
  'a recently password-authenticated admin can change a public member ID'
);
select is(
  (select public_member_id from public.profiles
   where id = '40000000-0000-0000-0000-000000000001'),
  'TM-AAAAAAAAAAAAAAAA',
  'administrator member ID updates apply to the selected account'
);

reset role;
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.proname = any(array[
        'consume_member_profile_update_limit',
        'update_my_member_profile',
        'list_public_members',
        'get_public_member',
        'get_my_member_profile',
        'set_my_avatar_path',
        'remove_my_avatar',
        'reserve_my_avatar_upload',
        'admin_set_public_member_id',
        'is_my_pending_avatar_upload',
        'can_delete_my_old_avatar'
      ])
      and p.prosecdef
      and not coalesce(
        p.proconfig @> array['search_path=""', 'row_security=off'],
        false
      )
  ),
  'member SECURITY DEFINER functions pin search_path and row security'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.prosecdef
      and p.proname = any(array[
        'consume_member_profile_update_limit',
        'update_my_member_profile',
        'list_public_members',
        'get_public_member',
        'get_my_member_profile',
        'set_my_avatar_path',
        'remove_my_avatar',
        'reserve_my_avatar_upload',
        'admin_set_public_member_id',
        'is_my_pending_avatar_upload',
        'can_delete_my_old_avatar'
      ])
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'member SECURITY DEFINER functions are not executable by PUBLIC'
);

select * from finish();
rollback;
