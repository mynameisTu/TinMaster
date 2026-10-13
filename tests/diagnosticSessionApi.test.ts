import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { configureDiagnosticRpc } from '../src/server/diagnosticRpc';
import { configureDiagnosticStartDependencies } from '../src/server/diagnosticStart';
import { configureLatestCompletedSessionResolver } from '../src/server/diagnosticSession';
import { SERVER_DIAGNOSTIC_QUESTION_BANK } from '../src/server/diagnosticQuestionBank';
import {
  configureAccessTokenVerifier,
  configureProfileRoleResolver,
} from '../src/server/supabaseAuth';

const ownerId = 'diagnostic-owner';
const secondUserId = 'diagnostic-second-user';
const sessionId = '83000000-0000-4000-8000-000000000001';
const secondSessionId = '83000000-0000-4000-8000-000000000003';
const idempotencyKey = '83000000-0000-4000-8000-000000000002';
const secondIdempotencyKey = '83000000-0000-4000-8000-000000000004';
const ownerToken = 'diagnostic-owner-token';
const secondUserToken = 'diagnostic-second-token';
const authUsers = new Map([
  [ownerToken, ownerId],
  [secondUserToken, secondUserId],
]);
let profileRole: 'student' | 'teacher' = 'student';
let latestResolverFails = false;
const sessions = new Map<string, Record<string, unknown>>();
const idempotencySessions = new Map<string, string>();
const savedAnswers = new Map<string, Record<string, unknown>>();
const persistedResults = new Map<string, Record<string, unknown>>();
const rpcCalls: Array<{ functionName: string; args: Record<string, unknown> }> = [];

const restoreVerifier = configureAccessTokenVerifier(async (token) => {
  const id = authUsers.get(token);
  return id ? { id } as never : null;
});
const restoreRoleResolver = configureProfileRoleResolver(async () => profileRole);
const restoreLatestSessionResolver = configureLatestCompletedSessionResolver(async (userId) => {
  if (latestResolverFails) throw new Error('lookup unavailable');
  const latest = [...sessions.values()]
    .filter((session) => session.user_id === userId && session.status === 'completed')
    .sort((left, right) =>
      String(right.finalized_at).localeCompare(String(left.finalized_at))
    )[0];
  return typeof latest?.id === 'string' ? latest.id : null;
});
const restoreStartDependencies = configureDiagnosticStartDependencies({
  resolveGrade: async (userId) => ({
    found: true,
    grade: userId === ownerId ? 11 : 10,
  }),
  selectQuestions: (grade) => SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (question) => question.grade <= Number(grade)
  ),
});
const restoreRpc = configureDiagnosticRpc(async (functionName, args) => {
  rpcCalls.push({ functionName, args });
  if (functionName === 'create_diagnostic_session') {
    const key = `${String(args.p_user_id)}:${String(args.p_idempotency_key)}`;
    const existingId = idempotencySessions.get(key);
    if (existingId) {
      return { data: [sessions.get(existingId)], error: null };
    }
    const row = {
      id: args.p_user_id === ownerId ? sessionId : secondSessionId,
      user_id: args.p_user_id,
      grade_snapshot: args.p_user_id === ownerId ? 11 : 10,
      eligible_grades: args.p_user_id === ownerId ? [10, 11] : [10],
      question_ids: args.p_question_ids,
      presentation_snapshot: args.p_presentation_snapshot,
      question_bank_version: args.p_question_bank_version,
      started_at: '2099-01-01T00:00:00.000Z',
      deadline_at: '2099-01-01T00:25:00.000Z',
      status: 'in_progress',
      submitted_at: null,
      finalized_at: null,
    };
    sessions.set(String(row.id), row);
    idempotencySessions.set(key, String(row.id));
    return { data: [row], error: null };
  }
  if (functionName === 'get_diagnostic_session_result') {
    const row = sessions.get(String(args.p_session_id));
    if (!row || row.user_id !== args.p_user_id) {
      return { data: null, error: { code: 'P0002', message: 'not found' } };
    }
    return { data: persistedResults.get(String(args.p_session_id)) ?? null, error: null };
  }
  if (functionName === 'submit_diagnostic_session') {
    const key = String(args.p_session_id);
    const row = sessions.get(key);
    if (!row || row.user_id !== args.p_user_id) {
      return { data: null, error: { code: 'P0002', message: 'not found' } };
    }
    if (row.status === 'incomplete') {
      return {
        data: [{
          session_status: 'incomplete',
          score: null,
          maximum_score: null,
          answered_questions: null,
          fully_correct_questions: null,
          total_questions: null,
          submitted_at: null,
        }],
        error: null,
      };
    }
    if (
      row.status === 'in_progress' &&
      new Date(String(row.deadline_at)).getTime() <= Date.now()
    ) {
      row.status = 'incomplete';
      row.finalized_at = new Date().toISOString();
      return {
        data: [{
          session_status: 'incomplete',
          score: null,
          maximum_score: null,
          answered_questions: null,
          fully_correct_questions: null,
          total_questions: null,
          submitted_at: null,
        }],
        error: null,
      };
    }
    if (row.status === 'in_progress') {
      row.status = 'completed';
      row.submitted_at = new Date().toISOString();
      row.finalized_at = row.submitted_at;
      persistedResults.set(key, {
        score: 0.25,
        maximum_score: 0.25,
        answered_questions: 1,
        fully_correct_questions: 1,
        total_questions: 1,
        submitted_at: row.submitted_at,
      });
    }
    return {
      data: [{
        session_status: row.status,
        ...persistedResults.get(key),
      }],
      error: null,
    };
  }
  if (functionName === 'get_diagnostic_session_state') {
    const row = sessions.get(String(args.p_session_id));
    if (!row || row.user_id !== args.p_user_id) {
      return { data: null, error: { code: 'P0002', message: 'not found' } };
    }
    if (
      row.status === 'in_progress' &&
      new Date(String(row.deadline_at)).getTime() <= Date.now()
    ) {
      row.status = 'incomplete';
      row.finalized_at = new Date().toISOString();
    }
    const answerSelections: Record<string, unknown> = {};
    for (const [key, answer] of savedAnswers) {
      if (key.startsWith(`${String(args.p_session_id)}:`)) {
        answerSelections[key.slice(String(args.p_session_id).length + 1)] = answer;
      }
    }
    return {
      data: [{
        session_id: row.id,
        grade_snapshot: row.grade_snapshot,
        eligible_grades: row.eligible_grades,
        presentation_snapshot: row.presentation_snapshot,
        question_bank_version: row.question_bank_version,
        started_at: row.started_at,
        deadline_at: row.deadline_at,
        status: row.status,
        submitted_at: row.submitted_at,
        finalized_at: row.finalized_at,
        answer_selections: answerSelections,
      }],
      error: null,
    };
  }
  if (functionName === 'save_diagnostic_answer') {
    const row = sessions.get(String(args.p_session_id));
    if (!row || row.user_id !== args.p_user_id) {
      return { data: null, error: { code: 'P0002', message: 'not found' } };
    }
    if (
      row.status !== 'in_progress' ||
      new Date(String(row.deadline_at)).getTime() <= Date.now()
    ) {
      return { data: null, error: { code: '55000', message: 'expired' } };
    }
    const answerKey = `${String(args.p_session_id)}:${String(args.p_question_id)}`;
    const existing = savedAnswers.get(answerKey);
    const currentRevision = typeof existing?.revision === 'number' ? existing.revision : 0;
    if (args.p_expected_revision !== currentRevision) {
      return { data: null, error: { code: '40001', message: 'conflict' } };
    }
    const revision = currentRevision + 1;
    savedAnswers.set(answerKey, {
      revision,
      answerSelection: args.p_answer_selection,
    });
    return { data: revision, error: null };
  }
  throw new Error(`Unexpected RPC ${functionName}`);
});

const { default: app } = await import('../api/[...path].js');
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  restoreVerifier();
  restoreRoleResolver();
  restoreLatestSessionResolver();
  restoreStartDependencies();
  restoreRpc();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

test('diagnostic lifecycle requires a verified student and validates route inputs', async () => {
  const start = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
  assert.equal(start.status, 401);

  profileRole = 'teacher';
  const teacherStart = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
    method: 'POST',
    headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
  assert.equal(teacherStart.status, 403);
  profileRole = 'student';

  const invalidKey = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
    method: 'POST',
    headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: 'not-a-uuid' }),
  });
  assert.equal(invalidKey.status, 400);
  assert.equal(rpcCalls.length, 0);

  const anonymousRead = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`);
  assert.equal(anonymousRead.status, 401);
  const anonymousLatestResult = await fetch(
    `${baseUrl}/api/diagnostic/assessment/latest-result`
  );
  assert.equal(anonymousLatestResult.status, 401);
});

test('diagnostic sessions persist idempotently, remain owner-scoped, and enforce answer revisions and deadlines', async () => {
  const startRequest = () => fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
    method: 'POST',
    headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey,
      userId: secondUserId,
      grade: 10,
      role: 'admin',
      scoring: { correctAnswers: { a: false } },
    }),
  });
  const firstStart = await startRequest();
  const firstBody = await firstStart.json();
  assert.equal(firstStart.status, 200);
  assert.equal(firstBody.assessment.persisted, true);
  assert.equal(firstBody.assessment.grade, 11);
  assert.equal(firstBody.assessment.id, sessionId);
  assert.doesNotMatch(JSON.stringify(firstBody), /correctOptionId|correctAnswers|explanation|isCorrect/);

  const creation = rpcCalls.find((call) => call.functionName === 'create_diagnostic_session');
  assert.ok(creation);
  assert.equal(creation.args.p_user_id, ownerId);
  assert.equal(creation.args.p_idempotency_key, idempotencyKey);
  assert.equal((creation.args.p_scoring_snapshot as unknown[]).length, firstBody.questions.length);
  assert.equal(creation.args.p_question_bank_version, 'tinmaster-diagnostic-v1');

  const retry = await startRequest();
  const retryBody = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(retryBody.assessment.id, firstBody.assessment.id);
  assert.equal(
    rpcCalls.filter((call) => call.functionName === 'create_diagnostic_session').length,
    2
  );

  const ownerRead = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`, {
    headers: auth(ownerToken),
  });
  const initialState = await ownerRead.json();
  assert.equal(ownerRead.status, 200);
  assert.equal(initialState.assessment.status, 'in_progress');
  assert.deepEqual(initialState.answers, {});

  const noCompletedResult = await fetch(
    `${baseUrl}/api/diagnostic/assessment/latest-result`,
    { headers: auth(ownerToken) }
  );
  assert.equal(noCompletedResult.status, 200);
  assert.deepEqual(await noCompletedResult.json(), { result: null });

  const otherUserRead = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`, {
    headers: auth(secondUserToken),
  });
  assert.equal(otherUserRead.status, 404);

  const questionId = firstBody.questions[0].id;
  const callsBeforeInvalidWrites = rpcCalls.length;
  const invalidRevision = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${sessionId}/answers`,
    {
      method: 'POST',
      headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId,
        answerSelection: {},
        expectedRevision: -1,
      }),
    }
  );
  assert.equal(invalidRevision.status, 400);
  assert.equal(rpcCalls.length, callsBeforeInvalidWrites);

  const otherUserWrite = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${sessionId}/answers`,
    {
      method: 'POST',
      headers: { ...auth(secondUserToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId,
        answerSelection: {},
        expectedRevision: 0,
      }),
    }
  );
  assert.equal(otherUserWrite.status, 404);

  const save = async (expectedRevision: number, answerSelection: unknown) => fetch(
    `${baseUrl}/api/diagnostic/assessment/${sessionId}/answers`,
    {
      method: 'POST',
      headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answerSelection, expectedRevision }),
    }
  );
  const firstSave = await save(0, {
    optionId: firstBody.questions[0].singleChoiceOptions[0].optionId,
  });
  assert.equal(firstSave.status, 200);
  assert.deepEqual(await firstSave.json(), { revision: 1 });

  const staleSave = await save(0, { optionId: 'stale' });
  assert.equal(staleSave.status, 409);
  assert.equal((await staleSave.json()).code, 'ANSWER_REVISION_CONFLICT');

  const ownerState = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`, {
    headers: auth(ownerToken),
  });
  const savedState = await ownerState.json();
  assert.equal(savedState.answers[questionId].revision, 1);
  assert.equal(savedState.result, null);

  const clear = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${sessionId}/answers/${questionId}`,
    {
      method: 'DELETE',
      headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    }
  );
  assert.equal(clear.status, 200);
  assert.deepEqual(await clear.json(), { revision: 2 });

  const persistedClear = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`, {
    headers: auth(ownerToken),
  });
  const clearedState = await persistedClear.json();
  assert.equal(clearedState.answers[questionId].revision, 2);
  assert.equal(clearedState.answers[questionId].answerSelection, null);

  const anonymousSubmit = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}/submit`, {
    method: 'POST',
  });
  assert.equal(anonymousSubmit.status, 401);

  const saveBeforeSubmit = await save(2, {
    optionId: firstBody.questions[0].singleChoiceOptions[0].optionId,
  });
  assert.equal(saveBeforeSubmit.status, 200);
  assert.deepEqual(await saveBeforeSubmit.json(), { revision: 3 });

  const otherUserSubmit = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${sessionId}/submit`,
    { method: 'POST', headers: auth(secondUserToken) }
  );
  assert.equal(otherUserSubmit.status, 404);

  const submit = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}/submit`, {
    method: 'POST',
    headers: {
      ...auth(ownerToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ score: 100, correctAnswers: { a: true }, userId: secondUserId }),
  });
  const submitted = await submit.json();
  assert.equal(submit.status, 200);
  assert.equal(submitted.status, 'completed');
  assert.deepEqual(submitted.result, {
    score: 0.25,
    maximumScore: 0.25,
    percentage: 100,
    answeredQuestions: 1,
    fullyCorrectQuestions: 1,
    totalQuestions: 1,
    submittedAt: sessions.get(sessionId)?.submitted_at,
  });
  const submissionCall = [...rpcCalls].reverse().find(
    (call) => call.functionName === 'submit_diagnostic_session'
  );
  assert.equal(submissionCall?.args.p_user_id, ownerId);
  assert.equal(submissionCall?.args.p_session_id, sessionId);
  assert.equal(Object.hasOwn(submissionCall?.args ?? {}, 'p_score'), false);

  const submitRetry = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}/submit`, {
    method: 'POST',
    headers: auth(ownerToken),
  });
  assert.deepEqual(await submitRetry.json(), submitted);

  const restoredResult = await fetch(`${baseUrl}/api/diagnostic/assessment/${sessionId}`, {
    headers: auth(ownerToken),
  });
  const restoredBody = await restoredResult.json();
  assert.equal(restoredBody.assessment.status, 'completed');
  assert.deepEqual(restoredBody.result, submitted.result);

  const latestResult = await fetch(
    `${baseUrl}/api/diagnostic/assessment/latest-result`,
    { headers: auth(ownerToken) }
  );
  assert.equal(latestResult.status, 200);
  assert.deepEqual((await latestResult.json()).result, submitted.result);
  const latestResultCall = [...rpcCalls].reverse().find(
    (call) => call.functionName === 'get_diagnostic_session_result'
  );
  assert.equal(latestResultCall?.args.p_user_id, ownerId);
  assert.equal(latestResultCall?.args.p_session_id, sessionId);
  const otherUsersLatestResult = await fetch(
    `${baseUrl}/api/diagnostic/assessment/latest-result`,
    { headers: auth(secondUserToken) }
  );
  assert.equal(otherUsersLatestResult.status, 200);
  assert.deepEqual(await otherUsersLatestResult.json(), { result: null });

  latestResolverFails = true;
  const unavailableLatestResult = await fetch(
    `${baseUrl}/api/diagnostic/assessment/latest-result`,
    { headers: auth(ownerToken) }
  );
  assert.equal(unavailableLatestResult.status, 503);
  assert.equal((await unavailableLatestResult.json()).code, 'ASSESSMENT_RESULT_LOOKUP_FAILED');
  latestResolverFails = false;

  const secondStart = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
    method: 'POST',
    headers: { ...auth(secondUserToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: secondIdempotencyKey }),
  });
  assert.equal(secondStart.status, 200);

  const row = sessions.get(secondSessionId);
  assert.ok(row);
  row.deadline_at = '2000-01-01T00:00:00.000Z';
  const lateWrite = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${secondSessionId}/answers`,
    {
      method: 'POST',
      headers: { ...auth(secondUserToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: (await secondStart.json()).questions[0].id,
        answerSelection: { optionId: 'expired' },
        expectedRevision: 0,
      }),
    }
  );
  assert.equal(lateWrite.status, 409);
  assert.equal((await lateWrite.json()).code, 'ASSESSMENT_NOT_ACCEPTING_ANSWERS');

  const expiredSubmit = await fetch(
    `${baseUrl}/api/diagnostic/assessment/${secondSessionId}/submit`,
    { method: 'POST', headers: auth(secondUserToken) }
  );
  assert.equal(expiredSubmit.status, 200);
  assert.deepEqual(await expiredSubmit.json(), { status: 'incomplete', result: null });

  const expiredRead = await fetch(`${baseUrl}/api/diagnostic/assessment/${secondSessionId}`, {
    headers: auth(secondUserToken),
  });
  assert.equal(expiredRead.status, 200);
  assert.equal((await expiredRead.json()).assessment.status, 'incomplete');
});
