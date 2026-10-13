import React, { useEffect, useRef, useState } from 'react';
import {
  UserProfile,
  StudentMastery,
  AdaptiveRecommendation,
  LearningPathDay,
  Question,
  ExamTrack,
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { getVerifiedMastery } from '../services/masteryStorage';
import type { LearningMode } from '../services/learningPreferences';
import { validateTargetScore } from '../services/authService';
import {
  getLatestDiagnosticAssessmentResult,
  normalizeDiagnosticCompetencyScore,
} from '../services/diagnosticAssessment';
import type { DiagnosticAssessmentResult } from '../services/diagnosticAssessment';
import { LEADERBOARD_EMPTY_STATE } from '../data/leaderboard';
import { SAMPLE_QUESTION_BANK } from '../data/questionBank';
import {
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Calendar,
  Trophy,
  Code2,
  Globe,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ClassroomStudentSection } from './ClassroomStudentSection';

interface StudentDashboardProps {
  user: UserProfile;
  masteries: Record<string, StudentMastery>;
  recommendations: AdaptiveRecommendation[];
  learningPath: LearningPathDay[];
  learningMode: LearningMode;
  learningModeReady: boolean;
  learningModeCanPersist: boolean;
  onChangeLearningMode: (mode: LearningMode) => Promise<void>;
  onSaveTargetScore: (targetScore: number) => Promise<void>;
  canEditTargetScore: boolean;
  showStudentLearningControls: boolean;
  onStartExam: () => void;
  onStartDiagnosticAssessment?: () => void;
  diagnosticResultRefreshKey?: number;
  onSelectTrack?: (track: ExamTrack) => void;
  onOpenTrackModal?: () => void;
  onStartAdaptivePractice: (recommendation?: AdaptiveRecommendation) => void;
  onStartMicroQuiz: (questionCount: number) => void;
  onOpenVideoModal: (conceptId?: string) => void;
  onNavigateToKnowledgeMap: () => void;
  onNavigateToExercises?: () => void;
  client?: SupabaseClient | null;
}

export function showTargetScoreDialog(
  dialog: Pick<HTMLDialogElement, 'open' | 'showModal'> | null,
  focusTarget: Pick<HTMLElement, 'focus'> | null,
  setEditing: (editing: boolean) => void
): void {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  focusTarget?.focus();
  setEditing(true);
}

export function startDiagnosticAssessmentFlow(
  onStartAssessment: (() => void) | undefined
): boolean {
  if (!onStartAssessment) return false;
  onStartAssessment();
  return true;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  masteries,
  recommendations,
  learningPath,
  learningMode,
  learningModeReady,
  learningModeCanPersist,
  onChangeLearningMode,
  onSaveTargetScore,
  canEditTargetScore,
  showStudentLearningControls,
  onStartExam,
  onStartDiagnosticAssessment,
  diagnosticResultRefreshKey = 0,
  onSelectTrack,
  onOpenTrackModal,
  onStartAdaptivePractice,
  onStartMicroQuiz,
  onOpenVideoModal,
  onNavigateToKnowledgeMap,
  onNavigateToExercises,
  client,
}) => {
  const [editingTarget, setEditingTarget] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(user.targetScore.toFixed(1));
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetSuccess, setTargetSuccess] = useState<string | null>(null);
  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [modeSuccess, setModeSuccess] = useState<string | null>(null);
  const [competencyLoadState, setCompetencyLoadState] = useState<
    'loading' | 'empty' | 'ready' | 'error'
  >(() => user.role === 'student' ? 'loading' : 'empty');
  const [competencyResult, setCompetencyResult] = useState<DiagnosticAssessmentResult | null>(null);
  const [competencyRetryKey, setCompetencyRetryKey] = useState(0);
  const hasValidTarget = validateTargetScore(user.targetScore) === null;
  const targetDialogRef = useRef<HTMLDialogElement>(null);
  const targetScoreSelectRef = useRef<HTMLSelectElement>(null);
  const targetEditButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (user.role !== 'student') {
      setCompetencyResult(null);
      setCompetencyLoadState('empty');
      return;
    }
    let current = true;
    setCompetencyLoadState('loading');
    getLatestDiagnosticAssessmentResult()
      .then(({ result }) => {
        if (!current) return;
        setCompetencyResult(result);
        setCompetencyLoadState(
          normalizeDiagnosticCompetencyScore(result) !== null ? 'ready' : 'empty'
        );
      })
      .catch(() => {
        if (!current) return;
        setCompetencyResult(null);
        setCompetencyLoadState('error');
      });
    return () => {
      current = false;
    };
  }, [user.id, user.role, diagnosticResultRefreshKey, competencyRetryKey]);

  useEffect(() => {
    setSelectedTarget(
      validateTargetScore(user.targetScore) === null
        ? user.targetScore.toFixed(1)
        : '1.0'
    );
    setEditingTarget(false);
  }, [user.id, user.targetScore]);

  useEffect(() => {
    const dialog = targetDialogRef.current;
    if (!dialog) return;
    if (editingTarget && !dialog.open) {
      dialog.showModal();
      targetScoreSelectRef.current?.focus();
    } else if (!editingTarget && dialog.open) {
      dialog.close();
      targetEditButtonRef.current?.focus();
    }
  }, [editingTarget]);

  const cancelTargetEdit = () => {
    setSelectedTarget(hasValidTarget ? user.targetScore.toFixed(1) : '1.0');
    setEditingTarget(false);
    setTargetError(null);
  };

  const handleSaveTarget = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetScore = Number(selectedTarget);
    const validationError = validateTargetScore(targetScore);
    if (validationError) {
      setTargetError(validationError);
      return;
    }
    setTargetSaving(true);
    setTargetError(null);
    setTargetSuccess(null);
    try {
      await onSaveTargetScore(targetScore);
      setEditingTarget(false);
      setTargetSuccess('Đã lưu mục tiêu điểm thi.');
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : 'Không thể lưu mục tiêu điểm thi.');
    } finally {
      setTargetSaving(false);
    }
  };

  const handleLearningModeChange = async (mode: LearningMode) => {
    setModeSaving(true);
    setModeError(null);
    setModeSuccess(null);
    try {
      await onChangeLearningMode(mode);
      setModeSuccess('Đã lưu phương pháp học cho tài khoản này.');
    } catch (error) {
      setModeError(error instanceof Error ? error.message : 'Không thể lưu phương pháp học.');
    } finally {
      setModeSaving(false);
    }
  };

  // Only recorded attempts can identify areas to reinforce.
  const weakConcepts = CONCEPTS_LIST.map((concept) => {
    const mastery = getVerifiedMastery(masteries, concept.id);
    if (!mastery) return null;
    return {
      concept,
      score: Math.round(mastery.masteryScore * 100),
    };
  })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Danh sách bài tập mới nhất từ ngân hàng đề mẫu
  const recentExercises: {
    id: string;
    displayId: string;
    title: string;
    acRatio: string;
    difficulty: 'easy' | 'medium' | 'hard';
    question: Question;
  }[] = [
    {
      id: 'Q_CS10_PY_01',
      displayId: '#001',
      title: 'Thuật toán tìm kiếm nhị phân trong dãy sắp thứ tự (Python)',
      acRatio: '72%',
      difficulty: 'easy',
      question: SAMPLE_QUESTION_BANK[5] || SAMPLE_QUESTION_BANK[0],
    },
    {
      id: 'Q_CS10_PY_02',
      displayId: '#002',
      title: 'Tối ưu hóa cấu trúc dữ liệu mảng và danh sách List',
      acRatio: '45%',
      difficulty: 'medium',
      question: SAMPLE_QUESTION_BANK[6] || SAMPLE_QUESTION_BANK[1],
    },
    {
      id: 'Q_CS11_NET_01',
      displayId: '#003',
      title: 'Bài tập về mô hình mạng TCP/IP & Giao thức IP',
      acRatio: '30%',
      difficulty: 'hard',
      question: SAMPLE_QUESTION_BANK[4] || SAMPLE_QUESTION_BANK[2],
    },
    {
      id: 'Q_CS11_DB_01',
      displayId: '#004',
      title: 'Truy vấn SQL lọc điều kiện WHERE & Khóa chính Primary Key',
      acRatio: '58%',
      difficulty: 'medium',
      question: SAMPLE_QUESTION_BANK[2] || SAMPLE_QUESTION_BANK[0],
    },
    {
      id: 'Q_CS12_WEB_01',
      displayId: '#005',
      title: 'Cú pháp thẻ HTML5 và mô hình định dạng CSS Box Model',
      acRatio: '84%',
      difficulty: 'easy',
      question: SAMPLE_QUESTION_BANK[3] || SAMPLE_QUESTION_BANK[1],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Action Quickbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-4 border border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
          <span className="text-base font-semibold text-slate-900 tracking-tight">
            Luyện thi Tin học THPT 2025
          </span>
          {/* Interactive Track Switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onSelectTrack && onSelectTrack('CS')}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center space-x-1 ${
                user.examTrack === 'CS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Định hướng Khoa học máy tính (CS)"
            >
              <Code2 className="w-3 h-3" />
              <span>Khoa học máy tính (CS)</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTrack && onSelectTrack('ICT')}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center space-x-1 ${
                user.examTrack === 'ICT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Định hướng Khoa học ứng dụng / Tin học ứng dụng (ICT)"
            >
              <Globe className="w-3 h-3" />
              <span>Khoa học ứng dụng (ICT)</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => onStartMicroQuiz(5)}
            className="btn-secondary text-xs whitespace-nowrap py-2 px-3.5 cursor-pointer"
            title="Làm bài kiểm tra 5 phút"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Micro-Quiz 5p</span>
          </button>
          {onStartDiagnosticAssessment && (
            <button
              type="button"
              onClick={onStartDiagnosticAssessment}
              className="btn-secondary text-xs whitespace-nowrap py-2 px-3.5 cursor-pointer"
              title="Bắt đầu bài đánh giá có lưu tiến trình trong 25 phút"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Bắt đầu đánh giá</span>
            </button>
          )}
          <button
            onClick={() => onOpenVideoModal()}
            className="btn-secondary text-xs whitespace-nowrap py-2 px-3.5 cursor-pointer"
            title="Tạo video bài học AI 3 phút"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span>Video AI</span>
          </button>
          <button
            onClick={onStartExam}
            className="btn text-xs whitespace-nowrap py-2 px-4.5 cursor-pointer"
            title="Vào phòng thi 50 phút chuẩn quy chế"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Phòng thi 50p</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout: Content (1fr) + Sidebar (380px-420px proportionally) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] lg:grid-cols-[1fr_350px] gap-6 sm:gap-7">
        {/* LEFT COLUMN: TABLES & CORE WORKFLOW */}
        <div className="space-y-6">
          {/* Lớp học của học sinh (Classroom Student Section) */}
          <ClassroomStudentSection client={client} />

          {/* Card 1: Nhiệm vụ luyện tập hôm nay */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200">
              <h2 className="text-[15px] font-semibold text-slate-900">
                Nhiệm vụ luyện tập hôm nay
              </h2>
              <span className="text-xs sm:text-[13px] text-slate-500">
                <span className="font-mono font-medium text-slate-700">{recommendations.length}</span> bài tập đề xuất
              </span>
            </div>

            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="var-table min-w-[540px]">
                <thead>
                  <tr>
                    <th style={{ width: '48%' }}>Bài tập & Gợi ý sư phạm</th>
                    <th style={{ width: '12%' }}>Độ khó</th>
                    <th style={{ width: '16%' }}>Chủ đề</th>
                    <th style={{ width: '12%' }}>Trạng thái</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.length > 0 ? (
                    recommendations.map((rec, index) => {
                      const diffClass =
                        rec.question.difficulty === 'easy'
                          ? 'badge-diff-easy'
                          : rec.question.difficulty === 'medium'
                          ? 'badge-diff-medium'
                          : 'badge-diff-hard';
                      const diffLabel =
                        rec.question.difficulty === 'easy'
                          ? 'Dễ'
                          : rec.question.difficulty === 'medium'
                          ? 'Vừa'
                          : 'Khó';
                      const status = index === 0 ? 'Chưa làm' : 'Đang thực hiện';

                      return (
                        <tr key={`${rec.question.id}-${index}`}>
                          <td>
                            <div className="font-medium text-slate-900 text-[15px] leading-relaxed">
                              {rec.question.stem}
                            </div>
                            <div className="text-[13px] text-slate-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                              <span className="font-medium text-slate-700 shrink-0">Lý do:</span>{' '}
                              <span>{rec.reasons.textExplanation}</span>
                            </div>
                          </td>
                          <td>
                            <span className={diffClass}>
                              {diffLabel}
                            </span>
                          </td>
                          <td className="text-slate-600 text-[13.5px] font-medium">
                            {rec.question.topicId.replace(/_/g, ' ')}
                          </td>
                          <td className="text-[13px] text-slate-500 font-medium">
                            {status}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => onStartAdaptivePractice(rec)}
                              className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer"
                            >
                              {index === 0 ? 'Giải' : 'Tiếp tục'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500 text-sm">
                        Đang tạo danh sách bài tập thích ứng...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Danh sách bài tập mới nhất */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Bài tập chuẩn hóa mới nhất</h2>
                <span className="text-xs sm:text-[13px] text-slate-500">
                  Tuyển chọn từ ngân hàng đề thi chuẩn GDPT 2018
                </span>
              </div>
              {onNavigateToExercises && (
                <button
                  onClick={onNavigateToExercises}
                  className="text-xs sm:text-[13px] font-medium text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="var-table min-w-[520px]">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Mã</th>
                    <th style={{ width: '54%' }}>Tiêu đề bài tập</th>
                    <th style={{ width: '14%' }}>Tỷ lệ đúng</th>
                    <th style={{ width: '11%' }}>Độ khó</th>
                    <th style={{ width: '11%', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExercises.map((ex, exIdx) => {
                    const diffClass =
                      ex.difficulty === 'easy'
                        ? 'badge-diff-easy'
                        : ex.difficulty === 'medium'
                        ? 'badge-diff-medium'
                        : 'badge-diff-hard';
                    const diffLabel =
                      ex.difficulty === 'easy'
                        ? 'Dễ'
                        : ex.difficulty === 'medium'
                        ? 'Vừa'
                        : 'Khó';

                    return (
                      <tr key={`${ex.id}-${exIdx}`}>
                        <td className="font-mono text-[13px] font-medium text-slate-500">{ex.displayId}</td>
                        <td className="font-medium text-slate-900 text-[15px] leading-relaxed">{ex.title}</td>
                        <td className="font-mono text-[13px] font-medium text-slate-600">{ex.acRatio}</td>
                        <td>
                          <span className={diffClass}>{diffLabel}</span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => {
                              onStartAdaptivePractice({
                                question: ex.question,
                                score: 0.85,
                                reasons: {
                                  weaknessScore: 0.5,
                                  recencyScore: 0.6,
                                  difficultyFitScore: 0.9,
                                  importanceScore: 0.7,
                                  textExplanation: 'Bài tập nằm trong danh mục ôn luyện trọng tâm.',
                                },
                              });
                            }}
                            className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
                          >
                            Luyện
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Lộ trình thích ứng 7 ngày (7-Day Adaptive Roadmap) */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Lộ trình học tập thích ứng 7 ngày
              </h2>
              <button
                onClick={onNavigateToKnowledgeMap}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer flex items-center space-x-1"
              >
                <span>Xem bản đồ tri thức</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-2">
              {learningPath.map((day) => {
                const isToday = day.status === 'in_progress';
                const isCompleted = day.status === 'completed';

                return (
                  <div
                    key={day.dayNumber}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                      isToday
                        ? 'bg-slate-50 border-slate-900 shadow-xs'
                        : isCompleted
                        ? 'bg-white border-slate-200 opacity-80'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className={`font-mono text-xs font-semibold ${isToday ? 'text-slate-900' : 'text-slate-500'}`}>
                          Ngày {day.dayNumber}
                        </span>
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                      </div>
                      <p className="font-medium text-slate-900 mt-1.5 line-clamp-2 text-xs leading-snug">
                        {day.conceptName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 mt-1.5">
                        {day.targetMinutes}p • {day.questionCount} câu
                      </p>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-slate-100">
                      {isToday ? (
                        <button
                          onClick={() => onStartAdaptivePractice()}
                          className="w-full btn text-[11px] py-1 px-1 cursor-pointer"
                        >
                          Học ngay
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 block text-center py-0.5 font-medium">
                          {isCompleted ? 'Hoàn thành' : 'Kế tiếp'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ASIDE (Mục tiêu & Tiến độ, Bảng Xếp Hạng, Thông báo, 3 Điểm yếu) */}
        <aside className="space-y-6">
          {/* Card 1: Mục tiêu & Tiến độ học tập */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200">
              <h2 className="text-[15px] font-semibold text-slate-900">Mục tiêu & Tiến độ</h2>
              <span className="text-xs text-slate-500 font-medium">Kỳ thi THPT</span>
            </div>

            {/* Do not infer an exam score from uncalibrated concept-mastery values. */}
            <div className="space-y-3.5 text-[13.5px]">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600 font-medium">Dự đoán điểm thi:</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  Chưa có mô hình dự đoán được kiểm chứng
                </span>
              </div>
              <DiagnosticCompetencyMetric
                state={competencyLoadState}
                score={normalizeDiagnosticCompetencyScore(competencyResult)}
                onRetry={() => setCompetencyRetryKey((key) => key + 1)}
                onStartAssessment={onStartDiagnosticAssessment}
                canStartAssessment={user.role === 'student'}
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600 font-medium">Mục tiêu điểm thi:</span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="font-mono text-lg font-bold text-slate-900">
                      {hasValidTarget ? `${user.targetScore.toFixed(1)} / 10` : 'Chưa chọn'}
                    </span>
                    {canEditTargetScore && (
                      <button
                        ref={targetEditButtonRef}
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={editingTarget}
                        aria-controls="target-score-dialog"
                        onClick={() => {
                          setSelectedTarget(hasValidTarget ? user.targetScore.toFixed(1) : '1.0');
                          setTargetError(null);
                          setTargetSuccess(null);
                          showTargetScoreDialog(
                            targetDialogRef.current,
                            targetScoreSelectRef.current,
                            setEditingTarget
                          );
                        }}
                        className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
                      >
                        Đổi mục tiêu
                      </button>
                    )}
                  </div>
                </div>
                {targetSuccess && <p role="status" className="text-xs text-emerald-700">{targetSuccess}</p>}
                <p className="text-xs text-slate-500">
                  Chưa có mô hình dự đoán điểm thi được kiểm chứng. Hãy hoàn thành bài đánh giá ban đầu để ghi nhận kết quả học tập.
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 space-y-2.5 text-slate-600 text-[13px]">
                <div className="flex justify-between">
                  <span>Số câu hỏi đã hoàn thành:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {user.completedQuestionsCount} câu
                  </span>
                </div>
              </div>

              <button
                onClick={onStartExam}
                className="w-full btn mt-2.5 text-xs py-2.5 justify-center cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Vào phòng thi 50 phút</span>
              </button>
            </div>
          </div>

          {canEditTargetScore && (
            <dialog
              ref={targetDialogRef}
              id="target-score-dialog"
              aria-labelledby="target-score-dialog-title"
              onCancel={(event) => {
                event.preventDefault();
                if (!targetSaving) cancelTargetEdit();
              }}
              className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
            >
              <form onSubmit={(event) => void handleSaveTarget(event)} className="space-y-5 p-5 sm:p-6">
                <div>
                  <h2 id="target-score-dialog-title" className="text-lg font-semibold">
                    Đổi mục tiêu điểm thi
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Chọn điểm mục tiêu từ 1.0 đến 10.0.
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="target-score" className="block text-sm font-medium text-slate-700">
                    Điểm mục tiêu
                  </label>
                  <select
                    ref={targetScoreSelectRef}
                    id="target-score"
                    value={selectedTarget}
                    onChange={(event) => setSelectedTarget(event.target.value)}
                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    disabled={targetSaving}
                  >
                    {Array.from({ length: 19 }, (_, index) => (1 + index * 0.5).toFixed(1)).map((score) => (
                      <option key={score} value={score}>{score} / 10</option>
                    ))}
                  </select>
                </div>
                {targetError && <p role="alert" className="text-sm text-rose-700">{targetError}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={targetSaving}
                    onClick={cancelTargetEdit}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Hủy
                  </button>
                  <button type="submit" disabled={targetSaving} className="btn text-xs py-2 px-3">
                    {targetSaving ? 'Đang lưu…' : 'Lưu mục tiêu'}
                  </button>
                </div>
              </form>
            </dialog>
          )}

          {showStudentLearningControls && (
            <div className="panel">
              <div className="pb-3 mb-3 border-b border-slate-200">
                <h2 className="text-[15px] font-semibold text-slate-900">Learning Method</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Chọn cách sắp xếp bài luyện; lựa chọn này không thay đổi lịch sử kết quả.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Luyện tập theo mục tiêu điểm chưa khả dụng vì hệ thống chưa kiểm chứng cách chuyển mục tiêu thành bài tập phù hợp.
                </p>
              </div>
              <div role="group" aria-label="Learning Method" className="grid gap-2">
                {([
                  {
                    id: 'structured',
                    title: 'Structured Learning Path',
                    description: 'Follow an organized sequence of topics based on the curriculum, with practice progressing through appropriate difficulty levels.',
                  },
                  {
                    id: 'focus_weak',
                    title: 'Focus on Weak Topics',
                    description: 'Prioritize topics where your actual practice results indicate that you need more work.',
                  },
                  {
                    id: 'smart_review',
                    title: 'Smart Review',
                    description: 'Adjust practice recommendations using your previous answers and recorded learning progress.',
                  },
                ] as const).map((option) => {
                  const selected = learningMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={!learningModeReady || modeSaving || !learningModeCanPersist}
                      onClick={() => void handleLearningModeChange(option.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{option.title}</span>
                        {selected && <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{option.description}</span>
                    </button>
                  );
                })}
              </div>
              {!learningModeReady && (
                <p role="status" className="mt-2 text-xs text-slate-500">Đang tải tùy chọn học tập…</p>
              )}
              {!learningModeCanPersist && (
                <p role="alert" className="mt-2 text-xs text-rose-700">
                  Tùy chọn đã lưu không hợp lệ; lựa chọn hiện tại chưa được ghi đè.
                </p>
              )}
              {modeSaving && <p role="status" className="mt-2 text-xs text-slate-500">Đang lưu phương pháp học…</p>}
              {modeSuccess && <p role="status" className="mt-2 text-xs text-emerald-700">{modeSuccess}</p>}
              {modeError && <p role="alert" className="mt-2 text-xs text-rose-700">{modeError}</p>}
            </div>
          )}

          {/* Card 2: Bảng xếp hạng */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="text-[15px] font-semibold text-slate-900">Bảng vàng</h2>
              </div>
            </div>
            <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
              <p className="text-sm text-slate-500">{LEADERBOARD_EMPTY_STATE}</p>
            </div>
          </div>

          {/* Card 3: Thông báo */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Thông báo học tập</h2>
              <span className="text-[11px] text-slate-500 font-medium">Hôm nay</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                <p className="font-medium text-slate-800">Cấu trúc đề minh họa 2025</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">Phần I Trắc nghiệm 4 lựa chọn (6đ) + Phần II Đúng/Sai (4đ).</p>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                <p className="font-medium text-slate-800">Trọng tâm ôn luyện tuần này</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">Tập trung chuyên đề Hệ CSDL Quan hệ & Truy vấn SQL nâng cao.</p>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                <p className="font-medium text-slate-800">Trợ lý AI vi mô</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">Sẵn sàng tạo video tóm tắt kiến thức 3 phút theo yêu cầu.</p>
              </div>
            </div>
          </div>

          {/* Card 4: measured areas for reinforcement */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Chuyên đề cần củng cố</h2>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Nhận diện tự động từ các câu làm sai và thời gian phản xạ.
            </p>

            <div className="space-y-2.5">
              {weakConcepts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Chưa có dữ liệu gắn với tài khoản này để xác định chuyên đề cần củng cố.
                </p>
              ) : weakConcepts.map(({ concept, score }) => (
                <div key={concept.id} className="p-2.5 bg-slate-50/80 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-900 truncate max-w-[180px]" title={concept.name}>
                      {concept.name}
                    </span>
                    <span className={score < 50 ? 'status-gap' : 'status-caution'}>
                      {score}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score < 50 ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.max(10, score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onNavigateToKnowledgeMap}
              className="w-full btn-secondary mt-3.5 text-xs py-2 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Xem phân tích bản đồ tri thức</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export function DiagnosticCompetencyMetric({
  state,
  score,
  onRetry,
  onStartAssessment,
  canStartAssessment,
}: {
  state: 'loading' | 'empty' | 'ready' | 'error';
  score: number | null;
  onRetry: () => void;
  onStartAssessment?: () => void;
  canStartAssessment: boolean;
}) {
  const [startError, setStartError] = useState<string | null>(null);
  const hasScore = state === 'ready' && score !== null;

  return (
    <section aria-label="Điểm năng lực hiện tại" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-slate-600 font-medium">Điểm năng lực hiện tại:</span>
        {state === 'loading' ? (
          <span role="status" className="font-mono text-sm font-semibold text-slate-400">
            Đang tải…
          </span>
        ) : state === 'error' ? (
          <span className="flex items-center gap-2">
            <span role="alert" className="text-xs font-medium text-rose-700">
              Không thể tải
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              Thử lại
            </button>
          </span>
        ) : hasScore ? (
          <span className="font-mono text-lg font-bold tabular-nums text-slate-900">
            {score.toFixed(1)} / 10
          </span>
        ) : (
          <span className="font-mono text-sm font-semibold text-slate-500">
            Chưa đánh giá
          </span>
        )}
      </div>
      {state === 'empty' && (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            disabled={!canStartAssessment || !onStartAssessment}
            onClick={() => {
              setStartError(null);
              if (!startDiagnosticAssessmentFlow(onStartAssessment)) {
                setStartError('Bài đánh giá hiện chưa khả dụng cho tài khoản này.');
              }
            }}
            className="btn-secondary cursor-pointer px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            Làm bài đánh giá
          </button>
          {!canStartAssessment && (
            <p className="text-xs text-slate-500">
              Bài đánh giá chỉ dành cho tài khoản học sinh.
            </p>
          )}
          {canStartAssessment && !onStartAssessment && (
            <p className="text-xs text-slate-500">
              Hãy đăng nhập bằng tài khoản học sinh để bắt đầu đánh giá.
            </p>
          )}
          {startError && <p role="alert" className="text-xs text-rose-700">{startError}</p>}
        </div>
      )}
      {state === 'error' && (
        <>
          <p className="text-[11px] text-slate-500">
            Kết quả chưa tải được; điểm mục tiêu không được dùng thay thế.
          </p>
          {canStartAssessment && (
            <button
              type="button"
              disabled={!onStartAssessment}
              onClick={() => {
                setStartError(null);
                if (!startDiagnosticAssessmentFlow(onStartAssessment)) {
                  setStartError('Bài đánh giá hiện chưa khả dụng cho tài khoản này.');
                }
              }}
              className="btn-secondary cursor-pointer px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              Làm bài đánh giá
            </button>
          )}
          {canStartAssessment && !onStartAssessment && (
            <p className="text-xs text-slate-500">
              Hãy đăng nhập bằng tài khoản học sinh để bắt đầu đánh giá.
            </p>
          )}
          {startError && <p role="alert" className="text-xs text-rose-700">{startError}</p>}
        </>
      )}
      {state === 'empty' && !canStartAssessment && (
        <p className="text-[11px] text-slate-500">Chưa có kết quả đánh giá.</p>
      )}
    </section>
  );
}
