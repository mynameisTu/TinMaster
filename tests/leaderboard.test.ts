import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_EXAMS_CATALOG,
  loadStoredExamHistory,
  type ExamAttemptRecord,
} from '../src/data/examCatalogData';
import { LEADERBOARD_EMPTY_STATE } from '../src/data/leaderboard';

const memoryStorage = (value: string | null) => ({
  getItem: (_key: string) => value,
});

test('leaderboard uses the Vietnamese empty state when there are no verified results', () => {
  assert.equal(LEADERBOARD_EMPTY_STATE, 'Chưa có dữ liệu xếp hạng.');
});

test('new installs have no seeded exam history', () => {
  assert.deepEqual(loadStoredExamHistory(memoryStorage(null)), []);
});

test('existing locally stored exam history is preserved without fabricated fallback entries', () => {
  const attempt: ExamAttemptRecord = {
    id: 'saved-attempt',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Completed exam',
    category: 'national_standard',
    dateTaken: '2026-09-20T10:00:00.000Z',
    score: 8,
    maxScore: 10,
    totalQuestions: 28,
    correctCount: 22,
    durationSeconds: 2200,
    accuracy: 78.6,
  };

  assert.deepEqual(
    loadStoredExamHistory(memoryStorage(JSON.stringify([attempt]))),
    [attempt]
  );
});

test('invalid local history data does not get replaced with demo results', () => {
  assert.deepEqual(loadStoredExamHistory(memoryStorage('not-json')), []);
  assert.deepEqual(loadStoredExamHistory(memoryStorage(JSON.stringify({ demo: true }))), []);
});

test('exam catalog does not report fabricated attempt counts or average scores', () => {
  assert.ok(INITIAL_EXAMS_CATALOG.every(
    (exam) => exam.attemptsCount === 0 && exam.averageScore === 0
  ));
});
