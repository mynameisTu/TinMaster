import { SAMPLE_QUESTION_BANK } from '../data/questionBank';
import type { Question } from '../types';

export type DiagnosticGrade = 10 | 11 | 12;

export function getCumulativeDiagnosticGrades(grade: unknown): DiagnosticGrade[] {
  switch (grade) {
    case 10:
      return [10];
    case 11:
      return [10, 11];
    case 12:
      return [10, 11, 12];
    default:
      throw new RangeError('A valid student grade (10, 11, or 12) is required.');
  }
}

export function filterDiagnosticQuestionsByGrade(
  grade: unknown,
  questions: readonly Question[],
  examTrack?: unknown
): Question[] {
  const eligibleGrades = new Set(getCumulativeDiagnosticGrades(grade));
  if (
    examTrack !== undefined &&
    examTrack !== null &&
    examTrack !== 'CS' &&
    examTrack !== 'ICT'
  ) {
    throw new RangeError('A valid student exam orientation is required.');
  }
  return questions.filter((question) =>
    eligibleGrades.has(question.grade) &&
    (examTrack === undefined || examTrack === null ||
      question.track === 'ALL' || question.track === examTrack)
  );
}

export function selectBuiltInDiagnosticCandidates(
  grade: unknown,
  examTrack?: unknown
): Question[] {
  return filterDiagnosticQuestionsByGrade(grade, SAMPLE_QUESTION_BANK, examTrack);
}
