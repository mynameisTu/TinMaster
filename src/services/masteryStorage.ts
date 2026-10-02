import type { StudentMastery } from '../types';

export const LEGACY_MASTERY_STORAGE_KEY = 'tinmaster_masteries_v1';
const USER_MASTERY_STORAGE_PREFIX = 'tinmaster_masteries_v2:';

export interface MasteryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const browserMasteryStorage: MasteryStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

export interface LoadedMasteries {
  masteries: Record<string, StudentMastery>;
  canPersist: boolean;
}

export function hasVerifiedMasteryEvidence(
  mastery: StudentMastery | undefined
): mastery is StudentMastery {
  return !!mastery && Number.isInteger(mastery.totalAttempts) && mastery.totalAttempts > 0;
}

export function getVerifiedMastery(
  masteries: Record<string, StudentMastery>,
  conceptId: string
): StudentMastery | undefined {
  const mastery = masteries[conceptId];
  return hasVerifiedMasteryEvidence(mastery) ? mastery : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidStoredMastery(value: unknown, conceptId: string): value is StudentMastery {
  if (!isRecord(value)) return false;
  return value.conceptId === conceptId
    && typeof value.masteryScore === 'number'
    && value.masteryScore >= 0
    && value.masteryScore <= 1
    && typeof value.confidenceScore === 'number'
    && value.confidenceScore >= 0
    && value.confidenceScore <= 1
    && Number.isInteger(value.totalAttempts)
    && (value.totalAttempts as number) > 0
    && Number.isInteger(value.correctAttempts)
    && (value.correctAttempts as number) >= 0
    && (value.correctAttempts as number) <= (value.totalAttempts as number)
    && Number.isInteger(value.consecutiveSuccessStreak)
    && typeof value.lastPracticedAt === 'string'
    && typeof value.nextSpacedReviewAt === 'string'
    && ['improving', 'stable', 'declining'].includes(String(value.trend));
}

export function userMasteryStorageKey(userId: string): string {
  return `${USER_MASTERY_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

export function loadUserMasteries(storage: MasteryStorage, userId: string): LoadedMasteries {
  try {
    const saved = storage.getItem(userMasteryStorageKey(userId));
    if (saved === null) return { masteries: {}, canPersist: true };

    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed)) return { masteries: {}, canPersist: false };

    const masteries: Record<string, StudentMastery> = {};
    for (const [conceptId, value] of Object.entries(parsed)) {
      if (!isValidStoredMastery(value, conceptId)) {
        return { masteries, canPersist: false };
      }
      masteries[conceptId] = value;
    }
    return { masteries, canPersist: true };
  } catch {
    return { masteries: {}, canPersist: false };
  }
}

export function saveUserMasteries(
  storage: MasteryStorage,
  userId: string,
  masteries: Record<string, StudentMastery>
): boolean {
  try {
    storage.setItem(userMasteryStorageKey(userId), JSON.stringify(masteries));
    return true;
  } catch {
    return false;
  }
}
