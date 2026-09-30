export type GeminiErrorCategory =
  | 'overloaded'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'timeout'
  | 'network'
  | 'cancelled'
  | 'deadline_exceeded'
  | 'invalid_json'
  | 'invalid_schema'
  | 'configuration'
  | 'unknown';

export interface GeminiResilienceOptions {
  primaryModel: string;
  fallbackModel?: string;
  maxRetries?: number;
  perAttemptTimeoutMs?: number;
  overallDeadlineMs?: number;
  responseReserveMs?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export interface GeminiGenerationAttempt {
  signal: AbortSignal;
  timeoutMs: number;
}

export interface GeminiGenerationResult<T> {
  value: T;
  model: string;
  retryCount: number;
  durationMs: number;
}

export class GeminiResilienceError extends Error {
  readonly category: GeminiErrorCategory;
  readonly model: string;
  readonly retryCount: number;
  readonly durationMs: number;
  readonly fallbackConfigured: boolean;

  constructor(
    message: string,
    details: {
      category: GeminiErrorCategory;
      model: string;
      retryCount: number;
      durationMs: number;
      fallbackConfigured: boolean;
      cause?: unknown;
    }
  ) {
    super(message, { cause: details.cause });
    this.name = 'GeminiResilienceError';
    this.category = details.category;
    this.model = details.model;
    this.retryCount = details.retryCount;
    this.durationMs = details.durationMs;
    this.fallbackConfigured = details.fallbackConfigured;
  }
}

export class GeminiResponseError extends Error {
  constructor(
    message: string,
    readonly category: 'invalid_json' | 'invalid_schema'
  ) {
    super(message);
    this.name = 'GeminiResponseError';
  }
}

interface ErrorMetadata {
  status?: number;
  retryAfterMs?: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000;
const DEFAULT_OVERALL_DEADLINE_MS = 180_000;
const DEFAULT_RESPONSE_RESERVE_MS = 15_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 8_000;

export function getRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function classifyGeminiError(error: unknown): GeminiErrorCategory {
  const metadata = error as ErrorMetadata | null;
  const status = typeof metadata?.status === 'number' ? metadata.status : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (status === 429) {
    const looksLikeQuotaExhaustion =
      /(you exceeded.{0,40}quota|quota.{0,50}(?:exceed|exhaust|limit|deplet|reach)|(?:exhaust|exceed).{0,50}quota|billing|daily limit|per.day|limit\s*:\s*0|insufficient quota)/i.test(message) &&
      !/(check|review).{0,20}quota|per.minute|per.second|rate.limit|too many requests|temporarily/i.test(message);
    return looksLikeQuotaExhaustion ? 'quota_exhausted' : 'rate_limited';
  }

  if (status === 502 || status === 503 || status === 504) return 'overloaded';
  if (message.includes('cancel')) return 'cancelled';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (status === undefined && /(fetch failed|network|socket|econnreset|eai_again)/i.test(message)) {
    return 'network';
  }
  return 'unknown';
}

function isRetryable(category: GeminiErrorCategory): boolean {
  return category === 'overloaded' || category === 'rate_limited' || category === 'timeout' || category === 'network';
}

function getRetryAfterMsFromError(error: unknown): number | undefined {
  const retryAfterMs = (error as ErrorMetadata | null)?.retryAfterMs;
  return typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs)
    ? Math.max(0, retryAfterMs)
    : undefined;
}

function createAbortError(): Error {
  return new Error('Gemini generation cancelled');
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function runAttempt<T>(
  generate: (model: string, attempt: GeminiGenerationAttempt) => Promise<T>,
  model: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<T> {
  if (externalSignal?.aborted) throw createAbortError();

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort(new Error('Gemini attempt timed out'));
      reject(new Error('Gemini attempt timed out'));
    }, timeoutMs);
  });

  const cancellationPromise = externalSignal
    ? new Promise<never>((_, reject) => {
        abortListener = () => {
          controller.abort(externalSignal.reason);
          reject(createAbortError());
        };
        externalSignal.addEventListener('abort', abortListener, { once: true });
      })
    : undefined;

  try {
    const requests = [
      generate(model, { signal: controller.signal, timeoutMs }),
      timeoutPromise,
    ];
    if (cancellationPromise) requests.push(cancellationPromise);
    return await Promise.race(requests);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (abortListener && externalSignal) {
      externalSignal.removeEventListener('abort', abortListener);
    }
  }
}

export async function generateWithGeminiResilience<T>(
  generate: (model: string, attempt: GeminiGenerationAttempt) => Promise<T>,
  options: GeminiResilienceOptions
): Promise<GeminiGenerationResult<T>> {
  const now = options.now || Date.now;
  const random = options.random || Math.random;
  const wait = options.sleep || sleep;
  const startedAt = now();
  const deadline = startedAt + (options.overallDeadlineMs ?? DEFAULT_OVERALL_DEADLINE_MS);
  const reserveMs = options.responseReserveMs ?? DEFAULT_RESPONSE_RESERVE_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const retryMaxDelayMs = options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  const models = [options.primaryModel];

  if (options.fallbackModel && options.fallbackModel !== options.primaryModel) {
    models.push(options.fallbackModel);
  }

  let retryCount = 0;
  let lastError: unknown;
  let lastCategory: GeminiErrorCategory = 'unknown';
  let lastModel = options.primaryModel;

  const throwFailure = (category: GeminiErrorCategory, cause?: unknown): never => {
    const fallbackConfigured = models.length > 1;
    const message =
      category === 'quota_exhausted'
        ? 'Gemini API quota is exhausted. Check the project quota and billing configuration.'
        : category === 'deadline_exceeded'
          ? 'Gemini extraction stopped before the function deadline to allow a response to be returned.'
          : category === 'cancelled'
            ? 'Gemini extraction was cancelled.'
            : !fallbackConfigured && isRetryable(category)
              ? 'Gemini is temporarily unavailable and no fallback model is configured.'
              : 'Gemini extraction failed after the available attempts.';

    throw new GeminiResilienceError(message, {
      category,
      model: lastModel,
      retryCount,
      durationMs: Math.max(0, now() - startedAt),
      fallbackConfigured,
      cause,
    });
  };

  for (const model of models) {
    lastModel = model;
    const attemptsForModel = model === options.primaryModel ? maxRetries + 1 : 1;
    for (let modelAttempt = 0; modelAttempt < attemptsForModel; modelAttempt += 1) {
      if (options.signal?.aborted) throwFailure('cancelled', options.signal.reason);

      const remainingMs = deadline - now();
      const timeoutMs = Math.min(
        options.perAttemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
        remainingMs - reserveMs
      );

      if (timeoutMs <= 0) throwFailure('deadline_exceeded', lastError);

      try {
        const value = await runAttempt(generate, model, timeoutMs, options.signal);
        return {
          value,
          model,
          retryCount,
          durationMs: Math.max(0, now() - startedAt),
        };
      } catch (error) {
        lastError = error;
        lastCategory = classifyGeminiError(error);

        if (lastCategory === 'cancelled' || !isRetryable(lastCategory)) {
          throwFailure(lastCategory, error);
        }

        const hasSameModelRetry = modelAttempt + 1 < attemptsForModel;
        const hasFallback = model === options.primaryModel && models.length > 1;
        if (!hasSameModelRetry && !hasFallback) {
          throwFailure(lastCategory, error);
        }

        const exponent = Math.max(0, modelAttempt);
        const jitterDelay = Math.floor(
          random() * Math.min(retryMaxDelayMs, retryBaseDelayMs * 2 ** exponent)
        );
        const delayMs = Math.max(jitterDelay, getRetryAfterMsFromError(error) || 0);
        const timeBeforeDeadline = deadline - now() - reserveMs;

        if (delayMs >= timeBeforeDeadline) {
          throwFailure('deadline_exceeded', error);
        }

        retryCount += 1;
        try {
          await wait(delayMs, options.signal);
        } catch (waitError) {
          if (options.signal?.aborted) throwFailure('cancelled', waitError);
          throw waitError;
        }
      }
    }
  }

  return throwFailure(lastCategory, lastError);
}

export function parseAndValidateExtractedQuestions(responseText: string): Record<string, unknown>[] {
  const cleanJson = responseText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanJson);
  } catch (error) {
    throw new GeminiResponseError('Gemini returned invalid JSON.', 'invalid_json');
  }

  const questions =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions)
        ? (parsed as { questions: unknown[] }).questions
        : undefined;

  if (!questions || questions.length === 0 || !questions.every(isValidQuestion)) {
    throw new GeminiResponseError(
      'Gemini returned questions that do not match the expected question schema.',
      'invalid_schema'
    );
  }

  return questions as Record<string, unknown>[];
}

function isValidQuestion(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const question = value as Record<string, unknown>;
  if (typeof question.stem !== 'string' || !question.stem.trim()) return false;

  if (question.questionType === 'single_choice') {
    if (!Array.isArray(question.singleChoiceOptions) || question.singleChoiceOptions.length !== 4) {
      return false;
    }
    const labels = new Set<string>();
    return question.singleChoiceOptions.every((option) => {
      if (typeof option !== 'object' || option === null) return false;
      const candidate = option as Record<string, unknown>;
      if (
        !['A', 'B', 'C', 'D'].includes(String(candidate.label)) ||
        typeof candidate.text !== 'string' ||
        typeof candidate.isCorrect !== 'boolean'
      ) {
        return false;
      }
      labels.add(candidate.label as string);
      return true;
    }) && labels.size === 4;
  }

  if (question.questionType === 'true_false_multistatement') {
    if (!Array.isArray(question.trueFalseStatements) || question.trueFalseStatements.length !== 4) {
      return false;
    }
    const orders = new Set<string>();
    return question.trueFalseStatements.every((statement) => {
      if (typeof statement !== 'object' || statement === null) return false;
      const candidate = statement as Record<string, unknown>;
      if (
        !['a', 'b', 'c', 'd'].includes(String(candidate.subOrder)) ||
        typeof candidate.statementText !== 'string' ||
        typeof candidate.isCorrect !== 'boolean'
      ) {
        return false;
      }
      orders.add(candidate.subOrder as string);
      return true;
    }) && orders.size === 4;
  }

  return false;
}
