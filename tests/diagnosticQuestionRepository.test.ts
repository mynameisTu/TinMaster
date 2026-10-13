import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_QUESTION_BANK } from '../src/data/questionBank';
import {
  createTrustedDiagnosticQuestionRecord,
  diagnosticOptionId,
  filterServerDiagnosticQuestions,
  getPrivateDiagnosticScoringData,
  getServerDiagnosticGrades,
  projectDiagnosticQuestion,
  selectServerDiagnosticQuestions,
  SERVER_DIAGNOSTIC_QUESTION_BANK,
} from '../src/server/diagnosticQuestionBank';

test('server repository preserves all 39 built-in records and stable IDs exactly', () => {
  assert.equal(SERVER_DIAGNOSTIC_QUESTION_BANK.length, 39);
  assert.equal(new Set(SERVER_DIAGNOSTIC_QUESTION_BANK.map((question) => question.id)).size, 39);
  assert.deepEqual(
    SERVER_DIAGNOSTIC_QUESTION_BANK.map((question) => question.id),
    SAMPLE_QUESTION_BANK.map((question) => question.id)
  );
  assert.deepEqual(SERVER_DIAGNOSTIC_QUESTION_BANK, SAMPLE_QUESTION_BANK);
});

test('server single-choice wording, options, and correct-answer metadata match the built-in bank', () => {
  const serverQuestions = SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (question) => question.questionType === 'single_choice'
  );
  const clientQuestions = SAMPLE_QUESTION_BANK.filter(
    (question) => question.questionType === 'single_choice'
  );

  assert.equal(serverQuestions.length, 31);
  assert.deepEqual(
    serverQuestions.map(({ id, stem, singleChoiceOptions }) => ({
      id,
      stem,
      singleChoiceOptions,
    })),
    clientQuestions.map(({ id, stem, singleChoiceOptions }) => ({
      id,
      stem,
      singleChoiceOptions,
    }))
  );
});

test('server true/false wording and answer keys match the built-in bank', () => {
  const serverQuestions = SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (question) => question.questionType === 'true_false_multistatement'
  );
  const clientQuestions = SAMPLE_QUESTION_BANK.filter(
    (question) => question.questionType === 'true_false_multistatement'
  );

  assert.equal(serverQuestions.length, 8);
  assert.deepEqual(
    serverQuestions.map(({ id, stem, trueFalseStatements }) => ({
      id,
      stem,
      trueFalseStatements,
    })),
    clientQuestions.map(({ id, stem, trueFalseStatements }) => ({
      id,
      stem,
      trueFalseStatements,
    }))
  );
});

test('grade eligibility remains cumulative and rejects invalid grades', () => {
  assert.deepEqual(getServerDiagnosticGrades(10), [10]);
  assert.deepEqual(getServerDiagnosticGrades(11), [10, 11]);
  assert.deepEqual(getServerDiagnosticGrades(12), [10, 11, 12]);

  for (const [grade, expected] of [
    [10, [10]],
    [11, [10, 11]],
    [12, [10, 11, 12]],
  ] as const) {
    const eligibleGrades = new Set<number>(expected);
    assert.ok(
      selectServerDiagnosticQuestions(grade)
        .every((question) => eligibleGrades.has(question.grade))
    );
  }

  for (const grade of [undefined, null, 9, 13, '10', 10.5]) {
    assert.throws(
      () => selectServerDiagnosticQuestions(grade),
      { name: 'RangeError', message: 'A valid student grade (10, 11, or 12) is required.' }
    );
  }
});

test('diagnostic questions respect a saved exam orientation while retaining shared questions', () => {
  const common = SERVER_DIAGNOSTIC_QUESTION_BANK.filter((question) => question.track === 'ALL');
  const cs = selectServerDiagnosticQuestions(12, 'CS');
  const ict = selectServerDiagnosticQuestions(12, 'ICT');
  const unselected = selectServerDiagnosticQuestions(12);

  assert.ok(cs.every((question) => question.track === 'ALL' || question.track === 'CS'));
  assert.ok(ict.every((question) => question.track === 'ALL' || question.track === 'ICT'));
  assert.ok(common.every((question) => cs.includes(question) && ict.includes(question)));
  assert.ok(unselected.some((question) => question.track === 'CS'));
  assert.ok(unselected.some((question) => question.track === 'ICT'));
  assert.throws(
    () => selectServerDiagnosticQuestions(12, 'OTHER'),
    { name: 'RangeError', message: 'A valid student exam orientation is required.' }
  );
});

test('server selector handles an empty eligible question pool explicitly', () => {
  const noGradeTenQuestions = SERVER_DIAGNOSTIC_QUESTION_BANK.filter(
    (question) => question.grade !== 10
  );
  assert.deepEqual(
    filterServerDiagnosticQuestions(10, noGradeTenQuestions),
    []
  );
});

test('public question projection contains presentation fields only', () => {
  for (const question of SERVER_DIAGNOSTIC_QUESTION_BANK) {
    const presentation = projectDiagnosticQuestion(question);
    assert.equal(presentation.id, question.id);
    assert.equal(presentation.questionType, question.questionType);
    assert.equal(presentation.stem, question.stem);
    assert.deepEqual(
      Object.keys(presentation).sort(),
      [
        'codeSnippet',
        'diagramDesc',
        'id',
        'questionType',
        'singleChoiceOptions',
        'stem',
        'trueFalseStatements',
      ].filter((key) => key in presentation).sort()
    );
    assert.doesNotMatch(JSON.stringify(presentation), /isCorrect|explanation|keyTakeaway|sourceYear/);

    if (presentation.questionType === 'single_choice') {
      assert.deepEqual(
        presentation.singleChoiceOptions.map(({ label, text }) => ({ label, text })),
        question.singleChoiceOptions?.map(({ label, text }) => ({ label, text }))
      );
      assert.ok(presentation.singleChoiceOptions.every((option) =>
        option.optionId === diagnosticOptionId(question.id, option.label)
      ));
      assert.ok(presentation.singleChoiceOptions.every((option) =>
        !('isCorrect' in option) && !('distractorExplanation' in option)
      ));
    } else {
      assert.deepEqual(
        presentation.trueFalseStatements,
        question.trueFalseStatements?.map(({ subOrder, statementText }) => ({
          subOrder,
          statementText,
        }))
      );
      assert.ok(presentation.trueFalseStatements.every((statement) =>
        !('isCorrect' in statement) && !('explanation' in statement)
      ));
    }
  }
});

test('private scoring records retain keys using deterministic option identities', () => {
  for (const question of SERVER_DIAGNOSTIC_QUESTION_BANK) {
    const scoring = getPrivateDiagnosticScoringData(question);
    assert.equal(scoring.questionId, question.id);
    assert.equal(scoring.questionType, question.questionType);

    if (question.questionType === 'single_choice' && scoring.questionType === 'single_choice') {
      const correctOption = question.singleChoiceOptions?.find((option) => option.isCorrect);
      assert.ok(correctOption);
      assert.equal(
        scoring.correctOptionId,
        diagnosticOptionId(question.id, correctOption.label)
      );
    } else if (
      question.questionType === 'true_false_multistatement' &&
      scoring.questionType === 'true_false_multistatement'
    ) {
      assert.deepEqual(
        scoring.correctAnswers,
        Object.fromEntries(
          question.trueFalseStatements?.map(({ subOrder, isCorrect }) => [subOrder, isCorrect]) ?? []
        )
      );
    }
  }
});

test('trusted records pair public projection with private scoring data', () => {
  const question = SERVER_DIAGNOSTIC_QUESTION_BANK[0];
  assert.deepEqual(createTrustedDiagnosticQuestionRecord(question), {
    presentation: projectDiagnosticQuestion(question),
    scoring: getPrivateDiagnosticScoringData(question),
  });
});
