begin;

select plan(49);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '71000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'diagnostic-one@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Diagnostic One"}',
    now(), now()
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'diagnostic-two@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Diagnostic Two"}',
    now(), now()
  );

update public.profiles
set grade = 10
where id in (
  '71000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000002'
);

create temporary table diagnostic_test_sessions (
  label text primary key,
  session_id uuid not null
);
grant all on diagnostic_test_sessions to service_role, authenticated;

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_diagnostic_session(uuid,uuid,text[],jsonb,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated role cannot execute session creation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_diagnostic_answer(uuid,uuid,text,jsonb,bigint)',
    'EXECUTE'
  ),
  'authenticated role cannot execute answer writes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_diagnostic_session_state(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated role cannot execute private session-state reads'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_diagnostic_session(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated role cannot execute diagnostic submission'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_diagnostic_session_result(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated role cannot execute private result reads'
);
select ok(
  not has_table_privilege('authenticated', 'private.diagnostic_session_scoring', 'SELECT')
    and not has_table_privilege('authenticated', 'private.diagnostic_session_answers', 'SELECT')
    and not has_table_privilege('authenticated', 'private.diagnostic_session_results', 'SELECT'),
  'authenticated role cannot read private scoring, answers, or results'
);
select ok(
  not has_table_privilege('authenticated', 'public.diagnostic_sessions', 'INSERT')
    and not has_table_privilege('authenticated', 'public.diagnostic_sessions', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.diagnostic_sessions', 'DELETE'),
  'authenticated role has no direct session write privileges'
);

set local role service_role;
insert into pg_temp.diagnostic_test_sessions (label, session_id)
select 'owner-session', s.id
from public.create_diagnostic_session(
  '71000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  array['Q_DIAG_TEST_1']::text[],
  '[{"id":"Q_DIAG_TEST_1","stem":"Test question","questionType":"single_choice","singleChoiceOptions":[{"optionId":"Q_DIAG_TEST_1:option:A","label":"A","text":"Option A"}]}]'::jsonb,
  'diagnostic-test-v1',
  '[{"questionId":"Q_DIAG_TEST_1","questionType":"single_choice","correctOptionId":"Q_DIAG_TEST_1:option:A"}]'::jsonb
) as s;
insert into pg_temp.diagnostic_test_sessions (label, session_id)
select 'other-session', s.id
from public.create_diagnostic_session(
  '71000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000002',
  array['Q_DIAG_TEST_TF']::text[],
  '[{"id":"Q_DIAG_TEST_TF","stem":"Test true/false question","questionType":"true_false_multistatement","trueFalseStatements":[{"subOrder":"a","statementText":"Statement A"},{"subOrder":"b","statementText":"Statement B"},{"subOrder":"c","statementText":"Statement C"},{"subOrder":"d","statementText":"Statement D"}]}]'::jsonb,
  'diagnostic-test-v1',
  '[{"questionId":"Q_DIAG_TEST_TF","questionType":"true_false_multistatement","correctAnswers":{"a":true,"b":false,"c":true,"d":false}}]'::jsonb
) as s;
reset role;

select is(
  (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
  (
    select s.id
    from public.create_diagnostic_session(
      '71000000-0000-0000-0000-000000000001',
      '72000000-0000-0000-0000-000000000001',
      array['Q_DIAG_TEST_1']::text[],
      '[{"id":"Q_DIAG_TEST_1","stem":"Test question","questionType":"single_choice","singleChoiceOptions":[{"optionId":"Q_DIAG_TEST_1:option:A","label":"A","text":"Option A"}]}]'::jsonb,
      'diagnostic-test-v1',
      '[{"questionId":"Q_DIAG_TEST_1","questionType":"single_choice","correctOptionId":"Q_DIAG_TEST_1:option:A"}]'::jsonb
    ) as s
  ),
  'retry with the same user and idempotency key returns the same session'
);

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer
   from public.diagnostic_sessions
   where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session')),
  1,
  'owner can read their safe session'
);
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000002',
  true
);
select is(
  (select count(*)::integer
   from public.diagnostic_sessions
   where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session')),
  0,
  'another student cannot read the session'
);
select throws_ok(
  $$insert into public.diagnostic_sessions (user_id) values ('71000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'student cannot directly insert a session'
);
select throws_ok(
  $$select * from private.diagnostic_session_scoring$$,
  '42501',
  null,
  'student cannot read private scoring'
);
select throws_ok(
  $$select * from private.diagnostic_session_results$$,
  '42501',
  null,
  'student cannot read private results'
);
reset role;

select throws_ok(
  $$update public.diagnostic_sessions
    set grade_snapshot = 12
    where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session')$$,
  '42501',
  'Diagnostic session snapshots are immutable',
  'session grade snapshot cannot be changed'
);

set local role service_role;
select is(
  public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    0
  ),
  1::bigint,
  'first answer write creates revision one'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"unexpected":"value"}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid single-choice answer selection',
  'single-choice answers require the optionId key'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A","unexpected":"value"}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid single-choice answer selection',
  'single-choice answers reject unexpected keys'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":123}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid single-choice answer selection',
  'single-choice optionId must be a JSON string'
);
select is(
  public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    1
  ),
  2::bigint,
  'valid answer update advances the revision'
);
select is(
  public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session'),
    'Q_DIAG_TEST_TF',
    '{"answers":{"a":true,"b":false,"c":true,"d":false}}'::jsonb,
    0
  ),
  1::bigint,
  'valid true/false answer creates revision one'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session'),
    'Q_DIAG_TEST_TF',
    '{"answers":{"a":true,"b":false,"c":true}}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid true/false answer selection',
  'true/false answers require all four statement keys'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session'),
    'Q_DIAG_TEST_TF',
    '{"answers":{"a":true,"b":false,"c":true,"d":false,"extra":true}}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid true/false answer selection',
  'true/false answers reject unexpected statement keys'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session'),
    'Q_DIAG_TEST_TF',
    '{"answers":{"a":true,"b":false,"c":true,"d":"false"}}'::jsonb,
    1
  )$$,
  '22023',
  'Invalid true/false answer selection',
  'true/false selections must be JSON booleans'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    1
  )$$,
  '40001',
  'Diagnostic answer revision conflict',
  'stale answer revision is rejected'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    2
  )$$,
  'P0002',
  'Diagnostic session not found',
  'another student cannot save an answer to the session'
);
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session'),
    'Q_NOT_IN_SESSION',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    0
  )$$,
  '22023',
  'Question is not part of this diagnostic session',
  'answer writes require a question in the session snapshot'
);
select is(
  public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session'),
    'Q_DIAG_TEST_TF',
    '{"answers":{"a":true,"b":false,"c":false,"d":false}}'::jsonb,
    1
  ),
  2::bigint,
  'partial-credit answer update advances its revision'
);
select is(
  (select score
   from public.submit_diagnostic_session(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')
   )),
  0.5::numeric,
  'three matching true/false statements receive one-half point'
);
select is(
  (select status
   from public.diagnostic_sessions
   where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')),
  'completed',
  'submission completes the session'
);
select is(
  (select score
   from public.get_diagnostic_session_result(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')
   )),
  0.5::numeric,
  'computed score is persisted in the private result table'
);
select is(
  (select score
   from public.submit_diagnostic_session(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')
   )),
  0.5::numeric,
  'duplicate submission returns the unchanged persisted score'
);
select is(
  (select score
   from public.get_diagnostic_session_result(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')
   )),
  0.5::numeric,
  'owner result-read RPC restores the persisted score'
);
select throws_ok(
  $$select * from public.submit_diagnostic_session(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'other-session')
  )$$,
  'P0002',
  'Diagnostic session not found',
  'another student cannot submit the session'
);
insert into pg_temp.diagnostic_test_sessions (label, session_id)
select 'blank-session', s.id
from public.create_diagnostic_session(
  '71000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000005',
  array['Q_DIAG_TEST_1']::text[],
  '[{"id":"Q_DIAG_TEST_1","stem":"Test question","questionType":"single_choice","singleChoiceOptions":[{"optionId":"Q_DIAG_TEST_1:option:A","label":"A","text":"Option A"}]}]'::jsonb,
  'diagnostic-test-v1',
  '[{"questionId":"Q_DIAG_TEST_1","questionType":"single_choice","correctOptionId":"Q_DIAG_TEST_1:option:A"}]'::jsonb
) as s;
select is(
  (select score
   from public.submit_diagnostic_session(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'blank-session')
   )),
  0::numeric,
  'unanswered questions earn no points'
);
select is(
  (select answered_questions
   from public.get_diagnostic_session_result(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'blank-session')
   )),
  0,
  'submission persists zero answered questions'
);
insert into pg_temp.diagnostic_test_sessions (label, session_id)
select 'single-choice-session', s.id
from public.create_diagnostic_session(
  '71000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000006',
  array['Q_DIAG_TEST_1']::text[],
  '[{"id":"Q_DIAG_TEST_1","stem":"Test question","questionType":"single_choice","singleChoiceOptions":[{"optionId":"Q_DIAG_TEST_1:option:A","label":"A","text":"Option A"}]}]'::jsonb,
  'diagnostic-test-v1',
  '[{"questionId":"Q_DIAG_TEST_1","questionType":"single_choice","correctOptionId":"Q_DIAG_TEST_1:option:A"}]'::jsonb
) as s;
select is(
  public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000002',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'single-choice-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    0
  ),
  1::bigint,
  'single-choice response is saved before scoring'
);
select is(
  (select score
   from public.submit_diagnostic_session(
     '71000000-0000-0000-0000-000000000002',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'single-choice-session')
   )),
  0.25::numeric,
  'correct single-choice answer receives one-quarter point'
);
reset role;

select throws_ok(
  $$update private.diagnostic_session_results
    set score = 0
    where session_id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'single-choice-session')$$,
  '42501',
  'Diagnostic results are immutable',
  'persisted diagnostic scores cannot be changed'
);

alter table public.diagnostic_sessions disable trigger diagnostic_sessions_immutable;
update public.diagnostic_sessions
set started_at = pg_catalog.clock_timestamp() - interval '30 minutes',
    deadline_at = pg_catalog.clock_timestamp() - interval '5 minutes'
where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session');
alter table public.diagnostic_sessions enable trigger diagnostic_sessions_immutable;

set local role service_role;
insert into pg_temp.diagnostic_test_sessions (label, session_id)
select 'reassessment-session', s.id
from public.create_diagnostic_session(
  '71000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000003',
  array['Q_DIAG_TEST_1']::text[],
  '[{"id":"Q_DIAG_TEST_1","stem":"Test question","questionType":"single_choice","singleChoiceOptions":[{"optionId":"Q_DIAG_TEST_1:option:A","label":"A","text":"Option A"}]}]'::jsonb,
  'diagnostic-test-v1',
  '[{"questionId":"Q_DIAG_TEST_1","questionType":"single_choice","correctOptionId":"Q_DIAG_TEST_1:option:A"}]'::jsonb
) as s;
reset role;

select is(
  (select status
   from public.diagnostic_sessions
   where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session')),
  'incomplete',
  'new start expires a prior expired active session'
);
select is(
  (select count(*)::integer
   from private.diagnostic_session_answers
   where session_id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'owner-session')),
  1,
  'expired session answer history is preserved'
);
select is(
  (select count(*)::integer
   from public.diagnostic_sessions
   where user_id = '71000000-0000-0000-0000-000000000001'
     and status = 'in_progress'),
  1,
  'new assessment starts after the expired session is finalized'
);

alter table public.diagnostic_sessions disable trigger diagnostic_sessions_immutable;
update public.diagnostic_sessions
set started_at = pg_catalog.clock_timestamp() - interval '30 minutes',
    deadline_at = pg_catalog.clock_timestamp() - interval '5 minutes'
where id = (select session_id from pg_temp.diagnostic_test_sessions where label = 'reassessment-session');
alter table public.diagnostic_sessions enable trigger diagnostic_sessions_immutable;

set local role service_role;
select throws_ok(
  $$select public.save_diagnostic_answer(
    '71000000-0000-0000-0000-000000000001',
    (select session_id from pg_temp.diagnostic_test_sessions where label = 'reassessment-session'),
    'Q_DIAG_TEST_1',
    '{"optionId":"Q_DIAG_TEST_1:option:A"}'::jsonb,
    0
  )$$,
  '55000',
  'Diagnostic session is not accepting answers',
  'expired session rejects answer writes'
);
select is(
  (select session_status
   from public.submit_diagnostic_session(
     '71000000-0000-0000-0000-000000000001',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'reassessment-session')
   )),
  'incomplete',
  'expired session is finalized as incomplete without a score'
);
select is(
  (select count(*)::integer
   from public.get_diagnostic_session_result(
     '71000000-0000-0000-0000-000000000001',
     (select session_id from pg_temp.diagnostic_test_sessions where label = 'reassessment-session')
   )),
  0,
  'expired submission does not persist a result'
);
reset role;

select ok(
  exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'diagnostic_sessions_one_active_per_user'
  ),
  'partial unique active-session index exists'
);
select alike(
  pg_catalog.pg_get_functiondef(
    'public.create_diagnostic_session(uuid,uuid,text[],jsonb,text,jsonb)'::regprocedure
  ),
  '%pg_advisory_xact_lock%',
  'session creation serializes concurrent starts per user'
);

delete from auth.users
where id = '71000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer
   from public.diagnostic_sessions
   where id in (
     select session_id
     from pg_temp.diagnostic_test_sessions
     where label in ('owner-session', 'reassessment-session')
   )),
  0,
  'deleting the Auth user cascades to diagnostic sessions'
);
select is(
  (select count(*)::integer
   from private.diagnostic_session_scoring s
   where s.session_id in (
     select session_id
     from pg_temp.diagnostic_test_sessions
     where label in ('owner-session', 'reassessment-session')
   )),
  0,
  'deleting the Auth user cascades to private scoring'
);
select is(
  (select count(*)::integer
   from private.diagnostic_session_answers a
   where a.session_id in (
     select session_id
     from pg_temp.diagnostic_test_sessions
     where label in ('owner-session', 'reassessment-session')
   )),
  0,
  'deleting the Auth user cascades to answer history'
);

select * from finish();
rollback;
