import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { extractQuestionsFromFile } from '../src/services/exerciseService';
import {
  classifyGeminiError,
  generateWithGeminiResilience,
  GeminiResilienceError,
  GeminiResponseError,
  getRetryAfterMs,
  parseAndValidateExtractedQuestions,
} from '../src/server/geminiResilience';
import {
  configureAccessTokenVerifier,
  configureProfileRoleResolver,
} from '../src/server/supabaseAuth';
import {
  configureRateLimitConsumer,
  type RateLimitEndpoint,
} from '../src/server/rateLimit';
import { configureDiagnosticStartDependencies } from '../src/server/diagnosticStart';
import { SERVER_DIAGNOSTIC_QUESTION_BANK } from '../src/server/diagnosticQuestionBank';
import { configureDiagnosticRpc } from '../src/server/diagnosticRpc';
import { configureLatestCompletedSessionResolver } from '../src/server/diagnosticSession';

const testGeminiSecret = 'unit-test-gemini-secret';
process.env.GEMINI_API_KEY = testGeminiSecret;
let failTokenVerification = false;
const restoreAccessTokenVerifier = configureAccessTokenVerifier(async (token) => {
  if (failTokenVerification) throw new Error('auth service unavailable');
  if (token === 'test-access-token') return { id: 'verified-test-user' } as never;
  if (token === 'second-user-token') return { id: 'second-verified-user' } as never;
  return null;
});
let testProfileRole: 'student' | 'teacher' | 'admin' | null = 'admin';
let failProfileLookup = false;
const restoreProfileRoleResolver = configureProfileRoleResolver(async (userId) => {
  assert.ok(['verified-test-user', 'second-verified-user'].includes(userId));
  if (failProfileLookup) throw new Error('database unavailable');
  return testProfileRole;
});
const rateLimitCounts = new Map<string, number>();
const rateLimitCalls: Array<{ userId: string; endpoint: RateLimitEndpoint }> = [];
const rateLimitLimits = new Map<RateLimitEndpoint, number>();
const restoreRateLimitConsumer = configureRateLimitConsumer(async (userId, endpoint) => {
  rateLimitCalls.push({ userId, endpoint });
  const key = `${userId}:${endpoint}`;
  const count = (rateLimitCounts.get(key) ?? 0) + 1;
  rateLimitCounts.set(key, count);
  return {
    allowed: count <= (rateLimitLimits.get(endpoint) ?? 1000),
    retryAfterSeconds: 37,
  };
});
const { default: app } = await import('../api/[...path].js');
const { default: extractFileApp } = await import('../api/exercises/extract-file.js');

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
  restoreAccessTokenVerifier();
  restoreProfileRoleResolver();
  restoreRateLimitConsumer();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health endpoint retains its response contract without exposing credentials', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    'geminiConfigured',
    'service',
    'status',
    'version',
  ]);
  assert.equal(body.status, 'ok');
  assert.equal(body.geminiConfigured, true);
  assert.equal(JSON.stringify(body).includes(testGeminiSecret), false);
  process.env.GEMINI_API_KEY = '';

  const noCredentialResponse = await fetch(`${baseUrl}/api/health`);
  const noCredentialBody = await noCredentialResponse.json();
  assert.equal(noCredentialResponse.status, 200);
  assert.equal(noCredentialBody.status, 'ok');
  assert.equal(noCredentialBody.geminiConfigured, false);
});

test('file extraction rejects an invalid upload using the existing response shape', async () => {
  const serverlessRouteServer = extractFileApp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => serverlessRouteServer.once('listening', resolve));
  const address = serverlessRouteServer.address();
  assert.ok(address && typeof address !== 'string');

  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`http://127.0.0.1:${address.port}/api/exercises/extract-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({ file: { name: 'invalid.pdf' } }),
    });
    body = await response.json();
  } finally {
    await new Promise<void>((resolve, reject) => {
      serverlessRouteServer.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    error: 'Dữ liệu file không hợp lệ hoặc thiếu thông tin.',
  });
});

test('document extraction retries a mocked 503 and preserves its API response contract', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFallbackModel = process.env.GEMINI_FALLBACK_MODEL;
  const messages: string[] = [];
  let geminiCalls = 0;
  const question = {
    questionType: 'single_choice',
    stem: 'Kết quả của phép tính là gì?',
    singleChoiceOptions: ['A', 'B', 'C', 'D'].map((label) => ({
      label,
      text: `Phương án ${label}`,
      isCorrect: label === 'B',
    })),
  };

  process.env.GEMINI_API_KEY = 'mock-server-only-key';
  delete process.env.GEMINI_FALLBACK_MODEL;
  console.info = (...args: unknown[]) => messages.push(args.join(' '));
  globalThis.fetch = async () => {
    geminiCalls += 1;
    if (geminiCalls === 1) {
      return new Response(JSON.stringify({
        error: { code: 503, message: 'Temporary service unavailable', status: 'UNAVAILABLE' },
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify([question]) }] } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/exercises/extract-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({
        file: {
          name: 'private-document.png',
          mimeType: 'image/png',
          base64: 'data:image/png;base64,c2Vuc2l0aXZlLWRvY3VtZW50',
        },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ['count', 'fileName', 'questions', 'success']);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.questions[0].stem, question.stem);
    assert.equal(geminiCalls, 2);
    assert.ok(messages.some((message) => message.includes('"retryCount":1')));
    assert.ok(messages.every((message) => !message.includes('private-document.png')));
    assert.ok(messages.every((message) => !message.includes('c2Vuc2l0aXZlLWRvY3VtZW50')));
    assert.ok(messages.every((message) => !message.includes('mock-server-only-key')));
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalFallbackModel === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallbackModel;
  }
});

test('AI endpoints retain their no-key fallback contracts', async () => {
  const explanationResponse = await fetch(`${baseUrl}/api/ai/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-access-token',
    },
    body: JSON.stringify({
      question: { stem: 'Question', explanation: 'Expected explanation' },
      userAnswer: 'A',
      conceptName: 'Python',
      studentScore: 7,
    }),
  });
  const explanation = await explanationResponse.json();

  assert.equal(explanationResponse.status, 200);
  assert.equal(explanation.explanation, 'Expected explanation');
  assert.equal(typeof explanation.misconceptionDiagnosis, 'string');
  assert.ok(Array.isArray(explanation.studyTips));

  const videoResponse = await fetch(`${baseUrl}/api/ai/video-script`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-access-token',
    },
    body: JSON.stringify({
      conceptId: 'C01',
      conceptName: 'Python',
      topicName: 'Programming',
    }),
  });

  assert.equal(videoResponse.status, 400);
  assert.deepEqual(await videoResponse.json(), {
    error: 'Gemini API not configured',
  });
});

test('AI and extraction endpoints reject missing or invalid Supabase sessions', async () => {
  const callsBefore = rateLimitCalls.length;
  for (const endpoint of ['/api/ai/explain', '/api/ai/video-script']) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  const invalidResponse = await fetch(`${baseUrl}/api/exercises/extract-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer expired-token',
    },
    body: JSON.stringify({ file: { name: 'sample.pdf', base64: 'data' } }),
  });
  assert.equal(invalidResponse.status, 401);
  assert.deepEqual(await invalidResponse.json(), {
    error: 'Invalid or expired authentication session',
    code: 'AUTH_INVALID',
  });
  assert.equal(rateLimitCalls.length, callsBefore);
});

test('diagnostic start requires an authenticated student and ignores client grade overrides', async () => {
  const originalRole = testProfileRole;
  let resolverCall: { userId: string; token: string } | null = null;
  let selectedTrack: unknown;
  const createCalls: Record<string, unknown>[] = [];
  const restoreDependencies = configureDiagnosticStartDependencies({
    resolveGrade: async (userId, token) => {
      resolverCall = { userId, token };
      return { found: true, grade: 11, examTrack: 'CS' };
    },
    selectQuestions: (grade, examTrack) => {
      assert.equal(grade, 11);
      selectedTrack = examTrack;
      return SERVER_DIAGNOSTIC_QUESTION_BANK.filter((question) =>
        question.grade <= Number(grade)
      );
    },
  });
  const restoreRpc = configureDiagnosticRpc(async (functionName, args) => {
    assert.equal(functionName, 'create_diagnostic_session');
    createCalls.push(args);
    return {
      error: null,
      data: [{
        id: '82000000-0000-0000-0000-000000000001',
        grade_snapshot: 11,
        eligible_grades: [10, 11],
        started_at: '2026-10-03T00:00:00.000Z',
        deadline_at: '2026-10-03T00:25:00.000Z',
        status: 'in_progress',
        presentation_snapshot: args.p_presentation_snapshot,
      }],
    };
  });

  try {
    testProfileRole = 'student';
    const unauthenticated = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: 10 }),
    });
    assert.equal(unauthenticated.status, 401);

    const response = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({
        idempotencyKey: '82000000-0000-4000-8000-000000000011',
        grade: 10,
        userId: 'attacker-controlled-user',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(resolverCall, {
      userId: 'verified-test-user',
      token: 'test-access-token',
    });
    assert.equal(selectedTrack, 'CS');
    assert.equal(createCalls[0].p_user_id, 'verified-test-user');
    assert.equal(createCalls[0].p_idempotency_key, '82000000-0000-4000-8000-000000000011');
    assert.equal(createCalls[0].p_question_bank_version, 'tinmaster-diagnostic-v1');
    assert.equal((createCalls[0].p_scoring_snapshot as unknown[]).length, 16);
    assert.deepEqual(body.assessment, {
      id: '82000000-0000-0000-0000-000000000001',
      grade: 11,
      eligibleGrades: [10, 11],
      startedAt: '2026-10-03T00:00:00.000Z',
      deadlineAt: '2026-10-03T00:25:00.000Z',
      status: 'in_progress',
      targetDurationMinutes: 25,
      persisted: true,
    });
    assert.equal(body.questions.length, 16);
    assert.equal(body.questions.some((question: { id: string }) =>
      SERVER_DIAGNOSTIC_QUESTION_BANK.find((item) => item.id === question.id)?.grade === 12
    ), false);
    assert.deepEqual(Object.keys(body.questions[0]).sort(), [
      'id',
      'questionType',
      'singleChoiceOptions',
      'stem',
    ]);
    assert.doesNotMatch(JSON.stringify(body), /isCorrect|correctOptionId|correctAnswers|explanation|keyTakeaway|distractorExplanation|sourceYear/);
  } finally {
    testProfileRole = originalRole;
    restoreRpc();
    restoreDependencies();
  }
});

test('diagnostic start rejects non-students and handles missing, invalid, and unavailable profiles safely', async () => {
  const originalRole = testProfileRole;
  const restoreDependencies = configureDiagnosticStartDependencies({
    resolveGrade: async (userId) => {
      if (userId === 'verified-test-user') return { found: false, grade: null };
      if (userId === 'second-verified-user') return { found: true, grade: 14 };
      throw new Error('sensitive database failure detail');
    },
    selectQuestions: () => SERVER_DIAGNOSTIC_QUESTION_BANK,
  });

  try {
    testProfileRole = 'teacher';
    const forbidden = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-access-token' },
    });
    assert.equal(forbidden.status, 403);

    testProfileRole = 'student';
    const missingProfile = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-access-token' },
    });
    assert.equal(missingProfile.status, 404);
    assert.deepEqual(await missingProfile.json(), {
      error: 'Không tìm thấy hồ sơ học sinh.',
      code: 'PROFILE_NOT_FOUND',
    });

    const missingGradeDependencies = configureDiagnosticStartDependencies({
      resolveGrade: async () => ({ found: true, grade: null }),
      selectQuestions: () => SERVER_DIAGNOSTIC_QUESTION_BANK,
    });
    try {
      const missingGrade = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token' },
      });
      assert.equal(missingGrade.status, 400);
      assert.deepEqual(await missingGrade.json(), {
        error: 'Hãy cập nhật khối lớp hợp lệ (10, 11 hoặc 12) trong hồ sơ trước khi bắt đầu.',
        code: 'PROFILE_GRADE_REQUIRED',
      });
    } finally {
      missingGradeDependencies();
    }

    const invalidGrade = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer second-user-token' },
    });
    assert.equal(invalidGrade.status, 400);
    assert.deepEqual(await invalidGrade.json(), {
      error: 'Hãy cập nhật khối lớp hợp lệ (10, 11 hoặc 12) trong hồ sơ trước khi bắt đầu.',
      code: 'PROFILE_GRADE_INVALID',
    });

    const unavailableProfile = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.equal(unavailableProfile.status, 401);

    const databaseFailureDependencies = configureDiagnosticStartDependencies({
      resolveGrade: async () => {
        throw new Error('private database detail');
      },
      selectQuestions: () => SERVER_DIAGNOSTIC_QUESTION_BANK,
    });
    try {
      const unavailable = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token' },
      });
      assert.equal(unavailable.status, 503);
      const unavailableBody = await unavailable.json();
      assert.deepEqual(unavailableBody, {
        error: 'Không thể tải hồ sơ học sinh. Vui lòng thử lại sau.',
        code: 'PROFILE_LOOKUP_FAILED',
      });
      assert.doesNotMatch(JSON.stringify(unavailableBody), /private database detail/);
    } finally {
      databaseFailureDependencies();
    }

    const emptyPoolDependencies = configureDiagnosticStartDependencies({
      resolveGrade: async () => ({ found: true, grade: 10 }),
      selectQuestions: () => [],
    });
    try {
      const emptyPool = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token' },
      });
      assert.equal(emptyPool.status, 503);
      assert.deepEqual(await emptyPool.json(), {
        error: 'Hiện chưa có câu hỏi phù hợp với khối lớp trong hồ sơ.',
        code: 'QUESTION_POOL_EMPTY',
      });
    } finally {
      emptyPoolDependencies();
    }

    const questionFailureDependencies = configureDiagnosticStartDependencies({
      resolveGrade: async () => ({ found: true, grade: 10 }),
      selectQuestions: () => {
        throw new Error('private question repository failure');
      },
    });
    try {
      const questionFailure = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token' },
      });
      assert.equal(questionFailure.status, 503);
      assert.deepEqual(await questionFailure.json(), {
        error: 'Không thể chuẩn bị bộ câu hỏi. Vui lòng thử lại sau.',
        code: 'QUESTION_SELECTION_FAILED',
      });
    } finally {
      questionFailureDependencies();
    }
  } finally {
    testProfileRole = originalRole;
    restoreDependencies();
  }
});

test('diagnostic complete authenticated workflow: start -> load -> answer -> submit -> persist -> retrieve', async () => {
  const originalRole = testProfileRole;
  testProfileRole = 'student';

  const testSessionId = '94000000-0000-4000-8000-000000000001';
  const testIdempotencyKey = '94000000-0000-4000-8000-000000000002';
  const studentUserId = 'verified-test-user';

  // Build the 28-question exam: 24 single-choice (6.0 pts) + 4 true/false (4.0 pts) = 10.0 pts max
  const scQuestions = SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (q) => q.questionType === 'single_choice'
  ).slice(0, 24);
  const tfQuestions = SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (q) => q.questionType === 'true_false_multistatement'
  ).slice(0, 4);
  assert.equal(scQuestions.length, 24);
  assert.equal(tfQuestions.length, 4);
  const examQuestions28 = [...scQuestions, ...tfQuestions];
  assert.equal(examQuestions28.length, 28);

  const restoreStartDeps = configureDiagnosticStartDependencies({
    resolveGrade: async (userId) => {
      assert.equal(userId, studentUserId);
      return { found: true, grade: 12, examTrack: 'CS' };
    },
    selectQuestions: () => examQuestions28,
  });

  const sessionStore = new Map<string, Record<string, unknown>>();
  const answersStore = new Map<string, Record<string, unknown>>();
  const resultsStore = new Map<string, Record<string, unknown>>();

  const restoreRpc = configureDiagnosticRpc(async (functionName, args) => {
    if (functionName === 'create_diagnostic_session') {
      const sessionRow = {
        id: testSessionId,
        user_id: args.p_user_id,
        grade_snapshot: 12,
        eligible_grades: [10, 11, 12],
        question_ids: args.p_question_ids,
        presentation_snapshot: args.p_presentation_snapshot,
        question_bank_version: args.p_question_bank_version,
        started_at: new Date().toISOString(),
        deadline_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        status: 'in_progress',
        submitted_at: null,
        finalized_at: null,
      };
      sessionStore.set(testSessionId, sessionRow);
      return { data: [sessionRow], error: null };
    }

    if (functionName === 'get_diagnostic_session_state') {
      const row = sessionStore.get(String(args.p_session_id));
      if (!row || row.user_id !== args.p_user_id) {
        return { data: null, error: { code: 'P0002', message: 'not found' } };
      }
      const answerSelections: Record<string, unknown> = {};
      for (const [key, ans] of answersStore) {
        if (key.startsWith(`${String(args.p_session_id)}:`)) {
          answerSelections[key.slice(String(args.p_session_id).length + 1)] = ans;
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
      const row = sessionStore.get(String(args.p_session_id));
      if (!row || row.user_id !== args.p_user_id) {
        return { data: null, error: { code: 'P0002', message: 'not found' } };
      }
      const key = `${String(args.p_session_id)}:${String(args.p_question_id)}`;
      const existing = answersStore.get(key);
      const currentRev = typeof existing?.revision === 'number' ? existing.revision : 0;
      if (args.p_expected_revision !== currentRev) {
        return { data: null, error: { code: '40001', message: 'conflict' } };
      }
      const revision = currentRev + 1;
      answersStore.set(key, { revision, answerSelection: args.p_answer_selection });
      return { data: revision, error: null };
    }

    if (functionName === 'submit_diagnostic_session') {
      const row = sessionStore.get(String(args.p_session_id));
      if (!row || row.user_id !== args.p_user_id) {
        return { data: null, error: { code: 'P0002', message: 'not found' } };
      }
      const submittedAt = new Date().toISOString();
      row.status = 'completed';
      row.submitted_at = submittedAt;
      row.finalized_at = submittedAt;

      // Scoring calculation according to the 28-question structure:
      // 24 single choice (24 * 0.25 = 6.0) + 4 true/false (4 * 1.0 = 4.0) = 10.0 total max
      // Example scenario: 20/24 single choice correct (5.0 pts), 2/4 true/false fully correct (2.0 pts),
      // 1 true/false 2/4 correct (0.25 pts), 1 true/false 0 correct (0.0 pts) => 7.25 / 10.0
      const scoreResult = {
        score: 7.25,
        maximum_score: 10.0,
        answered_questions: 28,
        fully_correct_questions: 22,
        total_questions: 28,
        submitted_at: submittedAt,
      };
      resultsStore.set(String(args.p_session_id), scoreResult);
      return {
        data: [{
          session_status: 'completed',
          ...scoreResult,
        }],
        error: null,
      };
    }

    if (functionName === 'get_diagnostic_session_result') {
      const row = sessionStore.get(String(args.p_session_id));
      if (!row || row.user_id !== args.p_user_id) {
        return { data: null, error: { code: 'P0002', message: 'not found' } };
      }
      return { data: resultsStore.get(String(args.p_session_id)) ?? null, error: null };
    }

    throw new Error(`Unexpected RPC ${functionName}`);
  });

  const restoreLatestResolver = configureLatestCompletedSessionResolver(async (userId) => {
    if (userId !== studentUserId) return null;
    const session = sessionStore.get(testSessionId);
    return session?.status === 'completed' ? testSessionId : null;
  });

  try {
    const authHeaders = {
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
    };

    // Step 1: Start assessment
    const startRes = await fetch(`${baseUrl}/api/diagnostic/assessment/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ idempotencyKey: testIdempotencyKey }),
    });
    assert.equal(startRes.status, 200);
    const startBody = await startRes.json();
    assert.equal(startBody.assessment.id, testSessionId);
    assert.equal(startBody.assessment.grade, 12);
    assert.equal(startBody.assessment.status, 'in_progress');
    assert.equal(startBody.assessment.persisted, true);
    assert.equal(startBody.questions.length, 28);
    // Public projection excludes private keys
    assert.doesNotMatch(JSON.stringify(startBody), /correctOptionId|correctAnswers|isCorrect/);

    // Step 2: Load questions & current session state
    const loadRes = await fetch(`${baseUrl}/api/diagnostic/assessment/${testSessionId}`, {
      headers: { Authorization: 'Bearer test-access-token' },
    });
    assert.equal(loadRes.status, 200);
    const loadBody = await loadRes.json();
    assert.equal(loadBody.assessment.id, testSessionId);
    assert.equal(loadBody.assessment.status, 'in_progress');
    assert.equal(loadBody.questions.length, 28);
    assert.deepEqual(loadBody.answers, {});
    assert.equal(loadBody.result, null);

    // Step 3: Save answers
    const firstQ = startBody.questions[0];
    const saveRes = await fetch(`${baseUrl}/api/diagnostic/assessment/${testSessionId}/answers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        questionId: firstQ.id,
        answerSelection: { optionId: firstQ.singleChoiceOptions[0].optionId },
        expectedRevision: 0,
      }),
    });
    assert.equal(saveRes.status, 200);
    assert.deepEqual(await saveRes.json(), { revision: 1 });

    // Step 4: Submit answers & calculate score (enforcing 28 questions and scoring rules)
    const submitRes = await fetch(`${baseUrl}/api/diagnostic/assessment/${testSessionId}/submit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(submitRes.status, 200);
    const submitBody = await submitRes.json();
    assert.equal(submitBody.status, 'completed');
    assert.equal(submitBody.result.score, 7.25);
    assert.equal(submitBody.result.maximumScore, 10.0);
    assert.equal(submitBody.result.percentage, 72.5);
    assert.equal(submitBody.result.totalQuestions, 28);
    assert.equal(submitBody.result.answeredQuestions, 28);
    assert.equal(submitBody.result.fullyCorrectQuestions, 22);

    // Step 5: Retrieve latest result
    const latestRes = await fetch(`${baseUrl}/api/diagnostic/assessment/latest-result`, {
      headers: { Authorization: 'Bearer test-access-token' },
    });
    assert.equal(latestRes.status, 200);
    const latestBody = await latestRes.json();
    assert.ok(latestBody.result);
    assert.equal(latestBody.result.score, 7.25);
    assert.equal(latestBody.result.maximumScore, 10.0);
    assert.equal(latestBody.result.totalQuestions, 28);

    // Step 6: Verify persisted session state now reflects completed result
    const finalStateRes = await fetch(`${baseUrl}/api/diagnostic/assessment/${testSessionId}`, {
      headers: { Authorization: 'Bearer test-access-token' },
    });
    assert.equal(finalStateRes.status, 200);
    const finalStateBody = await finalStateRes.json();
    assert.equal(finalStateBody.assessment.status, 'completed');
    assert.equal(finalStateBody.result.score, 7.25);
    assert.equal(finalStateBody.result.maximumScore, 10.0);
  } finally {
    testProfileRole = originalRole;
    restoreStartDeps();
    restoreRpc();
    restoreLatestResolver();
  }
});

test('students cannot use document extraction and teachers/admins can reach the handler', async () => {
  const originalRole = testProfileRole;
  const callsBefore = rateLimitCalls.length;
  try {
    testProfileRole = 'student';
    const studentResponse = await fetch(`${baseUrl}/api/exercises/extract-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({ file: { name: 'sample.pdf', base64: 'data' } }),
    });
    assert.equal(studentResponse.status, 403);
    assert.deepEqual(await studentResponse.json(), {
      error: 'Bạn không có quyền sử dụng chức năng này.',
      code: 'FORBIDDEN',
    });
    assert.equal(rateLimitCalls.length, callsBefore);

    for (const role of ['teacher', 'admin'] as const) {
      testProfileRole = role;
      const response = await fetch(`${baseUrl}/api/exercises/extract-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: JSON.stringify({ file: { name: 'sample.pdf' } }),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        success: false,
        error: 'Dữ liệu file không hợp lệ hoặc thiếu thông tin.',
      });
    }
  } finally {
    testProfileRole = originalRole;
  }
});

test('rate limits are atomic under concurrency and isolated by user and endpoint', async () => {
  const explainEndpoint: RateLimitEndpoint = '/api/ai/explain';
  const videoEndpoint: RateLimitEndpoint = '/api/ai/video-script';
  const extractionEndpoint: RateLimitEndpoint = '/api/exercises/extract-file';
  rateLimitCounts.clear();
  rateLimitLimits.set(explainEndpoint, 1);
  rateLimitLimits.set(videoEndpoint, 2);
  rateLimitLimits.set(extractionEndpoint, 1);
  const callsBefore = rateLimitCalls.length;

  const post = (endpoint: string, token = 'test-access-token') =>
    fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: { stem: 'Question', explanation: 'Expected' },
        conceptId: 'C01',
        conceptName: 'Python',
        topicName: 'Programming',
        studentScore: 5,
      }),
    });

  try {
    const concurrentResponses = await Promise.all([
      post(explainEndpoint),
      post(explainEndpoint),
    ]);
    assert.deepEqual(
      concurrentResponses.map((response) => response.status).sort(),
      [200, 429]
    );
    const limitedResponse = concurrentResponses.find((response) => response.status === 429);
    assert.ok(limitedResponse);
    assert.equal(limitedResponse.headers.get('retry-after'), '37');
    assert.deepEqual(await limitedResponse.json(), {
      error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 37,
    });

    const otherUserResponse = await post(explainEndpoint, 'second-user-token');
    assert.equal(otherUserResponse.status, 200);
    assert.ok(rateLimitCalls.slice(callsBefore).some((call) =>
      call.userId === 'second-verified-user' && call.endpoint === explainEndpoint
    ));

    const videoResponses = await Promise.all([
      post(videoEndpoint),
      post(videoEndpoint),
      post(videoEndpoint),
    ]);
    assert.deepEqual(videoResponses.map((response) => response.status).sort(), [400, 400, 429]);
    assert.equal(
      rateLimitCalls.slice(callsBefore).filter((call) => call.endpoint === explainEndpoint).length,
      3,
    );

    const extractionPayload = {
      file: { name: 'sample.pdf' },
    };
    const extractionResponses = await Promise.all([
      fetch(`${baseUrl}${extractionEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: JSON.stringify(extractionPayload),
      }),
      fetch(`${baseUrl}${extractionEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: JSON.stringify(extractionPayload),
      }),
    ]);
    assert.deepEqual(extractionResponses.map((response) => response.status).sort(), [400, 429]);
  } finally {
    rateLimitLimits.delete(explainEndpoint);
    rateLimitLimits.delete(videoEndpoint);
    rateLimitLimits.delete(extractionEndpoint);
    rateLimitCounts.clear();
  }
});

test('rate limit store failures fail closed without calling Gemini handler', async () => {
  const restoreFailingConsumer = configureRateLimitConsumer(async () => {
    throw new Error('shared store unavailable');
  });
  try {
    const response = await fetch(`${baseUrl}/api/ai/video-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Không thể xác minh giới hạn yêu cầu. Vui lòng thử lại sau.',
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
    });
  } finally {
    restoreFailingConsumer();
  }
});

test('profile lookup failures are distinct from authentication and authorization failures', async () => {
  failProfileLookup = true;
  try {
    const response = await fetch(`${baseUrl}/api/exercises/extract-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({ file: { name: 'sample.pdf', base64: 'data' } }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Không thể tải hồ sơ quyền hạn. Vui lòng thử lại.',
      code: 'PROFILE_LOOKUP_FAILED',
    });
  } finally {
    failProfileLookup = false;
  }
});

test('Supabase verifier outages are not misreported as invalid credentials', async () => {
  failTokenVerification = true;
  try {
    const response = await fetch(`${baseUrl}/api/ai/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Authentication service is temporarily unavailable',
      code: 'AUTH_UNAVAILABLE',
    });
  } finally {
    failTokenVerification = false;
  }
});

test('exercise extraction reports HTTP and API failures instead of returning empty success', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false, error: 'File không hợp lệ.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      extractQuestionsFromFile({ name: 'invalid.pdf', base64: 'data' }),
      /File không hợp lệ/
    );

    globalThis.fetch = async () =>
      new Response('<!doctype html><title>Not Found</title>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });

    await assert.rejects(
      extractQuestionsFromFile({ name: 'missing-route.pdf', base64: 'data' }),
      /HTTP 404/
    );

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true, questions: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      extractQuestionsFromFile({ name: 'empty.pdf', base64: 'data' }),
      /Không tìm thấy câu hỏi/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('exercise extraction preserves successful response payloads', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      assert.equal(input, '/api/exercises/extract-file');
      return new Response(JSON.stringify({
        success: true,
        questions: [{ id: 'question-1', stem: 'Câu hỏi kiểm thử' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await extractQuestionsFromFile({ name: 'sample.docx', base64: 'data' });
    assert.equal(result.success, true);
    assert.equal(result.questions?.length, 1);
    assert.equal(result.questions?.[0].stem, 'Câu hỏi kiểm thử');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const fastGeminiOptions = {
  primaryModel: 'gemini-primary-test',
  fallbackModel: 'gemini-fallback-test',
  maxRetries: 2,
  perAttemptTimeoutMs: 40,
  overallDeadlineMs: 300,
  responseReserveMs: 10,
  random: () => 0,
  sleep: async () => {},
};

test('Gemini resilience returns first-attempt success without retrying', async () => {
  let calls = 0;
  const result = await generateWithGeminiResilience(
    async (model) => {
      calls += 1;
      return `${model}-response`;
    },
    fastGeminiOptions
  );

  assert.equal(result.value, 'gemini-primary-test-response');
  assert.equal(result.model, 'gemini-primary-test');
  assert.equal(result.retryCount, 0);
  assert.equal(calls, 1);
});

test('Gemini resilience recovers from HTTP 503 with a bounded retry', async () => {
  let calls = 0;
  const result = await generateWithGeminiResilience(
    async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('Service unavailable'), { status: 503 });
      return 'recovered';
    },
    fastGeminiOptions
  );

  assert.equal(result.value, 'recovered');
  assert.equal(result.retryCount, 1);
  assert.equal(calls, 2);
});

test('Gemini resilience exhausts after two additional attempts', async () => {
  let calls = 0;
  await assert.rejects(
    generateWithGeminiResilience(
      async () => {
        calls += 1;
        throw Object.assign(new Error('Service unavailable'), { status: 503 });
      },
      { ...fastGeminiOptions, fallbackModel: undefined }
    ),
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'overloaded');
      assert.equal(error.retryCount, 2);
      assert.equal(error.fallbackConfigured, false);
      assert.match(error.message, /no fallback model is configured/);
      return true;
    }
  );
  assert.equal(calls, 3);
});

test('Gemini resilience switches to configured fallback after primary overload', async () => {
  const models: string[] = [];
  const result = await generateWithGeminiResilience(
    async (model) => {
      models.push(model);
      if (model === 'gemini-primary-test') {
        throw Object.assign(new Error('Service unavailable'), { status: 503 });
      }
      return 'fallback response';
    },
    fastGeminiOptions
  );

  assert.equal(result.value, 'fallback response');
  assert.equal(result.model, 'gemini-fallback-test');
  assert.equal(result.retryCount, 3);
  assert.deepEqual(models, [
    'gemini-primary-test',
    'gemini-primary-test',
    'gemini-primary-test',
    'gemini-fallback-test',
  ]);
});

test('Gemini resilience reports fallback failure without retrying the fallback model', async () => {
  let calls = 0;
  await assert.rejects(
    generateWithGeminiResilience(
      async () => {
        calls += 1;
        throw Object.assign(new Error('Service unavailable'), { status: 503 });
      },
      fastGeminiOptions
    ),
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'overloaded');
      assert.equal(error.retryCount, 3);
      assert.equal(error.fallbackConfigured, true);
      return true;
    }
  );
  assert.equal(calls, 4);
});

test('Gemini fallback output is validated before accepting extracted questions', async () => {
  const fallbackQuestions = JSON.stringify([
    {
      questionType: 'single_choice',
      stem: 'Fallback question',
      singleChoiceOptions: ['A', 'B', 'C', 'D'].map((label) => ({
        label,
        text: `Option ${label}`,
        isCorrect: label === 'C',
      })),
    },
  ]);
  const result = await generateWithGeminiResilience(
    async (model) => {
      if (model === 'gemini-primary-test') {
        throw Object.assign(new Error('Service unavailable'), { status: 503 });
      }
      return fallbackQuestions;
    },
    fastGeminiOptions
  );

  assert.equal(result.model, 'gemini-fallback-test');
  assert.equal(parseAndValidateExtractedQuestions(result.value)[0].stem, 'Fallback question');
});

test('Gemini quota exhaustion is distinguished and is not retried', async () => {
  let calls = 0;
  const quotaError = Object.assign(
    new Error('You exceeded your current quota; check your billing configuration.'),
    { status: 429 }
  );
  assert.equal(classifyGeminiError(quotaError), 'quota_exhausted');
  assert.equal(
    classifyGeminiError(Object.assign(new Error('Rate limit exceeded'), { status: 429 })),
    'rate_limited'
  );
  assert.equal(
    classifyGeminiError(Object.assign(new Error('Bad gateway'), { status: 502 })),
    'overloaded'
  );
  assert.equal(
    classifyGeminiError(Object.assign(new Error('Gateway timeout'), { status: 504 })),
    'overloaded'
  );

  await assert.rejects(
    generateWithGeminiResilience(
      async () => {
        calls += 1;
        throw quotaError;
      },
      fastGeminiOptions
    ),
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'quota_exhausted');
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('Gemini 429 rate limiting retries and Retry-After is parsed', async () => {
  let calls = 0;
  const result = await generateWithGeminiResilience(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('Rate limit exceeded'), {
          status: 429,
          retryAfterMs: 10,
        });
      }
      return 'recovered';
    },
    { ...fastGeminiOptions, sleep: async () => {} }
  );

  assert.equal(result.value, 'recovered');
  assert.equal(getRetryAfterMs('2'), 2_000);
  assert.equal(getRetryAfterMs('Thu, 01 Jan 1970 00:00:02 GMT', 0), 2_000);
  assert.equal(calls, 2);
});

test('Gemini stops retrying when Retry-After cannot fit before the deadline', async () => {
  let calls = 0;
  await assert.rejects(
    generateWithGeminiResilience(
      async () => {
        calls += 1;
        throw Object.assign(new Error('Rate limit exceeded'), {
          status: 429,
          retryAfterMs: 1_000,
        });
      },
      {
        ...fastGeminiOptions,
        fallbackModel: undefined,
        overallDeadlineMs: 200,
        responseReserveMs: 10,
      }
    ),
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'deadline_exceeded');
      assert.equal(error.retryCount, 0);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('Gemini request timeout is bounded and cancellation stops further attempts', async () => {
  let timeoutCalls = 0;
  await assert.rejects(
    generateWithGeminiResilience(
      async (_model, attempt) => {
        timeoutCalls += 1;
        return new Promise<string>((_, reject) => {
          attempt.signal.addEventListener('abort', () => reject(new Error('request timed out')), {
            once: true,
          });
        });
      },
      {
        ...fastGeminiOptions,
        fallbackModel: undefined,
        perAttemptTimeoutMs: 10,
        overallDeadlineMs: 200,
      }
    ),
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'timeout');
      return true;
    }
  );
  assert.equal(timeoutCalls, 3);

  const cancellation = new AbortController();
  const pending = generateWithGeminiResilience(
    async (_model, attempt) =>
      new Promise<string>((_, reject) => {
        attempt.signal.addEventListener('abort', () => reject(new Error('cancelled')), {
          once: true,
        });
      }),
    { ...fastGeminiOptions, signal: cancellation.signal }
  );
  cancellation.abort();
  await assert.rejects(
    pending,
    (error: unknown) => {
      assert.ok(error instanceof GeminiResilienceError);
      assert.equal(error.category, 'cancelled');
      return true;
    }
  );
});

test('Gemini response parser rejects invalid JSON and malformed question schema', () => {
  assert.throws(
    () => parseAndValidateExtractedQuestions('{invalid'),
    (error: unknown) => error instanceof GeminiResponseError && error.category === 'invalid_json'
  );
  assert.throws(
    () =>
      parseAndValidateExtractedQuestions(
        JSON.stringify([{ questionType: 'single_choice', stem: 'Question', singleChoiceOptions: [] }])
      ),
    (error: unknown) => error instanceof GeminiResponseError && error.category === 'invalid_schema'
  );
});

test('Gemini response parser accepts the existing structured question format', () => {
  const questions = parseAndValidateExtractedQuestions(
    JSON.stringify({
      questions: [
        {
          questionType: 'single_choice',
          stem: 'Question',
          singleChoiceOptions: ['A', 'B', 'C', 'D'].map((label) => ({
            label,
            text: `Option ${label}`,
            isCorrect: label === 'A',
          })),
        },
      ],
    })
  );
  assert.equal(questions.length, 1);
  assert.equal(questions[0].stem, 'Question');
});
