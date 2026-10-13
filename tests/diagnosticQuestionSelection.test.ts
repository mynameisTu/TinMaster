import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_QUESTION_BANK } from '../src/data/questionBank';
import {
  filterDiagnosticQuestionsByGrade,
  getCumulativeDiagnosticGrades,
  selectBuiltInDiagnosticCandidates,
} from '../src/services/diagnosticQuestionSelection';

test('diagnostic grade scopes are cumulative from the current grade', () => {
  assert.deepEqual(getCumulativeDiagnosticGrades(10), [10]);
  assert.deepEqual(getCumulativeDiagnosticGrades(11), [10, 11]);
  assert.deepEqual(getCumulativeDiagnosticGrades(12), [10, 11, 12]);
});

test('built-in diagnostic selection includes only questions in the cumulative grade scope', () => {
  const gradeScopes: Array<{ grade: 10 | 11 | 12; expectedGrades: number[] }> = [
    { grade: 10, expectedGrades: [10] },
    { grade: 11, expectedGrades: [10, 11] },
    { grade: 12, expectedGrades: [10, 11, 12] },
  ];
  for (const { grade, expectedGrades } of gradeScopes) {
    const selected = selectBuiltInDiagnosticCandidates(grade);
    assert.ok(selected.length > 0);
    assert.ok(selected.every((question) => expectedGrades.includes(question.grade)));
    assert.ok(selected.every((question) => SAMPLE_QUESTION_BANK.includes(question)));
  }

  const gradeTen = selectBuiltInDiagnosticCandidates(10);
  const gradeEleven = selectBuiltInDiagnosticCandidates(11);
  const gradeTwelve = selectBuiltInDiagnosticCandidates(12);
  assert.ok(gradeTen.every((question) => question.grade === 10));
  assert.ok(gradeEleven.some((question) => question.grade === 10));
  assert.ok(gradeEleven.some((question) => question.grade === 11));
  assert.ok(gradeTwelve.some((question) => question.grade === 12));
});

test('diagnostic selection uses only the built-in bank and ignores custom localStorage questions', () => {
  const customQuestion = { ...SAMPLE_QUESTION_BANK[0], id: 'CUSTOM_FROM_LOCAL_STORAGE' };
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => JSON.stringify([customQuestion]),
    },
  });

  try {
    const selected = selectBuiltInDiagnosticCandidates(12);
    assert.ok(selected.every((question) => question.id !== customQuestion.id));
    assert.deepEqual(
      selected.map((question) => question.id),
      SAMPLE_QUESTION_BANK
        .filter((question) => [10, 11, 12].includes(question.grade))
        .map((question) => question.id)
    );
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  }
});

test('question filtering returns an empty pool when no built-in candidates are supplied', () => {
  assert.deepEqual(filterDiagnosticQuestionsByGrade(12, []), []);
});

test('missing or invalid student grades are rejected instead of defaulted', () => {
  for (const grade of [undefined, null, 9, 13, '10', 10.5]) {
    assert.throws(
      () => selectBuiltInDiagnosticCandidates(grade),
      { name: 'RangeError', message: 'A valid student grade (10, 11, or 12) is required.' }
    );
  }
});
