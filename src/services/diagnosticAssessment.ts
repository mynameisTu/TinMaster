import type { PublicQuestionPresentation } from '../types';
import { authenticatedFetch } from './apiClient';

export interface DiagnosticAssessmentSummary {
  id: string;
  grade: number;
  eligibleGrades: number[];
  questionBankVersion?: string;
  startedAt: string;
  deadlineAt: string;
  status: 'in_progress' | 'completed' | 'incomplete';
  targetDurationMinutes?: number;
  persisted?: boolean;
  submittedAt?: string | null;
  finalizedAt?: string | null;
}

export interface DiagnosticSavedAnswer {
  revision: number;
  answerSelection: Record<string, unknown> | null;
}

export interface DiagnosticAssessmentState {
  assessment: DiagnosticAssessmentSummary;
  questions: PublicQuestionPresentation[];
  answers: Record<string, DiagnosticSavedAnswer>;
  result: DiagnosticAssessmentResult | null;
}

export interface DiagnosticAssessmentResult {
  score: number;
  maximumScore: number;
  percentage: number;
  answeredQuestions: number;
  fullyCorrectQuestions: number;
  totalQuestions: number;
  submittedAt: string;
}

export interface DiagnosticAssessmentSubmission {
  status: 'completed' | 'incomplete';
  result: DiagnosticAssessmentResult | null;
}

export function normalizeDiagnosticCompetencyScore(
  result: DiagnosticAssessmentResult | null
): number | null {
  if (
    !result ||
    !Number.isFinite(result.score) ||
    !Number.isFinite(result.maximumScore) ||
    result.maximumScore <= 0 ||
    result.score < 0 ||
    result.score > result.maximumScore ||
    result.totalQuestions <= 0 ||
    result.answeredQuestions < 0 ||
    result.answeredQuestions > result.totalQuestions
  ) {
    return null;
  }
  return Number(((result.score / result.maximumScore) * 10).toFixed(1));
}

export interface DiagnosticAssessmentStartResponse {
  assessment: DiagnosticAssessmentSummary;
  questions: PublicQuestionPresentation[];
}

export class DiagnosticAssessmentApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = 'DiagnosticAssessmentApiError';
    this.status = status;
    this.code = code;
  }
}

function userStorageKey(userId: string, kind: 'session' | 'idempotency'): string {
  return `tinmaster_diagnostic_${kind}_v1_${encodeURIComponent(userId)}`;
}

export function loadDiagnosticSessionId(
  storage: Pick<Storage, 'getItem'>,
  userId: string
): string | null {
  try {
    return storage.getItem(userStorageKey(userId, 'session'));
  } catch {
    return null;
  }
}

export function saveDiagnosticSessionId(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  sessionId: string
): boolean {
  try {
    storage.setItem(userStorageKey(userId, 'session'), sessionId);
    return true;
  } catch {
    return false;
  }
}

export function removeDiagnosticSessionId(
  storage: Pick<Storage, 'removeItem'>,
  userId: string
): void {
  try {
    storage.removeItem(userStorageKey(userId, 'session'));
  } catch {
    // The server remains authoritative if browser storage is unavailable.
  }
}

export function loadDiagnosticIdempotencyKey(
  storage: Pick<Storage, 'getItem'>,
  userId: string
): string | null {
  try {
    return storage.getItem(userStorageKey(userId, 'idempotency'));
  } catch {
    return null;
  }
}

export function saveDiagnosticIdempotencyKey(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  idempotencyKey: string
): boolean {
  try {
    storage.setItem(userStorageKey(userId, 'idempotency'), idempotencyKey);
    return true;
  } catch {
    return false;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new DiagnosticAssessmentApiError(
      0,
      'ASSESSMENT_NETWORK_ERROR',
      'Không thể kết nối với máy chủ bài đánh giá. Vui lòng kiểm tra kết nối và thử lại.'
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await response.json() as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('Expected a JSON object response.');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    const isMissingRoute = response.status === 404;
    throw new DiagnosticAssessmentApiError(
      response.status,
      isMissingRoute ? 'ASSESSMENT_API_NOT_FOUND' : 'ASSESSMENT_RESPONSE_INVALID',
      isMissingRoute
        ? 'Không tìm thấy API bài đánh giá. Hãy khởi động lại máy chủ và tải lại trang.'
        : 'Máy chủ bài đánh giá trả về phản hồi không hợp lệ. Vui lòng thử lại.'
    );
  }

  if (!response.ok) {
    const code = typeof body.code === 'string' ? body.code : null;
    const message = typeof body.error === 'string'
      ? body.error
      : `Không thể thực hiện yêu cầu đánh giá (HTTP ${response.status}).`;
    throw new DiagnosticAssessmentApiError(response.status, code, message);
  }
  return body as T;
}

export function startDiagnosticAssessment(
  idempotencyKey: string
): Promise<DiagnosticAssessmentStartResponse> {
  return requestJson('/api/diagnostic/assessment/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
}

export function getDiagnosticAssessment(
  sessionId: string
): Promise<DiagnosticAssessmentState> {
  return requestJson(`/api/diagnostic/assessment/${encodeURIComponent(sessionId)}`);
}

export function saveDiagnosticAnswer(
  sessionId: string,
  questionId: string,
  answerSelection: Record<string, unknown>,
  expectedRevision: number
): Promise<{ revision: number }> {
  return requestJson(
    `/api/diagnostic/assessment/${encodeURIComponent(sessionId)}/answers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answerSelection, expectedRevision }),
    }
  );
}

export function clearDiagnosticAnswer(
  sessionId: string,
  questionId: string,
  expectedRevision: number
): Promise<{ revision: number }> {
  return requestJson(
    `/api/diagnostic/assessment/${encodeURIComponent(sessionId)}/answers/${encodeURIComponent(questionId)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision }),
    }
  );
}

export function submitDiagnosticAssessment(
  sessionId: string
): Promise<DiagnosticAssessmentSubmission> {
  return requestJson(
    `/api/diagnostic/assessment/${encodeURIComponent(sessionId)}/submit`,
    { method: 'POST' }
  );
}

export function getLatestDiagnosticAssessmentResult(): Promise<{
  result: DiagnosticAssessmentResult | null;
}> {
  return requestJson('/api/diagnostic/assessment/latest-result');
}
