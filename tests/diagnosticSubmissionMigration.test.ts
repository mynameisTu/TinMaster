import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20261003120000_add_diagnostic_submission_results.sql',
    import.meta.url
  ),
  'utf8'
).toLowerCase();

test('submission migration stores results privately and denies direct client access', () => {
  assert.match(migration, /create table private\.diagnostic_session_results/);
  assert.match(migration, /alter table private\.diagnostic_session_results enable row level security/);
  assert.match(
    migration,
    /revoke all on private\.diagnostic_session_results from public, anon, authenticated, service_role/
  );
  assert.match(migration, /before update on private\.diagnostic_session_results/);
  assert.match(migration, /score numeric\(7, 2\)/);
  assert.match(migration, /maximum_score numeric\(7, 2\)/);
  assert.match(migration, /references public\.diagnostic_sessions\(id\) on delete cascade/);
});

test('submission is owner-scoped, deadline-enforced, transactional, and retry-stable', () => {
  const submit = migration.match(
    /create or replace function public\.submit_diagnostic_session\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(submit);
  assert.match(submit, /s\.id = p_session_id\s+and s\.user_id = p_user_id/);
  assert.match(submit, /for update/);
  assert.match(submit, /v_session\.deadline_at <= v_now/);
  assert.match(submit, /set status = 'incomplete'/);
  assert.match(submit, /set status = 'completed'/);
  assert.match(submit, /insert into private\.diagnostic_session_results/);
  assert.match(submit, /if v_session\.status = 'completed'[\s\S]*?from private\.diagnostic_session_results/);
  assert.match(submit, /if v_session\.status = 'incomplete'[\s\S]*?null::numeric/);
  assert.match(migration, /grant execute on function public\.submit_diagnostic_session\(uuid, uuid\)\s+to service_role/);
  assert.match(migration, /revoke all on function public\.submit_diagnostic_session\(uuid, uuid\)\s+from public, anon, authenticated/);
});

test('private answer keys control scoring and results are owner-readable only through RPC', () => {
  const submit = migration.match(
    /create or replace function public\.submit_diagnostic_session\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(submit);
  assert.match(submit, /from private\.diagnostic_session_scoring scoring/);
  assert.match(submit, /from private\.diagnostic_session_answers answer/);
  assert.match(submit, /correctoptionid/);
  assert.match(submit, /correctanswers/);
  assert.match(submit, /when 1 then 0\.1\s+when 2 then 0\.25\s+when 3 then 0\.5\s+when 4 then 1/);

  const readResult = migration.match(
    /create or replace function public\.get_diagnostic_session_result\([\s\S]*?\n\$\$;/
  )?.[0];
  assert.ok(readResult);
  assert.match(readResult, /session\.user_id = p_user_id/);
  assert.match(readResult, /session\.status = 'completed'/);
  assert.match(migration, /grant execute on function public\.get_diagnostic_session_result\(uuid, uuid\)\s+to service_role/);
  assert.doesNotMatch(migration, /alter table public\.(student_masteries|exam_history|xp)\b/);
  assert.doesNotMatch(migration, /create table public\.(student_masteries|exam_history|xp)\b/);
});
