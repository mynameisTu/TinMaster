import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { extractQuestionsFromFile } from '../src/services/exerciseService';

const testGeminiSecret = 'unit-test-gemini-secret';
process.env.GEMINI_API_KEY = testGeminiSecret;
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
      headers: { 'Content-Type': 'application/json' },
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

test('AI endpoints retain their no-key fallback contracts', async () => {
  const explanationResponse = await fetch(`${baseUrl}/api/ai/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
