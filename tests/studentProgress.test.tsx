import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DiagnosticCompetencyMetric,
  showTargetScoreDialog,
  startDiagnosticAssessmentFlow,
  StudentDashboard,
} from '../src/components/StudentDashboard';
import { createAdaptivePracticeResult } from '../src/components/AdaptivePracticeSession';
import { KnowledgeMap } from '../src/components/KnowledgeMap';
import { PracticeBankView } from '../src/components/PracticeBankView';
import { INITIAL_STUDENT_MASTERIES } from '../src/data/curriculumData';
import { SAMPLE_QUESTION_BANK } from '../src/data/questionBank';
import type { ExamAttemptRecord } from '../src/data/examCatalogData';
import { AdaptiveLearningEngine } from '../src/services/adaptiveEngine';
import {
  completeAdaptivePractice,
  PRACTICE_MASTERY_UPDATE_ERROR,
} from '../src/services/practiceCompletion';
import {
  getVerifiedMastery,
  LEGACY_MASTERY_STORAGE_KEY,
  loadUserMasteries,
  saveUserMasteries,
  userMasteryStorageKey,
} from '../src/services/masteryStorage';
import {
  isLearningMode,
  learningModeStorageKey,
  loadLearningMode,
  saveLearningMode,
} from '../src/services/learningPreferences';
import {
  getOrCreateProfile,
  STUDENT_GRADE_OPTIONS,
  updateMyStudentGrade,
  updateMyTargetScore,
  validateTargetScore,
} from '../src/services/authService';
import {
  LEGACY_EXAM_HISTORY_STORAGE_KEY,
  loadUserExamHistory,
  saveUserExamHistory,
  userExamHistoryStorageKey,
} from '../src/services/examHistoryStorage';
import type { StudentMastery, UserProfile } from '../src/types';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const student: UserProfile = {
  id: 'student-1',
  email: 'student@example.test',
  name: 'Test Student',
  role: 'student',
  researchGroup: 'unassigned',
  xp: 0,
  streakDays: 0,
  targetScore: 8.5,
  completedQuestionsCount: 0,
  totalStudyMinutes: 0,
};

function renderDashboard(
  masteries: Record<string, StudentMastery>,
  completedQuestionsCount = 0,
  role: UserProfile['role'] = 'student'
) {
  return renderToStaticMarkup(createElement(StudentDashboard, {
    user: { ...student, role, completedQuestionsCount },
    masteries,
    recommendations: [],
    learningPath: AdaptiveLearningEngine.generate7DayLearningPath(masteries),
    learningMode: 'structured',
    learningModeReady: true,
    learningModeCanPersist: true,
    onChangeLearningMode: async () => {},
    onSaveTargetScore: async () => {},
    canEditTargetScore: true,
    showStudentLearningControls: role === 'student',
    onStartExam: () => {},
    onStartDiagnosticAssessment: role === 'student' ? () => {} : undefined,
    onStartAdaptivePractice: () => {},
    onStartMicroQuiz: () => {},
    onOpenVideoModal: () => {},
    onNavigateToKnowledgeMap: () => {},
    client: null,
  }));
}

test('new student has no fabricated mastery and sees empty progress states', () => {
  const storage = new MemoryStorage();
  const loaded = loadUserMasteries(storage, student.id);
  const dashboard = renderDashboard(loaded.masteries);
  const map = renderToStaticMarkup(createElement(KnowledgeMap, {
    masteries: loaded.masteries,
    onStartPracticeConcept: () => {},
    onOpenVideoModal: () => {},
  }));

  assert.deepEqual(loaded.masteries, {});
  assert.equal(loaded.canPersist, true);
  assert.match(dashboard, /Chưa có mô hình dự đoán được kiểm chứng/);
  assert.match(dashboard, /Điểm năng lực hiện tại:/);
  assert.match(dashboard, /Đổi mục tiêu/);
  assert.match(dashboard, /id="target-score-dialog"[^>]*aria-labelledby="target-score-dialog-title"/);
  assert.match(dashboard, /Hủy/);
  assert.match(dashboard, /Lưu mục tiêu/);
  assert.equal((dashboard.match(/<option/g) ?? []).length, 19);
  assert.match(dashboard, /Chưa có dữ liệu gắn với tài khoản này để xác định chuyên đề cần củng cố/);
  assert.match(map, /Chưa có dữ liệu học tập gắn với tài khoản này/);
  assert.doesNotMatch(map, /Làm chủ: 50%|Độ tin cậy: 30%/);
});

test('diagnostic competency metric renders empty, loading, error, and valid-result states', () => {
  const renderMetric = (state: 'loading' | 'empty' | 'ready' | 'error', score: number | null) =>
    renderToStaticMarkup(createElement(DiagnosticCompetencyMetric, {
      state,
      score,
      onRetry: () => {},
      canStartAssessment: true,
      onStartAssessment: () => {},
    }));
  const empty = renderMetric('empty', null);
  assert.match(empty, /Chưa đánh giá/);
  assert.match(empty, /Làm bài đánh giá/);
  assert.doesNotMatch(empty, /progressbar/);
  assert.match(renderMetric('loading', null), /Đang tải/);
  assert.match(renderMetric('error', null), /Không thể tải/);
  assert.match(renderMetric('error', null), /Thử lại/);
  const completed = renderMetric('ready', 7.4);
  assert.match(completed, /7\.4 \/ 10/);
  assert.doesNotMatch(completed, /progressbar|Làm bài đánh giá/);
  const unavailable = renderToStaticMarkup(createElement(DiagnosticCompetencyMetric, {
    state: 'empty',
    score: null,
    onRetry: () => {},
    canStartAssessment: true,
  }));
  assert.match(unavailable, /Làm bài đánh giá/);
  assert.match(unavailable, /disabled=""/);
  assert.match(unavailable, /Hãy đăng nhập bằng tài khoản học sinh/);
});

test('assessment call-to-action invokes the existing flow and handles unavailable wiring', () => {
  let opened = false;
  assert.equal(startDiagnosticAssessmentFlow(() => { opened = true; }), true);
  assert.equal(opened, true);
  assert.equal(startDiagnosticAssessmentFlow(undefined), false);
});

test('authenticated student and admin dashboards render target editing controls', () => {
  for (const role of ['student', 'admin'] as const) {
    const dashboard = renderDashboard({}, 0, role);
    assert.match(dashboard, /Mục tiêu điểm thi:[\s\S]*?8\.5 \/ 10[\s\S]*?<button[^>]*aria-haspopup="dialog"/);
    assert.match(dashboard, />Đổi mục tiêu<\/button>/);
    assert.match(dashboard, /id="target-score-dialog"/);
    assert.match(dashboard, /Điểm năng lực hiện tại:/);
    if (role === 'admin') {
      assert.match(dashboard, /Làm bài đánh giá/);
      assert.match(dashboard, /Bài đánh giá chỉ dành cho tài khoản học sinh/);
      assert.match(dashboard, /Điểm năng lực hiện tại:[\s\S]*?Chưa đánh giá/);
    }
  }
});

test('target edit button action opens and focuses the dialog', () => {
  let opened = false;
  let focused = false;
  let editing = false;
  showTargetScoreDialog(
    {
      get open() {
        return opened;
      },
      showModal: () => {
        opened = true;
      },
    },
    { focus: () => { focused = true; } },
    (nextEditing) => { editing = nextEditing; }
  );

  assert.equal(opened, true);
  assert.equal(focused, true);
  assert.equal(editing, true);
});

test('unmeasured concepts show an empty state in the practice bank', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const html = renderToStaticMarkup(createElement(PracticeBankView, {
    questions: [question],
    masteries: {},
    recommendations: [],
    userRole: 'student',
    onStartSingleQuestion: () => {},
    onStartAdaptivePractice: () => {},
    onStartMicroQuiz: () => {},
    onOpenVideoModal: () => {},
  }));

  assert.match(html, /Mức độ nắm vững:<\/span>\s*<span class="text-slate-400">Chưa có dữ liệu/);
  assert.doesNotMatch(html, /Mức độ nắm vững:<\/span>\s*<span[^>]*>50%/);
});

test('completed practice creates measurable mastery evidence', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const mastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    1,
    question.difficulty,
    'fast_correct',
    30
  );
  const storage = new MemoryStorage();

  assert.equal(mastery.totalAttempts, 1);
  assert.equal(getVerifiedMastery({ [question.conceptId]: mastery }, question.conceptId), mastery);
  assert.equal(saveUserMasteries(storage, student.id, { [question.conceptId]: mastery }), true);
  assert.equal(
    getVerifiedMastery(loadUserMasteries(storage, student.id).masteries, question.conceptId)?.totalAttempts,
    1
  );

  const map = renderToStaticMarkup(createElement(KnowledgeMap, {
    masteries: { [question.conceptId]: mastery },
    onStartPracticeConcept: () => {},
    onOpenVideoModal: () => {},
  }));
  assert.match(map, new RegExp(`Làm chủ: ${Math.round(mastery.masteryScore * 100)}%`));
});

test('practice submission results preserve full, zero, and partial score ratios through completion', () => {
  const question = SAMPLE_QUESTION_BANK.find(
    (item) => item.questionType === 'true_false_multistatement'
  );
  assert.ok(question?.trueFalseStatements);

  const fullyCorrectAnswer = Object.fromEntries(
    question.trueFalseStatements.map((statement) => [statement.subOrder, statement.isCorrect])
  );
  const fullyIncorrectAnswer = Object.fromEntries(
    question.trueFalseStatements.map((statement) => [statement.subOrder, !statement.isCorrect])
  );
  const partiallyCorrectAnswer = Object.fromEntries(
    question.trueFalseStatements.map((statement, index) => [
      statement.subOrder,
      index < 3 ? statement.isCorrect : !statement.isCorrect,
    ])
  );

  const submittedResults = [
    createAdaptivePracticeResult(question, fullyCorrectAnswer, 30),
    createAdaptivePracticeResult(question, fullyIncorrectAnswer, 30),
    createAdaptivePracticeResult(question, partiallyCorrectAnswer, 30),
  ];
  assert.deepEqual(
    submittedResults.map(({ isCorrect, scoreRatio }) => ({ isCorrect, scoreRatio })),
    [
      { isCorrect: true, scoreRatio: 1 },
      { isCorrect: false, scoreRatio: 0 },
      { isCorrect: false, scoreRatio: 0.5 },
    ]
  );

  let callbackMasteries: Record<string, StudentMastery> = {};
  const onFinishPractice = (results: typeof submittedResults) => {
    callbackMasteries = AdaptiveLearningEngine.updateMasteriesFromPracticeResults({}, results);
  };
  onFinishPractice([submittedResults[2]]);

  const expectedPartialMastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    0.5,
    question.difficulty,
    'slow_incorrect',
    30
  );
  const binaryMastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    0,
    question.difficulty,
    'slow_incorrect',
    30
  );
  assert.deepEqual(callbackMasteries[question.conceptId], expectedPartialMastery);
  assert.notEqual(callbackMasteries[question.conceptId].masteryScore, binaryMastery.masteryScore);

  const examBreakdown = AdaptiveLearningEngine.calculateExamScoreBreakdown(
    [question],
    { [question.id]: { userAnswer: partiallyCorrectAnswer } }
  );
  assert.equal(examBreakdown.mandatoryScore, 0.5);
  assert.equal(examBreakdown.totalScore, 0.5);
  assert.equal(examBreakdown.mandatoryCorrect, 0);
  assert.equal(examBreakdown.mandatoryTotal, 1);
});

test('invalid practice score ratios throw and do not alter existing stored mastery', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const validMastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    0.5,
    question.difficulty,
    'slow_incorrect',
    30
  );
  const existingMasteries = { [question.conceptId]: validMastery };
  const storage = new MemoryStorage();
  assert.equal(saveUserMasteries(storage, student.id, existingMasteries), true);
  const storedBefore = storage.getItem(userMasteryStorageKey(student.id));
  const masteriesBefore = JSON.stringify(existingMasteries);

  for (const scoreRatio of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0.01,
    1.01,
  ]) {
    assert.throws(
      () => AdaptiveLearningEngine.updateMasteriesFromPracticeResults(
        existingMasteries,
        [
          {
            question,
            isCorrect: true,
            scoreRatio: 1,
            activeTimeSec: 30,
          },
          {
            question,
            isCorrect: false,
            scoreRatio,
            activeTimeSec: 30,
          },
        ]
      ),
      { name: 'RangeError', message: /finite number between 0 and 1/ }
    );
    assert.equal(JSON.stringify(existingMasteries), masteriesBefore);
    assert.equal(storage.getItem(userMasteryStorageKey(student.id)), storedBefore);
  }
});

test('practice completion failure notifies the user and preserves stored mastery', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const result = {
    question,
    isCorrect: false,
    scoreRatio: Number.NaN,
    activeTimeSec: 30,
  };
  const existingMastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    0.5,
    question.difficulty,
    'slow_incorrect',
    30
  );
  const existingMasteries = { [question.conceptId]: existingMastery };
  const storage = new MemoryStorage();
  assert.equal(saveUserMasteries(storage, student.id, existingMasteries), true);
  const savedValueBefore = storage.getItem(userMasteryStorageKey(student.id));
  let notification: string | undefined;
  let successCallbackCalled = false;

  const completed = completeAdaptivePractice(
    existingMasteries,
    [result],
    (masteries, results) =>
      AdaptiveLearningEngine.updateMasteriesFromPracticeResults(masteries, results),
    (updatedMasteries) => {
      successCallbackCalled = true;
      saveUserMasteries(storage, student.id, updatedMasteries);
    },
    (message) => { notification = message; }
  );

  assert.equal(completed, false);
  assert.equal(notification, PRACTICE_MASTERY_UPDATE_ERROR);
  assert.equal(successCallbackCalled, false);
  assert.equal(storage.getItem(userMasteryStorageKey(student.id)), savedValueBefore);
});

test('practice mastery error toast stacks above the adaptive-practice modal', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const practiceSource = readFileSync('src/components/AdaptivePracticeSession.tsx', 'utf8');
  const errorToast = appSource.match(/<div className="([^"]+)">\s*<CheckCircle2[\s\S]*?<span>\{toastMessage\}<\/span>/);
  const practiceOverlay = practiceSource.match(/<div className="([^"]+)"[^>]*>\s*<div className="bg-white rounded-3xl/);

  assert.ok(errorToast);
  assert.ok(practiceOverlay);
  assert.match(errorToast[1], /(?:^|\s)z-\[60\](?:\s|$)/);
  assert.match(practiceOverlay[1], /(?:^|\s)z-50(?:\s|$)/);
});

test('successful practice completion updates mastery and persists through its success callback', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const result = createAdaptivePracticeResult(question, 'A', 30);
  const storage = new MemoryStorage();
  let savedMasteries: Record<string, StudentMastery> = {};
  let notification: string | undefined;

  const completed = completeAdaptivePractice(
    {},
    [result],
    (masteries, results) =>
      AdaptiveLearningEngine.updateMasteriesFromPracticeResults(masteries, results),
    (updatedMasteries) => {
      savedMasteries = updatedMasteries;
      assert.equal(saveUserMasteries(storage, student.id, updatedMasteries), true);
    },
    (message) => { notification = message; }
  );

  assert.equal(completed, true);
  assert.equal(savedMasteries[question.conceptId].totalAttempts, 1);
  assert.ok(storage.getItem(userMasteryStorageKey(student.id)));
  assert.equal(notification, undefined);
});

test('one real practice attempt is still insufficient for an exam-score prediction', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const mastery = AdaptiveLearningEngine.updateConceptMastery(
    undefined,
    question.conceptId,
    1,
    question.difficulty,
    'fast_correct',
    30
  );
  const dashboard = renderDashboard({ [question.conceptId]: mastery }, 1);

  assert.match(dashboard, /Chưa có mô hình dự đoán được kiểm chứng/);
  assert.doesNotMatch(dashboard, /Dự đoán điểm thi:[\s\S]{0,120}\d\.\d/);
  assert.doesNotMatch(dashboard, /Tiến độ đạt mục tiêu/);
});

test('recommendations for unmeasured concepts are neutral diagnostic practice', () => {
  const question = SAMPLE_QUESTION_BANK[0];
  const [recommendation] = AdaptiveLearningEngine.getAdaptiveRecommendations({}, [question], 1);

  assert.equal(recommendation.reasons.weaknessScore, 0.5);
  assert.match(recommendation.reasons.textExplanation, /Bài luyện làm quen/);
  assert.match(recommendation.reasons.textExplanation, /Chưa có dữ liệu học tập gắn với tài khoản này/);
  assert.doesNotMatch(recommendation.reasons.textExplanation, /đạt \d+%|điểm cần củng cố/);
  const [focusRecommendation] = AdaptiveLearningEngine.getAdaptiveRecommendations(
    {}, [question], 1, [], 'focus_weak'
  );
  assert.match(focusRecommendation.reasons.textExplanation, /Chưa có dữ liệu học tập/);
  assert.equal(focusRecommendation.reasons.weaknessScore, 0.5);

  const [firstPathDay] = AdaptiveLearningEngine.generate7DayLearningPath({});
  assert.match(firstPathDay.learningGoal, /bổ sung dữ liệu học tập gắn với tài khoản này/);
  assert.doesNotMatch(firstPathDay.learningGoal, /từ 50%/);
});

test('legacy global mastery data is preserved and never loaded into a user account', () => {
  const storage = new MemoryStorage();
  const legacyValue = JSON.stringify(INITIAL_STUDENT_MASTERIES);
  storage.setItem(LEGACY_MASTERY_STORAGE_KEY, legacyValue);

  const loaded = loadUserMasteries(storage, student.id);
  assert.deepEqual(loaded.masteries, {});
  assert.equal(saveUserMasteries(storage, student.id, loaded.masteries), true);
  assert.equal(storage.getItem(LEGACY_MASTERY_STORAGE_KEY), legacyValue);
  assert.notEqual(userMasteryStorageKey('student-1'), userMasteryStorageKey('student-2'));
});

test('target scores are restricted to 1.0-10.0 in half-point increments', async () => {
  for (let score = 1; score <= 10; score += 0.5) {
    assert.equal(validateTargetScore(score), null);
  }
  for (const score of [0, 0.5, 10.5, 8.25, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.notEqual(validateTargetScore(score), null);
  }

  let rpcArgs: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, 'update_my_target_score');
      rpcArgs = args;
      return { data: 9, error: null };
    },
  } as never;
  const historyStorage = new MemoryStorage();
  const examHistory = JSON.stringify([{ id: 'attempt-1', score: 8.5 }]);
  historyStorage.setItem('tinmaster_student_exam_history_v1', examHistory);

  assert.equal(await updateMyTargetScore(client, 9), 9);
  assert.deepEqual(rpcArgs, { p_target_score: 9 });
  assert.equal(historyStorage.getItem('tinmaster_student_exam_history_v1'), examHistory);

  await assert.rejects(updateMyTargetScore(client, 8.25), /từ 1\.0 đến 10\.0/);
});

test('students can update only a valid grade through the self-service RPC', async () => {
  assert.deepEqual(STUDENT_GRADE_OPTIONS, [10, 11, 12]);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: args.p_grade, error: null };
    },
  } as never;

  for (const grade of [10, 11, 12] as const) {
    assert.equal(await updateMyStudentGrade(client, grade), grade);
  }
  assert.equal(await updateMyStudentGrade(client, null), null);
  assert.deepEqual(calls, ([10, 11, 12, null] as const).map((grade) => ({
    name: 'update_my_student_grade',
    args: { p_grade: grade },
  })));

  for (const grade of [undefined, 9, 13, '10', 10.5]) {
    await assert.rejects(updateMyStudentGrade(client, grade), /Khối lớp phải là 10, 11 hoặc 12/);
  }
  assert.equal(calls.length, 4);

  const deniedClient = {
    rpc: async () => ({
      data: null,
      error: { code: '42501', message: 'permission denied with private details' },
    }),
  } as never;
  await assert.rejects(
    updateMyStudentGrade(deniedClient, 11),
    { message: 'Chỉ tài khoản học sinh mới có thể cập nhật khối lớp của mình.' }
  );

  const missingRpcClient = {
    rpc: async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' },
    }),
  } as never;
  await assert.rejects(
    updateMyStudentGrade(missingRpcClient, 11),
    /Cơ sở dữ liệu chưa có chức năng lưu khối lớp.*20261003150000_add_student_grade_update_rpc\.sql/
  );

  const rateLimitedClient = {
    rpc: async () => ({
      data: null,
      error: {
        code: 'P0001',
        message: 'Profile update limit exceeded',
        details: 'PROFILE_RATE_LIMIT',
      },
    }),
  } as never;
  await assert.rejects(
    updateMyStudentGrade(rateLimitedClient, 11),
    /cập nhật hồ sơ quá thường xuyên/
  );
});

test('target update migration only permits authenticated self target-score writes', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261002220000_update_my_target_score.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /security definer\s+set search_path = ''\s+set row_security = off/i);
  assert.match(migration, /auth\.uid\(\) is null/);
  assert.match(migration, /p\.id = auth\.uid\(\)/);
  assert.match(migration, /p_target_score \* 2 <> pg_catalog\.trunc\(p_target_score \* 2\)/);
  assert.match(migration, /revoke all on function public\.update_my_target_score\(numeric\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.update_my_target_score\(numeric\) to authenticated/i);
  assert.match(migration, /set target_score = p_target_score/i);
  assert.doesNotMatch(migration, /set\s+[^;]*(?:role|email|display_name|school|grade)\s*=/i);
});

test('student grade update migration is self-scoped and cannot modify roles or unrelated fields', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261003150000_add_student_grade_update_rpc.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /security definer\s+set search_path = ''\s+set row_security = off/i);
  assert.match(migration, /auth\.uid\(\) is null/);
  assert.match(migration, /p_grade is not null and \(?p_grade not between 10 and 12\)?/i);
  assert.match(migration, /where p\.id = auth\.uid\(\)\s+and p\.role = 'student'/i);
  assert.match(migration, /set grade = p_grade/i);
  assert.match(migration, /consume_member_profile_update_limit/);
  assert.match(migration, /revoke all on function public\.update_my_student_grade\(smallint\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.update_my_student_grade\(smallint\) to authenticated/i);
  assert.doesNotMatch(migration, /set\s+(?:role|email|display_name|school|target_score)\s*=/i);
});

test('learning mode is restored per account and invalid values are preserved', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadLearningMode(storage, 'student-1'), {
    mode: 'structured',
    canPersist: true,
  });
  assert.equal(saveLearningMode(storage, 'student-1', 'focus_weak'), true);
  assert.equal(loadLearningMode(storage, 'student-1').mode, 'focus_weak');
  assert.equal(loadLearningMode(storage, 'student-2').mode, 'structured');
  assert.notEqual(learningModeStorageKey('student-1'), learningModeStorageKey('student-2'));
  assert.equal(isLearningMode('practice_toward_target'), false);

  const key = learningModeStorageKey('student-invalid');
  storage.setItem(key, 'unsupported');
  assert.deepEqual(loadLearningMode(storage, 'student-invalid'), {
    mode: 'structured',
    canPersist: false,
  });
  assert.equal(storage.getItem(key), 'unsupported');
  assert.equal(loadLearningMode(storage, 'student-invalid').canPersist, false);
});

test('grade and target score are restored from the authenticated profile for the correct account', async () => {
  const profileUser = {
    id: 'target-owner',
    email: 'target@example.test',
    user_metadata: {},
  } as unknown as import('@supabase/supabase-js').User;
  for (const grade of [10, 11, 12] as const) {
    const gradeClient = {
      from: (table: string) => {
        assert.equal(table, 'profiles');
        return {
          select: () => ({
            eq: (_column: string, userId: string) => {
              assert.equal(userId, profileUser.id);
              return {
                maybeSingle: async () => ({
                  data: {
                    id: userId,
                    email: profileUser.email,
                    display_name: 'Target Owner',
                    role: 'student',
                    grade,
                    target_score: 7.5,
                  },
                  error: null,
                }),
              };
            },
          }),
        };
      },
    } as unknown as import('@supabase/supabase-js').SupabaseClient;
    const restoredProfile = await getOrCreateProfile(gradeClient, profileUser);
    assert.equal(restoredProfile.id, 'target-owner');
    assert.equal(restoredProfile.targetScore, 7.5);
    assert.equal(restoredProfile.grade, grade);
  }
});

test('exam history is isolated by account without migrating or overwriting legacy results', () => {
  const storage = new MemoryStorage();
  const legacyHistory = JSON.stringify([{ id: 'legacy-attempt' }]);
  storage.setItem(LEGACY_EXAM_HISTORY_STORAGE_KEY, legacyHistory);
  const attempt: ExamAttemptRecord = {
    id: 'new-attempt',
    examId: 'exam-1',
    examTitle: 'Exam',
    category: 'national_standard',
    dateTaken: new Date().toISOString(),
    score: 8,
    maxScore: 10,
    totalQuestions: 10,
    correctCount: 8,
    durationSeconds: 1800,
    accuracy: 80,
  };

  assert.deepEqual(loadUserExamHistory(storage, 'student-1'), {
    records: [],
    canPersist: true,
  });
  assert.equal(saveUserExamHistory(storage, 'student-1', [attempt]), true);
  assert.deepEqual(loadUserExamHistory(storage, 'student-1').records, [attempt]);
  assert.deepEqual(loadUserExamHistory(storage, 'student-2').records, []);
  assert.notEqual(userExamHistoryStorageKey('student-1'), userExamHistoryStorageKey('student-2'));
  assert.equal(storage.getItem(LEGACY_EXAM_HISTORY_STORAGE_KEY), legacyHistory);

  const invalidKey = userExamHistoryStorageKey('student-invalid');
  storage.setItem(invalidKey, JSON.stringify([{ id: 'partial' }]));
  assert.deepEqual(loadUserExamHistory(storage, 'student-invalid'), {
    records: [],
    canPersist: false,
  });
  assert.equal(storage.getItem(invalidKey), JSON.stringify([{ id: 'partial' }]));
});

test('all supported learning modes change recommendation or roadmap ordering', () => {
  const earlyQuestion = SAMPLE_QUESTION_BANK.find((q) => q.conceptId === 'CS12_AI_CONCEPTS');
  const laterQuestion = SAMPLE_QUESTION_BANK.find((q) => q.conceptId === 'CS10_PYTHON_CONTROL');
  assert.ok(earlyQuestion);
  assert.ok(laterQuestion);

  const mastered: StudentMastery = {
    conceptId: laterQuestion.conceptId,
    masteryScore: 0.8,
    confidenceScore: 0.6,
    totalAttempts: 2,
    correctAttempts: 0,
    consecutiveSuccessStreak: 0,
    lastPracticedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    nextSpacedReviewAt: new Date(Date.now() - 60_000).toISOString(),
    trend: 'declining',
  };
  const evidence = { [mastered.conceptId]: mastered };
  const questions = [laterQuestion, earlyQuestion];
  const structured = AdaptiveLearningEngine.getAdaptiveRecommendations(
    evidence, questions, 2, [], 'structured'
  );
  const focusWeak = AdaptiveLearningEngine.getAdaptiveRecommendations(
    evidence, questions, 2, [], 'focus_weak'
  );
  const smartReview = AdaptiveLearningEngine.getAdaptiveRecommendations(
    evidence, [laterQuestion], 1, [], 'smart_review'
  );

  assert.equal(structured[0].question.conceptId, earlyQuestion.conceptId);
  assert.equal(focusWeak[0].question.conceptId, laterQuestion.conceptId);
  assert.match(smartReview[0].reasons.textExplanation, /lâu chưa ôn lại/);
  assert.match(focusWeak[0].reasons.textExplanation, /kết quả thực hành đã ghi nhận/);

  const structuredPath = AdaptiveLearningEngine.generate7DayLearningPath({}, 'structured');
  const focusPath = AdaptiveLearningEngine.generate7DayLearningPath(evidence, 'focus_weak');
  const reviewPath = AdaptiveLearningEngine.generate7DayLearningPath(evidence, 'smart_review');
  assert.notEqual(structuredPath[0].focusConceptId, focusPath[0].focusConceptId);
  assert.equal(focusPath[0].focusConceptId, laterQuestion.conceptId);
  assert.equal(reviewPath[0].focusConceptId, laterQuestion.conceptId);
});
