import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_QUESTION_BANK } from '../src/data/questionBank';
import { AdaptiveLearningEngine } from '../src/services/adaptiveEngine';

test('single-choice scoring awards full credit only for the keyed label', () => {
  const question = SAMPLE_QUESTION_BANK.find((item) => item.questionType === 'single_choice');
  assert.ok(question?.singleChoiceOptions);
  const correctOption = question.singleChoiceOptions.find((option) => option.isCorrect);
  const incorrectOption = question.singleChoiceOptions.find((option) => !option.isCorrect);
  assert.ok(correctOption);
  assert.ok(incorrectOption);

  assert.deepEqual(
    AdaptiveLearningEngine.calculateQuestionScore(question, correctOption.label),
    { isCorrect: true, scoreRatio: 1, awardedPoints: 0.25 }
  );
  assert.deepEqual(
    AdaptiveLearningEngine.calculateQuestionScore(question, incorrectOption.label),
    { isCorrect: false, scoreRatio: 0, awardedPoints: 0 }
  );
});

test('true/false scoring preserves current all-correct, all-incorrect, and partial-credit ratios', () => {
  const question = SAMPLE_QUESTION_BANK.find(
    (item) => item.questionType === 'true_false_multistatement'
  );
  assert.ok(question?.trueFalseStatements);

  const correctCountCases = [
    { matchingCount: 4, scoreRatio: 1, isCorrect: true },
    { matchingCount: 3, scoreRatio: 0.5, isCorrect: false },
    { matchingCount: 2, scoreRatio: 0.25, isCorrect: false },
    { matchingCount: 1, scoreRatio: 0.1, isCorrect: false },
    { matchingCount: 0, scoreRatio: 0, isCorrect: false },
  ];

  for (const { matchingCount, scoreRatio, isCorrect } of correctCountCases) {
    const answer: Record<string, boolean> = Object.fromEntries(
      question.trueFalseStatements.map((statement, index) => [
        statement.subOrder,
        index < matchingCount ? statement.isCorrect : !statement.isCorrect,
      ])
    );
    assert.deepEqual(
      AdaptiveLearningEngine.calculateQuestionScore(question, answer),
      {
        isCorrect,
        scoreRatio,
        awardedPoints: scoreRatio,
      }
    );
  }
});

test('missing and incomplete answers retain existing scoring behavior', () => {
  const singleChoice = SAMPLE_QUESTION_BANK.find(
    (item) => item.questionType === 'single_choice'
  );
  const trueFalse = SAMPLE_QUESTION_BANK.find(
    (item) => item.questionType === 'true_false_multistatement'
  );
  assert.ok(singleChoice);
  assert.ok(trueFalse?.trueFalseStatements);

  for (const answer of [undefined, '']) {
    assert.deepEqual(
      AdaptiveLearningEngine.calculateQuestionScore(singleChoice, answer),
      { isCorrect: false, scoreRatio: 0, awardedPoints: 0 }
    );
  }
  assert.deepEqual(
    AdaptiveLearningEngine.calculateQuestionScore(trueFalse, undefined),
    { isCorrect: false, scoreRatio: 0, awardedPoints: 0 }
  );

  const oneMatchingAnswer = Object.fromEntries([
    [
      trueFalse.trueFalseStatements[0].subOrder,
      trueFalse.trueFalseStatements[0].isCorrect,
    ],
  ]);
  assert.deepEqual(
    AdaptiveLearningEngine.calculateQuestionScore(trueFalse, oneMatchingAnswer),
    { isCorrect: false, scoreRatio: 0.1, awardedPoints: 0.1 }
  );
});

test('exam breakdown preserves partial credit and counts unanswered questions in the maximum', () => {
  const question = SAMPLE_QUESTION_BANK.find(
    (item) => item.questionType === 'true_false_multistatement'
  );
  assert.ok(question?.trueFalseStatements);
  const partialAnswer = Object.fromEntries(
    question.trueFalseStatements.map((statement, index) => [
      statement.subOrder,
      index < 3 ? statement.isCorrect : !statement.isCorrect,
    ])
  );
  const result = AdaptiveLearningEngine.calculateExamScoreBreakdown(
    [question, SAMPLE_QUESTION_BANK[0]],
    {
      [question.id]: { userAnswer: partialAnswer },
    }
  );

  assert.equal(result.mandatoryScore, 0.5);
  assert.equal(result.mandatoryMaxScore, 1.25);
  assert.equal(result.mandatoryCorrect, 0);
  assert.equal(result.mandatoryTotal, 2);
  assert.equal(result.totalScore, 0.5);
  assert.equal(result.totalMaxScore, 1.25);
});
