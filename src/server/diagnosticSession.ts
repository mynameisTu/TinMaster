import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { callDiagnosticRpc } from './diagnosticRpc';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
type LatestCompletedSessionResolver = (
  userId: string,
  accessToken: string
) => Promise<string | null>;
const latestCompletedSessionResolverKey = Symbol.for(
  'tinmaster.diagnostic-latest-completed-session-resolver'
);

function recordFromRpc(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' && !Array.isArray(row)
    ? row as Record<string, unknown>
    : null;
}

function respondToRpcError(
  error: unknown,
  res: Parameters<RequestHandler>[1],
  context: 'read' | 'write' | 'submit'
): void {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'P0002') {
    res.status(404).json({
      error: 'Assessment not found.',
      code: 'ASSESSMENT_NOT_FOUND',
    });
    return;
  }
  if (code === '40001') {
    res.status(409).json({
      error: 'This answer changed elsewhere. Reload the assessment before retrying.',
      code: 'ANSWER_REVISION_CONFLICT',
    });
    return;
  }
  if (code === '55000') {
    res.status(409).json({
      error: context === 'submit'
        ? 'This assessment cannot be submitted in its current state.'
        : 'This assessment is no longer accepting answers.',
      code: context === 'submit'
        ? 'ASSESSMENT_NOT_SUBMITTABLE'
        : 'ASSESSMENT_NOT_ACCEPTING_ANSWERS',
    });
    return;
  }
  if (code === '22023' && context === 'write') {
    res.status(400).json({
      error: 'The answer does not match this assessment question.',
      code: 'ANSWER_INVALID',
    });
    return;
  }
  res.status(503).json({
    error: context === 'read'
      ? 'Không thể tải bài đánh giá. Vui lòng thử lại sau.'
      : context === 'submit'
        ? 'Không thể nộp bài đánh giá. Vui lòng thử lại sau.'
        : 'Không thể lưu câu trả lời. Vui lòng thử lại sau.',
    code: context === 'read'
      ? 'ASSESSMENT_STORAGE_UNAVAILABLE'
      : context === 'submit'
        ? 'ASSESSMENT_SUBMISSION_UNAVAILABLE'
        : 'ANSWER_STORAGE_UNAVAILABLE',
  });
}

function validSessionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function currentLatestCompletedSessionResolver(): LatestCompletedSessionResolver | null {
  return Reflect.get(globalThis, latestCompletedSessionResolverKey) as
    LatestCompletedSessionResolver | null ?? null;
}

async function resolveLatestCompletedSession(
  userId: string,
  accessToken: string
): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase session lookup is not configured.');
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client
    .from('diagnostic_sessions')
    .select('id')
    .eq('status', 'completed')
    .order('finalized_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.id === 'string' ? data.id : null;
}

export function configureLatestCompletedSessionResolver(
  resolver: LatestCompletedSessionResolver
): () => void {
  const previous = currentLatestCompletedSessionResolver();
  Reflect.set(globalThis, latestCompletedSessionResolverKey, resolver);
  return () => {
    if (previous) Reflect.set(globalThis, latestCompletedSessionResolverKey, previous);
    else Reflect.deleteProperty(globalThis, latestCompletedSessionResolverKey);
  };
}

function resultFromRpc(data: unknown): Record<string, unknown> | null {
  return recordFromRpc(data);
}

function publicResult(row: Record<string, unknown>) {
  const score = Number(row.score);
  const maximumScore = Number(row.maximum_score);
  const answeredQuestions = Number(row.answered_questions);
  const fullyCorrectQuestions = Number(row.fully_correct_questions);
  const totalQuestions = Number(row.total_questions);
  if (
    !Number.isFinite(score) ||
    !Number.isFinite(maximumScore) ||
    maximumScore <= 0 ||
    !Number.isSafeInteger(answeredQuestions) ||
    !Number.isSafeInteger(fullyCorrectQuestions) ||
    !Number.isSafeInteger(totalQuestions) ||
    score < 0 ||
    score > maximumScore ||
    answeredQuestions < 0 ||
    answeredQuestions > totalQuestions ||
    fullyCorrectQuestions < 0 ||
    fullyCorrectQuestions > answeredQuestions ||
    totalQuestions <= 0 ||
    typeof row.submitted_at !== 'string'
  ) {
    return null;
  }
  return {
    score,
    maximumScore,
    percentage: Number(((score / maximumScore) * 100).toFixed(1)),
    answeredQuestions,
    fullyCorrectQuestions,
    totalQuestions,
    submittedAt: row.submitted_at,
  };
}

export const getLatestDiagnosticAssessmentResultHandler: RequestHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId as string | undefined;
  const accessToken = readBearerToken(req.header('authorization'));
  if (!userId || !accessToken) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const resolver = currentLatestCompletedSessionResolver() ?? resolveLatestCompletedSession;
    const sessionId = await resolver(userId, accessToken);
    if (!sessionId) {
      res.status(200).json({ result: null });
      return;
    }
    if (!validSessionId(sessionId)) {
      res.status(503).json({
        error: 'Không thể tải kết quả đánh giá đã lưu.',
        code: 'ASSESSMENT_RESULT_UNAVAILABLE',
      });
      return;
    }
    const data = await callDiagnosticRpc('get_diagnostic_session_result', {
      p_user_id: userId,
      p_session_id: sessionId,
    });
    const row = resultFromRpc(data);
    const result = row ? publicResult(row) : null;
    if (!result) {
      res.status(503).json({
        error: 'Không thể tải kết quả đánh giá đã lưu.',
        code: 'ASSESSMENT_RESULT_UNAVAILABLE',
      });
      return;
    }
    res.status(200).json({ result });
  } catch {
    res.status(503).json({
      error: 'Không thể tải điểm năng lực. Vui lòng thử lại.',
      code: 'ASSESSMENT_RESULT_LOOKUP_FAILED',
    });
  }
};

export const getDiagnosticAssessmentHandler: RequestHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId as string | undefined;
  const sessionId = req.params.sessionId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid assessment ID.', code: 'ASSESSMENT_ID_INVALID' });
    return;
  }

  try {
    const data = await callDiagnosticRpc('get_diagnostic_session_state', {
      p_user_id: userId,
      p_session_id: sessionId,
    });
    const state = recordFromRpc(data);
    if (
      !state ||
      typeof state.session_id !== 'string' ||
      !Array.isArray(state.presentation_snapshot) ||
      !state.answer_selections ||
      typeof state.answer_selections !== 'object' ||
      Array.isArray(state.answer_selections)
    ) {
      res.status(404).json({ error: 'Assessment not found.', code: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    let result = null;
    if (state.status === 'completed') {
      const resultData = await callDiagnosticRpc('get_diagnostic_session_result', {
        p_user_id: userId,
        p_session_id: sessionId,
      });
      const resultRow = resultFromRpc(resultData);
      result = resultRow ? publicResult(resultRow) : null;
      if (!result) {
        res.status(503).json({
          error: 'Không thể tải kết quả bài đánh giá đã lưu.',
          code: 'ASSESSMENT_RESULT_UNAVAILABLE',
        });
        return;
      }
    }
    res.status(200).json({
      assessment: {
        id: state.session_id,
        grade: state.grade_snapshot,
        eligibleGrades: state.eligible_grades,
        questionBankVersion: state.question_bank_version,
        startedAt: state.started_at,
        deadlineAt: state.deadline_at,
        status: state.status,
        submittedAt: state.submitted_at,
        finalizedAt: state.finalized_at,
      },
      questions: state.presentation_snapshot,
      answers: state.answer_selections,
      result,
    });
  } catch (error) {
    respondToRpcError(error, res, 'read');
  }
};

export const submitDiagnosticAssessmentHandler: RequestHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId as string | undefined;
  const sessionId = req.params.sessionId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid assessment ID.', code: 'ASSESSMENT_ID_INVALID' });
    return;
  }

  try {
    const data = await callDiagnosticRpc('submit_diagnostic_session', {
      p_user_id: userId,
      p_session_id: sessionId,
    });
    const submission = recordFromRpc(data);
    if (!submission || !['completed', 'incomplete'].includes(String(submission.session_status))) {
      res.status(503).json({
        error: 'Không thể xác nhận trạng thái nộp bài.',
        code: 'ASSESSMENT_SUBMISSION_RESPONSE_INVALID',
      });
      return;
    }
    if (submission.session_status === 'incomplete') {
      res.status(200).json({ status: 'incomplete', result: null });
      return;
    }
    const result = publicResult(submission);
    if (!result) {
      res.status(503).json({
        error: 'Không thể tải kết quả bài đánh giá đã lưu.',
        code: 'ASSESSMENT_RESULT_UNAVAILABLE',
      });
      return;
    }
    res.status(200).json({ status: 'completed', result });
  } catch (error) {
    respondToRpcError(error, res, 'submit');
  }
};

function readExpectedRevision(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function writeDiagnosticAnswer(
  userId: string,
  sessionId: string,
  questionId: string,
  selection: unknown,
  expectedRevision: number,
  res: Parameters<RequestHandler>[1]
): Promise<void> {
  try {
    const result = await callDiagnosticRpc('save_diagnostic_answer', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_question_id: questionId,
      p_answer_selection: selection,
      p_expected_revision: expectedRevision,
    });
    const revision = typeof result === 'number'
      ? result
      : typeof result === 'string'
        ? Number(result)
        : NaN;
    if (!Number.isSafeInteger(revision) || revision < 1) {
      res.status(503).json({
        error: 'Không thể lưu câu trả lời. Vui lòng thử lại sau.',
        code: 'ANSWER_RESPONSE_INVALID',
      });
      return;
    }
    res.status(200).json({ revision });
  } catch (error) {
    respondToRpcError(error, res, 'write');
  }
}

export const saveDiagnosticAnswerHandler: RequestHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId as string | undefined;
  const sessionId = req.params.sessionId;
  const { questionId, answerSelection, expectedRevision } = req.body ?? {};
  if (!userId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid assessment ID.', code: 'ASSESSMENT_ID_INVALID' });
    return;
  }
  if (
    typeof questionId !== 'string' ||
    !QUESTION_ID_PATTERN.test(questionId) ||
    !Object.hasOwn(req.body ?? {}, 'answerSelection') ||
    !(answerSelection === null || isJsonObject(answerSelection))
  ) {
    res.status(400).json({ error: 'Invalid answer payload.', code: 'ANSWER_INVALID' });
    return;
  }
  const revision = readExpectedRevision(expectedRevision);
  if (revision === null) {
    res.status(400).json({
      error: 'A valid expected revision is required.',
      code: 'ANSWER_REVISION_INVALID',
    });
    return;
  }
  await writeDiagnosticAnswer(userId, sessionId, questionId, answerSelection, revision, res);
};

export const clearDiagnosticAnswerHandler: RequestHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId as string | undefined;
  const sessionId = req.params.sessionId;
  const questionId = req.params.questionId;
  const revision = readExpectedRevision(req.body?.expectedRevision);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid assessment ID.', code: 'ASSESSMENT_ID_INVALID' });
    return;
  }
  if (!QUESTION_ID_PATTERN.test(questionId)) {
    res.status(400).json({ error: 'Invalid question ID.', code: 'QUESTION_ID_INVALID' });
    return;
  }
  if (revision === null) {
    res.status(400).json({
      error: 'A valid expected revision is required.',
      code: 'ANSWER_REVISION_INVALID',
    });
    return;
  }
  await writeDiagnosticAnswer(userId, sessionId, questionId, null, revision, res);
};
