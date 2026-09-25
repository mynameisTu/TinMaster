import React, { useMemo } from 'react';
import {
  UserProfile,
  StudentMastery,
  AdaptiveRecommendation,
  LearningPathDay,
  Question,
  ExamTrack,
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { SAMPLE_QUESTION_BANK } from '../data/questionBank';
import { TOP_LEADERBOARD_USERS } from '../data/leaderboardData';
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

interface StudentDashboardProps {
  user: UserProfile;
  masteries: Record<string, StudentMastery>;
  recommendations: AdaptiveRecommendation[];
  learningPath: LearningPathDay[];
  onStartExam: () => void;
  onSelectTrack?: (track: ExamTrack) => void;
  onOpenTrackModal?: () => void;
  onStartAdaptivePractice: (recommendation?: AdaptiveRecommendation) => void;
  onStartMicroQuiz: (questionCount: number) => void;
  onOpenVideoModal: (conceptId?: string) => void;
  onNavigateToKnowledgeMap: () => void;
  onNavigateToExercises?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  masteries,
  recommendations,
  learningPath,
  onStartExam,
  onSelectTrack,
  onOpenTrackModal,
  onStartAdaptivePractice,
  onStartMicroQuiz,
  onOpenVideoModal,
  onNavigateToKnowledgeMap,
  onNavigateToExercises,
}) => {
  // Tính điểm năng lực trung bình ước lượng (quy đổi thang 10)
  const masteryValues = Object.values(masteries);
  const avgMastery =
    masteryValues.length > 0
      ? masteryValues.reduce((acc, curr) => acc + curr.masteryScore, 0) / masteryValues.length
      : 0.74;
  const estimatedScore = Math.min(9.8, Math.max(4.0, Math.round(avgMastery * 100) / 10));
  const progressPercent = Math.min(100, Math.round((estimatedScore / 10.0) * 100));

  // Xác định 3 điểm yếu nhất cần củng cố
  const weakConcepts = CONCEPTS_LIST.map((concept) => {
    const score = masteries[concept.id]?.masteryScore ?? 0.5;
    return {
      concept,
      score: Math.round(score * 100),
    };
  })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Xếp hạng học sinh (Leaderboard) kết hợp điểm XP thực tế của người dùng hiện tại
  const leaderboardData = useMemo(() => {
    const list = [...TOP_LEADERBOARD_USERS];
    const initials = (user.name || 'NT')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const currentUserEntry = {
      id: user.id,
      rank: 0,
      name: user.name,
      school: 'THPT của bạn',
      avatarText: initials || 'HS',
      avatarColor: 'bg-blue-100 text-blue-800 border-blue-300',
      xp: user.xp,
      streakDays: user.streakDays,
      accuracyPercent: 84,
      isCurrentUser: true,
    };

    const combined = [...list, currentUserEntry].sort((a, b) => b.xp - a.xp);
    const ranked = combined.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    const currentRank = ranked.find((r) => r.isCurrentUser)?.rank || 8;
    const topFive = ranked.slice(0, 5);
    const isUserInTopFive = topFive.some((r) => r.isCurrentUser);

    return {
      topFive,
      userRank: currentRank,
      isUserInTopFive,
      currentUserEntry: { ...currentUserEntry, rank: currentRank },
    };
  }, [user.id, user.name, user.xp, user.streakDays]);

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
                                  weaknessScore: 0.8,
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

            <div className="space-y-3.5 text-[13.5px]">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600 font-medium">Năng lực ước lượng:</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {estimatedScore.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10.0</span>
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600 font-medium">Mục tiêu điểm số:</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {user.targetScore.toFixed(1)}
                </span>
              </div>

              {/* Progress bar towards target */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Tiến độ đạt mục tiêu</span>
                  <span className="font-mono font-medium">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 space-y-2.5 text-slate-600 text-[13px]">
                <div className="flex justify-between">
                  <span>Khoảng cách mục tiêu:</span>
                  <span className="font-medium text-slate-800">
                    {user.targetScore > estimatedScore
                      ? `Cần thêm +${(user.targetScore - estimatedScore).toFixed(1)}đ`
                      : 'Đã đạt mục tiêu'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Số câu hỏi đã hoàn thành:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {user.completedQuestionsCount} câu
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Chế độ thuật toán:</span>
                  <span className="font-medium text-slate-800">Thích ứng Bayesian (BKT)</span>
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

          {/* Card 2: Bảng Xếp Hạng Tuần */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="text-[15px] font-semibold text-slate-900">Bảng xếp hạng tuần</h2>
              </div>
              <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Tuần 38
              </span>
            </div>

            <p className="text-[13px] text-slate-500 mb-3.5">
              Học sinh tích cực ôn luyện và dẫn đầu điểm kinh nghiệm.
            </p>

            <div className="space-y-2">
              {leaderboardData.topFive.map((student) => {
                const isUser = student.isCurrentUser;
                const rankBadgeClass =
                  student.rank === 1
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                    : student.rank === 2
                    ? 'bg-slate-200 text-slate-800 border-slate-300 font-semibold'
                    : student.rank === 3
                    ? 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
                    : 'bg-slate-100 text-slate-600 border-slate-200 font-normal';

                return (
                  <div
                    key={student.id}
                    className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 ${
                      isUser
                        ? 'bg-slate-100/80 border-slate-300 ring-1 ring-slate-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] shrink-0 border ${rankBadgeClass}`}
                      >
                        {student.rank}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border ${student.avatarColor}`}
                      >
                        {student.avatarText}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{student.name}</span>
                          {isUser && (
                            <span className="px-1.5 py-0.2 bg-slate-800 text-white text-[9px] font-semibold rounded shrink-0">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={student.school}>
                          {student.school}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-semibold text-xs text-slate-800">
                        {student.xp.toLocaleString()} XP
                      </span>
                      <div className="text-[10px] text-slate-400">
                        Chuỗi {student.streakDays}n
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If user is not in top 5, show their rank separately below */}
            {!leaderboardData.isUserInTopFive && (
              <div className="pt-3 mt-3 border-t border-slate-200">
                <div className="p-2 bg-slate-100/80 border border-slate-300 rounded-lg flex items-center justify-between ring-1 ring-slate-300 shadow-2xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300 shrink-0">
                      #{leaderboardData.userRank}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {leaderboardData.currentUserEntry.avatarText}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="truncate">{user.name}</span>
                        <span className="px-1.5 py-0.2 bg-slate-800 text-white text-[9px] font-bold rounded">
                          Bạn
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Bạn đang xếp hạng #{leaderboardData.userRank}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {user.xp.toLocaleString()} XP
                    </span>
                    <div className="text-[10px] text-emerald-700 font-medium">
                      +15 XP mỗi câu
                    </div>
                  </div>
                </div>
              </div>
            )}
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

          {/* Card 4: 3 Điểm yếu cần khắc phục */}
          <div className="panel">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">3 Điểm yếu cần củng cố</h2>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Nhận diện tự động từ các câu làm sai và thời gian phản xạ.
            </p>

            <div className="space-y-2.5">
              {weakConcepts.map(({ concept, score }) => (
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

