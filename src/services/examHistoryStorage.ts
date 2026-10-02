import type { ExamAttemptRecord } from '../data/examCatalogData';

export const LEGACY_EXAM_HISTORY_STORAGE_KEY = 'tinmaster_student_exam_history_v1';
const USER_EXAM_HISTORY_STORAGE_PREFIX = 'tinmaster_student_exam_history_v2:';

export interface ExamHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadedExamHistory {
  records: ExamAttemptRecord[];
  canPersist: boolean;
}

function isExamAttemptRecord(value: unknown): value is ExamAttemptRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<ExamAttemptRecord>;
  return typeof record.id === 'string'
    && typeof record.examId === 'string'
    && typeof record.examTitle === 'string'
    && typeof record.dateTaken === 'string'
    && typeof record.score === 'number'
    && Number.isFinite(record.score)
    && typeof record.maxScore === 'number'
    && Number.isFinite(record.maxScore)
    && Number.isInteger(record.totalQuestions)
    && Number.isInteger(record.correctCount)
    && Number.isFinite(record.durationSeconds)
    && Number.isFinite(record.accuracy);
}

export function userExamHistoryStorageKey(userId: string): string {
  return `${USER_EXAM_HISTORY_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

export function loadUserExamHistory(
  storage: ExamHistoryStorage,
  userId: string
): LoadedExamHistory {
  try {
    const saved = storage.getItem(userExamHistoryStorageKey(userId));
    if (saved === null) return { records: [], canPersist: true };
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isExamAttemptRecord)) {
      return { records: [], canPersist: false };
    }
    return { records: parsed, canPersist: true };
  } catch {
    return { records: [], canPersist: false };
  }
}

export function saveUserExamHistory(
  storage: ExamHistoryStorage,
  userId: string,
  records: ExamAttemptRecord[]
): boolean {
  try {
    storage.setItem(userExamHistoryStorageKey(userId), JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export const browserExamHistoryStorage: ExamHistoryStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
