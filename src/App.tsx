import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  StudentMastery,
  ExamSession,
  Question,
  AdaptiveRecommendation,
  AdaptivePracticeResult,
  LearningPathDay,
  ExamBlueprint,
  ExamTrack,
} from './types';
import {
  OFFICIAL_EXAM_BLUEPRINT_2025,
  CONCEPTS_LIST,
} from './data/curriculumData';
import { SAMPLE_QUESTION_BANK } from './data/questionBank';
import { AdaptiveLearningEngine } from './services/adaptiveEngine';
import {
  completeAdaptivePractice,
  PRACTICE_MASTERY_UPDATE_ERROR,
} from './services/practiceCompletion';
import {
  ExamCatalogItem,
  ExamAttemptRecord,
  ClassStudentExamResult,
  INITIAL_EXAMS_CATALOG,
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
import { DiagnosticAssessment } from './components/DiagnosticAssessment';
import { SelectTrackModal } from './components/SelectTrackModal';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { TeacherInvitationModal } from './components/TeacherInvitationModal';
import { AuthenticationRoute } from './components/AuthPages';
import { MemberDirectory } from './components/MemberDirectory';
import { AccountSettingsPage, PublicMemberProfilePage } from './components/MemberPages';
import { supabase } from './services/supabaseClient';
import { createAvatarUrl, getMyMemberProfile, type MemberProfile } from './services/memberService';
import {
  browserMasteryStorage,
  getVerifiedMastery,
  loadUserMasteries,
  saveUserMasteries,
} from './services/masteryStorage';
import {
  browserPreferenceStorage,
  loadLearningMode,
  saveLearningMode,
  type LearningMode,
} from './services/learningPreferences';
import {
  browserExamHistoryStorage,
  loadUserExamHistory,
  saveUserExamHistory,
} from './services/examHistoryStorage';

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

interface MasteryState {
  userId: string;
  masteries: Record<string, StudentMastery>;
  canPersist: boolean;
}

interface LearningModeState {
  userId: string;
  mode: LearningMode;
  canPersist: boolean;
}

interface ExamHistoryState {
  userId: string;
  records: ExamAttemptRecord[];
  canPersist: boolean;
}

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

function pageFromLocation(): { tab: string; username: string | null } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/members') return { tab: 'member_directory', username: null };
  if (path.startsWith('/members/')) {
    return { tab: 'public_profile', username: decodeURIComponent(path.slice('/members/'.length)) };
  }
  if (path === '/settings') return { tab: 'account_settings', username: null };
  return { tab: 'dashboard', username: null };
}

function TinMasterApp() {
  const auth = useAuth();
  const initialPage = pageFromLocation();
  const [activeTab, setActiveTab] = useState<string>(initialPage.tab);
  const [profileTarget, setProfileTarget] = useState<string | null>(initialPage.username);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [memberAvatarUrl, setMemberAvatarUrl] = useState<string | null>(null);

  // 1. User State
  const [userState, setUser] = useState<UserProfile>({
    id: '',
    name: '',
    email: '',
    role: 'student',
    targetScore: 8.5,
    completedQuestionsCount: 0,
    streakDays: 0,
    xp: 0,
    researchGroup: 'unassigned',
    totalStudyMinutes: 0,
  });

  // 2. Knowledge Mastery State (Bayesian Knowledge Tracing)
  const activeUserId = auth.status === 'authenticated' ? auth.profile?.id ?? null : null;
  const [masteryState, setMasteryState] = useState<MasteryState | null>(null);
  const [learningModeState, setLearningModeState] = useState<LearningModeState | null>(null);
  const [practiceOwnerId, setPracticeOwnerId] = useState<string | null>(null);
  const [currentExamSession, setCurrentExamSession] = useState<ExamSession | null>(null);
  const [currentExamSessionOwnerId, setCurrentExamSessionOwnerId] = useState<string | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[] | null>(null);
  const [practiceRecommendation, setPracticeRecommendation] = useState<AdaptiveRecommendation | undefined>(undefined);
  const [examHistoryState, setExamHistoryState] = useState<ExamHistoryState | null>(null);

  useEffect(() => {
    if (!activeUserId) return;
    const loaded = loadUserMasteries(browserMasteryStorage, activeUserId);
    const loadedLearningMode = loadLearningMode(browserPreferenceStorage, activeUserId);
    const loadedExamHistory = loadUserExamHistory(browserExamHistoryStorage, activeUserId);
    setPracticeQuestions(null);
    setPracticeOwnerId(null);
    setPracticeRecommendation(undefined);
    setCurrentExamSession(null);
    setCurrentExamSessionOwnerId(null);
    setUser((prev) => ({
      ...prev,
      completedQuestionsCount: 0,
      streakDays: 0,
      xp: 0,
      totalStudyMinutes: 0,
    }));
    setMasteryState({
      userId: activeUserId,
      masteries: loaded.masteries,
      canPersist: loaded.canPersist,
    });
    setLearningModeState({
      userId: activeUserId,
      mode: loadedLearningMode.mode,
      canPersist: loadedLearningMode.canPersist,
    });
    setExamHistoryState({
      userId: activeUserId,
      records: loadedExamHistory.records,
      canPersist: loadedExamHistory.canPersist,
    });
  }, [activeUserId]);

  const masteries = masteryState?.userId === activeUserId
    ? masteryState.masteries
    : {};
  const learningMode = learningModeState?.userId === activeUserId
    ? learningModeState.mode
    : 'structured';
  const examHistory = examHistoryState?.userId === activeUserId
    ? examHistoryState.records
    : [];
  const visibleExamSession = currentExamSessionOwnerId === activeUserId
    ? currentExamSession
    : null;

  const setMasteries = (nextMasteries: Record<string, StudentMastery>) => {
    if (!activeUserId) return;
    setMasteryState((current) => ({
      userId: activeUserId,
      masteries: nextMasteries,
      canPersist: current?.userId === activeUserId ? current.canPersist : true,
    }));
  };

  const setOwnedPracticeQuestions = (questions: Question[]) => {
    setPracticeOwnerId(activeUserId);
    setPracticeQuestions(questions);
  };

  const handleLearningModeChange = async (mode: LearningMode) => {
    if (!activeUserId) throw new Error('Đăng nhập để lưu phương pháp học.');
    if (learningModeState?.userId === activeUserId && !learningModeState.canPersist) {
      throw new Error('Tùy chọn học tập đã lưu không hợp lệ; TinMaster không ghi đè dữ liệu đó.');
    }
    if (!saveLearningMode(browserPreferenceStorage, activeUserId, mode)) {
      throw new Error('Không thể lưu phương pháp học trên thiết bị này.');
    }
    setLearningModeState({ userId: activeUserId, mode, canPersist: true });
  };

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
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [videoConceptId, setVideoConceptId] = useState<string | undefined>(undefined);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [showTeacherInvitationModal, setShowTeacherInvitationModal] = useState(false);
  const [showDiagnosticAssessment, setShowDiagnosticAssessment] = useState(false);
  const [diagnosticResultRefreshKey, setDiagnosticResultRefreshKey] = useState(0);
  const [showSelectTrackModal, setShowSelectTrackModal] = useState<boolean>(false);
  const [pendingExamStart, setPendingExamStart] = useState<{ blueprint: ExamBlueprint; examItem?: ExamCatalogItem } | null>(null);

  // 4. Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (
      activeUserId &&
      masteryState?.userId === activeUserId &&
      !masteryState.canPersist
    ) {
      showToast('Không thể xác nhận dữ liệu tiến độ đã lưu; dữ liệu hiện có sẽ không bị ghi đè.');
    }
  }, [activeUserId, masteryState]);

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

  const [classResults] = useState<ClassStudentExamResult[]>([]);
  const [activeExamBlueprint, setActiveExamBlueprint] = useState<ExamBlueprint>(OFFICIAL_EXAM_BLUEPRINT_2025);
  const [currentExamItem, setCurrentExamItem] = useState<ExamCatalogItem | undefined>(undefined);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !supabase) {
      setMemberProfile(null);
      setMemberAvatarUrl(null);
      return;
    }

    const client = supabase;
    let active = true;
    void getMyMemberProfile(client)
      .then(async (profile) => {
        const avatarUrl = await createAvatarUrl(client, profile.avatarPath);
        if (active) {
          setMemberProfile(profile);
          setMemberAvatarUrl(avatarUrl);
        }
      })
      .catch(() => {
        if (active) {
          setMemberProfile(null);
          setMemberAvatarUrl(null);
        }
      });
    return () => { active = false; };
  }, [auth.status, auth.profile?.id, auth.profile?.displayName]);

  useEffect(() => {
    const handlePopState = () => {
      const page = pageFromLocation();
      setActiveTab(page.tab);
      setProfileTarget(page.username);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (tab: string, username?: string | null) => {
    setActiveTab(tab);
    setProfileTarget(username ?? null);
    const path = tab === 'member_directory'
      ? '/members'
      : tab === 'account_settings'
        ? '/settings'
        : tab === 'public_profile' && username
          ? `/members/${encodeURIComponent(username)}`
          : '/';
    window.history.pushState({}, '', path);
  };

  const handleMemberProfileSaved = (profile: MemberProfile) => {
    setMemberProfile(profile);
    if (supabase) {
      void createAvatarUrl(supabase, profile.avatarPath)
        .then(setMemberAvatarUrl)
        .catch(() => setMemberAvatarUrl(null));
    }
  };

  const user: UserProfile = auth.profile
    ? {
      ...userState,
      id: auth.profile.id,
      name: memberProfile?.displayName ?? auth.profile.displayName,
      email: auth.profile.email,
      role: auth.profile.role,
      avatarUrl: memberAvatarUrl ?? auth.profile.avatarUrl,
      school: auth.profile.school,
      grade: auth.profile.grade,
      examTrack: memberProfile ? memberProfile.examTrack : auth.profile.examTrack ?? userState.examTrack,
      targetScore: auth.profile.targetScore,
    }
    : userState;

  useEffect(() => {
    if (
      activeUserId &&
      masteryState?.userId === activeUserId &&
      masteryState.canPersist
    ) {
      if (!saveUserMasteries(browserMasteryStorage, activeUserId, masteryState.masteries)) {
        showToast('Không thể lưu tiến độ trên thiết bị này; thay đổi mới chỉ còn trong phiên hiện tại.');
      }
    }
  }, [activeUserId, masteryState]);

  // Derive dynamic adaptive recommendations & roadmap
  const recommendations = AdaptiveLearningEngine.getAdaptiveRecommendations(
    masteries,
    allQuestions,
    3,
    [],
    learningMode
  );

  const learningPath: LearningPathDay[] = AdaptiveLearningEngine.generate7DayLearningPath(
    masteries,
    learningMode
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
      setCurrentExamSessionOwnerId(activeUserId);
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
      setCurrentExamSessionOwnerId(activeUserId);
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
    setCurrentExamSessionOwnerId(activeUserId);

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

    if (!activeUserId) return;
    const updatedHistory = [newAttempt, ...examHistory];
    const currentHistoryCanPersist =
      examHistoryState?.userId !== activeUserId || examHistoryState.canPersist;
    const saved = currentHistoryCanPersist &&
      saveUserExamHistory(browserExamHistoryStorage, activeUserId, updatedHistory);
    setExamHistoryState({
      userId: activeUserId,
      records: updatedHistory,
      canPersist: currentHistoryCanPersist && saved,
    });
    if (!saved) {
      showToast('Không thể lưu lịch sử bài thi; dữ liệu cũ được giữ nguyên trên thiết bị.');
    }

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
      setOwnedPracticeQuestions([rec.question]);
    } else if (recommendations[0]) {
      setPracticeRecommendation(recommendations[0]);
      setOwnedPracticeQuestions([recommendations[0].question]);
    } else {
      setOwnedPracticeQuestions(allQuestions.slice(0, 3));
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
          weaknessScore: 0.5,
          recencyScore: 0.6,
          difficultyFitScore: 0.8,
          importanceScore: 0.8,
          textExplanation: 'Luyện tập câu hỏi theo lựa chọn của học sinh trong ngân hàng bài tập.',
        },
      });
    }
    setOwnedPracticeQuestions([question]);
  };

  // Start Micro-quiz (3 or 5 questions)
  const handleStartMicroQuiz = (count: number) => {
    const diagnosticConcepts = [...CONCEPTS_LIST].sort((a, b) => {
      const masteryA = getVerifiedMastery(masteries, a.id);
      const masteryB = getVerifiedMastery(masteries, b.id);
      if (masteryA && masteryB) return masteryA.masteryScore - masteryB.masteryScore;
      if (masteryA) return -1;
      if (masteryB) return 1;
      return b.importanceWeight - a.importanceWeight;
    });

    const diagnosticConceptIds = diagnosticConcepts.slice(0, 3).map((c) => c.id);
    const selected = allQuestions.filter((q) => diagnosticConceptIds.includes(q.conceptId)).slice(0, count);

    setOwnedPracticeQuestions(selected.length > 0 ? selected : allQuestions.slice(0, count));
    setPracticeRecommendation(undefined);
  };

  // Finish Practice session
  const handleFinishPracticeSession = (results: AdaptivePracticeResult[]) => {
    const correctCount = results.filter((result) => result.isCorrect).length;
    completeAdaptivePractice(
      masteries,
      results,
      (currentMasteries, practiceResults) =>
        AdaptiveLearningEngine.updateMasteriesFromPracticeResults(currentMasteries, practiceResults),
      (updatedMasteries) => {
        setMasteries(updatedMasteries);
        setPracticeQuestions(null);
        setPracticeOwnerId(null);
        setPracticeRecommendation(undefined);

        setUser((prev) => ({
          ...prev,
          completedQuestionsCount: prev.completedQuestionsCount + results.length,
          xp: prev.xp + results.length * 15,
        }));

        showToast(`Đã hoàn thành! Đúng ${correctCount}/${results.length} câu. +${results.length * 15} XP!`);
      },
      (message) => showToast(message)
    );
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
        memberUsername={memberProfile?.username ?? undefined}
        memberAvatarUrl={memberAvatarUrl}
        onSignOut={() => void auth.signOut()}
        onRedeemTeacherInvitation={() => setShowTeacherInvitationModal(true)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'member_directory') navigateTo('member_directory');
          else if (tab === 'account_settings') navigateTo('account_settings');
          else if (tab === 'public_profile') {
            if (memberProfile?.username) navigateTo('public_profile', memberProfile.username);
            else navigateTo('account_settings');
          } else {
            setActiveTab(tab);
            if (['dashboard', 'adaptive_practice', 'exam_list', 'knowledge_map', 'teacher_view'].includes(tab)) {
              window.history.pushState({}, '', '/');
            }
          }
        }}
        onOpenOwnProfile={() => {
          if (memberProfile?.username) navigateTo('public_profile', memberProfile.username);
          else navigateTo('account_settings');
        }}
        onOpenAccountSettings={() => navigateTo('account_settings')}
        onOpenVideoModal={() => handleOpenVideoModal()}
        onOpenGoogleWorkspace={() => setShowWorkspaceModal(true)}
        onOpenTrackModal={() => setShowSelectTrackModal(true)}
        onSelectTrack={handleTrackSelected}
      />

      {/* 2. FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[60] bg-[#1a1a1a] text-white px-4 py-2.5 rounded shadow-lg flex items-center space-x-2 text-xs font-semibold border border-[#d1d5db]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER - Expanded Width (90-95% viewport on desktop) */}
      <main className="flex-1 w-full max-w-[95%] 2xl:max-w-[1850px] mx-auto px-3 sm:px-5 lg:px-7 py-6">
        {/* VIEW A: STUDENT DASHBOARD */}
        {activeTab === 'dashboard' && (
          <StudentDashboard
            key={activeUserId ?? 'signed-out'}
            user={user}
            masteries={masteries}
            recommendations={recommendations}
            learningPath={learningPath}
            learningMode={learningMode}
            learningModeReady={learningModeState?.userId === activeUserId}
            learningModeCanPersist={learningModeState?.canPersist ?? true}
            onChangeLearningMode={handleLearningModeChange}
            onSaveTargetScore={auth.updateTargetScore}
            canEditTargetScore={Boolean(auth.profile)}
            showStudentLearningControls={user.role === 'student'}
            onStartExam={handleStartExam}
            onStartDiagnosticAssessment={user.role === 'student' && activeUserId
              ? () => setShowDiagnosticAssessment(true)
              : undefined}
            diagnosticResultRefreshKey={diagnosticResultRefreshKey}
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
            key={activeUserId ?? 'signed-out'}
            blueprint={activeExamBlueprint}
            questions={assembleExamQuestions(activeExamBlueprint, currentExamItem, user.examTrack || undefined)}
            studentTrack={user.examTrack || undefined}
            onSwitchTrack={handleTrackSelected}
            onFinishExam={handleFinishExam}
            onCancelExam={() => setActiveTab('exam_list')}
          />
        )}

        {/* VIEW C: EXAM REVIEW WITH BEHAVIORAL DIAGNOSTICS */}
        {activeTab === 'exam_review' && visibleExamSession && (
          <ExamReview
            session={visibleExamSession}
            questions={assembleExamQuestions(activeExamBlueprint, currentExamItem, visibleExamSession.studentTrack || user.examTrack || undefined)}
            masteries={masteries}
            onReturnDashboard={() => setActiveTab('exam_list')}
            onPracticeConcept={(conceptId) => {
              const matched = allQuestions.filter((q) => q.conceptId === conceptId);
              setOwnedPracticeQuestions(matched.length > 0 ? matched : allQuestions.slice(0, 3));
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
              setOwnedPracticeQuestions(matched.length > 0 ? matched : allQuestions.slice(0, 3));
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

        {activeTab === 'member_directory' && (
          <MemberDirectory
            onOpenMember={(username) => navigateTo('public_profile', username)}
          />
        )}

        {activeTab === 'public_profile' && (
          <PublicMemberProfilePage
            username={profileTarget ?? memberProfile?.username ?? ''}
            ownProfile={memberProfile}
            onBack={() => navigateTo('member_directory')}
            onOpenSettings={() => navigateTo('account_settings')}
          />
        )}

        {activeTab === 'account_settings' && (
          <AccountSettingsPage
            email={auth.profile?.email ?? ''}
            grade={auth.profile?.grade}
            onBack={() => navigateTo('dashboard')}
            onSaved={handleMemberProfileSaved}
            onGradeSaved={auth.refreshProfile}
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
          recentSession={visibleExamSession}
          onClose={() => setShowWorkspaceModal(false)}
        />
      )}

      {/* Adaptive Practice / Micro Quiz Modal */}
      {practiceQuestions && practiceOwnerId === activeUserId && activeUserId && (
        <AdaptivePracticeSession
          key={activeUserId ?? 'signed-out'}
          questions={practiceQuestions}
          initialRecommendation={practiceRecommendation}
          onFinishPractice={handleFinishPracticeSession}
          onClose={() => {
            setPracticeQuestions(null);
            setPracticeOwnerId(null);
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

      {showDiagnosticAssessment && activeUserId && user.role === 'student' && (
        <DiagnosticAssessment
          key={activeUserId}
          userId={activeUserId}
          onResultAvailable={() => setDiagnosticResultRefreshKey((key) => key + 1)}
          onClose={() => setShowDiagnosticAssessment(false)}
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
