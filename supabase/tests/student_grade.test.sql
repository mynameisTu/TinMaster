begin;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '51000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'grade-student@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Grade Student"}',
    now(), now()
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'grade-other@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Other Student"}',
    now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select public.update_my_student_grade(10)$$,
  'a student can set grade 10'
);
select is(
  (select grade::integer from public.profiles where id = auth.uid()),
  10,
  'grade 10 is persisted on the authenticated student profile'
);
select lives_ok(
  $$select public.update_my_student_grade(11)$$,
  'a student can set grade 11'
);
select is(
  (select grade::integer from public.profiles where id = auth.uid()),
  11,
  'grade 11 is persisted on the authenticated student profile'
);
select lives_ok(
  $$select public.update_my_student_grade(12)$$,
  'a student can set grade 12'
);
select is(
  (select grade::integer from public.profiles where id = auth.uid()),
  12,
  'grade 12 is persisted on the authenticated student profile'
);
select throws_ok(
  $$select public.update_my_student_grade(9)$$,
  '22023',
  'Grade must be 10, 11, or 12',
  'invalid grades are rejected'
);
select throws_ok(
  $$update public.profiles set grade = 10
    where id = '51000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'a student cannot directly update another profile grade'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501',
  null,
  'a student cannot change their role'
);

reset role;
select * from finish();
rollback;
