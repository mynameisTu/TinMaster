// src/server/api.ts
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";

// src/server/supabaseAuth.ts
import { createClient } from "@supabase/supabase-js";
var SupabaseAuthConfigurationError = class extends Error {
};
var cachedClient = null;
async function verifySupabaseAccessToken(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseAuthConfigurationError("Supabase Auth is not configured.");
  }
  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    });
  }
  const { data, error } = await cachedClient.auth.getUser(token);
  if (error) {
    const status = error.status;
    if (status === 401 || status === 403) return null;
    throw error;
  }
  return data.user;
}
async function resolveSupabaseProfileRole(userId, token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseAuthConfigurationError("Supabase Auth is not configured.");
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await userClient.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data || !["student", "teacher", "admin"].includes(data.role)) return null;
  return data.role;
}
var verifierKey = /* @__PURE__ */ Symbol.for("tinmaster.access-token-verifier");
var profileRoleResolverKey = /* @__PURE__ */ Symbol.for("tinmaster.profile-role-resolver");
function currentVerifier() {
  return Reflect.get(globalThis, verifierKey) ?? verifySupabaseAccessToken;
}
function currentProfileRoleResolver() {
  return Reflect.get(globalThis, profileRoleResolverKey) ?? resolveSupabaseProfileRole;
}
var requireSupabaseUser = async (req, res, next) => {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
    return;
  }
  try {
    const user = await currentVerifier()(match[1]);
    if (!user) {
      res.status(401).json({
        error: "Invalid or expired authentication session",
        code: "AUTH_INVALID"
      });
      return;
    }
    res.locals.authenticatedUserId = user.id;
    next();
  } catch (error) {
    if (error instanceof SupabaseAuthConfigurationError) {
      res.status(503).json({
        error: "Authentication service is not configured",
        code: "AUTH_CONFIGURATION"
      });
      return;
    }
    console.error("[auth] Supabase token verification failed.");
    res.status(503).json({
      error: "Authentication service is temporarily unavailable",
      code: "AUTH_UNAVAILABLE"
    });
  }
};
function requireSupabaseRole(allowedRoles) {
  return async (req, res, next) => {
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    const userId = res.locals.authenticatedUserId;
    if (!match || !userId) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
      return;
    }
    try {
      const role = await currentProfileRoleResolver()(userId, match[1]);
      if (!role) {
        res.status(403).json({
          error: "T\xE0i kho\u1EA3n ch\u01B0a c\xF3 h\u1ED3 s\u01A1 ho\u1EB7c vai tr\xF2 h\u1EE3p l\u1EC7.",
          code: "PROFILE_UNAVAILABLE"
        });
        return;
      }
      if (!allowedRoles.includes(role)) {
        res.status(403).json({
          error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EED d\u1EE5ng ch\u1EE9c n\u0103ng n\xE0y.",
          code: "FORBIDDEN"
        });
        return;
      }
      res.locals.authenticatedUserRole = role;
      next();
    } catch (error) {
      if (error instanceof SupabaseAuthConfigurationError) {
        res.status(503).json({
          error: "D\u1ECBch v\u1EE5 h\u1ED3 s\u01A1 ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.",
          code: "PROFILE_CONFIGURATION"
        });
        return;
      }
      console.error("[auth] Supabase profile role lookup failed.");
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i h\u1ED3 s\u01A1 quy\u1EC1n h\u1EA1n. Vui l\xF2ng th\u1EED l\u1EA1i.",
        code: "PROFILE_LOOKUP_FAILED"
      });
    }
  };
}

// src/server/rateLimit.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var RateLimitStoreError = class extends Error {
};
async function consumeSupabaseRateLimit(_verifiedUserId, endpoint, token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new RateLimitStoreError("Rate limit store is not configured.");
  const userClient = createClient2(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await userClient.rpc("consume_api_rate_limit", {
    p_endpoint: endpoint
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (typeof result?.allowed !== "boolean" || !Number.isFinite(Number(result.retry_after_seconds))) {
    throw new RateLimitStoreError("Rate limit store returned an invalid decision.");
  }
  return {
    allowed: result.allowed,
    retryAfterSeconds: Math.max(1, Math.ceil(Number(result.retry_after_seconds)))
  };
}
var consumerKey = /* @__PURE__ */ Symbol.for("tinmaster.rate-limit-consumer");
function currentConsumer() {
  return Reflect.get(globalThis, consumerKey) ?? consumeSupabaseRateLimit;
}
function rateLimitGemini(endpoint) {
  return async (req, res, next) => {
    const userId = res.locals.authenticatedUserId;
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!userId || !match) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
      return;
    }
    try {
      const decision = await currentConsumer()(userId, endpoint, match[1]);
      if (!decision.allowed) {
        res.setHeader("Retry-After", String(decision.retryAfterSeconds));
        res.status(429).json({
          error: "B\u1EA1n \u0111\xE3 g\u1EEDi qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
          code: "RATE_LIMITED",
          retryAfterSeconds: decision.retryAfterSeconds
        });
        return;
      }
      next();
    } catch {
      console.error("[rate-limit] Shared rate limit store unavailable.");
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 x\xE1c minh gi\u1EDBi h\u1EA1n y\xEAu c\u1EA7u. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "RATE_LIMIT_STORE_UNAVAILABLE"
      });
    }
  };
}

// src/server/geminiResilience.ts
var GeminiResilienceError = class extends Error {
  constructor(message, details) {
    super(message, { cause: details.cause });
    this.name = "GeminiResilienceError";
    this.category = details.category;
    this.model = details.model;
    this.retryCount = details.retryCount;
    this.durationMs = details.durationMs;
    this.fallbackConfigured = details.fallbackConfigured;
  }
};
var GeminiResponseError = class extends Error {
  constructor(message, category) {
    super(message);
    this.category = category;
    this.name = "GeminiResponseError";
  }
};
var DEFAULT_MAX_RETRIES = 2;
var DEFAULT_ATTEMPT_TIMEOUT_MS = 3e4;
var DEFAULT_OVERALL_DEADLINE_MS = 18e4;
var DEFAULT_RESPONSE_RESERVE_MS = 15e3;
var DEFAULT_RETRY_BASE_DELAY_MS = 500;
var DEFAULT_RETRY_MAX_DELAY_MS = 8e3;
function getRetryAfterMs(value, now = Date.now()) {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1e3;
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : void 0;
}
function classifyGeminiError(error) {
  const metadata = error;
  const status = typeof metadata?.status === "number" ? metadata.status : void 0;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (status === 429) {
    const looksLikeQuotaExhaustion = /(you exceeded.{0,40}quota|quota.{0,50}(?:exceed|exhaust|limit|deplet|reach)|(?:exhaust|exceed).{0,50}quota|billing|daily limit|per.day|limit\s*:\s*0|insufficient quota)/i.test(message) && !/(check|review).{0,20}quota|per.minute|per.second|rate.limit|too many requests|temporarily/i.test(message);
    return looksLikeQuotaExhaustion ? "quota_exhausted" : "rate_limited";
  }
  if (status === 502 || status === 503 || status === 504) return "overloaded";
  if (message.includes("cancel")) return "cancelled";
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (status === void 0 && /(fetch failed|network|socket|econnreset|eai_again)/i.test(message)) {
    return "network";
  }
  return "unknown";
}
function isRetryable(category) {
  return category === "overloaded" || category === "rate_limited" || category === "timeout" || category === "network";
}
function getRetryAfterMsFromError(error) {
  const retryAfterMs = error?.retryAfterMs;
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : void 0;
}
function createAbortError() {
  return new Error("Gemini generation cancelled");
}
function sleep(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function runAttempt(generate, model, timeoutMs, externalSignal) {
  if (externalSignal?.aborted) throw createAbortError();
  const controller = new AbortController();
  let timeout;
  let abortListener;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort(new Error("Gemini attempt timed out"));
      reject(new Error("Gemini attempt timed out"));
    }, timeoutMs);
  });
  const cancellationPromise = externalSignal ? new Promise((_, reject) => {
    abortListener = () => {
      controller.abort(externalSignal.reason);
      reject(createAbortError());
    };
    externalSignal.addEventListener("abort", abortListener, { once: true });
  }) : void 0;
  try {
    const requests = [
      generate(model, { signal: controller.signal, timeoutMs }),
      timeoutPromise
    ];
    if (cancellationPromise) requests.push(cancellationPromise);
    return await Promise.race(requests);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (abortListener && externalSignal) {
      externalSignal.removeEventListener("abort", abortListener);
    }
  }
}
async function generateWithGeminiResilience(generate, options) {
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
  let lastError;
  let lastCategory = "unknown";
  let lastModel = options.primaryModel;
  const throwFailure = (category, cause) => {
    const fallbackConfigured = models.length > 1;
    const message = category === "quota_exhausted" ? "Gemini API quota is exhausted. Check the project quota and billing configuration." : category === "deadline_exceeded" ? "Gemini extraction stopped before the function deadline to allow a response to be returned." : category === "cancelled" ? "Gemini extraction was cancelled." : !fallbackConfigured && isRetryable(category) ? "Gemini is temporarily unavailable and no fallback model is configured." : "Gemini extraction failed after the available attempts.";
    throw new GeminiResilienceError(message, {
      category,
      model: lastModel,
      retryCount,
      durationMs: Math.max(0, now() - startedAt),
      fallbackConfigured,
      cause
    });
  };
  for (const model of models) {
    lastModel = model;
    const attemptsForModel = model === options.primaryModel ? maxRetries + 1 : 1;
    for (let modelAttempt = 0; modelAttempt < attemptsForModel; modelAttempt += 1) {
      if (options.signal?.aborted) throwFailure("cancelled", options.signal.reason);
      const remainingMs = deadline - now();
      const timeoutMs = Math.min(
        options.perAttemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
        remainingMs - reserveMs
      );
      if (timeoutMs <= 0) throwFailure("deadline_exceeded", lastError);
      try {
        const value = await runAttempt(generate, model, timeoutMs, options.signal);
        return {
          value,
          model,
          retryCount,
          durationMs: Math.max(0, now() - startedAt)
        };
      } catch (error) {
        lastError = error;
        lastCategory = classifyGeminiError(error);
        if (lastCategory === "cancelled" || !isRetryable(lastCategory)) {
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
          throwFailure("deadline_exceeded", error);
        }
        retryCount += 1;
        try {
          await wait(delayMs, options.signal);
        } catch (waitError) {
          if (options.signal?.aborted) throwFailure("cancelled", waitError);
          throw waitError;
        }
      }
    }
  }
  return throwFailure(lastCategory, lastError);
}
function parseAndValidateExtractedQuestions(responseText) {
  const cleanJson = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (error) {
    throw new GeminiResponseError("Gemini returned invalid JSON.", "invalid_json");
  }
  const questions = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray(parsed.questions) ? parsed.questions : void 0;
  if (!questions || questions.length === 0 || !questions.every(isValidQuestion)) {
    throw new GeminiResponseError(
      "Gemini returned questions that do not match the expected question schema.",
      "invalid_schema"
    );
  }
  return questions;
}
function isValidQuestion(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const question = value;
  if (typeof question.stem !== "string" || !question.stem.trim()) return false;
  if (question.questionType === "single_choice") {
    if (!Array.isArray(question.singleChoiceOptions) || question.singleChoiceOptions.length !== 4) {
      return false;
    }
    const labels = /* @__PURE__ */ new Set();
    return question.singleChoiceOptions.every((option) => {
      if (typeof option !== "object" || option === null) return false;
      const candidate = option;
      if (!["A", "B", "C", "D"].includes(String(candidate.label)) || typeof candidate.text !== "string" || typeof candidate.isCorrect !== "boolean") {
        return false;
      }
      labels.add(candidate.label);
      return true;
    }) && labels.size === 4;
  }
  if (question.questionType === "true_false_multistatement") {
    if (!Array.isArray(question.trueFalseStatements) || question.trueFalseStatements.length !== 4) {
      return false;
    }
    const orders = /* @__PURE__ */ new Set();
    return question.trueFalseStatements.every((statement) => {
      if (typeof statement !== "object" || statement === null) return false;
      const candidate = statement;
      if (!["a", "b", "c", "d"].includes(String(candidate.subOrder)) || typeof candidate.statementText !== "string" || typeof candidate.isCorrect !== "boolean") {
        return false;
      }
      orders.add(candidate.subOrder);
      return true;
    }) && orders.size === 4;
  }
  return false;
}

// src/server/api.ts
dotenv.config();
var aiClient = null;
function getGenAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var GeminiApiCallError = class extends Error {
  constructor(error, retryAfterMs) {
    super(error instanceof Error ? error.message : "Gemini API request failed.", { cause: error });
    this.name = "GeminiApiCallError";
    const status = error?.status;
    this.status = typeof status === "number" ? status : void 0;
    this.retryAfterMs = retryAfterMs;
  }
};
function readPositiveEnvNumber(name, fallback, maximum) {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured) || configured <= 0) return fallback;
  return Math.min(Math.floor(configured), maximum);
}
function logExtractionAttempt(details) {
  console.info(
    "[gemini-extraction]",
    JSON.stringify({
      model: details.model,
      errorCategory: details.category,
      retryCount: details.retryCount,
      processingDurationMs: details.durationMs
    })
  );
}
function getExtractionErrorMessage(error) {
  if (error instanceof GeminiResilienceError) {
    if (error.category === "quota_exhausted") {
      return "Gemini \u0111\xE3 h\u1EBFt h\u1EA1n m\u1EE9c s\u1EED d\u1EE5ng c\u1EE7a d\u1EF1 \xE1n. Vui l\xF2ng ki\u1EC3m tra quota/billing r\u1ED3i th\u1EED l\u1EA1i.";
    }
    if (error.category === "cancelled") {
      return "Y\xEAu c\u1EA7u tr\xEDch xu\u1EA5t \u0111\xE3 b\u1ECB h\u1EE7y. Vui l\xF2ng th\u1EED l\u1EA1i.";
    }
    if (error.category === "deadline_exceeded") {
      return "Gemini x\u1EED l\xFD qu\xE1 l\xE2u. T\u1EC7p v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i; vui l\xF2ng th\u1EED l\u1EA1i sau.";
    }
    if (!error.fallbackConfigured && ["overloaded", "rate_limited", "timeout", "network"].includes(error.category)) {
      return "Gemini \u0111ang t\u1EA1m th\u1EDDi kh\xF4ng kh\u1EA3 d\u1EE5ng v\xE0 ch\u01B0a c\u1EA5u h\xECnh m\xF4 h\xECnh d\u1EF1 ph\xF2ng. T\u1EC7p v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i; vui l\xF2ng th\u1EED l\u1EA1i sau.";
    }
    if (error.category === "rate_limited") {
      return "Gemini \u0111ang nh\u1EADn qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u. Vui l\xF2ng \u0111\u1EE3i m\u1ED9t ch\xFAt r\u1ED3i th\u1EED l\u1EA1i.";
    }
    if (error.category === "overloaded" || error.category === "network") {
      return "Gemini \u0111ang t\u1EA1m th\u1EDDi kh\xF4ng kh\u1EA3 d\u1EE5ng. T\u1EC7p v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i; vui l\xF2ng th\u1EED l\u1EA1i sau.";
    }
    if (error.category === "timeout") {
      return "Gemini x\u1EED l\xFD qu\xE1 l\xE2u. T\u1EC7p v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i; vui l\xF2ng th\u1EED l\u1EA1i sau.";
    }
  }
  if (error instanceof GeminiResponseError) {
    return "Gemini tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u c\xE2u h\u1ECFi kh\xF4ng h\u1EE3p l\u1EC7. Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c d\xF9ng t\u1EC7p r\xF5 h\u01A1n.";
  }
  return "Kh\xF4ng th\u1EC3 x\u1EED l\xFD t\u1EC7p n\xE0y. Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c ki\u1EC3m tra \u0111\u1ECBnh d\u1EA1ng t\u1EC7p.";
}
var app = express();
app.use(express.json({ limit: process.env.VERCEL ? "4mb" : "50mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.VERCEL ? "4mb" : "50mb" }));
function registerApiRoutes() {
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "TinMaster Adaptive Learning Platform",
      version: "1.0.0",
      geminiConfigured: !!process.env.GEMINI_API_KEY
    });
  });
  app.post(
    "/api/ai/explain",
    requireSupabaseUser,
    rateLimitGemini("/api/ai/explain"),
    async (req, res) => {
      try {
        const { question, userAnswer, conceptName, studentScore } = req.body;
        const ai = getGenAI();
        if (!ai) {
          return res.json(
            {
              explanation: question?.explanation || "Kh\xF4ng c\xF3 gi\u1EA3i th\xEDch chi ti\u1EBFt.",
              misconceptionDiagnosis: `Kh\xE1i ni\u1EC7m "${conceptName}" c\u1EA7n l\u01B0u \xFD b\u1EABy \u0111\u1EC1 thi v\xE0 c\xE1c quy t\u1EAFc c\xFA ph\xE1p c\u01A1 b\u1EA3n.`,
              studyTips: [
                "Xem k\u1EF9 l\u1EA1i \u0111\u1ECBnh ngh\u0129a trong SGK K\u1EBFt n\u1ED1i tri th\u1EE9c",
                "Th\u1EF1c h\xE0nh l\u1EA1i c\xE2u h\u1ECFi t\u01B0\u01A1ng t\u1EF1 trong 48 gi\u1EDD t\u1EDBi"
              ]
            }
          );
        }
        const prompt = `B\u1EA1n l\xE0 chuy\xEAn gia s\u01B0 ph\u1EA1m Tin h\u1ECDc luy\u1EC7n thi t\u1ED1t nghi\u1EC7p THPT t\u1EA1i Vi\u1EC7t Nam.
H\xE3y ph\xE2n t\xEDch c\xE2u h\u1ECFi sau cho h\u1ECDc sinh (\u0110i\u1EC3m n\u0103ng l\u1EF1c hi\u1EC7n t\u1EA1i: ${studentScore * 10}/10):
Chuy\xEAn \u0111\u1EC1: ${conceptName}
\u0110\u1EC1 b\xE0i: ${question.stem}
\u0110o\u1EA1n m\xE3 (n\u1EBFu c\xF3): ${question.codeSnippet?.code || "Kh\xF4ng c\xF3"}
\u0110\xE1p \xE1n chu\u1EA9n c\u1EE7a c\xE2u h\u1ECFi: ${question.explanation}
L\u1EF1a ch\u1ECDn / c\xE2u tr\u1EA3 l\u1EDDi c\u1EE7a h\u1ECDc sinh: ${JSON.stringify(userAnswer)}

Y\xEAu c\u1EA7u tr\u1EA3 v\u1EC1 \u0111\u1ECBnh d\u1EA1ng JSON thu\u1EA7n t\xFAy (kh\xF4ng d\xF9ng markdown code blocks) c\xF3 c\u1EA5u tr\xFAc:
{
  "explanation": "Gi\u1EA3i th\xEDch chi ti\u1EBFt ng\u1EAFn g\u1ECDn, d\u1EC5 hi\u1EC3u, logic t\u1EEBng b\u01B0\u1EDBc",
  "misconceptionDiagnosis": "Ch\u1EA9n \u0111o\xE1n nguy\xEAn nh\xE2n h\u1ECDc sinh ch\u1ECDn sai (nh\u1EA7m l\u1EABn kh\xE1i ni\u1EC7m, sai c\xFA ph\xE1p, b\u1EABy bi\xEAn hay c\u1EA9u th\u1EA3)",
  "studyTips": ["M\u1EB9o 1", "M\u1EB9o 2", "M\u1EB9o 3"]
}`;
        let text = "";
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          text = response.text?.trim() || "{}";
        } catch (firstErr) {
          console.warn("First model attempt failed for explain, retrying with gemini-3.5-flash:", firstErr?.message);
          const retryResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          text = retryResponse.text?.trim() || "{}";
        }
        const parsed = JSON.parse(text);
        res.json(parsed);
      } catch (err) {
        console.warn("AI explain error fallback:", err?.message);
        res.json({
          explanation: req.body.question?.explanation || "Gi\u1EA3i th\xEDch chu\u1EA9n theo SGK GDPT 2018.",
          misconceptionDiagnosis: "L\u01B0u \xFD c\xE1c t\u1EEB kh\xF3a mang t\xEDnh ph\u1EE7 \u0111\u1ECBnh ho\u1EB7c \u0111i\u1EC1u ki\u1EC7n r\xE0ng bu\u1ED9c trong \u0111\u1EC1 thi.",
          studyTips: [
            "\u0110\u1ECDc k\u1EF9 \u0111\u1EC1 v\xE0 v\u1EBD nh\xE1p s\u01A1 \u0111\u1ED3 lu\u1ED3ng d\u1EEF li\u1EC7u tr\u01B0\u1EDBc khi ch\u1ECDn ph\u01B0\u01A1ng \xE1n",
            "\xD4n l\u1EA1i \u0111\u1ECBnh ngh\u0129a c\u1ED1t l\xF5i trong SGK Tin h\u1ECDc 11/12 K\u1EBFt n\u1ED1i tri th\u1EE9c"
          ]
        });
      }
    }
  );
  app.post(
    "/api/ai/video-script",
    requireSupabaseUser,
    rateLimitGemini("/api/ai/video-script"),
    async (req, res) => {
      try {
        const { conceptId, conceptName, topicName } = req.body;
        const ai = getGenAI();
        if (!ai) {
          return res.status(400).json({ error: "Gemini API not configured" });
        }
        const prompt = `B\u1EA1n l\xE0 \u0111\u1EA1o di\u1EC5n b\xE0i gi\u1EA3ng video gi\xE1o d\u1EE5c s\u1ED1 ng\u1EAFn (Micro-learning 3 ph\xFAt) cho h\u1ECDc sinh THPT chu\u1EA9n b\u1ECB thi T\u1ED1t nghi\u1EC7p m\xF4n Tin h\u1ECDc.
H\xE3y bi\xEAn so\u1EA1n k\u1ECBch b\u1EA3n video cho kh\xE1i ni\u1EC7m: "${conceptName}" (Ch\u1EE7 \u0111\u1EC1: ${topicName}).
Tr\u1EA3 v\u1EC1 \u0111\u1ECBnh d\u1EA1ng JSON thu\u1EA7n t\xFAy:
{
  "conceptId": "${conceptId}",
  "conceptName": "${conceptName}",
  "targetDurationMinutes": 3,
  "learningObjective": "M\u1EE5c ti\xEAu b\xE0i h\u1ECDc ng\u1EAFn g\u1ECDn",
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 25,
      "title": "T\xEAn ph\xE2n c\u1EA3nh",
      "visualDescription": "M\xF4 t\u1EA3 h\xECnh \u1EA3nh \u0111\u1ED3 h\u1ECDa tr\u1EF1c quan tr\xEAn m\xE0n h\xECnh",
      "codeSnippet": "M\xE3 l\u1EC7nh code n\u1EBFu c\xF3",
      "narrationVoiceover": "L\u1EDDi tho\u1EA1i thuy\u1EBFt minh truy\u1EC1n c\u1EA3m, t\u1EADp trung b\u1EABy \u0111\u1EC1 thi",
      "keyHighlight": "\xDD ch\xEDnh n\u1ED5i b\u1EADt hi\u1EC3n th\u1ECB tr\xEAn m\xE0n h\xECnh"
    }
  ],
  "miniQuiz": {
    "questionText": "C\xE2u h\u1ECFi ki\u1EC3m tra nhanh sau video",
    "options": ["L\u1EF1a ch\u1ECDn A", "L\u1EF1a ch\u1ECDn B", "L\u1EF1a ch\u1ECDn C", "L\u1EF1a ch\u1ECDn D"],
    "correctIndex": 1,
    "explanation": "Gi\u1EA3i th\xEDch ng\u1EAFn v\xEC sao \u0111\xFAng"
  }
}`;
        let responseText = "";
        try {
          const response = await ai.models.generateContent(
            {
              model: "gemini-3.8-flash",
              contents: prompt,
              config: {
                responseMimeType: "application/json"
              }
            }
          );
          responseText = response.text?.trim() || "";
        } catch (firstErr) {
          console.warn("First model attempt failed, retrying with fallback model:", firstErr?.message);
          const retryResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          responseText = retryResponse.text?.trim() || "";
        }
        if (!responseText) {
          throw new Error("Empty response from AI model");
        }
        res.json(JSON.parse(responseText));
      } catch (err) {
        console.warn("AI video-script fallback applied:", err?.message);
        const { conceptId = "C01", conceptName = "Kh\xE1i ni\u1EC7m Tin h\u1ECDc", topicName = "Chuy\xEAn \u0111\u1EC1" } = req.body || {};
        res.json({
          conceptId,
          conceptName,
          targetDurationMinutes: 3,
          learningObjective: `N\u1EAFm v\u1EEFng b\u1EA3n ch\u1EA5t c\u1ED1t l\xF5i c\u1EE7a ${conceptName}, x\u1EED l\xFD g\u1ECDn c\xE1c c\xE2u h\u1ECFi m\u1EE9c \u0111\u1ED9 V\u1EADn d\u1EE5ng trong \u0110\u1EC1 thi T\u1ED1t nghi\u1EC7p THPT Tin h\u1ECDc.`,
          scenes: [
            {
              sceneNumber: 1,
              durationSeconds: 25,
              title: "Ph\xE2n c\u1EA3nh 1: \u0110\u1EB7t v\u1EA5n \u0111\u1EC1 & T\xECnh hu\u1ED1ng th\u1EF1c t\u1EBF",
              visualDescription: `Hi\u1EC3n th\u1ECB slide ho\u1EA1t h\u1ECDa sinh \u0111\u1ED9ng: T\xECnh hu\u1ED1ng ph\xE1t sinh b\xE0i to\xE1n trong m\xF4i tr\u01B0\u1EDDng th\u1EF1c ti\u1EC5n li\xEAn quan \u0111\u1EBFn ${topicName}.`,
              narrationVoiceover: `Ch\xE0o c\xE1c b\u1EA1n h\u1ECDc sinh 2k7! Trong c\u1EA5u tr\xFAc \u0111\u1EC1 thi t\u1ED1t nghi\u1EC7p THPT m\xF4n Tin h\u1ECDc, ph\u1EA7n ${conceptName} th\u01B0\u1EDDng l\xE0 \u0111i\u1EC3m ph\xE2n h\xF3a \u0111i\u1EC3m 8+. H\xF4m nay ch\xFAng ta s\u1EBD c\xF9ng gi\u1EA3i m\xE3 b\u1EA3n ch\u1EA5t trong \u0111\xFAng 3 ph\xFAt.`,
              keyHighlight: `Tr\u1ECDng t\xE2m \u0111\u1EC1 thi: ${conceptName}`
            },
            {
              sceneNumber: 2,
              durationSeconds: 45,
              title: "Ph\xE2n c\u1EA3nh 2: M\u1ED5 x\u1EBB B\u1EA3n ch\u1EA5t & C\u01A1 ch\u1EBF ho\u1EA1t \u0111\u1ED9ng",
              visualDescription: `S\u01A1 \u0111\u1ED3 kh\u1ED1i tr\u1EF1c quan \u0111\u1ED9ng v\xE0 minh h\u1ECDa t\u1EEBng b\u01B0\u1EDBc x\u1EED l\xFD d\u1EEF li\u1EC7u c\u1EE7a ${conceptName}.`,
              narrationVoiceover: `\u0110\u1EC3 kh\xF4ng b\u1ECB m\u1EA5t \u0111i\u1EC3m oan, h\xE3y nh\u1EDB: B\u1EA3n ch\u1EA5t c\u1EE7a ${conceptName} xoay quanh lu\u1ED3ng d\u1EEF li\u1EC7u v\xE0o, \u0111i\u1EC1u ki\u1EC7n d\u1EEBng v\xE0 c\xE1c gi\xE1 tr\u1ECB bi\xEAn.`,
              keyHighlight: "Hi\u1EC3u b\u1EA3n ch\u1EA5t thay v\xEC h\u1ECDc v\u1EB9t c\xF4ng th\u1EE9c"
            },
            {
              sceneNumber: 3,
              durationSeconds: 50,
              title: "Ph\xE2n c\u1EA3nh 3: B\u1EABy \u0111\u1EC1 thi THPT B\u1ED9 GD&\u0110T th\u01B0\u1EDDng g\u1EB7p",
              visualDescription: "B\u1EA3ng \u0111\u1ED1i chi\u1EBFu 2 \u0111o\u1EA1n code/l\u1EC7nh: M\u1ED9t b\xEAn l\xE0 c\xE1ch t\u01B0 duy tr\u1EF1c gi\xE1c sai l\u1EA7m, m\u1ED9t b\xEAn l\xE0 chu\u1EA9n m\u1EF1c gi\u1EA3i thu\u1EADt.",
              narrationVoiceover: `\u0110i\u1EC3m b\u1EABy ph\u1ED5 bi\u1EBFn nh\u1EA5t: \u0110\u1EC1 thi th\u01B0\u1EDDng thay \u0111\u1ED5i m\u1ED9t to\xE1n t\u1EED quan h\u1EC7 ho\u1EB7c bi\u1EBFn ch\u1EC9 s\u1ED1. 42% th\xED sinh trong \u0111\u1EE3t kh\u1EA3o s\xE1t \u0111\xE3 b\u1ECF qua \u0111i\u1EC1u ki\u1EC7n bi\xEAn n\xE0y!`,
              keyHighlight: "B\u1EABy \u0111\u1EC1 thi: Ch\xFA \xFD \u0111i\u1EC1u ki\u1EC7n bi\xEAn v\xE0 ki\u1EC3u d\u1EEF li\u1EC7u"
            },
            {
              sceneNumber: 4,
              durationSeconds: 30,
              title: "Ph\xE2n c\u1EA3nh 4: C\xF4ng th\u1EE9c gi\u1EA3i nhanh & T\xF3m t\u1EAFt",
              visualDescription: "Mindmap t\u1ED5ng h\u1EE3p 3 nguy\xEAn t\u1EAFc v\xE0ng c\u1EA7n ki\u1EC3m tra tr\u01B0\u1EDBc khi t\xF4 \u0111\xE1p \xE1n.",
              narrationVoiceover: `T\xF3m l\u1EA1i, g\u1EB7p d\u1EA1ng b\xE0i ${conceptName}: B\u01B0\u1EDBc 1 ki\u1EC3m tra \u0111i\u1EC1u ki\u1EC7n, B\u01B0\u1EDBc 2 t\xEDnh to\xE1n nh\xE1p t\u1EEBng b\u01B0\u1EDBc, B\u01B0\u1EDBc 3 lo\u1EA1i tr\u1EEB ph\u01B0\u01A1ng \xE1n sai.`,
              keyHighlight: "3 B\u01B0\u1EDBc t\u01B0 duy chu\u1EA9n x\xE1c"
            }
          ],
          miniQuiz: {
            questionText: `Trong chuy\xEAn \u0111\u1EC1 ${conceptName}, y\u1EBFu t\u1ED1 quan tr\u1ECDng nh\u1EA5t c\u1EA7n ki\u1EC3m tra k\u1EF9 tr\u01B0\u1EDBc khi ch\u1ECDn ph\u01B0\u01A1ng \xE1n tr\u1EA3 l\u1EDDi l\xE0 g\xEC?`,
            options: [
              "\u0110i\u1EC1u ki\u1EC7n bi\xEAn v\xE0 ki\u1EC3u d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o c\u1EE7a b\xE0i to\xE1n",
              "\u0110\u1ED9 d\xE0i c\u1EE7a \u0111o\u1EA1n m\xE3 ch\u01B0\u01A1ng tr\xECnh",
              "T\xEAn bi\u1EBFn \u0111\u1EB7t theo ti\u1EBFng Anh hay ti\u1EBFng Vi\u1EC7t",
              "Th\u1EE9 t\u1EF1 c\xE1c c\xE2u h\u1ECFi tr\u01B0\u1EDBc \u0111\xF3 trong \u0111\u1EC1"
            ],
            correctIndex: 0,
            explanation: "\u0110i\u1EC1u ki\u1EC7n bi\xEAn v\xE0 s\u1EF1 t\u01B0\u01A1ng th\xEDch ki\u1EC3u d\u1EEF li\u1EC7u l\xE0 nguy\xEAn nh\xE2n d\u1EABn \u0111\u1EBFn h\u01A1n 60% l\u1ED7i sai trong c\xE1c c\xE2u h\u1ECFi v\u1EADn d\u1EE5ng Tin h\u1ECDc."
          }
        });
      }
    }
  );
  app.post(
    "/api/exercises/extract-file",
    requireSupabaseUser,
    requireSupabaseRole(["teacher", "admin"]),
    rateLimitGemini("/api/exercises/extract-file"),
    async (req, res) => {
      const { file, answerKeyFile } = req.body;
      if (!file || !file.name || !file.base64) {
        return res.status(400).json(
          {
            success: false,
            error: "D\u1EEF li\u1EC7u file kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c thi\u1EBFu th\xF4ng tin."
          }
        );
      }
      const fileName = file.name;
      const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      const cleanBase64 = file.base64.includes("base64,") ? file.base64.split("base64,")[1] : file.base64;
      const processingStartedAt = Date.now();
      const extractionDeadlineMs = readPositiveEnvNumber(
        "GEMINI_EXTRACTION_DEADLINE_MS",
        18e4,
        24e4
      );
      const requestAbortController = new AbortController();
      const onRequestAborted = () => requestAbortController.abort();
      const onResponseClosed = () => {
        if (!res.writableEnded) requestAbortController.abort();
      };
      req.once("aborted", onRequestAborted);
      res.once("close", onResponseClosed);
      try {
        let docxExtractedText = "";
        let answerKeyExtractedText = "";
        if (fileExt === ".docx") {
          const fileBuffer = Buffer.from(cleanBase64, "base64");
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          docxExtractedText = result.value || "";
        }
        if (answerKeyFile && answerKeyFile.base64) {
          const keyExt = (answerKeyFile.name || "").substring((answerKeyFile.name || "").lastIndexOf(".")).toLowerCase();
          const cleanKeyBase64 = answerKeyFile.base64.includes("base64,") ? answerKeyFile.base64.split("base64,")[1] : answerKeyFile.base64;
          if (keyExt === ".docx") {
            const keyBuffer = Buffer.from(cleanKeyBase64, "base64");
            const keyResult = await mammoth.extractRawText({ buffer: keyBuffer });
            answerKeyExtractedText = keyResult.value || "";
          }
        }
        const curriculumPrompt = `B\u1EA1n l\xE0 chuy\xEAn gia s\u1ED1 h\xF3a \u0111\u1EC1 thi m\xF4n Tin h\u1ECDc THPT ch\u01B0\u01A1ng tr\xECnh GDPT 2018 c\u1EE7a B\u1ED9 Gi\xE1o d\u1EE5c & \u0110\xE0o t\u1EA1o Vi\u1EC7t Nam.
H\xE3y \u0111\u1ECDc k\u1EF9 n\u1ED9i dung \u0111\u1EC1 thi, nh\u1EADn di\u1EC7n ch\xEDnh x\xE1c ti\u1EBFng Vi\u1EC7t c\xF3 d\u1EA5u, c\xF4ng th\u1EE9c to\xE1n h\u1ECDc, \u0111o\u1EA1n code (Python, SQL, HTML, CSS), v\xE0 c\xE1c ph\u01B0\u01A1ng \xE1n A, B, C, D.

Quy \u0111\u1ECBnh c\u1EA5u tr\xFAc h\xF3a:
1. Ph\xE2n lo\u1EA1i lo\u1EA1i c\xE2u h\u1ECFi (questionType):
   - "single_choice": C\xE2u tr\u1EAFc nghi\u1EC7m 4 l\u1EF1a ch\u1ECDn A, B, C, D (Ph\u1EA7n I). C\u1EA7n c\xF3 m\u1EA3ng singleChoiceOptions g\u1ED3m 4 ph\u1EA7n t\u1EED { label: 'A'|'B'|'C'|'D', text: string, isCorrect: boolean }.
   - "true_false_multistatement": C\xE2u h\u1ECFi \u0110\xFAng/Sai (Ph\u1EA7n II). G\u1ED3m 4 ph\xE1t bi\u1EC3u con a, b, c, d v\u1EDBi m\u1EA3ng trueFalseStatements g\u1ED3m 4 ph\u1EA7n t\u1EED { subOrder: 'a'|'b'|'c'|'d', statementText: string, isCorrect: boolean }.
2. G\u1EE3i \xFD ch\u1EE7 \u0111\u1EC1 (topicId) ph\xF9 h\u1EE3p:
   - "AI_FUNDAMENTALS" (Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o, H\u1ECDc m\xE1y)
   - "WEB_DEVELOPMENT" (HTML5, CSS3, Thi\u1EBFt k\u1EBF Web)
   - "RELATIONAL_DATABASE" (CSDL Quan h\u1EC7, Kh\xF3a)
   - "SQL_QUERIES" (Truy v\u1EA5n d\u1EEF li\u1EC7u SQL)
   - "PYTHON_PROGRAMMING" (L\u1EADp tr\xECnh Python, Gi\u1EA3i thu\u1EADt)
   - "COMPUTER_NETWORK" (M\u1EA1ng m\xE1y t\xEDnh, Internet, Giao th\u1EE9c)
   - "CYBER_SECURITY" (An to\xE0n th\xF4ng tin, \u0110\u1EA1o \u0111\u1EE9c s\u1ED1)
3. \u0110\u1ED9 kh\xF3 (difficulty): "easy" (D\u1EC5), "medium" (V\u1EEBa), "hard" (Kh\xF3).
4. C\u1EA5p \u0111\u1ED9 t\u01B0 duy (cognitiveLevel): "knowledge", "comprehension", "application", "high_application".
5. \u0110\u1ED1i chi\u1EBFu \u0111\xE1p \xE1n (Answer Key Matching):
   ${answerKeyExtractedText ? `N\u1ED9i dung b\u1EA3ng \u0111\xE1p \xE1n k\xE8m theo:
"""
${answerKeyExtractedText}
"""
H\xE3y \u0111\u1ED1i chi\u1EBFu th\u1EE9 t\u1EF1 c\xE2u h\u1ECFi trong \u0111\u1EC1 thi v\u1EDBi b\u1EA3ng \u0111\xE1p \xE1n n\xE0y \u0111\u1EC3 \u0111\xE1nh d\u1EA5u isCorrect ch\xEDnh x\xE1c.` : "Kh\xF4ng c\xF3 file \u0111\xE1p \xE1n ri\xEAng. H\xE3y t\xECm xem trong \u0111\u1EC1 c\xF3 \u0111\xE1p \xE1n in \u0111\u1EADm, g\u1EA1ch ch\xE2n ho\u1EB7c ghi ch\xFA \u0111\xE1p \xE1n hay kh\xF4ng."}
   - N\u1EBFu t\xECm th\u1EA5y \u0111\xE1p \xE1n \u0111\xFAng r\xF5 r\xE0ng: \u0111\u1EB7t confidence: "high", needsReview: false.
   - N\u1EBFu KH\xD4NG ch\u1EAFc ch\u1EAFn ho\u1EB7c KH\xD4NG t\xECm th\u1EA5y \u0111\xE1p \xE1n \u0111\xFAng: \u0111\u1EB7t confidence: "low", needsReview: true, reviewReason: "Ch\u01B0a c\xF3 \u0111\xE1p \xE1n ch\u1EAFc ch\u1EAFn, c\u1EA7n gi\xE1o vi\xEAn r\xE0 so\xE1t v\xE0 ch\u1ECDn ph\u01B0\u01A1ng \xE1n \u0111\xFAng."

Y\xEAu c\u1EA7u tr\u1EA3 v\u1EC1 m\u1EA3ng JSON thu\u1EA7n t\xFAy (kh\xF4ng b\u1ECDc code block markdown):
[
  {
    "stem": "N\u1ED9i dung c\xE2u h\u1ECFi...",
    "questionType": "single_choice",
    "codeSnippet": { "language": "python", "code": "..." },
    "singleChoiceOptions": [
      { "label": "A", "text": "N\u1ED9i dung A", "isCorrect": false },
      { "label": "B", "text": "N\u1ED9i dung B", "isCorrect": true },
      { "label": "C", "text": "N\u1ED9i dung C", "isCorrect": false },
      { "label": "D", "text": "N\u1ED9i dung D", "isCorrect": false }
    ],
    "trueFalseStatements": [
      { "subOrder": "a", "statementText": "Ph\xE1t bi\u1EC3u a", "isCorrect": true },
      { "subOrder": "b", "statementText": "Ph\xE1t bi\u1EC3u b", "isCorrect": false },
      { "subOrder": "c", "statementText": "Ph\xE1t bi\u1EC3u c", "isCorrect": true },
      { "subOrder": "d", "statementText": "Ph\xE1t bi\u1EC3u d", "isCorrect": false }
    ],
    "topicId": "AI_FUNDAMENTALS",
    "difficulty": "medium",
    "cognitiveLevel": "comprehension",
    "explanation": "Gi\u1EA3i th\xEDch chi ti\u1EBFt l\u1EDDi gi\u1EA3i...",
    "confidence": "high",
    "needsReview": false,
    "reviewReason": ""
  }
]`;
        let extractedQuestions = [];
        if (process.env.GEMINI_API_KEY) {
          let contentsPayload;
          if (fileExt === ".docx") {
            contentsPayload = `${curriculumPrompt}

N\u1ED8I DUNG V\u0102N B\u1EA2N TR\xCDCH XU\u1EA4T T\u1EEA FILE \u0110\u1EC0 THI (${fileName}):
"""
${docxExtractedText}
"""`;
          } else if (fileExt === ".pdf") {
            const parts = [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: cleanBase64
                }
              },
              {
                text: `${curriculumPrompt}

H\xE3y \u0111\u1ECDc to\xE0n b\u1ED9 t\xE0i li\u1EC7u PDF tr\xEAn (${fileName}) v\xE0 tr\xEDch xu\u1EA5t danh s\xE1ch c\xE2u h\u1ECFi.`
              }
            ];
            if (answerKeyFile && answerKeyFile.base64 && !answerKeyExtractedText) {
              const keyClean = answerKeyFile.base64.includes("base64,") ? answerKeyFile.base64.split("base64,")[1] : answerKeyFile.base64;
              const keyMime = answerKeyFile.mimeType || (answerKeyFile.name?.endsWith(".pdf") ? "application/pdf" : "image/png");
              parts.push({
                inlineData: {
                  mimeType: keyMime,
                  data: keyClean
                }
              });
              parts.push({
                text: "T\xE0i li\u1EC7u b\u1ED5 sung \u0111\xEDnh k\xE8m \u1EDF tr\xEAn l\xE0 B\u1EA2NG \u0110\xC1P \xC1N. H\xE3y \u0111\u1ED1i chi\u1EBFu s\u1ED1 th\u1EE9 t\u1EF1 c\xE2u h\u1ECFi \u0111\u1EC3 \u0111i\u1EC1n \u0111\xE1p \xE1n \u0111\xFAng."
              });
            }
            contentsPayload = { parts };
          } else {
            const mimeType = file.mimeType || (fileExt === ".png" ? "image/png" : "image/jpeg");
            const parts = [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64
                }
              },
              {
                text: `${curriculumPrompt}

\u0110\xE2y l\xE0 h\xECnh \u1EA3nh ch\u1EE5p \u0111\u1EC1 thi (${fileName}). H\xE3y ch\u1EA1y OCR nh\u1EADn di\u1EC7n ch\xEDnh x\xE1c t\u1EEBng c\xE2u h\u1ECFi, c\xF4ng th\u1EE9c, m\xE3 code v\xE0 ph\u01B0\u01A1ng \xE1n.`
              }
            ];
            if (answerKeyFile && answerKeyFile.base64 && !answerKeyExtractedText) {
              const keyClean = answerKeyFile.base64.includes("base64,") ? answerKeyFile.base64.split("base64,")[1] : answerKeyFile.base64;
              const keyMime = answerKeyFile.mimeType || (answerKeyFile.name?.endsWith(".pdf") ? "application/pdf" : "image/png");
              parts.push({
                inlineData: {
                  mimeType: keyMime,
                  data: keyClean
                }
              });
              parts.push({
                text: "T\xE0i li\u1EC7u b\u1ED5 sung \u0111\xEDnh k\xE8m \u1EDF tr\xEAn l\xE0 B\u1EA2NG \u0110\xC1P \xC1N. H\xE3y \u0111\u1ED1i chi\u1EBFu s\u1ED1 th\u1EE9 t\u1EF1 c\xE2u h\u1ECFi \u0111\u1EC3 \u0111i\u1EC1n \u0111\xE1p \xE1n \u0111\xFAng."
              });
            }
            contentsPayload = { parts };
          }
          let modelUsed = process.env.GEMINI_PRIMARY_MODEL?.trim() || "gemini-3.8-flash";
          let retryCount = 0;
          let processingDurationMs = 0;
          try {
            const generated = await generateWithGeminiResilience(
              async (model, attempt) => {
                const requestMetadata = {};
                const gemini = new GoogleGenAI({
                  apiKey: process.env.GEMINI_API_KEY,
                  httpOptions: {
                    timeout: attempt.timeoutMs,
                    retryOptions: { attempts: 1 },
                    headers: { "User-Agent": "aistudio-build" },
                    fetch: async (input, init) => {
                      const controller = new AbortController();
                      const abortSignals = [attempt.signal, init?.signal].filter(
                        (signal) => signal != null
                      );
                      const abortHandlers = abortSignals.map((signal) => {
                        const abort = () => controller.abort(signal.reason);
                        if (signal.aborted) abort();
                        else signal.addEventListener("abort", abort, { once: true });
                        return { signal, abort };
                      });
                      try {
                        const response = await globalThis.fetch(input, {
                          ...init,
                          signal: controller.signal
                        });
                        requestMetadata.retryAfterMs = getRetryAfterMs(
                          response.headers.get("Retry-After")
                        );
                        return response;
                      } finally {
                        abortHandlers.forEach(
                          ({ signal, abort }) => signal.removeEventListener("abort", abort)
                        );
                      }
                    }
                  }
                });
                try {
                  return await gemini.models.generateContent({
                    model,
                    contents: contentsPayload,
                    config: {
                      responseMimeType: "application/json"
                    }
                  });
                } catch (error) {
                  throw new GeminiApiCallError(error, requestMetadata.retryAfterMs);
                }
              },
              {
                primaryModel: process.env.GEMINI_PRIMARY_MODEL?.trim() || "gemini-3.8-flash",
                fallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || void 0,
                maxRetries: 2,
                perAttemptTimeoutMs: readPositiveEnvNumber(
                  "GEMINI_ATTEMPT_TIMEOUT_MS",
                  3e4,
                  6e4
                ),
                overallDeadlineMs: extractionDeadlineMs - (Date.now() - processingStartedAt),
                responseReserveMs: 15e3,
                signal: requestAbortController.signal
              }
            );
            modelUsed = generated.model;
            retryCount = generated.retryCount;
            const jsonText = generated.value.text?.trim() || "";
            extractedQuestions = parseAndValidateExtractedQuestions(jsonText);
            processingDurationMs = Date.now() - processingStartedAt;
            logExtractionAttempt({
              model: modelUsed,
              category: "none",
              retryCount,
              durationMs: processingDurationMs
            });
          } catch (error) {
            const category = error instanceof GeminiResilienceError ? error.category : error instanceof GeminiResponseError ? error.category : classifyGeminiError(error);
            const details = error instanceof GeminiResilienceError ? {
              model: error.model,
              retryCount: error.retryCount,
              durationMs: Math.max(
                error.durationMs,
                Date.now() - processingStartedAt
              )
            } : {
              model: modelUsed,
              retryCount,
              durationMs: Math.max(
                processingDurationMs,
                Date.now() - processingStartedAt
              )
            };
            logExtractionAttempt({ ...details, category });
            if (!(error instanceof GeminiResponseError)) {
              throw error;
            }
          }
        }
        if (extractedQuestions.length > 0) {
          const batchRandom = Math.random().toString(36).substring(2, 7);
          const formattedQuestions = extractedQuestions.map((q, idx) => {
            const id = `Q_IMP_${Date.now()}_${batchRandom}_${idx + 1}`;
            const isSingle = q.questionType === "single_choice" || !q.trueFalseStatements;
            return {
              id,
              questionType: isSingle ? "single_choice" : "true_false_multistatement",
              stem: q.stem || `C\xE2u h\u1ECFi tr\xEDch xu\u1EA5t #${idx + 1}`,
              codeSnippet: q.codeSnippet && q.codeSnippet.code ? q.codeSnippet : void 0,
              singleChoiceOptions: isSingle ? q.singleChoiceOptions && q.singleChoiceOptions.length === 4 ? q.singleChoiceOptions : [
                { label: "A", text: q.singleChoiceOptions?.[0]?.text || "L\u1EF1a ch\u1ECDn A", isCorrect: !!q.singleChoiceOptions?.[0]?.isCorrect },
                { label: "B", text: q.singleChoiceOptions?.[1]?.text || "L\u1EF1a ch\u1ECDn B", isCorrect: !!q.singleChoiceOptions?.[1]?.isCorrect },
                { label: "C", text: q.singleChoiceOptions?.[2]?.text || "L\u1EF1a ch\u1ECDn C", isCorrect: !!q.singleChoiceOptions?.[2]?.isCorrect },
                { label: "D", text: q.singleChoiceOptions?.[3]?.text || "L\u1EF1a ch\u1ECDn D", isCorrect: !!q.singleChoiceOptions?.[3]?.isCorrect }
              ] : void 0,
              trueFalseStatements: !isSingle ? q.trueFalseStatements && q.trueFalseStatements.length === 4 ? q.trueFalseStatements : [
                { subOrder: "a", statementText: q.trueFalseStatements?.[0]?.statementText || "Ph\xE1t bi\u1EC3u a", isCorrect: !!q.trueFalseStatements?.[0]?.isCorrect, explanation: "" },
                { subOrder: "b", statementText: q.trueFalseStatements?.[1]?.statementText || "Ph\xE1t bi\u1EC3u b", isCorrect: !!q.trueFalseStatements?.[1]?.isCorrect, explanation: "" },
                { subOrder: "c", statementText: q.trueFalseStatements?.[2]?.statementText || "Ph\xE1t bi\u1EC3u c", isCorrect: !!q.trueFalseStatements?.[2]?.isCorrect, explanation: "" },
                { subOrder: "d", statementText: q.trueFalseStatements?.[3]?.statementText || "Ph\xE1t bi\u1EC3u d", isCorrect: !!q.trueFalseStatements?.[3]?.isCorrect, explanation: "" }
              ] : void 0,
              conceptId: q.conceptId || "CS12_AI_CONCEPTS",
              topicId: q.topicId || "AI_FUNDAMENTALS",
              grade: q.grade || 12,
              strand: q.strand || "CS",
              cognitiveLevel: q.cognitiveLevel || "comprehension",
              difficulty: q.difficulty || "medium",
              estimatedTimeSec: 45,
              competencyCode: q.competencyCode || "NLa",
              explanation: q.explanation || "L\u1EDDi gi\u1EA3i chi ti\u1EBFt chu\u1EA9n ch\u01B0\u01A1ng tr\xECnh Tin h\u1ECDc GDPT 2018.",
              keyTakeaway: q.keyTakeaway || "Ki\u1EBFn th\u1EE9c c\u1ED1t l\xF5i \xF4n thi THPT.",
              source: `T\u1EA3i l\xEAn t\u1EEB file: ${fileName}`,
              sourceYear: 2025,
              isVerified: true,
              // Meta attributes for review screen
              confidence: q.confidence || (q.needsReview ? "low" : "high"),
              needsReview: typeof q.needsReview === "boolean" ? q.needsReview : q.confidence === "low",
              reviewReason: q.reviewReason || (q.needsReview ? "C\u1EA7n ki\u1EC3m tra l\u1EA1i \u0111\xE1p \xE1n" : ""),
              sourceFile: fileName
            };
          });
          return res.json({
            success: true,
            fileName,
            questions: formattedQuestions,
            count: formattedQuestions.length
          });
        }
        if (docxExtractedText) {
          const fallbackQuestions = parseQuestionsFromDocxText(docxExtractedText, fileName);
          if (fallbackQuestions.length > 0) {
            return res.json({
              success: true,
              fileName,
              questions: fallbackQuestions,
              count: fallbackQuestions.length,
              note: "Tr\xEDch xu\u1EA5t b\u1EB1ng b\u1ED9 ph\xE2n t\xEDch v\u0103n b\u1EA3n DOCX tr\u1EF1c ti\u1EBFp."
            });
          }
        }
        return res.json({
          success: false,
          fileName,
          error: "Kh\xF4ng th\u1EC3 \u0111\u1ECDc n\u1ED9i dung c\xE2u h\u1ECFi t\u1EEB file n\xE0y, vui l\xF2ng ki\u1EC3m tra l\u1EA1i \u0111\u1ECBnh d\u1EA1ng ho\u1EB7c nh\u1EADp th\u1EE7 c\xF4ng."
        });
      } catch (err) {
        if (requestAbortController.signal.aborted || res.destroyed) return;
        return res.json({
          success: false,
          fileName,
          error: getExtractionErrorMessage(err)
        });
      } finally {
        req.removeListener("aborted", onRequestAborted);
        res.removeListener("close", onResponseClosed);
      }
    }
  );
  function parseQuestionsFromDocxText(text, fileName) {
    const questions = [];
    const blocks = text.split(/(?:^|\n)(?:Câu\s+\d+[:.]|\b\d+[\.:]\s+)/i).filter((b) => b.trim().length > 10);
    blocks.forEach((block, idx) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      const stem = lines[0];
      const optA = lines.find((l) => /^[A|a][\.:\)]/i.test(l))?.replace(/^[A|a][\.:\)]\s*/i, "") || "L\u1EF1a ch\u1ECDn A";
      const optB = lines.find((l) => /^[B|b][\.:\)]/i.test(l))?.replace(/^[B|b][\.:\)]\s*/i, "") || "L\u1EF1a ch\u1ECDn B";
      const optC = lines.find((l) => /^[C|c][\.:\)]/i.test(l))?.replace(/^[C|c][\.:\)]\s*/i, "") || "L\u1EF1a ch\u1ECDn C";
      const optD = lines.find((l) => /^[D|d][\.:\)]/i.test(l))?.replace(/^[D|d][\.:\)]\s*/i, "") || "L\u1EF1a ch\u1ECDn D";
      const ansMatch = block.match(/Đáp án[:\s]+([A-D])/i);
      const correctLetter = ansMatch ? ansMatch[1].toUpperCase() : "";
      questions.push({
        id: `Q_DOCX_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx + 1}`,
        questionType: "single_choice",
        stem: stem.length > 5 ? stem : `C\xE2u h\u1ECFi tr\xEDch xu\u1EA5t #${idx + 1} t\u1EEB ${fileName}`,
        singleChoiceOptions: [
          { label: "A", text: optA, isCorrect: correctLetter === "A" },
          { label: "B", text: optB, isCorrect: correctLetter === "B" },
          { label: "C", text: optC, isCorrect: correctLetter === "C" },
          { label: "D", text: optD, isCorrect: correctLetter === "D" }
        ],
        topicId: "PYTHON_PROGRAMMING",
        conceptId: "CS12_AI_CONCEPTS",
        grade: 12,
        strand: "CS",
        cognitiveLevel: "comprehension",
        difficulty: "medium",
        estimatedTimeSec: 45,
        competencyCode: "NLa",
        explanation: "Tr\xEDch xu\u1EA5t t\u1EEB file \u0111\u1EC1 thi t\xE0i li\u1EC7u DOCX.",
        keyTakeaway: "N\u1ED9i dung \xF4n luy\u1EC7n Tin h\u1ECDc THPT.",
        source: `File DOCX: ${fileName}`,
        sourceYear: 2025,
        isVerified: true,
        confidence: correctLetter ? "high" : "low",
        needsReview: !correctLetter,
        reviewReason: correctLetter ? "" : "Ch\u01B0a c\xF3 \u0111\xE1p \xE1n ch\u1EAFc ch\u1EAFn, c\u1EA7n gi\xE1o vi\xEAn r\xE0 so\xE1t ch\u1ECDn \u0111\xE1p \xE1n \u0111\xFAng.",
        sourceFile: fileName
      });
    });
    return questions;
  }
}
registerApiRoutes();
var api_default = app;
export {
  api_default as default
};
