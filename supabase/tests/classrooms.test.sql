begin;

select plan(65);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-admin@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Admin"}',
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-teacher-one@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Teacher One"}',
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-teacher-two@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Teacher Two"}',
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-student-one@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Student One"}',
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-student-two@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Student Two"}',
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'class-teacher-revoked@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Teacher Revoked"}',
    now(), now()
  );

update public.profiles set role = 'admin'
where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set role = 'teacher'
where id in (
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000006'
);

insert into public.classrooms (id, teacher_id, name, grade)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Class One', 12
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'Class Two', 11
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000006',
    'Revoked Teacher Class', 10
  );

insert into public.classroom_invitation_codes (
  classroom_id, created_by, code_hash, expires_at, max_uses, created_at
)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    encode(extensions.digest(convert_to(repeat('a', 48), 'UTF8'), 'sha256'), 'hex'),
    now() + interval '1 day', 5, now()
  ),
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    encode(extensions.digest(convert_to(repeat('b', 48), 'UTF8'), 'sha256'), 'hex'),
    now() - interval '1 second', 3, now() - interval '2 days'
  ),
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    encode(extensions.digest(convert_to(repeat('c', 48), 'UTF8'), 'sha256'), 'hex'),
    now() + interval '1 day', 3, now()
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    encode(extensions.digest(convert_to(repeat('d', 48), 'UTF8'), 'sha256'), 'hex'),
    now() + interval '1 day', 1, now()
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000006',
    encode(extensions.digest(convert_to(repeat('e', 48), 'UTF8'), 'sha256'), 'hex'),
    now() + interval '1 day', 3, now()
  );

update public.classroom_invitation_codes
set revoked_at = now()
where code_hash = encode(
  extensions.digest(convert_to(repeat('c', 48), 'UTF8'), 'sha256'),
  'hex'
);

insert into public.classroom_memberships (
  classroom_id, student_id, joined_at
)
values (
  '31000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000005',
  now()
);

create temporary table classroom_test_codes (label text primary key, code text);
insert into classroom_test_codes values
  ('valid', repeat('a', 48)),
  ('expired', repeat('b', 48)),
  ('revoked', repeat('c', 48)),
  ('final-use', repeat('d', 48)),
  ('role-revocation', repeat('e', 48));
grant select on classroom_test_codes to authenticated;

create temporary table created_classroom (
  classroom_id uuid,
  invitation_code text,
  invitation_expires_at timestamptz
);
grant all on created_classroom to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000004',
  true
);

select is_empty(
  $$select id from public.classrooms$$,
  'a student cannot read classrooms before joining'
);
select throws_ok(
  $$select * from public.create_classroom('Attacker Class'::text, 12::smallint)$$,
  '42501',
  'Teacher access required',
  'students cannot create classrooms'
);
select throws_ok(
  $$select * from public.create_classroom_invitation(
    '31000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Teacher access required',
  'students cannot create classroom invitations'
);
select throws_ok(
  $$select public.archive_classroom('31000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Classroom access required',
  'students cannot archive classrooms'
);
select throws_ok(
  $$select * from public.get_classroom_students(
    '31000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Classroom access required',
  'students cannot read a classroom roster'
);
select throws_ok(
  $$insert into public.classroom_memberships (classroom_id, student_id)
    values (
      '31000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000004'
    )$$,
  '42501',
  null,
  'students cannot directly insert memberships'
);
select throws_ok(
  $$update public.classroom_memberships set left_at = now()
    where student_id = auth.uid()$$,
  '42501',
  null,
  'students cannot directly update membership history'
);
select throws_ok(
  $$delete from public.classroom_memberships where student_id = auth.uid()$$,
  '42501',
  null,
  'students cannot directly delete membership history'
);
select throws_ok(
  $$update public.classroom_invitation_codes set revoked_at = now()
    where classroom_id = '31000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'students cannot directly modify invitation codes'
);
select ok(
  (select count(*) = 3
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'classrooms',
       'classroom_memberships',
       'classroom_invitation_codes'
     )
     and c.relrowsecurity),
  'RLS is enabled on every classroom table'
);
select lives_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  'a student can join using a valid invitation'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and student_id = auth.uid() and left_at is null),
  1,
  'joining creates one active membership for the authenticated student'
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  '23505',
  null,
  'duplicate active membership is rejected'
);
reset role;
select is(
  (select i.use_count
   from public.classroom_invitation_codes i
   where i.code_hash = encode(
     extensions.digest(convert_to(repeat('a', 48), 'UTF8'), 'sha256'),
     'hex'
   )),
  1,
  'a rejected duplicate join rolls back its invitation-use increment'
);
set local role authenticated;
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'expired'))$$,
  '22023',
  'Invitation code is invalid, expired, revoked, or fully used',
  'expired invitations cannot be redeemed'
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'revoked'))$$,
  '22023',
  'Invitation code is invalid, expired, revoked, or fully used',
  'revoked invitations cannot be redeemed'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000005',
  true
);
select lives_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  'a second student can use a multi-use invitation'
);
select lives_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'final-use'))$$,
  'the final available invitation use can be redeemed'
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'final-use'))$$,
  '22023',
  'Invitation code is invalid, expired, revoked, or fully used',
  'an exhausted final invitation use cannot be redeemed again'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000004',
  true
);
select lives_ok(
  $$select public.leave_classroom('31000000-0000-0000-0000-000000000001')$$,
  'a student can leave their own active classroom'
);
select ok(
  (select left_at is not null from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and student_id = auth.uid()
   order by joined_at desc limit 1),
  'leaving closes rather than deletes the membership record'
);
select lives_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  'a student can rejoin after leaving with a valid code'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and student_id = auth.uid()),
  2,
  'rejoining creates a separate membership history row'
);
select is_empty(
  $$select id from public.classrooms
    where id = '31000000-0000-0000-0000-000000000002'$$,
  'students cannot read a classroom they have not joined'
);
select is_empty(
  $$select id from public.classroom_invitation_codes
    where classroom_id = '31000000-0000-0000-0000-000000000002'$$,
  'students cannot inspect another classroom invitation metadata'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000002',
  true
);
select is_empty(
  $$select id from public.classrooms
    where id = '31000000-0000-0000-0000-000000000002'$$,
  'teachers cannot read another teacher classroom'
);
select is_empty(
  $$select id from public.classroom_invitation_codes
    where classroom_id = '31000000-0000-0000-0000-000000000002'$$,
  'teachers cannot read another teacher invitation metadata'
);
select lives_ok(
  $$insert into created_classroom
    select * from public.create_classroom('Created Class'::text, 12::smallint)$$,
  'a teacher can create a classroom and its first invitation'
);
select is(
  (select c.teacher_id from public.classrooms c
   join created_classroom x on x.classroom_id = c.id),
  auth.uid(),
  'classroom ownership is derived from the authenticated identity'
);
select lives_ok(
  $$select * from public.create_classroom_invitation(
    '31000000-0000-0000-0000-000000000001', 5
  )$$,
  'an owner can create a bounded invitation for an active classroom'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000003',
  true
);
select throws_ok(
  $$select public.archive_classroom('31000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Classroom access required',
  'a teacher cannot archive another teacher classroom'
);
select throws_ok(
  $$select public.remove_classroom_student(
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000005'
  )$$,
  '42501',
  'Classroom access required',
  'a teacher cannot remove students from another classroom'
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  '42501',
  'Student access required',
  'teachers cannot use student invitation redemption'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000002',
  true
);
select lives_ok(
  $$select public.remove_classroom_student(
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000005'
  )$$,
  'a teacher can remove a student from an owned active classroom'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and student_id = '30000000-0000-0000-0000-000000000005'
     and left_at is not null),
  1,
  'teacher removal preserves the membership row with a leave timestamp'
);
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000005',
  true
);
select lives_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  'a student can rejoin after teacher removal'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and student_id = '30000000-0000-0000-0000-000000000005'),
  2,
  'rejoining after removal preserves both membership periods'
);
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000002',
  true
);
select throws_ok(
  $$delete from public.classrooms
    where id = '31000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'teachers cannot hard-delete classrooms'
);
select lives_ok(
  $$select public.archive_classroom('31000000-0000-0000-0000-000000000001')$$,
  'an owner can archive an active classroom'
);
select is(
  (select count(*)::integer from public.classrooms
   where id = '31000000-0000-0000-0000-000000000001'
     and archived_at is not null),
  1,
  'archived classrooms remain readable to their owner'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000001'),
  4,
  'archiving preserves all membership history'
);
select is(
  (select count(*)::integer from public.classroom_invitation_codes
   where classroom_id = '31000000-0000-0000-0000-000000000001'
     and revoked_at is not null),
  5,
  'archiving revokes outstanding classroom invitations'
);
select is_empty(
  $$update public.classrooms set name = 'Changed after archive'
    where id = '31000000-0000-0000-0000-000000000001'
    returning id$$,
  'archived classrooms cannot be edited through table updates'
);
select throws_ok(
  $$select public.archive_classroom('31000000-0000-0000-0000-000000000001')$$,
  '22023',
  'Classroom not found or already archived',
  'an archived classroom cannot be archived or restored a second time'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000005',
  true
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  '22023',
  'Invitation code is invalid, expired, revoked, or fully used',
  'archived classroom invitations cannot be redeemed'
);
select throws_ok(
  $$select public.leave_classroom('31000000-0000-0000-0000-000000000001')$$,
  '22023',
  'Active classroom membership not found',
  'membership history is immutable after its classroom is archived'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
select throws_ok(
  $$select * from public.create_classroom('Admin Class'::text, 12::smallint)$$,
  '42501',
  'Teacher access required',
  'admin role alone does not grant classroom management'
);
select throws_ok(
  $$select public.join_classroom((select code from classroom_test_codes where label = 'valid'))$$,
  '42501',
  'Student access required',
  'admins cannot use student invitation redemption'
);
select throws_ok(
  $$select * from public.get_classroom_students(
    '31000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Classroom access required',
  'admin role alone does not grant access to a classroom roster'
);

reset role;
update public.profiles
set role = 'student'
where id = '30000000-0000-0000-0000-000000000006';

select is(
  (select count(*)::integer from public.classrooms
   where id = '31000000-0000-0000-0000-000000000003'
     and archived_at is not null),
  1,
  'teacher role revocation automatically archives owned classrooms'
);
select is(
  (select count(*)::integer from public.classroom_invitation_codes
   where classroom_id = '31000000-0000-0000-0000-000000000003'
     and revoked_at is not null),
  1,
  'teacher role revocation revokes outstanding invitation codes'
);
select is(
  (select count(*)::integer from public.classroom_memberships
   where classroom_id = '31000000-0000-0000-0000-000000000003'),
  1,
  'teacher role revocation retains membership history'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000006',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.get_classroom_students(
    '31000000-0000-0000-0000-000000000003'
  )$$,
  '42501',
  'Classroom access required',
  'a revoked teacher role no longer grants roster access'
);
reset role;

select throws_ok(
  $$delete from auth.users
    where id = '30000000-0000-0000-0000-000000000004'$$,
  '23503',
  null,
  'Auth account deletion is restricted while membership history exists'
);

select is(
  (select count(*)::integer
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'classrooms',
       'classroom_memberships',
       'classroom_invitation_codes'
     )
     and pg_catalog.pg_get_userbyid(c.relowner) <> 'postgres'),
  0,
  'all classroom tables are owned by postgres'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosecdef
     and p.proname = any(array[
       'is_current_user_teacher',
       'is_classroom_owner',
       'can_manage_classroom',
       'is_active_classroom_student',
       'archive_classrooms_on_teacher_role_revocation',
       'create_classroom',
       'create_classroom_invitation',
       'join_classroom',
       'leave_classroom',
       'remove_classroom_student',
       'archive_classroom',
       'revoke_classroom_invitation',
       'get_classroom_students'
     ])
     and pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres'),
  0,
  'all classroom SECURITY DEFINER functions are owned by postgres'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname = any(array[
        'is_current_user_teacher',
        'is_classroom_owner',
        'can_manage_classroom',
        'is_active_classroom_student',
        'archive_classrooms_on_teacher_role_revocation',
        'create_classroom',
        'create_classroom_invitation',
        'join_classroom',
        'leave_classroom',
        'remove_classroom_student',
        'archive_classroom',
        'revoke_classroom_invitation',
        'get_classroom_students'
      ])
      and not coalesce(
        p.proconfig @> array['search_path=""', 'row_security=off'],
        false
      )
  ),
  'all classroom SECURITY DEFINER functions pin search_path and RLS behavior'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname = any(array[
        'is_current_user_teacher',
        'is_classroom_owner',
        'can_manage_classroom',
        'is_active_classroom_student',
        'archive_classrooms_on_teacher_role_revocation',
        'create_classroom',
        'create_classroom_invitation',
        'join_classroom',
        'leave_classroom',
        'remove_classroom_student',
        'archive_classroom',
        'revoke_classroom_invitation',
        'get_classroom_students'
      ])
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'no classroom SECURITY DEFINER function is executable by PUBLIC'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname = any(array[
        'is_current_user_teacher',
        'is_classroom_owner',
        'can_manage_classroom',
        'is_active_classroom_student',
        'archive_classrooms_on_teacher_role_revocation',
        'create_classroom',
        'create_classroom_invitation',
        'join_classroom',
        'leave_classroom',
        'remove_classroom_student',
        'archive_classroom',
        'revoke_classroom_invitation',
        'get_classroom_students'
      ])
      and pg_catalog.has_function_privilege(
        'anon', p.oid, 'EXECUTE'
      )
  ),
  'anonymous users cannot execute classroom SECURITY DEFINER functions'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.join_classroom(text)', 'EXECUTE'
  ),
  'authenticated users can invoke the checked classroom redemption RPC'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any(array[
        'touch_classroom_updated_at',
        'guard_classroom_update',
        'archive_classrooms_on_teacher_role_revocation'
      ])
      and pg_catalog.has_function_privilege(
        'authenticated', p.oid, 'EXECUTE'
      )
  ),
  'internal classroom trigger functions are not callable by authenticated users'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    where p.oid = 'public.join_classroom(text)'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'classroom redemption is not executable by PUBLIC'
);
select ok(
  pg_catalog.strpos(
    lower(pg_catalog.pg_get_functiondef(
      'public.join_classroom(text)'::regprocedure
    )),
    'for update'
  ) > 0
  and pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.join_classroom(text)'::regprocedure
    ),
    'i.use_count < i.max_uses'
  ) > 0,
  'redemption serializes on the classroom row and conditionally consumes a use'
);
select ok(
  pg_catalog.strpos(
    lower(pg_catalog.pg_get_functiondef(
      'public.archive_classroom(uuid)'::regprocedure
    )),
    'for update'
  ) > 0,
  'archiving locks the classroom row before changing invitation state'
);
select ok(
  pg_catalog.strpos(
    lower(pg_catalog.pg_get_functiondef(
      'public.join_classroom(text)'::regprocedure
    )),
    'for share'
  ) > 0
  and pg_catalog.strpos(
    lower(pg_catalog.pg_get_functiondef(
      'public.archive_classroom(uuid)'::regprocedure
    )),
    'for share'
  ) > 0
  and pg_catalog.strpos(
    lower(pg_catalog.pg_get_functiondef(
      'public.get_classroom_students(uuid)'::regprocedure
    )),
    'for share'
  ) > 0,
  'redemption, owner operations, and roster reads serialize against teacher role changes'
);

select * from finish();
rollback;
