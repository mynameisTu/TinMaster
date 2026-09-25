import React, { useState } from 'react';
import {
  ExamSession,
  Question,
  StudentMastery,
  InteractionQuadrant,
} from '../types';
import { AdaptiveLearningEngine } from '../services/adaptiveEngine';
import { AIPedagogicalService } from '../services/aiService';
import { CONCEPTS_LIST } from '../data/curriculumData';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExamReviewProps {
  session: ExamSession;
  questions: Question[];
  masteries: Record<string, StudentMastery>;
  onReturnDashboard: () => void;
  onPracticeConcept: (conceptId: string) => void;
}

export const ExamReview: React.FC<ExamReviewProps> = ({
  session,
  questions,
  masteries,
  onReturnDashboard,
  onPracticeConcept,
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(questions[0]?.id || '');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<any | null>(null);

  // Trigger confetti if score >= 7.0
  React.useEffect(() => {
    let totalScore = 0;
    questions.forEach((q) => {
      const tel = session.questionTelemetries[q.id];
      const maxPoints = q.questionType === 'true_false_multistatement' ? 1.0 : 0.25;
      const result = AdaptiveLearningEngine.calculateQuestionScore(q, tel?.userAnswer, maxPoints);
      totalScore += result.awardedPoints;
    });

    if (totalScore >= 7.0) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }
  }, [session, questions]);

  // Compute detailed analytics
  let totalScore = 0;
  let totalCorrect = 0;
  let totalChanges = 0;
  let markedCount = 0;

  const questionResults = questions.map((q) => {
    const tel = session.questionTelemetries[q.id];
    const maxPoints = q.questionType === 'true_false_multistatement' ? 1.0 : 0.25;
    const scoreResult = AdaptiveLearningEngine.calculateQuestionScore(q, tel?.userAnswer, maxPoints);
    const activeTime = tel?.activeTimeSec || 45;
    const changes = tel?.answerChangesCount || 0;
    totalChanges += changes;
    if (tel?.markedForReview) markedCount++;

    totalScore += scoreResult.awardedPoints;
    if (scoreResult.isCorrect) totalCorrect++;

    const { quadrant, hesitationScore, patternNote } =
      AdaptiveLearningEngine.evaluateBehaviorQuadrant(
        activeTime,
        q.estimatedTimeSec,
        scoreResult.isCorrect,
        changes
      );

    return {
      question: q,
      telemetry: tel,
      scoreResult,
      activeTime,
      changes,
      quadrant,
      hesitationScore,
      patternNote,
    };
  });

  const scaledScore = Math.round(totalScore * 100) / 100;
  const accuracy = Math.round((totalCorrect / questions.length) * 100);
  const avgTimePerQuestion = Math.round(session.durationSeconds / Math.max(1, questions.length));

  // Behavioral grouping
  const fastIncorrect = questionResults.filter((r) => r.quadrant === 'fast_incorrect');
  const slowIncorrect = questionResults.filter((r) => r.quadrant === 'slow_incorrect');
  const slowCorrect = questionResults.filter((r) => r.quadrant === 'slow_correct');
  const fastCorrect = questionResults.filter((r) => r.quadrant === 'fast_correct');

  const activeQuestionResult = questionResults.find((r) => r.question.id === selectedQuestionId) || questionResults[0];

  const handleAskAI = async () => {
    if (!activeQuestionResult) return;
    setAiLoading(true);
    setAiResponse(null);

    const concept = CONCEPTS_LIST.find((c) => c.id === activeQuestionResult.question.conceptId);
    const res = await AIPedagogicalService.explainQuestion(
      activeQuestionResult.question,
      activeQuestionResult.telemetry?.userAnswer,
      concept?.name || 'Tin học',
      scaledScore / 10.0
    );

    setAiResponse(res);
    setAiLoading(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. TOP RESULT HERO CARD */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã hoàn thành và ghi nhận hành vi</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Kết Quả Phân Tích Bài Thi Chuẩn Hóa
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              {session.mandatoryScore !== undefined || session.electiveScore !== undefined
                ? `Điểm số chuẩn BGDĐT: 24 câu trắc nghiệm (6.0đ), 2 câu Đúng/Sai chung (2.0đ) và 2 câu Đúng/Sai tự chọn (2.0đ) theo định hướng ${
                    session.studentTrack === 'CS'
                      ? 'Khoa học máy tính (CS)'
                      : session.studentTrack === 'ICT'
                      ? 'Tin học ứng dụng (ICT)'
                      : 'đã đăng ký'
                  }.`
                : 'Điểm số được chấm nghiêm ngặt theo thang điểm chuẩn BGDĐT: Phần I (0.25đ/câu) và Phần II (lũy tiến 0.1, 0.25, 0.5, 1.0đ).'}
            </p>
          </div>

          {/* Main Score Box & Breakdown */}
          <div className="flex flex-wrap items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/15">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Điểm bài thi
              </p>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-amber-400">
                  {scaledScore}
                </span>
                <span className="text-slate-300 font-medium text-sm">/ 10.0</span>
              </div>
            </div>

            {(session.mandatoryScore !== undefined || session.electiveScore !== undefined) && (
              <>
                <div className="w-px h-12 bg-white/15 hidden sm:block" />
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-300">Phần bắt buộc (26 câu):</span>
                    <strong className="text-emerald-300 font-mono">
                      {session.mandatoryScore ?? 0} / {session.mandatoryMaxScore ?? 8.0}đ
                    </strong>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-300">Tự chọn ({session.studentTrack || 'Track'}):</span>
                    <strong className="text-purple-300 font-mono">
                      {session.electiveScore ?? 0} / {session.electiveMaxScore ?? 2.0}đ
                    </strong>
                  </div>
                </div>
              </>
            )}

            <div className="w-px h-12 bg-white/15" />
            <div>
              <p className="text-xs text-slate-300">Độ chính xác</p>
              <p className="text-2xl font-bold text-white">{accuracy}%</p>
              <p className="text-xs text-slate-400">{totalCorrect}/{questions.length} câu đúng</p>
            </div>
          </div>
        </div>

        {/* Behavioral Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 text-xs font-sans">
          <div>
            <span className="text-slate-400 block">Thời gian làm bài</span>
            <strong className="text-sm font-semibold text-white">
              <span className="font-mono">{Math.floor(session.durationSeconds / 60)}</span> phút <span className="font-mono">{session.durationSeconds % 60}</span>s
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">Thời gian TB / câu</span>
            <strong className="text-sm font-semibold text-white">
              <span className="font-mono">{avgTimePerQuestion}</span> giây / câu
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">Số lần đổi đáp án</span>
            <strong className="text-sm font-semibold text-amber-300">
              <span className="font-mono">{totalChanges}</span> lần sửa
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">Số câu gắn cờ xem lại</span>
            <strong className="text-sm font-semibold text-blue-300">
              <span className="font-mono">{markedCount}</span> câu
            </strong>
          </div>
        </div>
      </section>

      {/* 2. BEHAVIORAL 4-QUADRANT DIAGNOSTIC */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Chẩn Đoán Hành Vi Tương Tác 4 Góc Phần Tư (Behavioral Quadrant)
            </h2>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Dữ liệu độc quyền TinMaster
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quadrant 1: Nhanh - Đúng */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Nhanh & Đúng ({fastCorrect.length})
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs text-emerald-950 font-medium">
              Vùng thành thạo: Phản xạ dứt khoát, kiến thức đã trở thành bản năng.
            </p>
          </div>

          {/* Quadrant 2: Chậm - Đúng */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                Chậm & Đúng ({slowCorrect.length})
              </span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-blue-950 font-medium">
              Vùng tư duy sâu: Trả lời đúng nhưng tốn nhiều thời gian; cần rèn phản xạ tốc độ.
            </p>
          </div>

          {/* Quadrant 3: Nhanh - Sai */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Nhanh & Sai ({fastIncorrect.length})
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-amber-950 font-medium">
              Vùng cẩu thả / Bẫy đề: Đọc lướt quá nhanh hoặc bỏ sót từ phủ định trong câu hỏi.
            </p>
          </div>

          {/* Quadrant 4: Chậm - Sai */}
          <div className="p-4 rounded-xl border border-red-200 bg-red-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
                Chậm & Sai ({slowIncorrect.length})
              </span>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xs text-red-950 font-medium">
              Lỗ hổng cốt lõi: Mất nhiều thời gian suy nghĩ nhưng vẫn bế tắc; cần ôn tập lại khái niệm gốc.
            </p>
          </div>
        </div>
      </section>

      {/* 3. QUESTION-BY-QUESTION AUDIT & AI EXPLANATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 col: Question List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 h-[600px] flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Danh sách câu hỏi ({questions.length})
          </h3>

          <div className="overflow-y-auto space-y-2 flex-1 pr-1">
            {questionResults.map((r, idx) => {
              const isSelected = r.question.id === selectedQuestionId;
              const isCorrect = r.scoreResult.isCorrect;

              return (
                <button
                  key={`${r.question.id}-${idx}`}
                  onClick={() => {
                    setSelectedQuestionId(r.question.id);
                    setAiResponse(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="text-xs truncate max-w-[170px]">
                      <span className="font-semibold text-slate-800 block truncate">
                        {r.question.stem}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {r.question.sectionScope === 'elective' ? (
                          <span className="text-purple-600 font-semibold mr-1">
                            Tự chọn {r.question.track} •
                          </span>
                        ) : null}
                        {r.activeTime}s • {r.changes} lần sửa
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold ${
                      isCorrect ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    +{r.scoreResult.awardedPoints}đ
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 cols: Detailed Inspection & AI Assistant */}
        <div className="lg:col-span-2 space-y-4">
          {activeQuestionResult && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {activeQuestionResult.question.sectionScope === 'elective'
                        ? `Phần III: Tự chọn (${activeQuestionResult.question.track || 'Track'})`
                        : activeQuestionResult.question.sectionScope === 'mandatory'
                        ? 'Phần I: Bắt buộc chung'
                        : activeQuestionResult.question.questionType === 'single_choice'
                        ? 'Phần I: 4 Lựa chọn'
                        : 'Phần II: Đúng / Sai'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Độ khó: {activeQuestionResult.question.difficulty}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2 leading-relaxed">
                    {activeQuestionResult.question.stem}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold ${
                      activeQuestionResult.scoreResult.isCorrect
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {activeQuestionResult.scoreResult.isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span>+{activeQuestionResult.scoreResult.awardedPoints} điểm</span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Thời gian: {activeQuestionResult.activeTime}s
                  </p>
                </div>
              </div>

              {/* Behavioral Notice */}
              <div className="flex items-center space-x-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Hành vi quan sát: </strong>
                  {activeQuestionResult.patternNote}
                </span>
              </div>

              {/* Standard Explanation */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Giải thích đáp án chuẩn mực
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {activeQuestionResult.question.explanation}
                </div>
              </div>

              {/* AI Sư phạm Explanation Trigger */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Chẩn đoán Sư phạm Chuyên sâu với AI
                    </span>
                  </div>
                  <button
                    onClick={handleAskAI}
                    disabled={aiLoading}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiLoading ? 'Đang phân tích...' : 'Phân tích lỗi sai với AI'}</span>
                  </button>
                </div>

                {/* AI Box */}
                {aiResponse && (
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3 text-xs text-purple-950">
                    <div>
                      <strong className="block font-bold text-purple-900 mb-1">
                        Chẩn đoán nguyên nhân lỗi:
                      </strong>
                      <p className="leading-relaxed">{aiResponse.misconceptionDiagnosis}</p>
                    </div>

                    <div>
                      <strong className="block font-bold text-purple-900 mb-1">
                        Giải thích từng bước:
                      </strong>
                      <p className="leading-relaxed">{aiResponse.explanation}</p>
                    </div>

                    {aiResponse.studyTips?.length > 0 && (
                      <div>
                        <strong className="block font-bold text-purple-900 mb-1">
                          Lời khuyên ôn tập thích ứng:
                        </strong>
                        <ul className="list-disc list-inside space-y-1 text-purple-900">
                          {aiResponse.studyTips.map((tip: string, i: number) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom return bar */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onReturnDashboard}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition flex items-center space-x-2 shadow-xs shadow-blue-500/20 cursor-pointer"
        >
          <span>Trở về Trang Tổng Quan & Cập Nhật Bản Đồ Tri Thức</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
