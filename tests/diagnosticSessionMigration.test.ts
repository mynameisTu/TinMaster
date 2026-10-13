import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20261003014000_create_diagnostic_session_foundation.sql',
    import.meta.url
  ),
  'utf8'
).toLowerCase();

test('diagnostic migration defines isolated session, scoring, and answer storage', () => {
  assert.match(migration, /create table public\.diagnostic_sessions/);
  assert.match(migration, /create table private\.diagnostic_session_scoring/);
  assert.match(migration, /create table private\.diagnostic_session_answers/);
  assert.match(migration, /diagnostic_presentation_snapshot_is_safe/);
  assert.match(migration, /alter table public\.diagnostic_sessions enable row level security/);
  assert.match(migration, /alter table private\.diagnostic_session_scoring enable row level security/);
  assert.match(migration, /alter table private\.diagnostic_session_answers enable row level security/);

  const answerTable = migration.match(
    /create table private\.diagnostic_session_answers \([\s\S]*?\n\);/
  )?.[0];
  assert.ok(answerTable);
  assert.match(answerTable, /primary key \(session_id, question_id\)/);
  assert.match(answerTable, /revision bigint not null check \(revision > 0\)/);
  assert.doesNotMatch(answerTable, /correct|score|user_id/);

  const publicSnapshotGuard = migration.match(
    /create or replace function private\.diagnostic_presentation_snapshot_is_safe\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(publicSnapshotGuard);
  assert.match(publicSnapshotGuard, /singlechoiceoptions/);
  assert.match(publicSnapshotGuard, /truefalsestatements/);
  assert.doesNotMatch(publicSnapshotGuard, /iscorrect|correctoptionid|explanation|keytakeaway/);
});

test('student access is owner-scoped and all session writes use server-role RPCs', () => {
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(
    migration,
    /revoke all on public\.diagnostic_sessions from public, anon, authenticated/
  );
  assert.match(
    migration,
    /grant select \([\s\S]*?presentation_snapshot[\s\S]*?\) on public\.diagnostic_sessions to authenticated/
  );
  assert.match(
    migration,
    /revoke all on private\.diagnostic_session_scoring from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /revoke all on private\.diagnostic_session_answers from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /revoke all on function public\.create_diagnostic_session\([\s\S]*?\)\s+from public, anon, authenticated/
  );
  assert.match(
    migration,
    /grant execute on function public\.create_diagnostic_session\([\s\S]*?\)\s+to service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.save_diagnostic_answer\([\s\S]*?\)\s+to service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.get_diagnostic_session_state\([\s\S]*?\)\s+to service_role/
  );
});

test('session constraints cover grade scope, unique questions, timing, and idempotency', () => {
  assert.match(migration, /grade_snapshot smallint not null check \(grade_snapshot between 10 and 12\)/);
  assert.match(migration, /diagnostic_sessions_grade_scope_check/);
  assert.match(migration, /private\.diagnostic_question_ids_are_unique\(question_ids\)/);
  assert.match(migration, /diagnostic_sessions_deadline_check check \(deadline_at > started_at\)/);
  assert.match(migration, /unique \(user_id, idempotency_key\)/);
  assert.match(
    migration,
    /create unique index diagnostic_sessions_one_active_per_user[\s\S]*?where status = 'in_progress'/
  );
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /started_at \+ interval '25 minutes'/);
});

test('session snapshots are immutable and answer writes enforce ownership, membership, and deadline', () => {
  assert.match(migration, /diagnostic_sessions_immutable[\s\S]*?guard_diagnostic_session_update/);
  assert.match(migration, /diagnostic_session_scoring_immutable/);
  assert.match(migration, /diagnostic_session_answers_immutable_owner/);
  assert.match(migration, /s\.id = p_session_id\s+and s\.user_id = p_user_id/);
  assert.match(migration, /v_session\.deadline_at <= pg_catalog\.clock_timestamp\(\)/);
  assert.match(migration, /p_question_id = any\(v_session\.question_ids\)/);
  assert.match(migration, /diagnostic_session_scoring[\s\S]*?insert into private\.diagnostic_session_scoring/);
  assert.match(migration.trimEnd(), /commit;$/);

  const answerWriter = migration.match(
    /create or replace function public\.save_diagnostic_answer\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(answerWriter);
  assert.match(answerWriter, /p_expected_revision bigint/);
  assert.match(answerWriter, /v_current_revision <> p_expected_revision/);
  assert.match(answerWriter, /revision = a\.revision \+ 1/);
  assert.match(answerWriter, /using errcode = '40001'/);
  assert.match(answerWriter, /return v_new_revision/);
  assert.doesNotMatch(answerWriter, /p_revision\s*[,)]/);
  assert.doesNotMatch(answerWriter, /jsonb_object_length/);
  assert.match(answerWriter, /p_answer_selection - 'optionid' <> '\{\}'::jsonb/);
  assert.match(answerWriter, /v_answers - array\['a', 'b', 'c', 'd'\]::text\[\] <> '\{\}'::jsonb/);
  assert.match(answerWriter, /jsonb_typeof\(v_answers -> 'd'\) is distinct from 'boolean'/);
});

test('account deletion cascades and new starts expire every expired active session', () => {
  assert.match(
    migration,
    /user_id uuid not null references public\.profiles\(id\) on delete cascade/
  );
  assert.match(
    migration,
    /session_id uuid primary key\s+references public\.diagnostic_sessions\(id\) on delete cascade/
  );
  assert.match(
    migration,
    /session_id uuid not null\s+references public\.diagnostic_sessions\(id\) on delete cascade/
  );
  assert.doesNotMatch(
    migration,
    /references public\.profiles\(id\) on delete restrict/
  );

  const createSession = migration.match(
    /create or replace function public\.create_diagnostic_session\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(createSession);
  const expireBlock = createSession.match(
    /update public\.diagnostic_sessions s\s+set status = 'incomplete'[\s\S]*?;/)?.[0];
  const activeCheck = createSession.match(
    /if exists \([\s\S]*?status = 'in_progress'[\s\S]*?then/
  )?.[0];
  assert.ok(expireBlock);
  assert.ok(activeCheck);
  assert.match(expireBlock, /s\.user_id = p_user_id/);
  assert.match(expireBlock, /s\.status = 'in_progress'/);
  assert.match(expireBlock, /s\.deadline_at <= pg_catalog\.clock_timestamp\(\)/);
  assert.doesNotMatch(expireBlock, /idempotency_key/);
  assert.ok(createSession.indexOf(expireBlock) < createSession.indexOf(activeCheck));
});

test('migration does not modify existing learning-progress tables', () => {
  assert.doesNotMatch(
    migration,
    /alter table public\.(profiles|exam_history|student_masteries|mastery|xp)\b/
  );
  assert.doesNotMatch(migration, /create table public\.(exam_history|student_masteries|mastery|xp)\b/);
});
