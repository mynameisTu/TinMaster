import { Question } from '../types';

export interface ExerciseFilePayload {
  name: string;
  type?: string;
  mimeType?: string;
  base64: string;
}

export interface ExerciseExtractionResponse {
  success: boolean;
  fileName?: string;
  questions?: Question[];
  count?: number;
  note?: string;
  error?: string;
}

export async function extractQuestionsFromFile(
  file: ExerciseFilePayload,
  answerKeyFile?: ExerciseFilePayload
): Promise<ExerciseExtractionResponse> {
  const response = await fetch('/api/exercises/extract-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, answerKeyFile }),
  });

  return response.json();
}
