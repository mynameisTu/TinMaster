import React, { useState, useEffect, useRef } from 'react';
import {
  Question,
  AdaptiveRecommendation,
  AdaptivePracticeResult,
  QuestionAttemptTelemetry,
} from '../types';
import { AdaptiveLearningEngine } from '../services/adaptiveEngine';
import { AIPedagogicalService } from '../services/aiService';
import { CONCEPTS_LIST } from '../data/curriculumData';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Code2,
  Zap,
  HelpCircle,
} from 'lucide-react';

interface AdaptivePracticeSessionProps {
  questions: Question[];
  initialRecommendation?: AdaptiveRecommendation;
  onFinishPractice: (results: AdaptivePracticeResult[]) => void;
  onClose: () => void;
}

export function createAdaptivePracticeResult(
  question: Question,
  userAnswer: string | Record<string, boolean>,
  activeTimeSec: number
): AdaptivePracticeResult {
  const scoreResult = AdaptiveLearningEngine.calculateQuestionScore(question, userAnswer);
  return {
    question,
    isCorrect: scoreResult.isCorrect,
    scoreRatio: scoreResult.scoreRatio,
    activeTimeSec: Math.max(5, activeTimeSec),
  };
}

export const AdaptivePracticeSession: React.FC<AdaptivePracticeSessionProps> = ({
  questions,
  initialRecommendation,
  onFinishPractice,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [accumulatedResults, setAccumulatedResults] = useState<AdaptivePracticeResult[]>([]);

  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());
  const currentQuestion = questions[currentIndex];
  const isPartTwo = currentQuestion?.questionType === 'true_false_multistatement';

  useEffect(() => {
    startTimeRef.current = Date.now();
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setAiAnalysis(null);
  }, [currentIndex]);

  if (!currentQuestion) return null;

  // Single choice selection
  const handleSelectOption = (optLabel: string) => {
    if (isSubmitted) return;
    setSelectedAnswer(optLabel);
  };

  // True/False multi-statement toggle
  const handleToggleSubStatement = (subOrder: string, val: boolean) => {
    if (isSubmitted) return;
    setSelectedAnswer((prev: Record<string, boolean> | null) => ({
      ...(prev || {}),
      [subOrder]: val,
    }));
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || isSubmitted) return;
    setIsSubmitted(true);

    const activeTime = Math.round((Date.now() - startTimeRef.current) / 1000);
    const newResult = createAdaptivePracticeResult(
      currentQuestion,
      selectedAnswer,
      activeTime
    );

    setAccumulatedResults((prev) => [...prev, newResult]);

    // If incorrect or user hesitated, fetch pedagogical misconception
    if (!newResult.isCorrect || activeTime > currentQuestion.estimatedTimeSec * 1.5) {
      setIsAiLoading(true);
      const concept = CONCEPTS_LIST.find((c) => c.id === currentQuestion.conceptId);
      const aiRes = await AIPedagogicalService.explainQuestion(
        currentQuestion,
        selectedAnswer,
        concept?.name || 'Khái niệm Tin học',
        0.7
      );
      setAiAnalysis(aiRes);
      setIsAiLoading(false);
    }
  };

  const handleNextOrFinish = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onFinishPractice(accumulatedResults);
    }
  };

  const currentScoreResult = isSubmitted
    ? AdaptiveLearningEngine.calculateQuestionScore(currentQuestion, selectedAnswer)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative my-8">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {/* Pedagogical model: Zone of Proximal Development (ZPD) adaptive sequencing */}
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Luyện Tập Thích Ứng Cá Nhân Hóa
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Câu {currentIndex + 1} / {questions.length} • {currentQuestion.strand}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>

        {/* Explainability Banner: Why this question was chosen */}
        {initialRecommendation && currentIndex === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>Lý do hệ thống đề xuất câu này: </strong>
              <span>{initialRecommendation.reasons.textExplanation}</span>
            </div>
          </div>
        )}

        {/* Question Stem */}
        <div className="space-y-4">
          <p className="text-base font-medium text-slate-800 leading-relaxed">
            {currentQuestion.stem}
          </p>

          {currentQuestion.codeSnippet && (
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase pb-1 mb-2 border-b border-slate-800">
                {currentQuestion.codeSnippet.language}
              </div>
              <pre>{currentQuestion.codeSnippet.code}</pre>
            </div>
          )}

          {/* Single Choice Options */}
          {!isPartTwo && currentQuestion.singleChoiceOptions && (
            <div className="space-y-2.5 pt-2">
              {currentQuestion.singleChoiceOptions.map((opt) => {
                const isSelected = selectedAnswer === opt.label;
                const isCorrect = isSubmitted && opt.isCorrect;
                const isWrongSelected = isSubmitted && isSelected && !opt.isCorrect;

                return (
                  <button
                    key={opt.label}
                    disabled={isSubmitted}
                    onClick={() => handleSelectOption(opt.label)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition flex items-start space-x-3 cursor-pointer ${
                      isCorrect
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                        : isWrongSelected
                        ? 'bg-red-50 border-red-500 text-red-950'
                        : isSelected
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-bold text-xs ${
                        isCorrect
                          ? 'bg-emerald-600 text-white'
                          : isWrongSelected
                          ? 'bg-red-600 text-white'
                          : isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="pt-0.5 text-slate-800 leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* True / False Multi-statement Options */}
          {isPartTwo && currentQuestion.trueFalseStatements && (
            <div className="space-y-3 pt-2">
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {currentQuestion.trueFalseStatements.map((st) => {
                  const val = selectedAnswer?.[st.subOrder];
                  const isCorrect = isSubmitted && val === st.isCorrect;

                  return (
                    <div
                      key={st.subOrder}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                    >
                      <div className="flex items-start space-x-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {st.subOrder}
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {st.statementText}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          disabled={isSubmitted}
                          onClick={() => handleToggleSubStatement(st.subOrder, true)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            val === true
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Đúng
                        </button>
                        <button
                          disabled={isSubmitted}
                          onClick={() => handleToggleSubStatement(st.subOrder, false)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            val === false
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Sai
                        </button>
                        {isSubmitted && (
                          <span className="text-[11px] font-bold ml-1">
                            (Đ/A: {st.isCorrect ? 'Đúng' : 'Sai'})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FEEDBACK SECTION AFTER SUBMISSION */}
        {isSubmitted && currentScoreResult && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center space-x-1 font-bold ${
                  currentScoreResult.isCorrect ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {currentScoreResult.isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span>
                  {currentScoreResult.isCorrect
                    ? 'Xuất sắc! Bạn đã trả lời chính xác.'
                    : 'Chưa chính xác. Hãy xem phân tích sư phạm dưới đây:'}
                </span>
              </span>

              <span className="font-bold text-slate-700">
                +{currentScoreResult.awardedPoints} điểm
              </span>
            </div>

            <p className="text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200">
              <strong>Giải thích chuẩn mực: </strong>
              {currentQuestion.explanation}
            </p>

            {/* AI Misconception Analysis if any */}
            {isAiLoading && (
              <p className="text-purple-600 italic">
                Trí tuệ nhân tạo đang phân tích điểm mù nhận thức của bạn...
              </p>
            )}

            {aiAnalysis && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 text-purple-950">
                <div className="flex items-center space-x-1 font-bold text-purple-900">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Chẩn đoán sai sót thường gặp:</span>
                </div>
                <p className="leading-relaxed">{aiAnalysis.misconceptionDiagnosis}</p>
                {aiAnalysis.studyTips?.[0] && (
                  <p className="font-semibold text-purple-800">
                    💡 Lời khuyên: {aiAnalysis.studyTips[0]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div className="flex items-center justify-between pt-2">
          {!isSubmitted ? (
            <button
              disabled={!selectedAnswer}
              onClick={handleSubmitAnswer}
              className="ml-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <span>Kiểm Tra Đáp Án</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNextOrFinish}
              className="ml-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <span>{currentIndex < questions.length - 1 ? 'Câu tiếp theo' : 'Hoàn Thành Luyện Tập'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
