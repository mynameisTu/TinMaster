import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicSingleChoiceQuestionPresentation, PublicTrueFalseQuestionPresentation } from '../types';
import {
  clearDiagnosticAnswer,
  DiagnosticAssessmentApiError,
  getDiagnosticAssessment,
  loadDiagnosticIdempotencyKey,
  loadDiagnosticSessionId,
  removeDiagnosticSessionId,
  saveDiagnosticAnswer,
  saveDiagnosticIdempotencyKey,
  saveDiagnosticSessionId,
  submitDiagnosticAssessment,
  startDiagnosticAssessment,
  type DiagnosticAssessmentState,
  type DiagnosticSavedAnswer,
} from '../services/diagnosticAssessment';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  X,
} from 'lucide-react';

type ViewState = 'loading' | 'ready' | 'starting' | 'active' | 'error';

export function hasDiagnosticDeadlineElapsed(
  deadlineAt: string,
  now: number
): boolean {
  return new Date(deadlineAt).getTime() <= now;
}

function getRemainingSeconds(deadlineAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function selectionFor(saved: DiagnosticSavedAnswer | undefined): Record<string, unknown> | null {
  if (!saved?.answerSelection) return null;
  return saved.answerSelection;
}

function singleChoiceValue(selection: Record<string, unknown> | null): string {
  return typeof selection?.optionId === 'string' ? selection.optionId : '';
}

function trueFalseValues(selection: Record<string, unknown> | null): Record<string, boolean> {
  const answers = selection?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  return answers as Record<string, boolean>;
}

function isCompleteTrueFalse(answers: Record<string, boolean>): boolean {
  return ['a', 'b', 'c', 'd'].every((key) => typeof answers[key] === 'boolean');
}

function SingleChoiceQuestion({
  question,
  selection,
  disabled,
  onChange,
}: {
  question: PublicSingleChoiceQuestionPresentation;
  selection: Record<string, unknown> | null;
  disabled: boolean;
  onChange: (selection: Record<string, unknown>) => void;
}) {
  const selected = singleChoiceValue(selection);
  return (
    <fieldset disabled={disabled} className="space-y-2.5">
      <legend className="sr-only">Các phương án trả lời</legend>
      {question.singleChoiceOptions.map((option) => (
        <label
          key={option.optionId}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
            selected === option.optionId
              ? 'border-teal-500 bg-teal-50 text-slate-900'
              : 'border-slate-200 bg-white hover:border-slate-300'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <input
            type="radio"
            name={`answer-${question.id}`}
            value={option.optionId}
            checked={selected === option.optionId}
            onChange={() => onChange({ optionId: option.optionId })}
            className="mt-1 accent-teal-700"
          />
          <span className="font-semibold">{option.label}.</span>
          <span>{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TrueFalseQuestion({
  question,
  selection,
  disabled,
  onChange,
}: {
  question: PublicTrueFalseQuestionPresentation;
  selection: Record<string, unknown> | null;
  disabled: boolean;
  onChange: (selection: Record<string, unknown>) => void;
}) {
  const savedValues = trueFalseValues(selection);
  const [draftValues, setDraftValues] = useState<Record<string, boolean>>(savedValues);
  useEffect(() => setDraftValues(savedValues), [selection]);

  return (
    <div className="space-y-3">
      {question.trueFalseStatements.map((statement) => (
        <fieldset
          key={statement.subOrder}
          disabled={disabled}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
        >
          <legend className="sr-only">Phát biểu {statement.subOrder}</legend>
          <p className="text-sm leading-6 text-slate-700">
            <span className="mr-2 font-semibold uppercase text-slate-500">{statement.subOrder}.</span>
            {statement.statementText}
          </p>
          <div className="flex gap-4 text-sm">
            {[
              { value: true, label: 'Đúng' },
              { value: false, label: 'Sai' },
            ].map((choice) => (
              <label key={String(choice.value)} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`answer-${question.id}-${statement.subOrder}`}
                  checked={draftValues[statement.subOrder] === choice.value}
                  disabled={disabled}
                  onChange={() => {
                    const next = { ...draftValues, [statement.subOrder]: choice.value };
                    setDraftValues(next);
                    if (isCompleteTrueFalse(next)) onChange({ answers: next });
                  }}
                  className="accent-teal-700"
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {!isCompleteTrueFalse(draftValues) && (
        <p className="text-xs text-slate-500">
          Chọn Đúng hoặc Sai cho cả bốn phát biểu để lưu câu trả lời.
        </p>
      )}
    </div>
  );
}

export function DiagnosticAssessment({
  userId,
  onClose,
  onResultAvailable,
}: {
  userId: string;
  onClose: () => void;
  onResultAvailable?: () => void;
}) {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [assessment, setAssessment] = useState<DiagnosticAssessmentState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [savingQuestions, setSavingQuestions] = useState<Set<string>>(new Set());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestInProgress = useRef(false);
  const expiryRefreshStarted = useRef(false);

  const restoreSession = useCallback(async () => {
    const sessionId = loadDiagnosticSessionId(window.localStorage, userId);
    if (!sessionId) {
      setViewState('ready');
      return;
    }
    try {
      const state = await getDiagnosticAssessment(sessionId);
      setAssessment(state);
      setViewState('active');
    } catch (error) {
      if (error instanceof DiagnosticAssessmentApiError && error.status === 404) {
        removeDiagnosticSessionId(window.localStorage, userId);
        setViewState('ready');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể khôi phục bài đánh giá.');
        setViewState('error');
      }
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    void restoreSession().finally(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [restoreSession]);

  const startAssessment = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setViewState('starting');
    setErrorMessage(null);
    try {
      const key = loadDiagnosticIdempotencyKey(window.localStorage, userId) ?? crypto.randomUUID();
      if (!loadDiagnosticIdempotencyKey(window.localStorage, userId)) {
        const savedKey = saveDiagnosticIdempotencyKey(window.localStorage, userId, key);
        setStorageWarning(!savedKey);
      }
      const started = await startDiagnosticAssessment(key);
      const state: DiagnosticAssessmentState = {
        assessment: started.assessment,
        questions: started.questions,
        answers: {},
        result: null,
      };
      const stored = saveDiagnosticSessionId(window.localStorage, userId, started.assessment.id);
      setStorageWarning((previous) => previous || !stored);
      setAssessment(state);
      setViewState('active');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể bắt đầu bài đánh giá.');
      setViewState('error');
    } finally {
      requestInProgress.current = false;
    }
  };

  const refreshState = useCallback(async () => {
    if (!assessment) return;
    const state = await getDiagnosticAssessment(assessment.assessment.id);
    setAssessment(state);
  }, [assessment]);

  const persistAnswer = async (
    questionId: string,
    selection: Record<string, unknown> | null
  ) => {
    if (!assessment || requestInProgress.current ||
      hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, Date.now())) return;
    requestInProgress.current = true;
    setSavingQuestions((current) => new Set(current).add(questionId));
    setErrorMessage(null);
    try {
      const currentAnswer = assessment.answers[questionId];
      const result = selection === null
        ? await clearDiagnosticAnswer(
            assessment.assessment.id,
            questionId,
            currentAnswer?.revision ?? 0
          )
        : await saveDiagnosticAnswer(
            assessment.assessment.id,
            questionId,
            selection,
            currentAnswer?.revision ?? 0
          );
      setAssessment((current) => {
        if (!current) return current;
        return {
          ...current,
          answers: {
            ...current.answers,
            [questionId]: { revision: result.revision, answerSelection: selection },
          },
        };
      });
    } catch (error) {
      if (error instanceof DiagnosticAssessmentApiError && error.code === 'ANSWER_REVISION_CONFLICT') {
        try {
          await refreshState();
          setErrorMessage('Câu trả lời đã được cập nhật ở nơi khác. Đã tải lại dữ liệu mới nhất.');
        } catch {
          setErrorMessage('Có xung đột phiên bản; không thể tải câu trả lời mới nhất.');
        }
      } else if (
        error instanceof DiagnosticAssessmentApiError &&
        error.code === 'ASSESSMENT_NOT_ACCEPTING_ANSWERS'
      ) {
        try {
          await refreshState();
        } catch {
          setErrorMessage('Bài đánh giá đã hết hạn và không thể tải trạng thái mới.');
        }
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu câu trả lời.');
      }
    } finally {
      requestInProgress.current = false;
      setSavingQuestions((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
    }
  };

  const submitAssessment = async () => {
    if (
      !assessment ||
      assessment.assessment.status !== 'in_progress' ||
      requestInProgress.current ||
      hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, Date.now())
    ) return;
    requestInProgress.current = true;
    setSubmitting(true);
    setConfirmSubmit(false);
    setErrorMessage(null);
    try {
      const submission = await submitDiagnosticAssessment(assessment.assessment.id);
      if (submission.status === 'incomplete' || !submission.result) {
        setAssessment((current) => current ? {
          ...current,
          assessment: { ...current.assessment, status: 'incomplete' },
          result: null,
        } : current);
        return;
      }
      setAssessment((current) => current ? {
        ...current,
        assessment: {
          ...current.assessment,
          status: 'completed',
          submittedAt: submission.result?.submittedAt,
          finalizedAt: submission.result?.submittedAt,
        },
        result: submission.result,
      } : current);
      onResultAvailable?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể nộp bài đánh giá.');
    } finally {
      requestInProgress.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!assessment) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [assessment]);

  const expired = Boolean(assessment && (
    assessment.assessment.status === 'incomplete' ||
    assessment.assessment.status === 'in_progress' &&
      hasDiagnosticDeadlineElapsed(assessment.assessment.deadlineAt, now)
  ));
  useEffect(() => {
    if (!expired || !assessment || expiryRefreshStarted.current) return;
    expiryRefreshStarted.current = true;
    void getDiagnosticAssessment(assessment.assessment.id)
      .then(setAssessment)
      .catch(() => setErrorMessage('Bài đánh giá đã hết hạn; không thể đồng bộ trạng thái cuối cùng.'));
  }, [expired, assessment]);

  const remaining = assessment
    ? getRemainingSeconds(assessment.assessment.deadlineAt, now)
    : 0;
  const saving = savingQuestions.size > 0;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 px-3 py-5 sm:px-6 sm:py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostic-title"
        className="mx-auto w-full max-w-4xl rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Đánh giá chẩn đoán
            </p>
            <h2 id="diagnostic-title" className="mt-1 text-xl font-bold text-slate-900">
              Bài đánh giá Tin học
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            aria-label="Đóng bài đánh giá"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-7">
          {viewState === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Đang khôi phục bài đánh giá…
            </p>
          )}
          {(viewState === 'ready' || viewState === 'error') && !assessment && (
            <div className="space-y-4">
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Bài đánh giá được lưu theo tài khoản và có thời hạn 25 phút. Câu trả lời đã lưu sẽ được khôi phục khi mở lại bài.
              </p>
              {viewState === 'error' && errorMessage && (
                <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </p>
              )}
              {storageWarning && (
                <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Không thể lưu mã khôi phục trên thiết bị này. Hãy giữ trang mở để tiếp tục bài đánh giá.
                </p>
              )}
              <button
                type="button"
                onClick={() => void startAssessment()}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Bắt đầu đánh giá
              </button>
            </div>
          )}
          {viewState === 'starting' && !assessment && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Đang tạo bài đánh giá…
            </p>
          )}
          {assessment && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm text-slate-600">
                  Khối {assessment.assessment.grade} · {assessment.questions.length} câu hỏi
                </div>
                <div
                  className={`flex items-center gap-2 font-mono text-lg font-semibold tabular-nums ${
                    expired ? 'text-rose-700' : 'text-slate-900'
                  }`}
                  aria-live="polite"
                  aria-label="Thời gian còn lại"
                >
                  <Clock3 className="h-4 w-4" />
                  {formatRemainingTime(remaining)}
                </div>
              </div>

              {expired ? (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">Thời gian đánh giá đã hết.</p>
                  <p className="mt-1">Các câu trả lời đã lưu được giữ lại. Bài đã hết hạn nên sẽ không được chấm điểm.</p>
                </div>
              ) : assessment.assessment.status !== 'in_progress' ? (
                <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  {assessment.assessment.status === 'completed'
                    ? 'Bài đánh giá đã được nộp.'
                    : 'Bài đánh giá đã kết thúc mà chưa được nộp.'}
                </div>
              ) : null}

              {errorMessage && (
                <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </p>
              )}
              {assessment.result && (
                <section
                  aria-label="Kết quả đánh giá"
                  className="rounded-xl border border-teal-200 bg-teal-50 p-5"
                >
                  <h3 className="font-semibold text-teal-950">Kết quả đánh giá</h3>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-teal-950">
                    {assessment.result.score} / {assessment.result.maximumScore} điểm
                    <span className="ml-2 text-base font-semibold">
                      ({assessment.result.percentage}%)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-teal-900">
                    Đã trả lời {assessment.result.answeredQuestions}/{assessment.result.totalQuestions} câu;
                    {' '}{assessment.result.fullyCorrectQuestions} câu đúng hoàn toàn.
                  </p>
                </section>
              )}
              {saving && (
                <p role="status" className="flex items-center gap-2 text-xs text-teal-800">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Đang lưu câu trả lời…
                </p>
              )}
              {assessment.questions.map((question, index) => {
                const saved = assessment.answers[question.id];
                const selection = selectionFor(saved);
                const disabled = expired || assessment.assessment.status !== 'in_progress' ||
                  saving;
                return (
                  <article key={question.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                        <span className="mr-2 text-teal-800">{index + 1}.</span>
                        {question.stem}
                      </h3>
                      {saved && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đã lưu
                        </span>
                      )}
                    </div>
                    {saved?.answerSelection && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void persistAnswer(question.id, null)}
                        className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Xóa câu trả lời
                      </button>
                    )}
                    {question.questionType === 'single_choice' ? (
                      <SingleChoiceQuestion
                        question={question}
                        selection={selection}
                        disabled={disabled}
                        onChange={(next) => void persistAnswer(question.id, next)}
                      />
                    ) : (
                      <TrueFalseQuestion
                        question={question}
                        selection={selection}
                        disabled={disabled}
                        onChange={(next) => void persistAnswer(question.id, next)}
                      />
                    )}
                  </article>
                );
              })}
              {assessment.assessment.status === 'in_progress' && !expired && (
                <div className="space-y-3 border-t border-slate-200 pt-5">
                  {confirmSubmit ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm text-amber-950">
                        Xác nhận nộp bài? Câu chưa trả lời sẽ được tính 0 điểm và bạn không thể sửa sau khi nộp.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void submitAssessment()}
                          disabled={saving || submitting}
                          className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                        >
                          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                          Xác nhận nộp bài
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(false)}
                          disabled={submitting}
                          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                        >
                          Tiếp tục làm bài
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSubmit(true)}
                      disabled={saving || submitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                    >
                      Nộp bài đánh giá
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
