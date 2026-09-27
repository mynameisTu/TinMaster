import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  StudentMastery,
  ExamSession,
  Question,
  AdaptiveRecommendation,
  LearningPathDay,
  ExamBlueprint,
  ExamTrack,
} from './types';
import {
  INITIAL_STUDENT_MASTERIES,
  OFFICIAL_EXAM_BLUEPRINT_2025,
  CONCEPTS_LIST,
} from './data/curriculumData';
import { SAMPLE_QUESTION_BANK } from './data/questionBank';
import { AdaptiveLearningEngine } from './services/adaptiveEngine';
import {
  ExamCatalogItem,
  ExamAttemptRecord,
  ClassStudentExamResult,
  INITIAL_EXAMS_CATALOG,
  loadStoredExamHistory,
} from './data/examCatalogData';

import { Header } from './components/Header';
import { StudentDashboard } from './components/StudentDashboard';
import { ExamSimulation } from './components/ExamSimulation';
import { ExamReview } from './components/ExamReview';
import { KnowledgeMap } from './components/KnowledgeMap';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AIVideoLessonModal } from './components/AIVideoLessonModal';
import { GoogleWorkspaceModal } from './components/GoogleWorkspaceModal';
import { AdaptivePracticeSession } from './components/AdaptivePracticeSession';
import { PracticeBankView } from './components/PracticeBankView';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { ExamsCatalogView } from './components/ExamsCatalogView';
import { SelectTrackModal } from './components/SelectTrackModal';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { TeacherInvitationModal } from './components/TeacherInvitationModal';
import { AuthenticationRoute } from './components/AuthPages';

import {
  Play,
  HardDrive,
  Mail,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const STORAGE_KEY_MASTERIES = 'tinmaster_masteries_v1';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (['/admin', '/admin/dashboard', '/admin/setup-password', '/register', '/forgot-password', '/reset-password'].includes(path)) {
    return <AuthenticationRoute />;
  }
  return <TinMasterApp />;
}

function TinMasterApp() {
  const auth = useAuth();

  // 1. User State
  const [userState, setUser] = useState<UserProfile>({
    id: '',
    name: '',
    email: '',
    role: 'student',
    targetScore: 8.5,
    estimatedScore: 0,
    completedQuestionsCount: 0,
    streakDays: 0,
    xp: 0,
    researchGroup: 'unassigned',
    totalStudyMinutes: 0,
  });

  // 2. Knowledge Mastery State (Bayesian Knowledge Tracing)
  const [masteries, setMasteries] = useState<Record<string, StudentMastery>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MASTERIES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_STUDENT_MASTERIES;
  });

  // 2.1 Question Bank (Preloaded + Custom uploaded / manually created)
  const [allQuestions, setAllQuestions] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem('tinmaster_custom_questions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>(SAMPLE_QUESTION_BANK.map((q) => q.id));
          const uniqueCustom: Question[] = [];
          for (const q of parsed) {
            if (q && q.id && !seenIds.has(q.id)) {
              seenIds.add(q.id);
              uniqueCustom.push(q);
            }
          }
          // Self-heal localStorage by storing clean, deduplicated array
          localStorage.setItem('tinmaster_custom_questions_v1', JSON.stringify(uniqueCustom));
          return [...SAMPLE_QUESTION_BANK, ...uniqueCustom];
        }
      }
    } catch {}
    return SAMPLE_QUESTION_BANK;
  });

  const handleAddQuestions = (newQuestions: Question[]) => {
    setAllQuestions((prev) => {
      const existingIds = new Set(prev.map((q) => q.id));
      const deduplicatedNew: Question[] = [];

      for (let i = 0; i < newQuestions.length; i++) {
        const q = newQuestions[i];
        let finalId = q.id;
        if (!finalId || existingIds.has(finalId)) {
          finalId = `Q_CUST_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i + 1}`;
        }
        existingIds.add(finalId);
        deduplicatedNew.push({ ...q, id: finalId });
      }

      const updated = [...prev, ...deduplicatedNew];
      try {
        const existingCustom = localStorage.getItem('tinmaster_custom_questions_v1');
        const prevCustom: Question[] = existingCustom ? JSON.parse(existingCustom) : [];
        const customIds = new Set(prevCustom.map((q) => q.id));
        const newToStore = deduplicatedNew.filter((q) => !customIds.has(q.id));
        localStorage.setItem(
          'tinmaster_custom_questions_v1',
          JSON.stringify([...prevCustom, ...newToStore])
        );
      } catch {}
      return updated;
    });
    showToast(`Đã lưu thành công ${newQuestions.length} câu hỏi vào ngân hàng bài tập!`);
  };

  // 3. Navigation & Modals
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentExamSession, setCurrentExamSession] = useState<ExamSession | null>(null);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [videoConceptId, setVideoConceptId] = useState<string | undefined>(undefined);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [showTeacherInvitationModal, setShowTeacherInvitationModal] = useState(false);
  const [showSelectTrackModal, setShowSelectTrackModal] = useState<boolean>(false);
  const [pendingExamStart, setPendingExamStart] = useState<{ blueprint: ExamBlueprint; examItem?: ExamCatalogItem } | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[] | null>(null);
  const [practiceRecommendation, setPracticeRecommendation] = useState<AdaptiveRecommendation | undefined>(undefined);

  // 4. Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.error) return;
    setToastMessage(`Lỗi xác thực: ${auth.error}`);
    const timeout = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [auth.error, auth.status]);

  // Exam Catalog, History, and Session States
  const [examsCatalog, setExamsCatalog] = useState<ExamCatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem('tinmaster_custom_exams_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...INITIAL_EXAMS_CATALOG, ...parsed];
        }
      }
    } catch {}
    return INITIAL_EXAMS_CATALOG;
  });

  const [examHistory, setExamHistory] = useState<ExamAttemptRecord[]>(() =>
    loadStoredExamHistory(localStorage)
  );

  const [classResults] = useState<ClassStudentExamResult[]>([]);
  const [activeExamBlueprint, setActiveExamBlueprint] = useState<ExamBlueprint>(OFFICIAL_EXAM_BLUEPRINT_2025);
  const [currentExamItem, setCurrentExamItem] = useState<ExamCatalogItem | undefined>(undefined);

  useEffect(() => {
    if (!auth.profile) return;
    setActiveTab('dashboard');
  }, [auth.profile]);

  const user: UserProfile = auth.profile
    ? {
      ...userState,
      id: auth.profile.id,
      name: auth.profile.displayName,
      email: auth.profile.email,
      role: auth.profile.role,
      avatarUrl: auth.profile.avatarUrl,
      school: auth.profile.school,
      grade: auth.profile.grade,
      examTrack: auth.profile.examTrack ?? userState.examTrack,
      targetScore: auth.profile.targetScore,
    }
    : userState;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MASTERIES, JSON.stringify(masteries));
    } catch {}
  }, [masteries]);

  // Derive dynamic adaptive recommendations & roadmap
  const recommendations = AdaptiveLearningEngine.getAdaptiveRecommendations(
    masteries,
    allQuestions,
    3
  );

  const learningPath: LearningPathDay[] = AdaptiveLearningEngine.generate7DayLearningPath(
    masteries
  );

  // Assemble exam questions filtered by track for elective exams
  const assembleExamQuestions = (blueprint: ExamBlueprint, examItem?: ExamCatalogItem, track?: ExamTrack): Question[] => {
    // If the exam has custom uploaded questions, use those directly
    if (examItem?.questions && examItem.questions.length > 0) {
      return examItem.questions;
    }

    const hasElective = blueprint.hasElectiveTracks;
    if (!hasElective) {
      // Non-elective exams: use all questions as-is
      return allQuestions;
    }

    // Filter mandatory questions (sectionScope === 'mandatory' or track === 'ALL')
    const mandatoryQuestions = allQuestions.filter((q) => q.sectionScope === 'mandatory');
    const mandatoryTrueFalseQuestions = allQuestions.filter(
      (q) => q.sectionScope === 'mandatory_tf'
    );

    // Filter elective questions matching student's track
    const electiveQuestions = track
      ? allQuestions.filter(
          (q) => q.sectionScope === 'elective' && q.track === track
        )
      : [];

    // Limit to blueprint counts
    const mandatoryCount = blueprint.sections.sectionI.questionCount || 24;
    const mandatoryTrueFalseCount = blueprint.sections.sectionII.questionCount || 2;
    const electiveCount = blueprint.sections.sectionIII?.electivePerStudentCount || 2;

    const shuffle = <T,>(items: T[]): T[] => {
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const selectedMandatory = shuffle(mandatoryQuestions).slice(0, mandatoryCount);
    const selectedMandatoryTrueFalse = shuffle(mandatoryTrueFalseQuestions).slice(
      0,
      mandatoryTrueFalseCount
    );
    const selectedElective = shuffle(electiveQuestions).slice(0, electiveCount);

    return [...selectedMandatory, ...selectedMandatoryTrueFalse, ...selectedElective];
  };

  // Start exam from catalog or quick button
  const handleStartExam = (blueprint?: ExamBlueprint, examItem?: ExamCatalogItem) => {
    const bp = blueprint || OFFICIAL_EXAM_BLUEPRINT_2025;
    setActiveExamBlueprint(bp);
    setCurrentExamItem(examItem);

    // If exam has elective tracks, check user has selected a track
    if (bp.hasElectiveTracks && !user.examTrack) {
      setPendingExamStart({ blueprint: bp, examItem });
      setShowSelectTrackModal(true);
      return;
    }

    setActiveTab('exam_simulation');
  };

  // Handle track selection from modal
  const handleTrackSelected = (track: ExamTrack) => {
    setUser((prev) => ({ ...prev, examTrack: track }));
    setShowSelectTrackModal(false);

    // If we had a pending exam start, continue with it now
    if (pendingExamStart) {
      setActiveExamBlueprint(pendingExamStart.blueprint);
      setCurrentExamItem(pendingExamStart.examItem);
      setPendingExamStart(null);
      setActiveTab('exam_simulation');
    }
  };

  // View completed exam review
  const handleViewExamSession = (attempt: ExamAttemptRecord) => {
    if (attempt.sessionData) {
      setCurrentExamSession(attempt.sessionData);
      setActiveTab('exam_review');
    } else {
      // Synthetic readable session
      const syntheticSession: ExamSession = {
        id: attempt.id,
        blueprintId: attempt.examId,
        examTitle: attempt.examTitle,
        startedAt: attempt.dateTaken,
        submittedAt: attempt.dateTaken,
        durationSeconds: attempt.durationSeconds,
        timeRemainingSeconds: 0,
        isCompleted: true,
        totalScore: attempt.score,
        totalCorrect: attempt.correctCount,
        questionTelemetries: {},
      };
      setCurrentExamSession(syntheticSession);
      setActiveTab('exam_review');
    }
  };

  // Teacher/Admin add custom exam
  const handleAddCustomExam = (newExam: ExamCatalogItem) => {
    setExamsCatalog((prev) => {
      const updated = [newExam, ...prev];
      try {
        const existing = localStorage.getItem('tinmaster_custom_exams_v1');
        const prevCustom = existing ? JSON.parse(existing) : [];
        localStorage.setItem('tinmaster_custom_exams_v1', JSON.stringify([newExam, ...prevCustom]));
      } catch {}
      return updated;
    });
    showToast(`Đã xuất bản kỳ thi mới: ${newExam.title}`);
  };

  // Finish exam
  const handleFinishExam = (session: ExamSession) => {
    // Get the actual questions used in this exam session
    const examQuestions = assembleExamQuestions(activeExamBlueprint, currentExamItem, user.examTrack || undefined);
    const questionsInSession = examQuestions.filter((q) => session.questionTelemetries[q.id]);
    const questionsToGrade = questionsInSession.length > 0 ? questionsInSession : examQuestions;

    // Calculate score breakdown (mandatory vs elective)
    const breakdown = AdaptiveLearningEngine.calculateExamScoreBreakdown(
      questionsToGrade,
      session.questionTelemetries,
      user.examTrack || undefined
    );

    // Update session with breakdown data
    const enrichedSession: ExamSession = {
      ...session,
      totalScore: breakdown.totalScore,
      totalCorrect: breakdown.mandatoryCorrect + breakdown.electiveCorrect,
      studentTrack: user.examTrack || undefined,
      mandatoryScore: breakdown.mandatoryScore,
      mandatoryMaxScore: breakdown.mandatoryMaxScore,
      electiveScore: breakdown.electiveScore,
      electiveMaxScore: breakdown.electiveMaxScore,
    };

    // Update masteries via Bayesian Knowledge Tracing
    let updatedMasteries = { ...masteries };

    questionsToGrade.forEach((q) => {
      const tel = session.questionTelemetries[q.id];
      if (tel && tel.userAnswer !== undefined) {
        // Use correct maxPoints based on section
        const maxPts = q.questionType === 'true_false_multistatement' ? 1.0 : 0.25;
        const scoreResult = AdaptiveLearningEngine.calculateQuestionScore(q, tel.userAnswer, maxPts);

        const currentM = updatedMasteries[q.conceptId] || {
          conceptId: q.conceptId,
          masteryScore: 0.5,
          confidenceScore: 0.5,
          totalAttempts: 0,
          correctAttempts: 0,
          consecutiveSuccessStreak: 0,
          lastPracticedAt: new Date().toISOString(),
          nextSpacedReviewAt: new Date().toISOString(),
          trend: 'stable' as const,
        };

        const updatedM = AdaptiveLearningEngine.updateConceptMastery(
          currentM,
          q.conceptId,
          scoreResult.scoreRatio,
          q.difficulty,
          tel.quadrant || 'fast_correct',
          tel.activeTimeSec || 45
        );

        updatedMasteries[q.conceptId] = updatedM;
      }
    });

    setMasteries(updatedMasteries);
    setCurrentExamSession(enrichedSession);

    // Save attempt to student exam history
    const prevAttempt = examHistory.find((h) => h.examId === (currentExamItem?.id || 'exam-thpt-2025-std'));
    const totalQ = questionsToGrade.length;
    const totalCorrectCount = breakdown.mandatoryCorrect + breakdown.electiveCorrect;
    const accuracy = Math.round((totalCorrectCount / Math.max(totalQ, 1)) * 100);
    const trendDiff = prevAttempt ? Number((breakdown.totalScore - prevAttempt.score).toFixed(2)) : undefined;

    const newAttempt: ExamAttemptRecord = {
      id: `attempt-${Date.now()}`,
      examId: currentExamItem?.id || 'exam-thpt-2025-std',
      examTitle: currentExamItem?.title || session.examTitle || 'Phòng Thi Chuẩn Hóa Môn Tin Học (THPT 2025)',
      category: currentExamItem?.category || 'national_standard',
      dateTaken: new Date().toISOString(),
      score: Number(breakdown.totalScore.toFixed(2)),
      maxScore: 10.0,
      totalQuestions: totalQ,
      correctCount: totalCorrectCount,
      durationSeconds: session.durationSeconds,
      accuracy,
      trendDiff,
      sessionData: enrichedSession,
      studentTrack: user.examTrack || undefined,
      mandatoryScore: breakdown.mandatoryScore,
      electiveScore: breakdown.electiveScore,
    };

    setExamHistory((prev) => {
      const updated = [newAttempt, ...prev];
      try {
        localStorage.setItem('tinmaster_student_exam_history_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Update user stats
    setUser((prev) => ({
      ...prev,
      completedQuestionsCount: prev.completedQuestionsCount + totalQ,
      xp: prev.xp + 120,
    }));

    setActiveTab('exam_review');
    showToast(`Đã chấm bài thi! Bắt buộc (26 câu): ${breakdown.mandatoryScore}/${breakdown.mandatoryMaxScore}đ | Tự chọn (2 câu): ${breakdown.electiveScore}/${breakdown.electiveMaxScore}đ | Tổng: ${breakdown.totalScore}/10.0đ`);
  };

  // Start Adaptive Practice session
  const handleStartAdaptivePractice = (rec?: AdaptiveRecommendation) => {
    if (rec) {
      setPracticeRecommendation(rec);
      setPracticeQuestions([rec.question]);
    } else if (recommendations[0]) {
      setPracticeRecommendation(recommendations[0]);
      setPracticeQuestions([recommendations[0].question]);
    } else {
      setPracticeQuestions(allQuestions.slice(0, 3));
    }
  };

  // Practice a single specific question from the question bank
  const handlePracticeSingleQuestion = (question: Question) => {
    const matchedRec = recommendations.find((r) => r.question.id === question.id);
    if (matchedRec) {
      setPracticeRecommendation(matchedRec);
    } else {
      setPracticeRecommendation({
        question,
        score: 0.85,
        reasons: {
          weaknessScore: 0.7,
          recencyScore: 0.6,
          difficultyFitScore: 0.8,
          importanceScore: 0.8,
          textExplanation: 'Luyện tập câu hỏi theo lựa chọn của học sinh trong ngân hàng bài tập.',
        },
      });
    }
    setPracticeQuestions([question]);
  };

  // Start Micro-quiz (3 or 5 questions)
  const handleStartMicroQuiz = (count: number) => {
    const sortedWeak = [...CONCEPTS_LIST].sort((a, b) => {
      const mA = masteries[a.id]?.masteryScore ?? 0.5;
      const mB = masteries[b.id]?.masteryScore ?? 0.5;
      return mA - mB;
    });

    const weakConceptIds = sortedWeak.slice(0, 3).map((c) => c.id);
    const selected = allQuestions.filter((q) => weakConceptIds.includes(q.conceptId)).slice(0, count);

    setPracticeQuestions(selected.length > 0 ? selected : allQuestions.slice(0, count));
    setPracticeRecommendation(undefined);
  };

  // Finish Practice session
  const handleFinishPracticeSession = (
    results: { question: Question; isCorrect: boolean; activeTimeSec: number }[]
  ) => {
    let updatedMasteries = { ...masteries };
    let correctCount = 0;

    results.forEach((r) => {
      if (r.isCorrect) correctCount++;
      const currentM = updatedMasteries[r.question.conceptId] || {
        conceptId: r.question.conceptId,
        masteryScore: 0.5,
        confidenceScore: 0.5,
        totalAttempts: 0,
        correctAttempts: 0,
        consecutiveSuccessStreak: 0,
        lastPracticedAt: new Date().toISOString(),
        nextSpacedReviewAt: new Date().toISOString(),
        trend: 'stable' as const,
      };

      const updatedM = AdaptiveLearningEngine.updateConceptMastery(
        currentM,
        r.question.conceptId,
        r.isCorrect ? 1.0 : 0.0,
        r.question.difficulty,
        r.isCorrect ? 'fast_correct' : 'slow_incorrect',
        r.activeTimeSec
      );

      updatedMasteries[r.question.conceptId] = updatedM;
    });

    setMasteries(updatedMasteries);
    setPracticeQuestions(null);
    setPracticeRecommendation(undefined);

    setUser((prev) => ({
      ...prev,
      completedQuestionsCount: prev.completedQuestionsCount + results.length,
      xp: prev.xp + results.length * 15,
    }));

    showToast(`Đã hoàn thành! Đúng ${correctCount}/${results.length} câu. +${results.length * 15} XP!`);
  };

  const handleOpenVideoModal = (conceptId?: string) => {
    setVideoConceptId(conceptId);
    setShowVideoModal(true);
  };

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-sm text-slate-600">
        Đang khôi phục phiên đăng nhập…
      </div>
    );
  }

  if (auth.status !== 'authenticated' || !auth.profile) {
    return (
      <GoogleSignInModal
        isOpen
        onSignIn={auth.signInWithGoogle}
        isLoading={false}
        error={auth.error}
        errorKind={auth.errorKind}
        onRetryProfileLoad={auth.retryProfileLoad}
        onSignOut={auth.signOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1e293b] flex flex-col font-sans">
      {/* 1. APP HEADER */}
      <Header
        user={user}
        onSignOut={() => void auth.signOut()}
        onRedeemTeacherInvitation={() => setShowTeacherInvitationModal(true)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenVideoModal={() => handleOpenVideoModal()}
        onOpenGoogleWorkspace={() => setShowWorkspaceModal(true)}
        onOpenTrackModal={() => setShowSelectTrackModal(true)}
        onSelectTrack={handleTrackSelected}
      />

      {/* 2. FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] text-white px-4 py-2.5 rounded shadow-lg flex items-center space-x-2 text-xs font-semibold border border-[#d1d5db]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER - Expanded Width (90-95% viewport on desktop) */}
      <main className="flex-1 w-full max-w-[95%] 2xl:max-w-[1850px] mx-auto px-3 sm:px-5 lg:px-7 py-6">
        {/* VIEW A: STUDENT DASHBOARD */}
        {activeTab === 'dashboard' && (
          <StudentDashboard
            user={user}
            masteries={masteries}
            recommendations={recommendations}
            learningPath={learningPath}
            onStartExam={handleStartExam}
            onStartAdaptivePractice={handleStartAdaptivePractice}
            onStartMicroQuiz={handleStartMicroQuiz}
            onOpenVideoModal={handleOpenVideoModal}
            onNavigateToKnowledgeMap={() => setActiveTab('knowledge_map')}
            onNavigateToExercises={() => setActiveTab('adaptive_practice')}
          />
        )}

        {/* VIEW A2: ADAPTIVE PRACTICE & QUESTION BANK */}
        {activeTab === 'adaptive_practice' && (
          <PracticeBankView
            questions={allQuestions}
            masteries={masteries}
            recommendations={recommendations}
            userRole={user.role}
            onAddQuestions={handleAddQuestions}
            onStartSingleQuestion={handlePracticeSingleQuestion}
            onStartAdaptivePractice={handleStartAdaptivePractice}
            onStartMicroQuiz={handleStartMicroQuiz}
            onOpenVideoModal={handleOpenVideoModal}
          />
        )}

        {/* VIEW B: EXAM ROOM / SIMULATION ENGINE */}
        {activeTab === 'exam_simulation' && (
          <ExamSimulation
            blueprint={activeExamBlueprint}
            questions={assembleExamQuestions(activeExamBlueprint, currentExamItem, user.examTrack || undefined)}
            studentTrack={user.examTrack || undefined}
            onSwitchTrack={handleTrackSelected}
            onFinishExam={handleFinishExam}
            onCancelExam={() => setActiveTab('exam_list')}
          />
        )}

        {/* VIEW C: EXAM REVIEW WITH BEHAVIORAL DIAGNOSTICS */}
        {activeTab === 'exam_review' && currentExamSession && (
          <ExamReview
            session={currentExamSession}
            questions={assembleExamQuestions(activeExamBlueprint, currentExamItem, currentExamSession.studentTrack || user.examTrack || undefined)}
            masteries={masteries}
            onReturnDashboard={() => setActiveTab('exam_list')}
            onPracticeConcept={(conceptId) => {
              const matched = allQuestions.filter((q) => q.conceptId === conceptId);
              setPracticeQuestions(matched.length > 0 ? matched : allQuestions.slice(0, 3));
            }}
          />
        )}

        {/* VIEW D: EXAM CATALOG & DASHBOARD */}
        {activeTab === 'exam_list' && (
          <ExamsCatalogView
            user={user}
            exams={examsCatalog}
            examHistory={examHistory}
            classResults={classResults}
            allQuestions={allQuestions}
            onStartExam={handleStartExam}
            onViewExamSession={handleViewExamSession}
            onAddCustomExam={handleAddCustomExam}
          />
        )}

        {/* VIEW E: KNOWLEDGE MAP */}
        {activeTab === 'knowledge_map' && (
          <KnowledgeMap
            masteries={masteries}
            onStartPracticeConcept={(conceptId) => {
              const matched = allQuestions.filter((q) => q.conceptId === conceptId);
              setPracticeQuestions(matched.length > 0 ? matched : allQuestions.slice(0, 3));
            }}
            onOpenVideoModal={handleOpenVideoModal}
          />
        )}

        {/* VIEW F: TEACHER DASHBOARD */}
        {activeTab === 'teacher_view' && (user.role === 'teacher' || user.role === 'admin') && (
          <TeacherDashboard
            onOpenVideoModal={() => handleOpenVideoModal()}
            onOpenGoogleWorkspace={() => setShowWorkspaceModal(true)}
          />
        )}

      </main>

      {/* 4. GOOGLE WORKSPACE FLOATING ACTION BAR */}
      <aside className="fixed bottom-6 left-6 z-40">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-2 flex items-center space-x-2">
          <button
            onClick={() => setShowWorkspaceModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer"
            title="Đồng bộ Google Drive & Gửi báo cáo Gmail"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Google Workspace</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <button
            onClick={() => handleOpenVideoModal()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl transition border border-purple-200 cursor-pointer"
            title="Tạo bài giảng video AI 3 phút"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Video AI</span>
          </button>
        </div>
      </aside>

      {/* 5. MODALS */}
      {/* Video Lesson Modal */}
      {showVideoModal && (
        <AIVideoLessonModal
          initialConceptId={videoConceptId}
          onClose={() => {
            setShowVideoModal(false);
            setVideoConceptId(undefined);
          }}
        />
      )}

      {/* Google Workspace Modal (Drive & Gmail) */}
      {showWorkspaceModal && (
        <GoogleWorkspaceModal
          user={user}
          masteries={masteries}
          recentSession={currentExamSession}
          onClose={() => setShowWorkspaceModal(false)}
        />
      )}

      {/* Adaptive Practice / Micro Quiz Modal */}
      {practiceQuestions && (
        <AdaptivePracticeSession
          questions={practiceQuestions}
          initialRecommendation={practiceRecommendation}
          onFinishPractice={handleFinishPracticeSession}
          onClose={() => {
            setPracticeQuestions(null);
            setPracticeRecommendation(undefined);
          }}
        />
      )}

      {showTeacherInvitationModal && (
        <TeacherInvitationModal
          onClose={() => setShowTeacherInvitationModal(false)}
          onRedeemed={auth.refreshProfile}
        />
      )}

      {/* Select Track Modal for Elective Exams */}
      <SelectTrackModal
        isOpen={showSelectTrackModal}
        currentTrack={user.examTrack}
        onSelectTrack={handleTrackSelected}
        onClose={() => {
          setShowSelectTrackModal(false);
          setPendingExamStart(null);
        }}
      />
    </div>
  );
}
