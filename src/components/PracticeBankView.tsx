import React, { useState, useMemo } from 'react';
import {
  Question,
  StudentMastery,
  AdaptiveRecommendation,
  COGNITIVE_LEVEL_LABELS,
  DifficultyLevel,
  UserRole,
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { UploadExerciseModal } from './UploadExerciseModal';
import { ManualQuestionModal } from './ManualQuestionModal';
import {
  Sparkles,
  Play,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Code2,
  FileQuestion,
  ListFilter,
  Flame,
  ArrowRight,
  BookOpen,
  Upload,
  PlusCircle,
} from 'lucide-react';

interface PracticeBankViewProps {
  questions: Question[];
  masteries: Record<string, StudentMastery>;
  recommendations: AdaptiveRecommendation[];
  userRole?: UserRole;
  onAddQuestions?: (newQuestions: Question[]) => void;
  onStartSingleQuestion: (question: Question) => void;
  onStartAdaptivePractice: (rec?: AdaptiveRecommendation) => void;
  onStartMicroQuiz: (count: number) => void;
  onOpenVideoModal: (conceptId?: string) => void;
}

export const PracticeBankView: React.FC<PracticeBankViewProps> = ({
  questions,
  masteries,
  recommendations,
  userRole = 'student',
  onAddQuestions,
  onStartSingleQuestion,
  onStartAdaptivePractice,
  onStartMicroQuiz,
  onOpenVideoModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Modals for teachers & admins
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  // Extract unique topics
  const topics = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => set.add(q.topicId));
    return Array.from(set);
  }, [questions]);

  // Filtered questions (deduplicated by ID)
  const filteredQuestions = useMemo(() => {
    const seen = new Set<string>();
    const deduplicatedList: Question[] = [];
    for (const q of questions) {
      if (q && q.id && !seen.has(q.id)) {
        seen.add(q.id);
        deduplicatedList.push(q);
      }
    }

    return deduplicatedList.filter((q) => {
      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const stemMatch = q.stem.toLowerCase().includes(term);
        const idMatch = q.id.toLowerCase().includes(term);
        const topicMatch = q.topicId.toLowerCase().includes(term);
        if (!stemMatch && !idMatch && !topicMatch) return false;
      }

      // Topic filter
      if (selectedTopic !== 'all' && q.topicId !== selectedTopic) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && q.questionType !== selectedType) {
        return false;
      }

      return true;
    });
  }, [questions, searchTerm, selectedTopic, selectedDifficulty, selectedType]);

  // Concept name helper
  const getConceptName = (conceptId: string) => {
    const found = CONCEPTS_LIST.find((c) => c.id === conceptId);
    return found ? found.name : conceptId;
  };

  const getDifficultyBadge = (diff: DifficultyLevel) => {
    switch (diff) {
      case 'easy':
        return <span className="badge-diff-easy">Dễ</span>;
      case 'medium':
        return <span className="badge-diff-med">Vừa</span>;
      case 'hard':
        return <span className="badge-diff-hard">Khó</span>;
      default:
        return <span className="badge-diff-med">{diff}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="panel">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Kho bài tập & Luyện tập thích ứng
              </h1>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                BGDĐT 2025
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Hệ thống tự động điều chỉnh độ khó và chủ đề bài tập tối ưu theo mức độ hiểu bài và lịch sử rèn luyện của bạn.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Teacher & Admin Question Management Actions */}
            {isTeacherOrAdmin && (
              <>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="btn-secondary text-xs py-2 px-3 flex items-center space-x-1.5 cursor-pointer"
                  title="Tải lên đề thi từ file DOCX, PDF, JPG, PNG với AI số hóa tự động"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tải lên đề bài</span>
                </button>

                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="btn-secondary text-xs py-2 px-3 flex items-center space-x-1.5 cursor-pointer"
                  title="Soạn thảo câu hỏi trắc nghiệm hoặc đúng/sai thủ công"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tạo bài tập</span>
                </button>
              </>
            )}

            <button
              onClick={() => onStartMicroQuiz(5)}
              className="btn-secondary text-xs py-2 px-3 flex items-center space-x-1.5 cursor-pointer"
              title="Làm bài kiểm tra nhanh 5 câu"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Micro-Quiz 5 câu</span>
            </button>

            {/* SINGLE PRIMARY ACTION */}
            <button
              onClick={() => onStartAdaptivePractice()}
              className="btn text-xs py-2 px-4 flex items-center space-x-1.5 cursor-pointer"
              title="Luyện bài tập tối ưu nhất theo thuật toán thích ứng"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Luyện tập đề xuất</span>
            </button>
          </div>
        </div>

        {/* Adaptive Recommended Strip if recommendations exist (ZPD recommendation engine) */}
        {recommendations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <div
                key={`${rec.question.id}-${idx}`}
                className="card-compact-row flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-900 text-xs">Gợi ý #{idx + 1}</span>
                    {getDifficultyBadge(rec.question.difficulty)}
                  </div>
                  <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed">
                    {rec.question.stem}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    {rec.reasons.textExplanation}
                  </p>
                </div>
                <button
                  onClick={() => onStartAdaptivePractice(rec)}
                  className="mt-3 text-xs font-semibold text-slate-900 hover:text-blue-600 flex items-center space-x-1 cursor-pointer self-start"
                >
                  <span>Luyện ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo nội dung đề bài, mã câu hỏi, chủ đề..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:border-slate-400 bg-slate-50 focus:bg-white transition"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Topic Filter */}
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả chủ đề ({questions.length})</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Difficulty Filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 cursor-pointer"
            >
              <option value="all">Mọi độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Vừa</option>
              <option value="hard">Khó</option>
            </select>

            {/* Question Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 cursor-pointer"
            >
              <option value="all">Mọi định dạng</option>
              <option value="single_choice">Phần I: 4 Lựa chọn</option>
              <option value="true_false_multistatement">Phần II: Đúng/Sai</option>
            </select>
          </div>
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Tìm thấy <strong className="text-slate-800">{filteredQuestions.length}</strong> bài tập
          </span>
          {(searchTerm || selectedTopic !== 'all' || selectedDifficulty !== 'all' || selectedType !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTopic('all');
                setSelectedDifficulty('all');
                setSelectedType('all');
              }}
              className="text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs sm:text-[13px]">
                <th className="py-3 px-4 w-28">Mã câu</th>
                <th className="py-3 px-4">Nội dung câu hỏi & Kiến thức</th>
                <th className="py-3 px-4 w-36">Chủ đề</th>
                <th className="py-3 px-4 w-28 text-center">Cấp độ</th>
                <th className="py-3 px-4 w-24 text-center">Độ khó</th>
                <th className="py-3 px-4 w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.length > 0 ? (
                filteredQuestions.map((q, idx) => {
                  const mastery = masteries[q.conceptId]?.masteryScore ?? 0.5;
                  const masteryPercent = Math.round(mastery * 100);

                  return (
                    <tr key={`${q.id}-${idx}`} className="hover:bg-slate-50/70 transition">
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 text-xs sm:text-[13px]">
                        {q.id.replace('Q_', '')}
                        <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                          {q.questionType === 'single_choice' ? 'Phần I' : 'Phần II'}
                        </div>
                      </td>

                      {/* Stem and Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 text-[15px] leading-relaxed">
                          {q.stem}
                        </div>
                        {q.codeSnippet && (
                          <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <Code2 className="w-3.5 h-3.5" />
                            <span>Code snippet ({q.codeSnippet.language})</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-3">
                          <span>
                            Khái niệm: <strong className="text-slate-700">{getConceptName(q.conceptId)}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center space-x-1.5">
                            <span>Mức độ nắm vững:</span>
                            <span
                              className={
                                masteryPercent >= 70
                                  ? 'status-stable'
                                  : masteryPercent >= 50
                                  ? 'status-caution'
                                  : 'status-gap'
                              }
                            >
                              {masteryPercent}%
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Topic */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium text-xs sm:text-[13px]">
                        {q.topicId.replace(/_/g, ' ')}
                      </td>

                      {/* Cognitive Level */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium text-xs">
                          {COGNITIVE_LEVEL_LABELS[q.cognitiveLevel] || q.cognitiveLevel}
                        </span>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3.5 px-4 text-center">
                        {getDifficultyBadge(q.difficulty)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onStartSingleQuestion(q)}
                            className="btn-secondary text-xs py-1.5 px-3.5 whitespace-nowrap cursor-pointer"
                            title="Luyện ngay câu hỏi này"
                          >
                            Luyện ngay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <FileQuestion className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Không tìm thấy bài tập phù hợp</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Vui lòng thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher & Admin Modals */}
      {isTeacherOrAdmin && (
        <>
          {isUploadModalOpen && (
            <UploadExerciseModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              onConfirmQuestions={(newQuestions) => onAddQuestions?.(newQuestions)}
            />
          )}
          {isManualModalOpen && (
            <ManualQuestionModal
              isOpen={isManualModalOpen}
              onClose={() => setIsManualModalOpen(false)}
              onSaveQuestion={(newQuestion) => onAddQuestions?.([newQuestion])}
            />
          )}
        </>
      )}
    </div>
  );
};
