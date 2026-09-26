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

export class ExerciseExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExerciseExtractionError';
  }
}

export async function extractQuestionsFromFile(
  file: ExerciseFilePayload,
  answerKeyFile?: ExerciseFilePayload
): Promise<ExerciseExtractionResponse> {
  let response: Response;
  try {
    response = await fetch('/api/exercises/extract-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, answerKeyFile }),
    });
  } catch {
    throw new ExerciseExtractionError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ExerciseExtractionError(
      `Không thể đọc phản hồi từ máy chủ (HTTP ${response.status}).`
    );
  }

  const responseBody =
    typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : undefined;
  const serverError =
    typeof responseBody?.error === 'string'
      ? responseBody.error
      : typeof responseBody?.note === 'string'
        ? responseBody.note
        : undefined;

  if (!response.ok) {
    throw new ExerciseExtractionError(
      serverError || `Máy chủ từ chối yêu cầu (HTTP ${response.status}).`
    );
  }

  if (typeof responseBody?.success !== 'boolean') {
    throw new ExerciseExtractionError('Phản hồi trích xuất từ máy chủ không hợp lệ.');
  }

  if (!responseBody.success) {
    throw new ExerciseExtractionError(serverError || 'Không thể trích xuất câu hỏi từ file.');
  }

  if (!Array.isArray(responseBody.questions) || responseBody.questions.length === 0) {
    throw new ExerciseExtractionError('Không tìm thấy câu hỏi nào trong file.');
  }

  return result as ExerciseExtractionResponse;
}
