export type LearningMode = 'structured' | 'focus_weak' | 'smart_review';

const LEARNING_MODE_STORAGE_PREFIX = 'tinmaster_learning_mode_v1:';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const browserPreferenceStorage: PreferenceStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

export interface LoadedLearningMode {
  mode: LearningMode;
  canPersist: boolean;
}

const LEARNING_MODES: readonly LearningMode[] = [
  'structured',
  'focus_weak',
  'smart_review',
];

export function isLearningMode(value: unknown): value is LearningMode {
  return LEARNING_MODES.includes(value as LearningMode);
}

export function learningModeStorageKey(userId: string): string {
  return `${LEARNING_MODE_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

export function loadLearningMode(
  storage: PreferenceStorage,
  userId: string
): LoadedLearningMode {
  try {
    const saved = storage.getItem(learningModeStorageKey(userId));
    if (saved === null) return { mode: 'structured', canPersist: true };
    if (isLearningMode(saved)) return { mode: saved, canPersist: true };
    return { mode: 'structured', canPersist: false };
  } catch {
    return { mode: 'structured', canPersist: false };
  }
}

export function saveLearningMode(
  storage: PreferenceStorage,
  userId: string,
  mode: LearningMode
): boolean {
  if (!isLearningMode(mode)) return false;
  try {
    storage.setItem(learningModeStorageKey(userId), mode);
    return true;
  } catch {
    return false;
  }
}
