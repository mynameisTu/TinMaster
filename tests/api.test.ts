import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const testGeminiSecret = 'unit-test-gemini-secret';
process.env.GEMINI_API_KEY = testGeminiSecret;
const { default: app } = await import('../src/server/api');

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
});

test('file extraction rejects an invalid upload using the existing response shape', async () => {
  const response = await fetch(`${baseUrl}/api/exercises/extract-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { name: 'invalid.pdf' } }),
  });
  const body = await response.json();

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
