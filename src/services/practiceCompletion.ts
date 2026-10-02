import type { AdaptivePracticeResult, StudentMastery } from '../types';

export const PRACTICE_MASTERY_UPDATE_ERROR =
  'Không thể cập nhật tiến độ học tập. Kết quả luyện tập hiện chưa được lưu.';

export function completeAdaptivePractice(
  masteries: Record<string, StudentMastery>,
  results: AdaptivePracticeResult[],
  updateMasteries: (
    masteries: Record<string, StudentMastery>,
    results: AdaptivePracticeResult[]
  ) => Record<string, StudentMastery>,
  onSuccess: (updatedMasteries: Record<string, StudentMastery>) => void,
  onError: (message: string) => void
): boolean {
  let updatedMasteries: Record<string, StudentMastery>;
  try {
    updatedMasteries = updateMasteries(masteries, results);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.error('Adaptive practice mastery update failed.', error);
    }
    onError(PRACTICE_MASTERY_UPDATE_ERROR);
    return false;
  }

  onSuccess(updatedMasteries);
  return true;
}
