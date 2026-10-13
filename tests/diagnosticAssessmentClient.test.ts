import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  clearDiagnosticAnswer,
  DiagnosticAssessmentApiError,
  getDiagnosticAssessment,
  getLatestDiagnosticAssessmentResult,
  loadDiagnosticIdempotencyKey,
  loadDiagnosticSessionId,
  saveDiagnosticAnswer,
  saveDiagnosticIdempotencyKey,
  saveDiagnosticSessionId,
  submitDiagnosticAssessment,
  startDiagnosticAssessment,
  normalizeDiagnosticCompetencyScore,
} from '../src/services/diagnosticAssessment';
import { hasDiagnosticDeadlineElapsed } from '../src/components/DiagnosticAssessment';
import type { DiagnosticAssessmentState } from '../src/services/diagnosticAssessment';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('session restoration uses a per-account session key and server-saved answers', async () => {
  const storage = new MemoryStorage();
  saveDiagnosticSessionId(storage, 'student-one', 'session-one');
  saveDiagnosticSessionId(storage, 'student-two', 'session-two');
  assert.equal(loadDiagnosticSessionId(storage, 'student-one'), 'session-one');
  assert.equal(loadDiagnosticSessionId(storage, 'student-two'), 'session-two');

  const state: DiagnosticAssessmentState = {
    assessment: {
      id: 'session-one',
      grade: 11,
      eligibleGrades: [10, 11],
      startedAt: '2026-10-03T00:00:00.000Z',
      deadlineAt: '2026-10-03T00:25:00.000Z',
      status: 'in_progress',
    },
    questions: [],
    answers: {
      Q1: { revision: 2, answerSelection: { optionId: 'Q1:option:B' } },
    },
    result: null,
  };
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/api/diagnostic/assessment/session-one');
    return new Response(JSON.stringify(state), { status: 200 });
  };

  const restored = await getDiagnosticAssessment(
    loadDiagnosticSessionId(storage, 'student-one') as string
  );
  assert.deepEqual(restored.answers, state.answers);
  assert.deepEqual(await getDiagnosticAssessment('session-one'), state);
});

test('answer saves and clears send revision preconditions to the API', async () => {
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return new Response(JSON.stringify({ revision: requests.length }), { status: 200 });
  };

  assert.deepEqual(
    await saveDiagnosticAnswer('session-one', 'Q1', { optionId: 'Q1:option:A' }, 2),
    { revision: 1 }
  );
  assert.deepEqual(
    await clearDiagnosticAnswer('session-one', 'Q1', 3),
    { revision: 2 }
  );
  assert.deepEqual(requests, [
    {
      url: '/api/diagnostic/assessment/session-one/answers',
      method: 'POST',
      body: {
        questionId: 'Q1',
        answerSelection: { optionId: 'Q1:option:A' },
        expectedRevision: 2,
      },
    },
    {
      url: '/api/diagnostic/assessment/session-one/answers/Q1',
      method: 'DELETE',
      body: { expectedRevision: 3 },
    },
  ]);
});

test('submission sends no client score and returns the persisted result contract', async () => {
  let request: { url: string; method: string; body: unknown } | null = null;
  const response = {
    status: 'completed',
    result: {
      score: 2.25,
      maximumScore: 3.5,
      percentage: 64.3,
      answeredQuestions: 4,
      fullyCorrectQuestions: 2,
      totalQuestions: 5,
      submittedAt: '2026-10-03T02:00:00.000Z',
    },
  };
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    return new Response(JSON.stringify(response), { status: 200 });
  };

  assert.deepEqual(await submitDiagnosticAssessment('session-one'), response);
  assert.deepEqual(request, {
    url: '/api/diagnostic/assessment/session-one/submit',
    method: 'POST',
    body: null,
  });
});

test('competency score normalization requires a valid persisted score and maximum', () => {
  const base = {
    percentage: 65,
    answeredQuestions: 3,
    fullyCorrectQuestions: 2,
    totalQuestions: 4,
    submittedAt: '2026-10-03T02:00:00.000Z',
  };
  assert.equal(normalizeDiagnosticCompetencyScore(null), null);
  assert.equal(normalizeDiagnosticCompetencyScore({
    ...base, score: 2.25, maximumScore: 3.5,
  }), 6.4);
  assert.equal(normalizeDiagnosticCompetencyScore({
    ...base, score: 1, maximumScore: 0,
  }), null);
  assert.equal(normalizeDiagnosticCompetencyScore({
    ...base, score: 4, maximumScore: 3.5,
  }), null);
});

test('latest competency result is loaded from the authenticated API', async () => {
  const result = {
    score: 2.25,
    maximumScore: 3.5,
    percentage: 64.3,
    answeredQuestions: 3,
    fullyCorrectQuestions: 2,
    totalQuestions: 4,
    submittedAt: '2026-10-03T02:00:00.000Z',
  };
  let requestedPath = '';
  globalThis.fetch = async (input) => {
    requestedPath = String(input);
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  assert.deepEqual(await getLatestDiagnosticAssessmentResult(), { result });
  assert.equal(requestedPath, '/api/diagnostic/assessment/latest-result');
});

test('start preserves a per-account idempotency key for safe retries', async () => {
  const storage = new MemoryStorage();
  saveDiagnosticIdempotencyKey(storage, 'student-one', 'key-one');
  assert.equal(loadDiagnosticIdempotencyKey(storage, 'student-one'), 'key-one');
  assert.equal(loadDiagnosticIdempotencyKey(storage, 'student-two'), null);

  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ assessment: {}, questions: [] }), { status: 200 });
  };
  await startDiagnosticAssessment(loadDiagnosticIdempotencyKey(storage, 'student-one') as string);
  assert.deepEqual(requestBody, { idempotencyKey: 'key-one' });
});

test('start reports stale development API routes instead of masking an empty 404', async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });

  await assert.rejects(
    startDiagnosticAssessment('83000000-0000-4000-8000-000000000002'),
    (error: unknown) => {
      assert.ok(error instanceof DiagnosticAssessmentApiError);
      assert.equal(error.status, 404);
      assert.equal(error.code, 'ASSESSMENT_API_NOT_FOUND');
      assert.match(error.message, /khởi động lại máy chủ và tải lại trang/);
      return true;
    }
  );
});

test('assessment client rejects successful HTML fallbacks instead of treating them as API data', async () => {
  globalThis.fetch = async () => new Response('<!doctype html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });

  await assert.rejects(
    startDiagnosticAssessment('83000000-0000-4000-8000-000000000002'),
    (error: unknown) => {
      assert.ok(error instanceof DiagnosticAssessmentApiError);
      assert.equal(error.code, 'ASSESSMENT_RESPONSE_INVALID');
      assert.match(error.message, /phản hồi không hợp lệ/);
      return true;
    }
  );
});

test('deadline status disables assessment exactly at and after the deadline', () => {
  const assessment: DiagnosticAssessmentState = {
    assessment: {
      id: 'session-one',
      grade: 10,
      eligibleGrades: [10],
      startedAt: '2026-10-03T00:00:00.000Z',
      deadlineAt: '2026-10-03T00:25:00.000Z',
      status: 'in_progress',
    },
    questions: [],
    answers: {},
    result: null,
  };
  const deadline = Date.parse(assessment.assessment.deadlineAt);
  assert.equal(hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, deadline - 1), false);
  assert.equal(hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, deadline), true);
  assert.equal(hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, deadline + 1), true);
});
