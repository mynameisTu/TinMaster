import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';

export type RateLimitEndpoint =
  | '/api/ai/explain'
  | '/api/ai/video-script'
  | '/api/exercises/extract-file';

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

type RateLimitConsumer = (
  userId: string,
  endpoint: RateLimitEndpoint,
  token: string
) => Promise<RateLimitDecision>;

class RateLimitStoreError extends Error {}

async function consumeSupabaseRateLimit(
  _verifiedUserId: string,
  endpoint: RateLimitEndpoint,
  token: string
): Promise<RateLimitDecision> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new RateLimitStoreError('Rate limit store is not configured.');

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await userClient.rpc('consume_api_rate_limit', {
    p_endpoint: endpoint,
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (
    typeof result?.allowed !== 'boolean' ||
    !Number.isFinite(Number(result.retry_after_seconds))
  ) {
    throw new RateLimitStoreError('Rate limit store returned an invalid decision.');
  }

  return {
    allowed: result.allowed,
    retryAfterSeconds: Math.max(1, Math.ceil(Number(result.retry_after_seconds))),
  };
}

const consumerKey = Symbol.for('tinmaster.rate-limit-consumer');

function currentConsumer(): RateLimitConsumer {
  return (Reflect.get(globalThis, consumerKey) as RateLimitConsumer | undefined) ??
    consumeSupabaseRateLimit;
}

export function configureRateLimitConsumer(consumer: RateLimitConsumer): () => void {
  const previous = Reflect.get(globalThis, consumerKey) as RateLimitConsumer | undefined;
  Reflect.set(globalThis, consumerKey, consumer);
  return () => {
    if (previous) Reflect.set(globalThis, consumerKey, previous);
    else Reflect.deleteProperty(globalThis, consumerKey);
  };
}

export function rateLimitGemini(endpoint: RateLimitEndpoint): RequestHandler {
  return async (req, res, next) => {
    const userId = res.locals.authenticatedUserId as string | undefined;
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!userId || !match) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    try {
      const decision = await currentConsumer()(userId, endpoint, match[1]);
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res.status(429).json({
          error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: decision.retryAfterSeconds,
        });
        return;
      }
      next();
    } catch {
      console.error('[rate-limit] Shared rate limit store unavailable.');
      res.status(503).json({
        error: 'Không thể xác minh giới hạn yêu cầu. Vui lòng thử lại sau.',
        code: 'RATE_LIMIT_STORE_UNAVAILABLE',
      });
    }
  };
}
