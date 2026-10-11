import React, { useState, useEffect, useRef } from 'react';
import {
  Question,
  ExamBlueprint,
  QuestionAttemptTelemetry,
  ExamSession,
  ExamTrack,
} from '../types';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Code2,
  Send,
  HelpCircle,
  Globe,
  Sparkles,
} from 'lucide-react';

interface ExamSimulationProps {
  blueprint: ExamBlueprint;
  questions: Question[];
  studentTrack?: ExamTrack;
  onSwitchTrack?: (track: ExamTrack) => void;
  onFinishExam: (session: ExamSession) => void;
  onCancelExam: () => void;
}

export const ExamSimulation: React.FC<ExamSimulationProps> = ({
  blueprint,
  questions,
  studentTrack,
  onSwitchTrack,
  onFinishExam,
  onCancelExam,
}) => {
  const rawMinutes = Number(
  blueprint.durationMinutes ?? (blueprint as any).duration_minutes
);
const totalSeconds = (Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 50) * 60;
const [secondsRemaining, setSecondsRemaining] = useState<number>(totalSeconds);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const endTimeRef = useRef<number>(Date.now() + totalSeconds * 1000);
  const submitRef = useRef<() => void>(() => {});
  const submittedRef = useRef<boolean>(false);
  // Telemetry references
  const telemetriesRef = useRef<Record<string, Partial<QuestionAttemptTelemetry>>>({});
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentIndex];

  // Initialize telemetries for all questions (preserve existing on track switch)
  useEffect(() => {
    const current = { ...telemetriesRef.current };
    questions.forEach((q) => {
      if (!current[q.id]) {
        current[q.id] = {
          questionId: q.id,
          startTime: Date.now(),
          answerChangesCount: 0,
          activeTimeSec: 0,
          revisited: false,
          markedForReview: false,
        };
      }
    });
    telemetriesRef.current = current;
  }, [questions]);

  // Active time tracking when switching questions
  useEffect(() => {
    const prevTime = questionStartTimeRef.current;
    const now = Date.now();
    const elapsedSec = Math.round((now - prevTime) / 1000);

    if (currentQuestion && telemetriesRef.current[currentQuestion.id]) {
      const qTel = telemetriesRef.current[currentQuestion.id]!;
      qTel.activeTimeSec = (qTel.activeTimeSec || 0) + elapsedSec;
      qTel.revisited = true;
    }

    questionStartTimeRef.current = now;
  }, [currentIndex, currentQuestion]);

  // 50-minute Countdown Timer
 useEffect(() => {
  const id = setInterval(() => {
    const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setSecondsRemaining(left);
    if (left === 0 && !submittedRef.current) {
      submittedRef.current = true;
      clearInterval(id);
      submitRef.current();
    }
  }, 1000);
  return () => clearInterval(id);
}, []);

  // Format timer MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = secondsRemaining < 300; // Under 5 minutes

  // Single choice answer selection
  const handleSelectSingleChoice = (optionLabel: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const prevAnswer = answers[qId];

    // Update telemetry
    const qTel = telemetriesRef.current[qId];
    if (qTel) {
      if (!qTel.firstInteractionTime) {
        qTel.firstInteractionTime = Date.now();
      }
      if (prevAnswer && prevAnswer !== optionLabel) {
        qTel.answerChangesCount = (qTel.answerChangesCount || 0) + 1;
      }
    }

    setAnswers((prev) => ({ ...prev, [qId]: optionLabel }));
  };

  // True/False multi-statement toggle
  const handleToggleTrueFalse = (subOrder: string, value: boolean) => {
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const currentMap = (answers[qId] as Record<string, boolean>) || {};
    const hadPrevious = subOrder in currentMap;

    const qTel = telemetriesRef.current[qId];
    if (qTel) {
      if (!qTel.firstInteractionTime) {
        qTel.firstInteractionTime = Date.now();
      }
      if (hadPrevious && currentMap[subOrder] !== value) {
        qTel.answerChangesCount = (qTel.answerChangesCount || 0) + 1;
      }
    }

    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        ...currentMap,
        [subOrder]: value,
      },
    }));
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const newFlaggedState = !flagged[qId];
    setFlagged((prev) => ({ ...prev, [qId]: newFlaggedState }));

    if (telemetriesRef.current[qId]) {
      telemetriesRef.current[qId]!.markedForReview = newFlaggedState;
    }
  };

  // Check if a question is answered
  const isQuestionAnswered = (q: Question): boolean => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.questionType === 'single_choice') {
      return typeof ans === 'string';
    }
    if (q.questionType === 'true_false_multistatement') {
      const map = ans as Record<string, boolean>;
      // All 4 sub-statements answered
      return ['a', 'b', 'c', 'd'].every((k) => k in map);
    }
    return false;
  };

  const answeredCount = questions.filter((q) => isQuestionAnswered(q)).length;

const handleSubmitExam = () => {
  submittedRef.current = true;
    // Finalize time for current question
    const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    if (currentQuestion && telemetriesRef.current[currentQuestion.id]) {
      telemetriesRef.current[currentQuestion.id]!.activeTimeSec =
        (telemetriesRef.current[currentQuestion.id]!.activeTimeSec || 0) + elapsed;
    }

    // Build session object
    const finalTelemetries: Record<string, QuestionAttemptTelemetry> = {};
    questions.forEach((q) => {
      const partial = telemetriesRef.current[q.id] || {};
      finalTelemetries[q.id] = {
        questionId: q.id,
        startTime: partial.startTime || Date.now(),
        firstInteractionTime: partial.firstInteractionTime,
        answerChangesCount: partial.answerChangesCount || 0,
        activeTimeSec: Math.max(5, partial.activeTimeSec || 15),
        revisited: !!partial.revisited,
        markedForReview: !!flagged[q.id],
        userAnswer: answers[q.id],
        isCorrect: false, // will be evaluated by engine in review
        scoreAwarded: 0,
        quadrant: 'slow_incorrect',
        hesitationScore: 0,
      };
    });

    const session: ExamSession = {
      id: `EXAM_${Date.now()}`,
      blueprintId: blueprint.id,
      examTitle: blueprint.title,
      startedAt: new Date(Date.now() - (totalSeconds - secondsRemaining) * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      durationSeconds: totalSeconds - secondsRemaining,
      timeRemainingSeconds: secondsRemaining,
      isCompleted: true,
      totalScore: 0,
      totalCorrect: 0,
      questionTelemetries: finalTelemetries,
      studentTrack: studentTrack,
    };

    onFinishExam(session);
  };
  submitRef.current = handleSubmitExam;
  if (!currentQuestion) return null;

  const isCurrentFlagged = !!flagged[currentQuestion.id];
  const isTrueFalse = currentQuestion.questionType === 'true_false_multistatement';
  const isElective = currentQuestion.sectionScope === 'elective';

  const part1Items = questions
    .map((q, idx) => ({ q, realIndex: idx }))
    .filter((item) =>
      item.q.sectionScope ? item.q.sectionScope === 'mandatory' : item.q.questionType === 'single_choice'
    );

  const commonTrueFalseItems = questions
    .map((q, idx) => ({ q, realIndex: idx }))
    .filter((item) => item.q.sectionScope === 'mandatory_tf');
  const electiveItems = questions
    .map((q, idx) => ({ q, realIndex: idx }))
    .filter((item) => item.q.sectionScope === 'elective');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. EXAM HEADER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs sticky top-18 z-30 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
              Kỳ thi Tốt nghiệp THPT 2025
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">• Môn: Tin học</span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-md mt-0.5">
            {blueprint.title}
          </h2>
        </div>

        {/* Center Track Switcher if elective tracks enabled */}
        {blueprint.hasElectiveTracks && (
          <div className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 px-2">Định hướng Phần III:</span>
            <button
              type="button"
              onClick={() => onSwitchTrack && onSwitchTrack('CS')}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                studentTrack === 'CS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/70 border border-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Khoa học máy tính (CS)</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchTrack && onSwitchTrack('ICT')}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                studentTrack === 'ICT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/70 border border-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Khoa học ứng dụng (ICT)</span>
            </button>
          </div>
        )}

        {/* Center/Right Timer & Progress */}
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500 font-medium">Tiến độ làm bài</p>
            <p className="text-sm font-bold text-slate-900">
              {answeredCount} / {questions.length} câu
            </p>
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl font-mono text-base font-bold shadow-xs border transition ${
              isTimeCritical
                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formattedTime}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition flex items-center space-x-1.5 shadow-xs shadow-emerald-500/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Nộp bài</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: QUESTION VIEW + RIGHT PALETTE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Question Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 min-h-[500px] flex flex-col justify-between">
            <div className="space-y-6">
              {/* Question Index & Action Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                    {currentIndex + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {isTrueFalse
                          ? isElective
                            ? `PHẦN III: Đúng/Sai tự chọn — ${studentTrack === 'CS' ? 'Khoa học máy tính (CS)' : 'Tin học ứng dụng (ICT)'}`
                            : 'PHẦN II: Đúng/Sai chung'
                          : 'PHẦN I: Trắc nghiệm 4 lựa chọn'}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{currentQuestion.strand}</span>
                      {currentQuestion.track && currentQuestion.track !== 'ALL' && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Track {currentQuestion.track}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {isTrueFalse ? 'Tối đa 1.0 điểm' : '0.25 điểm'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Nguồn: {currentQuestion.source} ({currentQuestion.sourceYear})
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleFlag}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                    isCurrentFlagged
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-600 text-amber-600' : ''}`} />
                  <span>{isCurrentFlagged ? 'Đã gắn cờ xem lại' : 'Gắn cờ xem lại'}</span>
                </button>
              </div>

              {/* In-Question Elective Track Selector for Section II */}
              {isElective && blueprint.hasElectiveTracks && (
                <div className="p-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/70 to-purple-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        PHẦN III: Tự chọn Đúng/Sai (2 câu - tối đa 2.0 điểm)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Đang làm định hướng:{' '}
                      <strong className={studentTrack === 'ICT' ? 'text-emerald-700' : 'text-purple-700'}>
                        {studentTrack === 'ICT' ? 'Khoa học ứng dụng / Tin học ứng dụng (ICT)' : 'Khoa học máy tính (CS)'}
                      </strong>
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSwitchTrack && onSwitchTrack('CS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        studentTrack === 'CS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Chọn CS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchTrack && onSwitchTrack('ICT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        studentTrack === 'ICT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Chọn Khoa học ứng dụng</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Question Stem Text */}
              <div className="text-base text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                {currentQuestion.stem}
              </div>

              {/* Optional Code Snippet */}
              {currentQuestion.codeSnippet && (
                <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-200 overflow-x-auto border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 mb-2 border-b border-slate-800">
                    <span className="flex items-center space-x-1.5">
                      <Code2 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="uppercase">{currentQuestion.codeSnippet.language}</span>
                    </span>
                  </div>
                  <pre>{currentQuestion.codeSnippet.code}</pre>
                </div>
              )}

              {/* Options Interface */}
              {/* Case A: Single Choice (Phần I) */}
              {!isTrueFalse && currentQuestion.singleChoiceOptions && (
                <div className="space-y-3 pt-2">
                  {currentQuestion.singleChoiceOptions.map((opt) => {
                    const isSelected = answers[currentQuestion.id] === opt.label;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleSelectSingleChoice(opt.label)}
                        className={`w-full text-left p-4 rounded-xl border transition flex items-start space-x-3.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-sm text-slate-800 font-medium leading-relaxed pt-0.5">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Case B: True/False Multi-statement (Phần II) */}
              {isTrueFalse && currentQuestion.trueFalseStatements && (
                <div className="space-y-3 pt-2">
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 leading-relaxed">
                    <strong>Quy định chấm điểm Phần II BGDĐT:</strong> Đúng 1 ý = 0.1 đ; Đúng 2 ý = 0.25 đ; Đúng 3 ý = 0.5 đ; Đúng cả 4 ý = 1.0 đ.
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                    {currentQuestion.trueFalseStatements.map((st) => {
                      const userChoice = (answers[currentQuestion.id] as Record<string, boolean>)?.[st.subOrder];
                      return (
                        <div
                          key={st.subOrder}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                        >
                          <div className="flex items-start space-x-3">
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                              {st.subOrder}
                            </span>
                            <p className="text-sm text-slate-800 font-medium leading-relaxed">
                              {st.statementText}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => handleToggleTrueFalse(st.subOrder, true)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                userChoice === true
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              onClick={() => handleToggleTrueFalse(st.subOrder, false)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                userChoice === false
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Sai
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Nav Controls */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Câu trước</span>
              </button>

              <span className="text-xs text-slate-400 font-medium">
                Câu {currentIndex + 1} / {questions.length}
              </span>

              <button
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1.5 shadow-xs shadow-blue-500/20 cursor-pointer"
              >
                <span>Câu kế tiếp</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 col: Question Palette & Navigation */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Bảng điều hướng câu hỏi</h3>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-600" />
                <span>Đã làm ({answeredCount})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400" />
                <span>Gắn cờ ({Object.values(flagged).filter(Boolean).length})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm border border-slate-300 bg-white" />
                <span>Chưa làm ({questions.length - answeredCount})</span>
              </div>
            </div>

            {/* Section I Palette */}
            {part1Items.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  {blueprint.hasElectiveTracks
                    ? `Phần I: Trắc nghiệm (${part1Items.length} câu)`
                    : `Phần I: Trắc nghiệm 4 lựa chọn (${part1Items.length} câu)`}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {part1Items.map((item, idx) => {
                    const isAnswered = isQuestionAnswered(item.q);
                    const isCurrent = item.realIndex === currentIndex;
                    const isFl = flagged[item.q.id];

                    return (
                      <button
                        key={`${item.q.id}-${item.realIndex}`}
                        onClick={() => setCurrentIndex(item.realIndex)}
                        className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center relative cursor-pointer ${
                          isCurrent
                            ? 'ring-2 ring-blue-600 ring-offset-2'
                            : ''
                        } ${
                          isFl
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : isAnswered
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section II Palette */}
            {commonTrueFalseItems.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Phần II: Đúng / Sai chung ({commonTrueFalseItems.length} câu)
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {commonTrueFalseItems.map((item, idx) => {
                    const isAnswered = isQuestionAnswered(item.q);
                    const isCurrent = item.realIndex === currentIndex;
                    const isFl = flagged[item.q.id];

                    return (
                      <button
                        key={`${item.q.id}-${item.realIndex}`}
                        onClick={() => setCurrentIndex(item.realIndex)}
                        className={`h-9 rounded-lg text-xs font-bold transition flex items-center justify-center relative cursor-pointer ${
                          isCurrent ? 'ring-2 ring-blue-600 ring-offset-2' : ''
                        } ${
                          isFl
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : isAnswered
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        Câu {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {electiveItems.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Phần III: Đúng / Sai tự chọn ({electiveItems.length} câu)
                  </p>
                  <span className="text-[10px] font-semibold text-purple-600">
                    {studentTrack || 'Chưa chọn định hướng'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {electiveItems.map((item, idx) => {
                    const isAnswered = isQuestionAnswered(item.q);
                    const isCurrent = item.realIndex === currentIndex;
                    const isFl = flagged[item.q.id];

                    return (
                      <button
                        key={`${item.q.id}-${item.realIndex}`}
                        onClick={() => setCurrentIndex(item.realIndex)}
                        className={`h-9 rounded-lg text-xs font-bold transition flex items-center justify-center relative cursor-pointer ${
                          isCurrent ? 'ring-2 ring-blue-600 ring-offset-2' : ''
                        } ${
                          isFl
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : isAnswered
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        Câu {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Xác nhận Nộp bài thi?</h3>
                <p className="text-xs text-slate-500">Đề thi: {blueprint.title}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs text-slate-700 border border-slate-200">
              <div className="flex justify-between">
                <span>Số câu đã trả lời:</span>
                <strong className="text-slate-900">{answeredCount} / {questions.length} câu</strong>
              </div>
              <div className="flex justify-between">
                <span>Số câu chưa trả lời:</span>
                <strong className={questions.length - answeredCount > 0 ? 'text-red-600' : 'text-slate-900'}>
                  {questions.length - answeredCount} câu
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Thời gian còn lại:</span>
                <strong className="text-blue-600 font-mono">{formattedTime}</strong>
              </div>
            </div>

            {questions.length - answeredCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                ⚠️ Bạn vẫn còn {questions.length - answeredCount} câu chưa hoàn thành. Các câu chưa trả lời sẽ được tính 0 điểm theo thang chuẩn BGDĐT.
              </p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                onClick={handleSubmitExam}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
