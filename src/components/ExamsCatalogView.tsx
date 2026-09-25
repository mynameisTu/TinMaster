import React, { useState, useMemo } from 'react';
import {
  ExamCatalogItem,
  ExamAttemptRecord,
  ClassStudentExamResult,
  ExamCategory,
} from '../data/examCatalogData';
import { UserProfile, ExamBlueprint, ExamSession, Question } from '../types';
import { CreateExamModal } from './CreateExamModal';
import {
  Play,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Award,
  TrendingUp,
  History,
  BookOpen,
  ArrowRight,
  Sparkles,
  Users,
  Settings,
  ChevronRight,
  RotateCcw,
  Check,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface ExamsCatalogViewProps {
  user: UserProfile;
  exams: ExamCatalogItem[];
  examHistory: ExamAttemptRecord[];
  classResults: ClassStudentExamResult[];
  allQuestions?: Question[];
  onStartExam: (blueprint: ExamBlueprint, examItem?: ExamCatalogItem) => void;
  onViewExamSession?: (attempt: ExamAttemptRecord) => void;
  onAddCustomExam?: (newExam: ExamCatalogItem) => void;
  onToggleExamStatus?: (examId: string) => void;
}

export const ExamsCatalogView: React.FC<ExamsCatalogViewProps> = ({
  user,
  exams,
  examHistory,
  classResults,
  allQuestions,
  onStartExam,
  onViewExamSession,
  onAddCustomExam,
  onToggleExamStatus,
}) => {
  const isTeacherOrAdmin = user.role === 'teacher' || user.role === 'admin';

  // Tabs: 'catalog' | 'history' | 'class_management'
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'history' | 'class_management'>('catalog');

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  // Create Exam Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Map of completed exams for the student
  const completedExamMap = useMemo(() => {
    const map: Record<string, ExamAttemptRecord> = {};
    examHistory.forEach((att) => {
      if (!map[att.examId] || att.score > map[att.examId].score) {
        map[att.examId] = att;
      }
    });
    return map;
  }, [examHistory]);

  // Overall student statistics
  const studentStats = useMemo(() => {
    if (examHistory.length === 0) {
      return { totalAttempts: 0, avgScore: 0, highestScore: 0, totalExamsAvailable: exams.length };
    }
    const totalScore = examHistory.reduce((acc, cur) => acc + cur.score, 0);
    const highest = Math.max(...examHistory.map((h) => h.score));
    return {
      totalAttempts: examHistory.length,
      avgScore: Number((totalScore / examHistory.length).toFixed(2)),
      highestScore: Number(highest.toFixed(2)),
      totalExamsAvailable: exams.length,
    };
  }, [examHistory, exams]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.topicName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || exam.category === selectedCategory;

      const isCompleted = !!completedExamMap[exam.id];
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'completed' && isCompleted) ||
        (selectedStatus === 'not_started' && !isCompleted) ||
        (selectedStatus === 'open' && exam.status === 'open');

      const matchesGrade =
        selectedGrade === 'all' ||
        exam.targetGrade === 'all' ||
        String(exam.targetGrade) === selectedGrade;

      return matchesSearch && matchesCategory && matchesStatus && matchesGrade;
    });
  }, [exams, searchTerm, selectedCategory, selectedStatus, selectedGrade, completedExamMap]);

  // Separate featured exam and others
  const featuredExam = useMemo(() => {
    return exams.find((e) => e.isFeatured) || exams[0];
  }, [exams]);

  // Score distribution for Teacher/Admin View
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: 'Dưới 5.0', count: 0, color: 'bg-red-500' },
      { range: '5.0 - 6.5', count: 0, color: 'bg-amber-500' },
      { range: '6.5 - 8.0', count: 0, color: 'bg-blue-500' },
      { range: '8.0 - 9.0', count: 0, color: 'bg-indigo-500' },
      { range: '9.0 - 10.0', count: 0, color: 'bg-emerald-500' },
    ];

    classResults.forEach((res) => {
      if (res.score < 5.0) buckets[0].count++;
      else if (res.score < 6.5) buckets[1].count++;
      else if (res.score < 8.0) buckets[2].count++;
      else if (res.score < 9.0) buckets[3].count++;
      else buckets[4].count++;
    });

    const total = classResults.length || 1;
    return buckets.map((b) => ({
      ...b,
      percent: Math.round((b.count / total) * 100),
    }));
  }, [classResults]);

  const classAverageScore = useMemo(() => {
    if (classResults.length === 0) return 0;
    const sum = classResults.reduce((acc, c) => acc + c.score, 0);
    return (sum / classResults.length).toFixed(2);
  }, [classResults]);

  return (
    <div className="w-full space-y-8 pb-16">
      {/* 1. TOP HEADER & ROLE ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
              Khảo Thí & Đánh Giá Năng Lực
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Chương trình GDPT 2018 Tin Học THPT
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Trung Tâm Khảo Thí & Kỳ Thi Chuẩn Hóa
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Luyện tập thi thử theo chuẩn định dạng BGDĐT 2025, kiểm tra định kỳ 15 phút, 1 tiết và theo dõi tiến trình điểm số chi tiết.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {isTeacherOrAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Kỳ Thi Mới</span>
            </button>
          )}

          <button
            onClick={() => onStartExam(featuredExam.blueprint, featuredExam)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Thi Thử THPT 2025 (50 Phút)</span>
          </button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!isTeacherOrAdmin ? (
          <>
            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Kỳ thi sẵn có</span>
              <div className="text-2xl font-bold text-slate-900">{exams.length}</div>
              <span className="text-[11px] text-slate-500 block">Đang mở toàn hệ thống</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Số bài đã hoàn thành</span>
              <div className="text-2xl font-bold text-slate-900">{studentStats.totalAttempts}</div>
              <span className="text-[11px] text-slate-500 block">Lần nộp bài thi thử</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Điểm thi trung bình</span>
              <div className="text-2xl font-bold text-slate-900">
                {studentStats.avgScore > 0 ? `${studentStats.avgScore}/10` : '—'}
              </div>
              <span className="text-[11px] text-slate-500 block">Thang điểm 10.0 BGDĐT</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Điểm thi cao nhất</span>
              <div className="text-2xl font-bold text-slate-900">
                {studentStats.highestScore > 0 ? `${studentStats.highestScore}/10` : '—'}
              </div>
              <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-slate-400" />
                <span>Kỷ lục cá nhân</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Tổng số kỳ thi quản lý</span>
              <div className="text-2xl font-bold text-slate-900">{exams.length}</div>
              <span className="text-[11px] text-slate-500 block">Khối 10, 11, 12 THPT</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Lượt học sinh đã thi</span>
              <div className="text-2xl font-bold text-slate-900">{classResults.length}</div>
              <span className="text-[11px] text-slate-500 block">Tỷ lệ nộp bài 94.5%</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Điểm trung bình khối</span>
              <div className="text-2xl font-bold text-slate-900">{classAverageScore}/10</div>
              <span className="text-[11px] text-slate-500 block">Dựa trên các bài thi đã nộp</span>
            </div>

            <div className="card-stat space-y-1">
              <span className="text-xs text-slate-500 font-medium">Học sinh đạt điểm Giỏi (8+)</span>
              <div className="text-2xl font-bold text-slate-900">
                {classResults.filter((c) => c.score >= 8.0).length} / {classResults.length}
              </div>
              <span className="text-[11px] text-slate-500 block">Chiếm 62.5% lớp</span>
            </div>
          </>
        )}
      </div>

      {/* 3. NAVIGATION SUB-TABS */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2 sm:space-x-6">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
              activeSubTab === 'catalog'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Danh sách kỳ thi ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
              activeSubTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Lịch sử làm bài ({examHistory.length})</span>
          </button>

          {isTeacherOrAdmin && (
            <button
              onClick={() => setActiveSubTab('class_management')}
              className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'class_management'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Quản lý & Phổ điểm lớp</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. TAB 1: EXAM CATALOG VIEW */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Tìm kiếm kỳ thi theo tên đề, chuyên đề, thời gian..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 bg-slate-50 focus:bg-white rounded-md border border-slate-200 focus:border-slate-400 focus:outline-none transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto text-xs py-2 px-3 bg-white rounded-md border border-slate-200 text-slate-700 cursor-pointer font-medium"
              >
                <option value="all">Tất cả thể loại</option>
                <option value="national_standard">Chuẩn Tốt nghiệp THPT (50p)</option>
                <option value="test_45m">Kiểm tra 1 tiết (45p)</option>
                <option value="test_15m">Kiểm tra 15 phút</option>
                <option value="survey">Khảo sát năng lực</option>
                <option value="custom">Đề Giáo viên tự tạo</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-auto text-xs py-2 px-3 bg-white rounded-md border border-slate-200 text-slate-700 cursor-pointer font-medium"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="not_started">Chưa làm bài</option>
                <option value="open">Đang mở đề</option>
              </select>

              {/* Grade Filter */}
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full sm:w-auto text-xs py-2 px-3 bg-white rounded-md border border-slate-200 text-slate-700 cursor-pointer font-medium"
              >
                <option value="all">Toàn khối (10, 11, 12)</option>
                <option value="12">Lớp 12</option>
                <option value="11">Lớp 11</option>
                <option value="10">Lớp 10</option>
              </select>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredExams.length === 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-slate-800">
                  Không tìm thấy kỳ thi phù hợp
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Không có kỳ thi nào khớp với bộ lọc &ldquo;{searchTerm}&rdquo;. Hãy thử xóa bộ lọc hoặc chọn tiêu chí khác.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setSelectedStatus('all');
                    setSelectedGrade('all');
                  }}
                  className="btn-secondary text-xs"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            </div>
          )}

          {/* FEATURED EXAM CARD: Clean, intentional assessment task card */}
          {filteredExams.some((e) => e.id === featuredExam.id) && (
            <div className="panel space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Kỳ thi chuẩn hóa Quốc gia
                    </span>
                    <span className="text-slate-300">•</span>
                    {completedExamMap[featuredExam.id] ? (
                      <span className="status-stable">
                        Đã làm: {completedExamMap[featuredExam.id].score}/10 điểm
                      </span>
                    ) : (
                      <span className="status-stable">Đang mở thi thử</span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Phòng Thi Chuẩn Hóa Môn Tin Học
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mô phỏng chuẩn quy chế 764/QĐ-BGDĐT với đồng hồ đếm ngược 50 phút và cơ chế chống thoát màn hình.
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={() => onStartExam(featuredExam.blueprint, featuredExam)}
                    className="btn text-xs py-2.5 px-5 cursor-pointer self-start md:self-auto"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      {completedExamMap[featuredExam.id]
                        ? 'Làm lại bài thi 50 phút'
                        : 'Bắt đầu làm bài 50 phút'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Part I and Part II structured specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1 border border-slate-200">
                  <span className="text-slate-900 font-semibold text-xs block">
                    Phần I: 24 câu trắc nghiệm 4 lựa chọn (6.0 điểm)
                  </span>
                  <p className="text-slate-500 text-[11px]">Mỗi câu trả lời đúng được 0.25 điểm. Bao quát kiến thức chung GDPT 2018.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg space-y-1 border border-slate-200">
                  <span className="text-slate-900 font-semibold text-xs block">
                    Phần II & III: 2 câu Đúng/Sai chung + 2 câu tự chọn (4.0 điểm)
                  </span>
                  <p className="text-slate-500 text-[11px]">
                    Mỗi câu có 4 ý (a, b, c, d). Chấm theo thang điểm lũy tiến 0.1, 0.25, 0.5, 1.0 điểm.
                  </p>
                </div>
              </div>

              {/* Single plain text metadata line */}
              <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between flex-wrap gap-2">
                <span>50 phút • 28 câu hỏi (24 TN + 2 Đ/S chung + 2 Đ/S tự chọn) • Thang điểm 10.0 • Khối 12</span>
                <span className="font-mono text-slate-400">MÃ ĐỀ: THPT-2025-CH01</span>
              </div>
            </div>
          )}

          {/* GRID OF OTHER EXAMS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <span>Danh mục đề kiểm tra & khảo sát</span>
                <span className="text-xs text-slate-500 font-normal">
                  ({filteredExams.length} đề thi)
                </span>
              </h2>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Biên soạn bám sát cấu trúc phân hóa Tin học THPT
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExams
                .filter((exam) => exam.id !== featuredExam.id)
                .map((exam) => {
                  const attempt = completedExamMap[exam.id];

                  return (
                    <div
                      key={exam.id}
                      className="card-compact-row flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        {/* Header: Type and Single Status Indicator */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            {exam.category === 'test_15m'
                              ? 'Kiểm tra 15 phút'
                              : exam.category === 'test_45m'
                              ? 'Kiểm tra 1 tiết'
                              : exam.category === 'survey'
                              ? 'Khảo sát năng lực'
                              : 'Kỳ thi'}
                          </span>

                          {/* EXACTLY ONE status indicator per card */}
                          {attempt ? (
                            <span className="status-stable">
                              Đã làm: {attempt.score}/10đ
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              Chưa làm
                            </span>
                          )}
                        </div>

                        {/* Title & Subtitle */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                            {exam.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {exam.subtitle}
                          </p>
                        </div>

                        {/* Plain text metadata line */}
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center space-x-1.5">
                          <span>{exam.durationMinutes} phút</span>
                          <span>•</span>
                          <span>{exam.totalQuestions} câu</span>
                          <span>•</span>
                          <span>Lớp {exam.targetGrade === 'all' ? '10-12' : exam.targetGrade}</span>
                        </div>

                        {/* Topic note */}
                        <div className="text-[11px] text-slate-600 truncate">
                          Chuyên đề: <span className="font-medium text-slate-800">{exam.topicName}</span>
                        </div>
                      </div>

                      {/* Footer: One Primary Action Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        {exam.questionSource === 'upload_custom' ? (
                          <span className="text-[10px] text-slate-500">Đề tải lên</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Ngân hàng chuẩn</span>
                        )}

                        <div className="flex items-center space-x-2">
                          {attempt && onViewExamSession && (
                            <button
                              onClick={() => onViewExamSession(attempt)}
                              className="btn-ghost text-xs py-1 px-2 cursor-pointer"
                              title="Xem lại bài đã làm"
                            >
                              Xem lại
                            </button>
                          )}

                          <button
                            onClick={() => onStartExam(exam.blueprint, exam)}
                            className="btn-secondary text-xs py-1 px-3 cursor-pointer flex items-center space-x-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>{attempt ? 'Làm lại' : 'Làm bài'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: EXAM HISTORY / RESULTS SECTION (FOR STUDENTS & GENERAL) */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Lịch Sử Làm Bài & Báo Cáo Tiến Trình
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Toàn bộ các lần nộp bài thi thử và kiểm tra định kỳ của bạn trên hệ thống TinMaster.
                </p>
              </div>

              {examHistory.length > 0 && (
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 flex items-center space-x-2 self-start sm:self-auto">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Điểm cao nhất: {studentStats.highestScore}/10.0</span>
                </div>
              )}
            </div>

            {examHistory.length === 0 ? (
              <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                <History className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Chưa có dữ liệu làm bài</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Bạn chưa thực hiện bài thi hoặc bài kiểm tra nào. Hãy chọn một đề thi để bắt đầu làm bài ngay!
                </p>
                <button
                  onClick={() => setActiveSubTab('catalog')}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <span>Khám phá các kỳ thi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-3 px-4 rounded-l-xl">Tên Kỳ Thi / Bài Kiểm Tra</th>
                      <th className="py-3 px-3">Thời Điểm Nộp</th>
                      <th className="py-3 px-3">Điểm Số</th>
                      <th className="py-3 px-3">Số Câu Đúng</th>
                      <th className="py-3 px-3">Thời Gian Làm</th>
                      <th className="py-3 px-3">Xu Hướng</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {examHistory.map((att) => {
                      const minutes = Math.floor(att.durationSeconds / 60);
                      const seconds = att.durationSeconds % 60;

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span>{att.examTitle}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(att.dateTaken).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block ${
                                att.score >= 8.0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : att.score >= 6.5
                                  ? 'bg-blue-100 text-blue-800'
                                  : att.score >= 5.0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {att.score.toFixed(2)} / {att.maxScore.toFixed(1)}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap font-mono">
                            {att.correctCount}/{att.totalQuestions} ({att.accuracy.toFixed(0)}%)
                          </td>

                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                            {minutes}p {seconds < 10 ? `0${seconds}` : seconds}s
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {att.trendDiff !== undefined ? (
                              att.trendDiff > 0 ? (
                                <span className="text-emerald-600 font-bold flex items-center space-x-0.5">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  <span>+{att.trendDiff.toFixed(2)}đ</span>
                                </span>
                              ) : att.trendDiff < 0 ? (
                                <span className="text-red-500 font-bold">
                                  {att.trendDiff.toFixed(2)}đ
                                </span>
                              ) : (
                                <span className="text-slate-400">Ổn định</span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {onViewExamSession && (
                              <button
                                onClick={() => onViewExamSession(att)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem lại bài làm</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 3: TEACHER / ADMIN CLASS MANAGEMENT & AGGREGATE RESULTS */}
      {activeSubTab === 'class_management' && isTeacherOrAdmin && (
        <div className="space-y-8">
          {/* CLASS SCORE DISTRIBUTION & AGGREGATES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Distribution Chart */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Phổ Điểm Toàn Khối (Score Distribution)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Biểu đồ tần số học sinh phân bố theo các dải điểm chuẩn BGDĐT
                  </p>
                </div>
                <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  {classResults.length} bài nộp
                </span>
              </div>

              {/* Bar Visualizer */}
              <div className="space-y-3 pt-2">
                {scoreDistribution.map((item) => (
                  <div key={item.range} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{item.range} điểm</span>
                      <span className="text-slate-500">
                        {item.count} học sinh ({item.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(item.percent, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Teaching Insight Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Khuyến Nghị Sư Phạm AI</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Phân Tích Ma Trận Điểm Khối 12
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Học sinh làm tốt phần trắc nghiệm đơn (Đạt 88% tỷ lệ đúng ở Phần I). Tuy nhiên ở{' '}
                  <strong className="text-slate-900 font-bold">Phần II (Đúng/Sai)</strong>, tỷ lệ đạt trọn 1.0 điểm/câu chỉ đạt{' '}
                  <strong className="text-purple-700 font-bold">38%</strong> do nhầm lẫn câu lệnh truy vấn SQL có điều kiện lồng nhau.
                </p>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-800 space-y-1">
                  <strong>Đề xuất ôn tập:</strong>
                  <p>Mở bài kiểm tra 15 phút tập trung vào các câu hỏi phân loại Đúng/Sai mệnh đề SQL.</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo Đề Ôn Tập Bổ Khuyết</span>
              </button>
            </div>
          </div>

          {/* PER-STUDENT RESULTS TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Bảng Điểm Chi Tiết Theo Từng Học Sinh
                </h3>
                <p className="text-xs text-slate-500">
                  Theo dõi kết quả nộp bài, thời gian hoàn thành và số câu đúng của từng học sinh
                </p>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Đang hiển thị {classResults.length} học sinh
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-3 px-4 rounded-l-xl">Học Sinh</th>
                    <th className="py-3 px-3">Lớp</th>
                    <th className="py-3 px-3">Bài Thi Nộp</th>
                    <th className="py-3 px-3">Điểm Số</th>
                    <th className="py-3 px-3">Số Câu Đúng</th>
                    <th className="py-3 px-3">Thời Gian Làm</th>
                    <th className="py-3 px-3">Ngày Nộp</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {classResults.map((res) => {
                    const mins = Math.floor(res.durationSeconds / 60);
                    const secs = res.durationSeconds % 60;

                    return (
                      <tr key={res.studentId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {res.studentName.charAt(0)}
                          </div>
                          <span>{res.studentName}</span>
                        </td>

                        <td className="py-3.5 px-3 font-semibold text-slate-600">
                          {res.className}
                        </td>

                        <td className="py-3.5 px-3 text-slate-800">
                          {res.examTitle}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block ${
                              res.score >= 8.0
                                ? 'bg-emerald-100 text-emerald-800'
                                : res.score >= 6.5
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {res.score.toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 font-mono">
                          {res.correctCount}/{res.totalQuestions}
                        </td>

                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                          {mins}p {secs < 10 ? `0${secs}` : secs}s
                        </td>

                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                          {res.submittedAt}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-md border border-emerald-200">
                            Đã hoàn thành
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE EXAM MODAL FOR TEACHER / ADMIN */}
      {isCreateModalOpen && (
        <CreateExamModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          availableQuestions={allQuestions}
          onSaveExam={(newExam) => {
            onAddCustomExam?.(newExam);
          }}
        />
      )}
    </div>
  );
};
