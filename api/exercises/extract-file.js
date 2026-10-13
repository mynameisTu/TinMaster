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

// src/server/diagnosticStart.ts
import { createClient as createClient4 } from "@supabase/supabase-js";

// src/server/diagnosticQuestionBank.ts
var SERVER_DIAGNOSTIC_QUESTION_BANK = [
  // =========================================================================
  // PHẦN I: CÂU TRẮC NGHIỆM 4 LỰA CHỌN (SINGLE CHOICE)
  // =========================================================================
  // --- CHỦ ĐỀ 1 (TIN 12): MÁY TÍNH VÀ XÃ HỘI TRI THỨC - TRÍ TUỆ NHÂN TẠO ---
  {
    id: "Q_CS12_AI_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: 'Thu\u1EADt ng\u1EEF "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o" (Artificial Intelligence - AI) ch\xEDnh th\u1EE9c \u0111\u01B0\u1EE3c \u0111\u1EC1 xu\u1EA5t l\u1EA7n \u0111\u1EA7u ti\xEAn t\u1EA1i s\u1EF1 ki\u1EC7n l\u1ECBch s\u1EED n\xE0o?',
    conceptId: "CS12_AI_CONCEPTS",
    topicId: "AI_FUNDAMENTALS",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "H\u1ED9i th\u1EA3o Dartmouth (M\u1EF9) n\u0103m 1956.", isCorrect: true },
      { label: "B", text: "C\xF4ng b\u1ED1 ph\xE9p th\u1EED Turing c\u1EE7a Alan Turing n\u0103m 1950.", isCorrect: false, distractorExplanation: "N\u0103m 1950 Alan Turing c\xF4ng b\u1ED1 b\xE0i b\xE1o v\u1EC1 ph\xE9p th\u1EED Turing, nh\u01B0ng thu\u1EADt ng\u1EEF AI ch\u01B0a ra \u0111\u1EDDi." },
      { label: "C", text: "Ra m\u1EAFt h\u1EC7 chuy\xEAn gia y t\u1EBF MYCIN n\u0103m 1972.", isCorrect: false, distractorExplanation: "MYCIN l\xE0 h\u1EC7 chuy\xEAn gia ch\u1EA9n \u0111o\xE1n b\u1EC7nh nhi\u1EC5m tr\xF9ng m\xE1u ra \u0111\u1EDDi n\u0103m 1972." },
      { label: "D", text: "S\u1EF1 ki\u1EC7n ra m\u1EAFt ChatGPT c\u1EE7a t\u1ED5 ch\u1EE9c OpenAI n\u0103m 2022.", isCorrect: false, distractorExplanation: "ChatGPT ra m\u1EAFt cu\u1ED1i n\u0103m 2022, thu\u1ED9c l\xE0n s\xF3ng AI t\u1EA1o sinh hi\u1EC7n \u0111\u1EA1i." }
    ],
    explanation: 'Thu\u1EADt ng\u1EEF "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o" \u0111\u01B0\u1EE3c nh\xE0 khoa h\u1ECDc m\xE1y t\xEDnh John McCarthy v\xE0 c\xE1c \u0111\u1ED3ng nghi\u1EC7p ch\xEDnh th\u1EE9c \u0111\u01B0a ra t\u1EA1i H\u1ED9i th\u1EA3o Dartmouth (M\u1EF9) v\xE0o m\xF9a h\xE8 n\u0103m 1956, \u0111\xE1nh d\u1EA5u s\u1EF1 ra \u0111\u1EDDi c\u1EE7a ng\xE0nh khoa h\u1ECDc AI.',
    keyTakeaway: "H\u1ED9i th\u1EA3o Dartmouth n\u0103m 1956 l\xE0 m\u1ED1c l\u1ECBch s\u1EED khai sinh thu\u1EADt ng\u1EEF Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 1: L\xE0m quen v\u1EDBi Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_AI_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "\u0110\u1EB7c tr\u01B0ng n\xE0o sau \u0111\xE2y c\u1EE7a Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o th\u1EC3 hi\u1EC7n kh\u1EA3 n\u0103ng m\xE1y t\xEDnh t\u1EF1 r\xFAt ra tri th\u1EE9c m\u1EDBi t\u1EEB d\u1EEF li\u1EC7u quan s\xE1t \u0111\u01B0\u1EE3c thay v\xEC ch\u1EC9 th\u1EF1c thi c\xE1c quy t\u1EAFc l\u1EADp tr\xECnh s\u1EB5n?",
    conceptId: "CS12_AI_CONCEPTS",
    topicId: "AI_FUNDAMENTALS",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "Kh\u1EA3 n\u0103ng t\xEDnh to\xE1n s\u1ED1 h\u1ECDc t\u1ED1c \u0111\u1ED9 cao.", isCorrect: false, distractorExplanation: "T\xEDnh to\xE1n t\u1ED1c \u0111\u1ED9 cao l\xE0 n\u0103ng l\u1EF1c ph\u1EA7n c\u1EE9ng m\xE1y t\xEDnh truy\u1EC1n th\u1ED1ng, kh\xF4ng ph\u1EA3i \u0111\u1EB7c tr\u01B0ng c\u1EE7a AI." },
      { label: "B", text: "Kh\u1EA3 n\u0103ng h\u1ECDc (Learning) t\u1EEB d\u1EEF li\u1EC7u th\u1EF1c nghi\u1EC7m.", isCorrect: true },
      { label: "C", text: "Kh\u1EA3 n\u0103ng l\u01B0u tr\u1EEF dung l\u01B0\u1EE3ng l\u1EDBn tr\xEAn \u1ED5 \u0111\u0129a SSD.", isCorrect: false, distractorExplanation: "L\u01B0u tr\u1EEF l\xE0 t\xEDnh n\u0103ng c\u1EE7a thi\u1EBFt b\u1ECB nh\u1EDB." },
      { label: "D", text: "Kh\u1EA3 n\u0103ng hi\u1EC3n th\u1ECB \u0111\u1ED3 h\u1ECDa \u0111\u1ED9 ph\xE2n gi\u1EA3i 4K s\u1EAFc n\xE9t.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 t\xEDnh n\u0103ng c\u1EE7a m\xE0n h\xECnh v\xE0 card \u0111\u1ED3 h\u1ECDa." }
    ],
    explanation: "Theo SGK Tin h\u1ECDc 12, c\xE1c \u0111\u1EB7c tr\u01B0ng c\u1ED1t l\xF5i c\u1EE7a AI g\u1ED3m: kh\u1EA3 n\u0103ng h\u1ECDc (learning), kh\u1EA3 n\u0103ng suy lu\u1EADn (reasoning), nh\u1EADn th\u1EE9c m\xF4i tr\u01B0\u1EDDng (perception), hi\u1EC3u ng\xF4n ng\u1EEF t\u1EF1 nhi\xEAn v\xE0 gi\u1EA3i quy\u1EBFt v\u1EA5n \u0111\u1EC1. Kh\u1EA3 n\u0103ng t\u1EF1 \u0111\xFAc k\u1EBFt tri th\u1EE9c t\u1EEB d\u1EEF li\u1EC7u ch\xEDnh l\xE0 kh\u1EA3 n\u0103ng h\u1ECDc.",
    keyTakeaway: "Kh\u1EA3 n\u0103ng h\u1ECDc (h\u1ECDc m\xE1y) gi\xFAp AI c\u1EA3i thi\u1EC7n n\u0103ng l\u1EF1c t\u1EEB d\u1EEF li\u1EC7u thay v\xEC m\xE3 h\xF3a c\u1EE9ng quy t\u1EAFc.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 1: L\xE0m quen v\u1EDBi Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_AI_03",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Hi\u1EC7n t\u01B0\u1EE3ng m\xF4 h\xECnh ng\xF4n ng\u1EEF l\u1EDBn (LLM) t\u1EA1o ra c\xE1c c\xE2u tr\u1EA3 l\u1EDDi t\u1EF1 tin, tr\xF4i ch\u1EA3y nh\u01B0ng ch\u1EE9a \u0111\u1EF1ng th\xF4ng tin ho\xE0n to\xE0n sai l\u1EC7ch ho\u1EB7c b\u1ECBa \u0111\u1EB7t \u0111\u01B0\u1EE3c g\u1ECDi l\xE0 g\xEC trong nghi\xEAn c\u1EE9u AI?",
    conceptId: "CS12_AI_APPLICATIONS",
    topicId: "AI_FUNDAMENTALS",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 40,
    competencyCode: "NLc",
    singleChoiceOptions: [
      { label: "A", text: "\u1EA2o gi\xE1c AI (AI Hallucination).", isCorrect: true },
      { label: "B", text: "Qu\xE1 kh\u1EDBp d\u1EEF li\u1EC7u (Overfitting).", isCorrect: false, distractorExplanation: "Overfitting l\xE0 hi\u1EC7n t\u01B0\u1EE3ng m\xF4 h\xECnh ghi nh\u1EDB m\xE1y m\xF3c d\u1EEF li\u1EC7u hu\u1EA5n luy\u1EC7n, k\xE9m kh\u1EA3 n\u0103ng t\u1ED5ng qu\xE1t." },
      { label: "C", text: "Ph\xE2n m\u1EA3nh b\u1ED9 nh\u1EDB (Memory Fragmentation).", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 hi\u1EC7n t\u01B0\u1EE3ng trong qu\u1EA3n l\xFD b\u1ED9 nh\u1EDB c\u1EE7a h\u1EC7 \u0111i\u1EC1u h\xE0nh." },
      { label: "D", text: "T\u1EA5n c\xF4ng t\u1EEB ch\u1ED1i d\u1ECBch v\u1EE5 (DDoS).", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 h\xECnh th\u1EE9c t\u1EA5n c\xF4ng an ninh m\u1EA1ng." }
    ],
    explanation: "Hi\u1EC7n t\u01B0\u1EE3ng \u1EA2o gi\xE1c AI (AI Hallucination) x\u1EA3y ra khi m\xF4 h\xECnh sinh ng\xF4n ng\u1EEF t\u1EF1 nhi\xEAn \u0111\u01B0a ra c\xE1c th\xF4ng tin sai th\u1EF1c t\u1EBF nh\u01B0ng c\xF3 v\u1EBB r\u1EA5t logic v\xE0 thuy\u1EBFt ph\u1EE5c, \u0111\xF2i h\u1ECFi ng\u01B0\u1EDDi d\xF9ng lu\xF4n ph\u1EA3i ki\u1EC3m ch\u1EE9ng ngu\u1ED3n tin.",
    keyTakeaway: "Lu\xF4n ph\u1EA3n bi\u1EC7n v\xE0 ki\u1EC3m ch\u1EE9ng d\u1EEF li\u1EC7u do AI t\u1EA1o sinh cung c\u1EA5p \u0111\u1EC3 tr\xE1nh b\u1EABy \u1EA3o gi\xE1c AI.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 2: Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o trong khoa h\u1ECDc v\xE0 \u0111\u1EDDi s\u1ED1ng",
    sourceYear: 2024,
    isVerified: true
  },
  // --- CHỦ ĐỀ 2 (TIN 12): MẠNG MÁY TÍNH VÀ THIẾT BỊ MẠNG ---
  {
    id: "Q_CS12_NET_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Thi\u1EBFt b\u1ECB m\u1EA1ng n\xE0o sau \u0111\xE2y c\xF3 ch\u1EE9c n\u0103ng \u0111\u1ECDc \u0111\u1ECBa ch\u1EC9 MAC c\u1EE7a g\xF3i tin \u0111\u1EC3 chuy\u1EC3n ti\u1EBFp d\u1EEF li\u1EC7u ch\xEDnh x\xE1c \u0111\u1EBFn duy nh\u1EA5t c\u1ED5ng c\u1EE7a m\xE1y t\xEDnh nh\u1EADn, gi\xFAp tr\xE1nh va ch\u1EA1m xung \u0111\u1ED9t (collision) trong m\u1EA1ng LAN?",
    conceptId: "CS12_NETWORK_DEVICES",
    topicId: "COMPUTER_NETWORKING",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "B\u1ED9 t\u1EADp trung (Hub).", isCorrect: false, distractorExplanation: "Hub ph\xE1t t\xE1n t\xEDn hi\u1EC7u nh\u1EADn \u0111\u01B0\u1EE3c t\u1EDBi t\u1EA5t c\u1EA3 c\xE1c c\u1ED5ng c\xF2n l\u1EA1i, d\u1EC5 g\xE2y ngh\u1EBDn v\xE0 xung \u0111\u1ED9t d\u1EEF li\u1EC7u." },
      { label: "B", text: "B\u1ED9 chuy\u1EC3n m\u1EA1ch (Switch).", isCorrect: true },
      { label: "C", text: "B\u1ED9 l\u1EB7p t\xEDn hi\u1EC7u (Repeater).", isCorrect: false, distractorExplanation: "Repeater ch\u1EC9 khu\u1EBFch \u0111\u1EA1i t\xEDn hi\u1EC7u v\u1EADt l\xFD \u0111\u1EC3 truy\u1EC1n \u0111i xa h\u01A1n, kh\xF4ng \u0111\u1ECDc \u0111\u1ECBa ch\u1EC9 MAC." },
      { label: "D", text: "\u0110\u1EA7u b\u1EA5m m\u1EA1ng RJ45.", isCorrect: false, distractorExplanation: "RJ45 l\xE0 \u0111\u1EA7u n\u1ED1i c\u01A1 h\u1ECDc c\u1EE7a c\xE1p xo\u1EAFn \u0111\xF4i UTP." }
    ],
    explanation: "Switch (b\u1ED9 chuy\u1EC3n m\u1EA1ch) l\u01B0u tr\u1EEF b\u1EA3ng \u0111\u1ECBa ch\u1EC9 MAC v\xE0 ch\u1EC9 chuy\u1EC3n ti\u1EBFp khung d\u1EEF li\u1EC7u \u0111\u1EBFn \u0111\xFAng c\u1ED5ng k\u1EBFt n\u1ED1i v\u1EDBi thi\u1EBFt b\u1ECB \u0111\xEDch, t\u1EA1o ra c\xE1c mi\u1EC1n xung \u0111\u1ED9t ri\xEAng r\u1EBD v\xE0 n\xE2ng cao hi\u1EC7u n\u0103ng m\u1EA1ng LAN.",
    keyTakeaway: "Switch chuy\u1EC3n ti\u1EBFp d\u1EEF li\u1EC7u th\xF4ng minh theo b\u1EA3ng \u0111\u1ECBa ch\u1EC9 MAC, Hub ph\xE1t t\xE1n t\u1EDBi m\u1ECDi c\u1ED5ng.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 3: M\u1ED9t s\u1ED1 thi\u1EBFt b\u1ECB m\u1EA1ng th\xF4ng d\u1EE5ng",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_NET_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "B\u1ED9 \u0111\u1ECBnh tuy\u1EBFn (Router) th\u1EF1c hi\u1EC7n chuy\u1EC3n ti\u1EBFp c\xE1c g\xF3i d\u1EEF li\u1EC7u gi\u1EEFa c\xE1c m\u1EA1ng kh\xE1c nhau (nh\u01B0 m\u1EA1ng LAN gia \u0111\xECnh v\xE0 m\u1EA1ng Internet to\xE0n c\u1EA7u) d\u1EF1a tr\xEAn th\xF4ng tin n\xE0o?",
    conceptId: "CS12_NETWORK_DEVICES",
    topicId: "COMPUTER_NETWORKING",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "\u0110\u1ECBa ch\u1EC9 IP \u0111\xEDch v\xE0 B\u1EA3ng \u0111\u1ECBnh tuy\u1EBFn (Routing Table).", isCorrect: true },
      { label: "B", text: "T\xEAn nh\xE0 s\u1EA3n xu\u1EA5t bo m\u1EA1ch ch\u1EE7 (Motherboard).", isCorrect: false, distractorExplanation: "Router kh\xF4ng quan t\xE2m \u0111\u1EBFn ph\u1EA7n c\u1EE9ng bo m\u1EA1ch ch\u1EE7." },
      { label: "C", text: "T\u1EA7n s\u1ED1 qu\xE9t c\u1EE7a m\xE0n h\xECnh m\xE1y t\xEDnh.", isCorrect: false, distractorExplanation: "T\u1EA7n s\u1ED1 qu\xE9t m\xE0n h\xECnh kh\xF4ng li\xEAn quan \u0111\u1EBFn truy\u1EC1n th\xF4ng m\u1EA1ng." },
      { label: "D", text: "\u0110\u1ED9 d\xE0i c\u1EE7a d\xE2y c\xE1p ngu\u1ED3n \u0111i\u1EC7n m\xE1y ch\u1EE7.", isCorrect: false, distractorExplanation: "Kh\xF4ng li\xEAn quan \u0111\u1EBFn giao th\u1EE9c m\u1EA1ng." }
    ],
    explanation: "Router ho\u1EA1t \u0111\u1ED9ng \u1EDF t\u1EA7ng M\u1EA1ng (Network Layer), s\u1EED d\u1EE5ng \u0111\u1ECBa ch\u1EC9 IP \u0111\xEDch ghi trong g\xF3i tin k\u1EBFt h\u1EE3p v\u1EDBi B\u1EA3ng \u0111\u1ECBnh tuy\u1EBFn \u0111\u1EC3 quy\u1EBFt \u0111\u1ECBnh \u0111\u01B0\u1EDDng \u0111i t\u1ED1i \u01B0u \u0111\u01B0a g\xF3i tin \u0111\u1EBFn m\u1EA1ng \u0111\xEDch.",
    keyTakeaway: "Router l\xE0m vi\u1EC7c v\u1EDBi \u0111\u1ECBa ch\u1EC9 IP \u0111\u1EC3 \u0111\u1ECBnh tuy\u1EBFn d\u1EEF li\u1EC7u gi\u1EEFa c\xE1c m\u1EA1ng m\xE1y t\xEDnh kh\xE1c nhau.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 3: M\u1ED9t s\u1ED1 thi\u1EBFt b\u1ECB m\u1EA1ng th\xF4ng d\u1EE5ng",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_NET_03",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "C\xE1p xo\u1EAFn \u0111\xF4i UTP th\xF4ng d\u1EE5ng \u0111\u1EC3 k\u1EBFt n\u1ED1i m\xE1y t\xEDnh v\u1EDBi b\u1ED9 chuy\u1EC3n m\u1EA1ch Switch trong m\u1EA1ng LAN s\u1EED d\u1EE5ng chu\u1EA9n \u0111\u1EA7u n\u1ED1i b\u1EA5m n\xE0o?",
    conceptId: "CS12_NETWORK_DEVICES",
    topicId: "COMPUTER_NETWORKING",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "\u0110\u1EA7u n\u1ED1i chu\u1EA9n RJ45 (8 ch\xE2n ti\u1EBFp x\xFAc \u0111\u1ED3ng).", isCorrect: true },
      { label: "B", text: "\u0110\u1EA7u c\u1EAFm chu\u1EA9n RJ11 c\u1EE7a \u0111\u01B0\u1EDDng d\xE2y \u0111i\u1EC7n tho\u1EA1i b\xE0n.", isCorrect: false, distractorExplanation: "RJ11 l\xE0 \u0111\u1EA7u c\u1EAFm \u0111i\u1EC7n tho\u1EA1i b\xE0n c\xF3 4 ho\u1EB7c 6 ch\xE2n, nh\u1ECF h\u01A1n RJ45." },
      { label: "C", text: "C\u1ED5ng c\u1EAFm m\xE0n h\xECnh analog VGA 15 ch\xE2n.", isCorrect: false, distractorExplanation: "C\u1ED5ng VGA d\xF9ng \u0111\u1EC3 xu\u1EA5t h\xECnh \u1EA3nh ra m\xE0n h\xECnh/m\xE1y chi\u1EBFu." },
      { label: "D", text: "\u0110\u1EA7u c\u1EAFm \xE2m thanh Audio Jack 3.5mm.", isCorrect: false, distractorExplanation: "Jack 3.5mm d\xF9ng \u0111\u1EC3 truy\u1EC1n t\xEDn hi\u1EC7u \xE2m thanh." }
    ],
    explanation: "C\xE1p xo\u1EAFn \u0111\xF4i kh\xF4ng b\u1ECDc kim UTP g\u1ED3m 4 c\u1EB7p d\xE2y xo\u1EAFn m\xE0u kh\xE1c nhau, \u0111\u01B0\u1EE3c b\u1EA5m v\xE0o \u0111\u1EA7u c\u1EAFm chu\u1EA9n RJ45 g\u1ED3m 8 ch\xE2n ti\u1EBFp x\xFAc b\u1EB1ng \u0111\u1ED3ng \u0111\u1EC3 c\u1EAFm v\xE0o c\u1ED5ng Ethernet tr\xEAn m\xE1y t\xEDnh ho\u1EB7c Switch.",
    keyTakeaway: "C\xE1p m\u1EA1ng Ethernet d\xF9ng \u0111\u1EA7u b\u1EA5m chu\u1EA9n RJ45 g\u1ED3m 8 ch\xE2n ti\u1EBFp x\xFAc \u0111\u1ED3ng.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 3: M\u1ED9t s\u1ED1 thi\u1EBFt b\u1ECB m\u1EA1ng th\xF4ng d\u1EE5ng",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_NET_04",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "L\u1EC7nh n\xE0o trong giao di\u1EC7n d\xF2ng l\u1EC7nh (Command Prompt) c\u1EE7a h\u1EC7 \u0111i\u1EC1u h\xE0nh Windows s\u1EED d\u1EE5ng giao th\u1EE9c ICMP \u0111\u1EC3 ki\u1EC3m tra t\xEDnh th\xF4ng su\u1ED1t v\xE0 \u0111o th\u1EDDi gian ph\u1EA3n h\u1ED3i (Round-Trip Time) gi\u1EEFa m\xE1y t\xEDnh hi\u1EC7n t\u1EA1i t\u1EDBi m\u1ED9t \u0111\u1ECBa ch\u1EC9 m\xE1y ch\u1EE7?",
    conceptId: "CS12_NETWORK_PROTOCOLS",
    topicId: "COMPUTER_NETWORKING",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLc",
    codeSnippet: {
      language: "pseudo",
      code: "C:\\Users\\Student> ping 8.8.8.8"
    },
    singleChoiceOptions: [
      { label: "A", text: "L\u1EC7nh ping.", isCorrect: true },
      { label: "B", text: "L\u1EC7nh ipconfig.", isCorrect: false, distractorExplanation: "ipconfig d\xF9ng \u0111\u1EC3 xem th\xF4ng tin c\u1EA5u h\xECnh IP v\xE0 card m\u1EA1ng c\u1EE7a m\xE1y c\u1EE5c b\u1ED9." },
      { label: "C", text: "L\u1EC7nh cls.", isCorrect: false, distractorExplanation: "cls d\xF9ng \u0111\u1EC3 x\xF3a tr\u1EAFng m\xE0n h\xECnh console." },
      { label: "D", text: "L\u1EC7nh mkdir.", isCorrect: false, distractorExplanation: "mkdir d\xF9ng \u0111\u1EC3 t\u1EA1o th\u01B0 m\u1EE5c m\u1EDBi tr\xEAn \u1ED5 \u0111\u0129a." }
    ],
    explanation: "L\u1EC7nh ping g\u1EEDi c\xE1c g\xF3i tin Echo Request theo giao th\u1EE9c ICMP t\u1EDBi m\xE1y ch\u1EE7 \u0111\xEDch v\xE0 l\u1EAFng nghe g\xF3i Echo Reply ph\u1EA3n h\u1ED3i, gi\xFAp ki\u1EC3m tra k\u1EBFt n\u1ED1i m\u1EA1ng v\xE0 \u0111\u1ED9 tr\u1EC5 mili-gi\xE2y (ms).",
    keyTakeaway: "L\u1EC7nh ping d\xF9ng giao th\u1EE9c ICMP \u0111\u1EC3 ki\u1EC3m tra t\xEDnh th\xF4ng su\u1ED1t k\u1EBFt n\u1ED1i m\u1EA1ng.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 4: Giao th\u1EE9c m\u1EA1ng",
    sourceYear: 2024,
    isVerified: true
  },
  // --- CHỦ ĐỀ 3 (TIN 12): ĐẠO ĐỨC, PHÁP LUẬT VÀ VĂN HÓA TRONG MÔI TRƯỜNG SỐ ---
  {
    id: "Q_CS12_ETHIC_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Theo B\u1ED9 quy t\u1EAFc \u1EE9ng x\u1EED tr\xEAn m\u1EA1ng x\xE3 h\u1ED9i do B\u1ED9 Th\xF4ng tin v\xE0 Truy\u1EC1n th\xF4ng ban h\xE0nh theo Quy\u1EBFt \u0111\u1ECBnh s\u1ED1 874/Q\u0110-BTTTT, nh\xF3m 4 nguy\xEAn t\u1EAFc nh\xE2n v\u0103n n\xE0o d\u01B0\u1EDBi \u0111\xE2y \u0111\u01B0\u1EE3c khuy\u1EBFn kh\xEDch \xE1p d\u1EE5ng trong giao ti\u1EBFp s\u1ED1?",
    conceptId: "CS12_DIGITAL_COMMUNICATION",
    topicId: "ETHICS_SECURITY",
    grade: 12,
    strand: "DL",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLd",
    singleChoiceOptions: [
      { label: "A", text: "T\xF4n tr\u1ECDng - L\u1ECBch s\u1EF1 - Th\u1EA5u hi\u1EC3u - H\u1ED7 tr\u1EE3.", isCorrect: true },
      { label: "B", text: "C\u1EA1nh tranh - B\xED m\u1EADt - T\u1EF1 do tuy\u1EC7t \u0111\u1ED1i - Tranh lu\u1EADn.", isCorrect: false, distractorExplanation: "\u0110\xE2y kh\xF4ng ph\u1EA3i c\xE1c nguy\xEAn t\u1EAFc nh\xE2n v\u0103n \u1EE9ng x\u1EED m\u1EA1ng chu\u1EA9n m\u1EF1c." },
      { label: "C", text: "\u1EA8n danh - Ph\xE1t t\xE1n - C\xE2u like - Ph\xEA ph\xE1n.", isCorrect: false, distractorExplanation: "C\xE1c h\xE0nh vi n\xE0y g\xE2y h\u1EA1i v\xE0 t\u1EA1o m\xF4i tr\u01B0\u1EDDng m\u1EA1ng ti\xEAu c\u1EF1c." },
      { label: "D", text: "Ch\u1EC9 nghe - Kh\xF4ng n\xF3i - Kh\xF4ng b\xECnh lu\u1EADn - T\u1EA9y chay.", isCorrect: false, distractorExplanation: "\u0110\xE2y kh\xF4ng ph\u1EA3i 4 nguy\xEAn t\u1EAFc theo quy \u0111\u1ECBnh." }
    ],
    explanation: "Quy\u1EBFt \u0111\u1ECBnh 874/Q\u0110-BTTTT v\xE0 SGK Tin h\u1ECDc 12 nh\u1EA5n m\u1EA1nh 4 nguy\xEAn t\u1EAFc giao ti\u1EBFp nh\xE2n v\u0103n tr\xEAn kh\xF4ng gian m\u1EA1ng: T\xF4n tr\u1ECDng (t\xF4n tr\u1ECDng ng\u01B0\u1EDDi kh\xE1c), L\u1ECBch s\u1EF1 (l\u1EDDi n\xF3i h\xF2a nh\xE3), Th\u1EA5u hi\u1EC3u (\u0111\u1EB7t m\xECnh v\xE0o v\u1ECB tr\xED ng\u01B0\u1EDDi kh\xE1c) v\xE0 H\u1ED7 tr\u1EE3 (gi\xFAp \u0111\u1EE1 khi c\u1ED9ng \u0111\u1ED3ng c\u1EA7n).",
    keyTakeaway: "4 Nguy\xEAn t\u1EAFc \u1EE9ng x\u1EED nh\xE2n v\u0103n tr\xEAn m\xF4i tr\u01B0\u1EDDng s\u1ED1: T\xF4n tr\u1ECDng, L\u1ECBch s\u1EF1, Th\u1EA5u hi\u1EC3u, H\u1ED7 tr\u1EE3.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 6: Giao ti\u1EBFp v\xE0 \u1EE9ng x\u1EED trong kh\xF4ng gian m\u1EA1ng",
    sourceYear: 2024,
    isVerified: true
  },
  // --- CHỦ ĐỀ 4 (TIN 12): THIẾT KẾ WEB VỚI HTML5 & CSS3 ---
  {
    id: "Q_CS12_WEB_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "D\xF2ng khai b\xE1o n\xE0o sau \u0111\xE2y l\xE0 b\u1EAFt bu\u1ED9c \u1EDF v\u1ECB tr\xED \u0111\u1EA7u ti\xEAn c\u1EE7a m\u1ED9t t\u1EC7p t\xE0i li\u1EC7u HTML5 \u0111\u1EC3 tr\xECnh duy\u1EC7t web bi\u1EBFt v\xE0 k\u1EBFt xu\u1EA5t \u0111\xFAng chu\u1EA9n ng\u1EEF ngh\u0129a?",
    conceptId: "CS12_WEB_HTML_BASIC",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 25,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "<!DOCTYPE html>", isCorrect: true },
      { label: "B", text: '<xml version="1.0">', isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 khai b\xE1o \u0111\u1EA7u t\u1EC7p XML." },
      { label: "C", text: '<style type="text/css">', isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 th\u1EBB m\u1EDF \u0111\u1ECBnh ki\u1EC3u CSS." },
      { label: "D", text: '<meta charset="UTF-8">', isCorrect: false, distractorExplanation: "Th\u1EBB meta n\u1EB1m trong ph\u1EA7n t\u1EED <head>, kh\xF4ng ph\u1EA3i khai b\xE1o lo\u1EA1i t\xE0i li\u1EC7u." }
    ],
    explanation: "<!DOCTYPE html> l\xE0 khai b\xE1o ki\u1EC3u t\xE0i li\u1EC7u (Document Type Declaration) kh\xF4ng ph\xE2n bi\u1EC7t hoa th\u01B0\u1EDDng, \u0111\u1EB7t \u1EDF d\xF2ng \u0111\u1EA7u ti\xEAn c\u1EE7a t\u1EC7p tin \u0111\u1EC3 ch\u1EC9 \u0111\u1ECBnh tr\xECnh duy\u1EC7t web hi\u1EC3n th\u1ECB trang theo chu\u1EA9n HTML5.",
    keyTakeaway: "<!DOCTYPE html> l\xE0 d\xF2ng \u0111\u1EA7u ti\xEAn b\u1EAFt bu\u1ED9c \u0111\u1EC3 tr\xECnh duy\u1EC7t nh\u1EADn di\u1EC7n chu\u1EA9n HTML5.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 7: HTML v\xE0 c\u1EA5u tr\xFAc trang web",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "\u0110\u1EC3 t\u1EA1o m\u1ED9t danh s\xE1ch c\xF3 th\u1EE9 t\u1EF1 g\u1ED3m c\xE1c m\u1EE5c \u0111\u01B0\u1EE3c \u0111\xE1nh s\u1ED1 th\u1EE9 t\u1EF1 t\u1EEB 1, 2, 3... trong HTML5, ta s\u1EED d\u1EE5ng c\u1EB7p th\u1EBB n\xE0o sau \u0111\xE2y?",
    conceptId: "CS12_WEB_HTML_BASIC",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "C\u1EB7p th\u1EBB <ol> v\xE0 c\xE1c ph\u1EA7n t\u1EED <li> b\xEAn trong.", isCorrect: true },
      { label: "B", text: "C\u1EB7p th\u1EBB <ul> v\xE0 c\xE1c ph\u1EA7n t\u1EED <li> b\xEAn trong.", isCorrect: false, distractorExplanation: "<ul> l\xE0 danh s\xE1ch kh\xF4ng th\u1EE9 t\u1EF1 (Unordered List) hi\u1EC3n th\u1ECB b\u1EB1ng d\u1EA5u ch\u1EA5m \u0111\u1EA7u d\xF2ng (bullet)." },
      { label: "C", text: "C\u1EB7p th\u1EBB <dl> v\xE0 c\xE1c ph\u1EA7n t\u1EED <dt>, <dd>.", isCorrect: false, distractorExplanation: "<dl> l\xE0 danh s\xE1ch m\xF4 t\u1EA3 \u0111\u1ECBnh ngh\u0129a (Description List)." },
      { label: "D", text: "C\u1EB7p th\u1EBB <table> v\xE0 <tr>.", isCorrect: false, distractorExplanation: "<table> d\xF9ng \u0111\u1EC3 d\u1EF1ng b\u1EA3ng d\u1EEF li\u1EC7u l\u01B0\u1EDBi." }
    ],
    explanation: "<ol> l\xE0 vi\u1EBFt t\u1EAFt c\u1EE7a Ordered List (danh s\xE1ch c\xF3 th\u1EE9 t\u1EF1). M\u1ED7i m\u1EE5c trong danh s\xE1ch \u0111\u01B0\u1EE3c bao b\u1EDFi c\u1EB7p th\u1EBB <li> (List Item).",
    keyTakeaway: "<ol> d\xF9ng cho danh s\xE1ch c\xF3 th\u1EE9 t\u1EF1 \u0111\xE1nh s\u1ED1, <ul> d\xF9ng cho danh s\xE1ch d\u1EA5u \u0111\u1EA7u d\xF2ng.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 9: T\u1EA1o danh s\xE1ch, b\u1EA3ng",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_03",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong b\u1EA3ng HTML (th\u1EBB <table>), thu\u1ED9c t\xEDnh n\xE0o \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng trong th\u1EBB <td> ho\u1EB7c <th> \u0111\u1EC3 g\u1ED9p nhi\u1EC1u \xF4 li\xEAn ti\u1EBFp tr\xEAn c\xF9ng m\u1ED9t c\u1ED9t theo chi\u1EC1u d\u1ECDc?",
    conceptId: "CS12_WEB_HTML_BASIC",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 40,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: 'rowspan="s\u1ED1_h\xE0ng_g\u1ED9p"', isCorrect: true },
      { label: "B", text: 'colspan="s\u1ED1_c\u1ED9t_g\u1ED9p"', isCorrect: false, distractorExplanation: "colspan d\xF9ng \u0111\u1EC3 g\u1ED9p nhi\u1EC1u \xF4 theo chi\u1EC1u ngang (nhi\u1EC1u c\u1ED9t tr\xEAn c\xF9ng m\u1ED9t h\xE0ng)." },
      { label: "C", text: 'cellpadding="10"', isCorrect: false, distractorExplanation: "cellpadding quy \u0111\u1ECBnh kho\u1EA3ng c\xE1ch \u0111\u1EC7m t\u1EEB vi\u1EC1n \xF4 t\u1EDBi n\u1ED9i dung." },
      { label: "D", text: 'align="center"', isCorrect: false, distractorExplanation: "align quy \u0111\u1ECBnh c\u0103n l\u1EC1 v\u0103n b\u1EA3n trong \xF4." }
    ],
    explanation: "Thu\u1ED9c t\xEDnh rowspan g\u1ED9p c\xE1c \xF4 theo h\xE0ng d\u1ECDc (chi\u1EC1u cao), c\xF2n colspan g\u1ED9p c\xE1c \xF4 theo h\xE0ng ngang (chi\u1EC1u r\u1ED9ng) trong b\u1EA3ng HTML.",
    keyTakeaway: "rowspan g\u1ED9p \xF4 theo chi\u1EC1u d\u1ECDc nhi\u1EC1u h\xE0ng; colspan g\u1ED9p \xF4 theo chi\u1EC1u ngang nhi\u1EC1u c\u1ED9t.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 9: T\u1EA1o danh s\xE1ch, b\u1EA3ng",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_04",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: 'Xem x\xE9t \u0111o\u1EA1n m\xE3 HTML sau:\n\n<a href="#chuyen-muc-2">Xem chuy\xEAn m\u1EE5c 2</a>\n\nLi\xEAn k\u1EBFt tr\xEAn thu\u1ED9c lo\u1EA1i si\xEAu li\xEAn k\u1EBFt n\xE0o trong thi\u1EBFt k\u1EBF web?',
    conceptId: "CS12_WEB_HTML_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 40,
    competencyCode: "NLe",
    codeSnippet: {
      language: "html",
      code: '<a href="#chuyen-muc-2">Xem chuy\xEAn m\u1EE5c 2</a>'
    },
    singleChoiceOptions: [
      { label: "A", text: 'Li\xEAn k\u1EBFt neo n\u1ED9i b\u1ED9 (Bookmark / Anchor link) cu\u1ED9n t\u1EDBi ph\u1EA7n t\u1EED c\xF3 id="chuyen-muc-2" trong c\xF9ng trang web.', isCorrect: true },
      { label: "B", text: "Li\xEAn k\u1EBFt tuy\u1EC7t \u0111\u1ED1i tr\u1ECF t\u1EDBi m\u1ED9t m\xE1y ch\u1EE7 n\u01B0\u1EDBc ngo\xE0i.", isCorrect: false, distractorExplanation: "Li\xEAn k\u1EBFt tuy\u1EC7t \u0111\u1ED1i ph\u1EA3i c\xF3 \u0111\u1EA7y \u0111\u1EE7 giao th\u1EE9c http:// ho\u1EB7c https://." },
      { label: "C", text: "Li\xEAn k\u1EBFt t\u1EA3i t\u1EC7p tin nh\u1EA1c MP3 v\u1EC1 m\xE1y.", isCorrect: false, distractorExplanation: "\u0110\u01B0\u1EDDng d\u1EABn b\u1EAFt \u0111\u1EA7u b\u1EB1ng d\u1EA5u # l\xE0 li\xEAn k\u1EBFt neo t\u1EDBi \u0111\u1ECBnh danh id." },
      { label: "D", text: "Li\xEAn k\u1EBFt g\u1EEDi th\u01B0 \u0111i\u1EC7n t\u1EED mailto.", isCorrect: false, distractorExplanation: "Li\xEAn k\u1EBFt g\u1EEDi th\u01B0 c\xF3 ti\u1EC1n t\u1ED1 mailto:." }
    ],
    explanation: 'Trong HTML, d\u1EA5u th\u0103ng (#) \u0111i k\xE8m \u0111\u1ECBnh danh (v\xED d\u1EE5 href="#id_name") \u0111\u1EA1i di\u1EC7n cho li\xEAn k\u1EBFt neo (bookmark). Khi ng\u01B0\u1EDDi d\xF9ng nh\u1EA5p v\xE0o, tr\xECnh duy\u1EC7t s\u1EBD t\u1EF1 \u0111\u1ED9ng cu\u1ED9n m\xE0n h\xECnh t\u1EDBi ph\u1EA7n t\u1EED c\xF3 thu\u1ED9c t\xEDnh id kh\u1EDBp v\u1EDBi t\xEAn sau d\u1EA5u #.',
    keyTakeaway: 'href="#id" l\xE0 li\xEAn k\u1EBFt neo n\u1ED9i b\u1ED9 cu\u1ED9n t\u1EDBi v\u1ECB tr\xED ph\u1EA7n t\u1EED c\xF3 id t\u01B0\u01A1ng \u1EE9ng.',
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 10: T\u1EA1o li\xEAn k\u1EBFt",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_05",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong th\u1EBB bi\u1EC3u m\u1EABu <form>, ki\u1EC3u d\u1EEF li\u1EC7u input (thu\u1ED9c t\xEDnh type) n\xE0o sau \u0111\xE2y ch\u1EC9 cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng ch\u1ECDn duy nh\u1EA5t M\u1ED8T l\u1EF1a ch\u1ECDn trong m\u1ED9t nh\xF3m c\xE1c ph\u01B0\u01A1ng \xE1n c\xF3 c\xF9ng thu\u1ED9c t\xEDnh name?",
    conceptId: "CS12_WEB_HTML_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: '<input type="radio"> (N\xFAt ch\u1ECDn tr\xF2n).', isCorrect: true },
      { label: "B", text: '<input type="checkbox"> (H\u1ED9p ki\u1EC3m vu\xF4ng).', isCorrect: false, distractorExplanation: "Checkbox cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng \u0111\xE1nh d\u1EA5u ch\u1ECDn nhi\u1EC1u m\u1EE5c \u0111\u1ED3ng th\u1EDDi." },
      { label: "C", text: '<input type="text"> (\xD4 nh\u1EADp v\u0103n b\u1EA3n).', isCorrect: false, distractorExplanation: "Text d\xF9ng \u0111\u1EC3 nh\u1EADp chu\u1ED7i k\xFD t\u1EF1 t\u1EF1 do." },
      { label: "D", text: '<input type="submit"> (N\xFAt g\u1EEDi bi\u1EC3u m\u1EABu).', isCorrect: false, distractorExplanation: "Submit d\xF9ng \u0111\u1EC3 k\xEDch ho\u1EA1t g\u1EEDi d\u1EEF li\u1EC7u form l\xEAn m\xE1y ch\u1EE7." }
    ],
    explanation: 'N\xFAt radio (<input type="radio">) c\xF3 \u0111\u1EB7c \u0111i\u1EC3m lo\u1EA1i tr\u1EEB l\u1EABn nhau: khi c\xE1c n\xFAt radio c\xF3 c\xF9ng thu\u1ED9c t\xEDnh name, ng\u01B0\u1EDDi d\xF9ng ch\u1EC9 c\xF3 th\u1EC3 ch\u1ECDn m\u1ED9t ph\u01B0\u01A1ng \xE1n duy nh\u1EA5t t\u1EA1i m\u1ED9t th\u1EDDi \u0111i\u1EC3m.',
    keyTakeaway: 'type="radio" ch\u1ECDn 1 trong nh\xF3m c\xF9ng name; type="checkbox" ch\u1ECDn nhi\u1EC1u m\u1EE5c \u0111\u1ED9c l\u1EADp.',
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 12: T\u1EA1o bi\u1EC3u m\u1EABu",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_06",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Theo M\xF4 h\xECnh h\u1ED9p (Box Model) trong CSS, th\u1EE9 t\u1EF1 c\xE1c l\u1EDBp t\u1EEB TRONG RA NGO\xC0I bao quanh m\u1ED9t ph\u1EA7n t\u1EED n\u1ED9i dung l\xE0 g\xEC?",
    conceptId: "CS12_WEB_CSS_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "N\u1ED9i dung (Content) -> V\xF9ng \u0111\u1EC7m (Padding) -> \u0110\u01B0\u1EDDng vi\u1EC1n (Border) -> L\u1EC1 ngo\xE0i (Margin).", isCorrect: true },
      { label: "B", text: "N\u1ED9i dung (Content) -> L\u1EC1 ngo\xE0i (Margin) -> \u0110\u01B0\u1EDDng vi\u1EC1n (Border) -> V\xF9ng \u0111\u1EC7m (Padding).", isCorrect: false, distractorExplanation: "Padding n\u1EB1m s\xE1t n\u1ED9i dung, Margin n\u1EB1m \u1EDF l\u1EDBp ngo\xE0i c\xF9ng ti\u1EBFp gi\xE1p c\xE1c ph\u1EA7n t\u1EED kh\xE1c." },
      { label: "C", text: "\u0110\u01B0\u1EDDng vi\u1EC1n (Border) -> V\xF9ng \u0111\u1EC7m (Padding) -> L\u1EC1 ngo\xE0i (Margin) -> N\u1ED9i dung (Content).", isCorrect: false, distractorExplanation: "Th\u1EE9 t\u1EF1 n\xE0y b\u1ECB \u0111\u1EA3o ng\u01B0\u1EE3c." },
      { label: "D", text: "V\xF9ng \u0111\u1EC7m (Padding) -> N\u1ED9i dung (Content) -> L\u1EC1 ngo\xE0i (Margin) -> \u0110\u01B0\u1EDDng vi\u1EC1n (Border).", isCorrect: false, distractorExplanation: "N\u1ED9i dung lu\xF4n \u1EDF trong c\xF9ng." }
    ],
    explanation: "M\xF4 h\xECnh h\u1ED9p CSS Box Model g\u1ED3m 4 l\u1EDBp \u0111\u1ED3ng t\xE2m t\u1EEB trong ra ngo\xE0i: 1. Content (ch\u1EE9a v\u0103n b\u1EA3n, h\xECnh \u1EA3nh) -> 2. Padding (kho\u1EA3ng c\xE1ch gi\u1EEFa n\u1ED9i dung v\xE0 vi\u1EC1n) -> 3. Border (\u0111\u01B0\u1EDDng vi\u1EC1n bao quanh) -> 4. Margin (l\u1EC1 c\xE1ch ly ph\u1EA7n t\u1EED v\u1EDBi c\xE1c ph\u1EA7n t\u1EED l\xE2n c\u1EADn b\xEAn ngo\xE0i).",
    keyTakeaway: "Box Model: Content -> Padding -> Border -> Margin.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 16: \u0110\u1ECBnh d\u1EA1ng khung",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_07",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong CSS3, b\u1ED9 ch\u1ECDn t\u1ED5 h\u1EE3p quan h\u1EC7 n\xE0o sau \u0111\xE2y d\xF9ng \u0111\u1EC3 \u0111\u1ECBnh d\u1EA1ng cho T\u1EA4T C\u1EA2 c\xE1c ph\u1EA7n t\u1EED <p> l\xE0 con tr\u1EF1c ti\u1EBFp (c\u1EA5p 1) c\u1EE7a th\u1EBB <div>, kh\xF4ng \xE1p d\u1EE5ng cho c\xE1c th\u1EBB <p> n\u1EB1m l\u1ED3ng s\xE2u h\u01A1n \u1EDF c\xE1c c\u1EA5p con ch\xE1u b\xEAn d\u01B0\u1EDBi?",
    conceptId: "CS12_WEB_CSS_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "div > p", isCorrect: true },
      { label: "B", text: "div p", isCorrect: false, distractorExplanation: "div p l\xE0 b\u1ED9 ch\u1ECDn h\u1EADu du\u1EC7 (descendant), \xE1p d\u1EE5ng cho m\u1ECDi th\u1EBB p n\u1EB1m trong div b\u1EA5t k\u1EC3 c\u1EA5p \u0111\u1ED9 l\u1ED3ng." },
      { label: "C", text: "div + p", isCorrect: false, distractorExplanation: "div + p l\xE0 b\u1ED9 ch\u1ECDn anh em li\u1EC1n k\u1EC1 (adjacent sibling), ch\u1ECDn th\u1EBB p n\u1EB1m ngay li\u1EC1n k\u1EC1 sau th\u1EBB div." },
      { label: "D", text: "div ~ p", isCorrect: false, distractorExplanation: "div ~ p l\xE0 b\u1ED9 ch\u1ECDn anh em th\xF4ng th\u01B0\u1EDDng (general sibling)." }
    ],
    explanation: "K\xFD t\u1EF1 l\u1EDBn h\u01A1n (>) \u0111\u1EA1i di\u1EC7n cho Child Combinator trong CSS. C\xFA ph\xE1p `E > F` ch\u1EC9 ch\u1ECDn c\xE1c ph\u1EA7n t\u1EED F l\xE0 con tr\u1EF1c ti\u1EBFp c\u1EA5p 1 c\u1EE7a E.",
    keyTakeaway: "`E > F` ch\u1ECDn con tr\u1EF1c ti\u1EBFp c\u1EA5p 1; `E F` ch\u1ECDn m\u1ECDi con ch\xE1u h\u1EADu du\u1EC7 b\xEAn trong.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 15: T\u1EA1o m\xE0u cho ch\u1EEF v\xE0 n\u1EC1n",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_WEB_08",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Khi c\xF3 s\u1EF1 xung \u0111\u1ED9t \u0111\u1ECBnh d\u1EA1ng m\xE0u s\u1EAFc cho c\xF9ng m\u1ED9t th\u1EBB HTML, b\u1ED9 ch\u1ECDn CSS n\xE0o d\u01B0\u1EDBi \u0111\xE2y c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn (Specificity) cao nh\u1EA5t (n\u1EBFu kh\xF4ng x\xE9t \u0111\u1EBFn ch\u1EC9 th\u1ECB !important)?",
    conceptId: "CS12_WEB_CSS_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "Thu\u1ED9c t\xEDnh style vi\u1EBFt tr\u1EF1c ti\u1EBFp trong th\u1EBB HTML (Inline Style).", isCorrect: true },
      { label: "B", text: "B\u1ED9 ch\u1ECDn \u0111\u1ECBnh danh theo ID (#header).", isCorrect: false, distractorExplanation: "ID selector c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn 100, th\u1EA5p h\u01A1n Inline Style (1000)." },
      { label: "C", text: "B\u1ED9 ch\u1ECDn theo t\xEAn l\u1EDBp Class (.highlight).", isCorrect: false, distractorExplanation: "Class selector c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn 10." },
      { label: "D", text: "B\u1ED9 ch\u1ECDn theo t\xEAn th\u1EBB HTML (p, div).", isCorrect: false, distractorExplanation: "Tag selector c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn th\u1EA5p nh\u1EA5t (1)." }
    ],
    explanation: "Th\u1EE9 t\u1EF1 \u01B0u ti\xEAn Specificity trong CSS: Inline Style (1000) > ID Selector (100) > Class / Attribute / Pseudo-class (10) > Tag / Pseudo-element (1) > Universal * (0). Do \u0111\xF3 Inline Style c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn cao nh\u1EA5t.",
    keyTakeaway: "\u0110\u1ED9 \u01B0u ti\xEAn CSS: Inline Style (1000) > ID (100) > Class (10) > Tag name (1).",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 17: C\xE1c m\u1EE9c \u01B0u ti\xEAn c\u1EE7a b\u1ED9 ch\u1ECDn",
    sourceYear: 2024,
    isVerified: true
  },
  // --- CHỦ ĐỀ 6 & 7 (TIN 12): KẾT NỐI THIẾT BỊ SỐ & GOOGLE SITES ---
  {
    id: "Q_CS12_APP_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Khi k\u1EBFt n\u1ED1i m\xE1y t\xEDnh x\xE1ch tay v\u1EDBi m\xE1y chi\u1EBFu ho\u1EB7c m\xE0n h\xECnh ngo\xE0i qua c\u1ED5ng HDMI trong h\u1EC7 \u0111i\u1EC1u h\xE0nh Windows, ph\xEDm t\u1EAFt n\xE0o sau \u0111\xE2y m\u1EDF nhanh b\u1EA3ng ch\u1ECDn ch\u1EBF \u0111\u1ED9 tr\xECnh chi\u1EBFu (Duplicate, Extend)?",
    conceptId: "CS12_ICT_SMART_DEVICES",
    topicId: "APPLIED_INFORMATICS_12",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "T\u1ED5 h\u1EE3p ph\xEDm Windows + P.", isCorrect: true },
      { label: "B", text: "T\u1ED5 h\u1EE3p ph\xEDm Ctrl + Shift + Esc.", isCorrect: false, distractorExplanation: "T\u1ED5 h\u1EE3p ph\xEDm n\xE0y m\u1EDF tr\xECnh qu\u1EA3n l\xFD t\xE1c v\u1EE5 Task Manager." },
      { label: "C", text: "T\u1ED5 h\u1EE3p ph\xEDm Windows + R.", isCorrect: false, distractorExplanation: "Windows + R m\u1EDF h\u1ED9p tho\u1EA1i Run." },
      { label: "D", text: "T\u1ED5 h\u1EE3p ph\xEDm Alt + F4.", isCorrect: false, distractorExplanation: "Alt + F4 \u0111\xF3ng c\u1EEDa s\u1ED5 \u1EE9ng d\u1EE5ng hi\u1EC7n t\u1EA1i." }
    ],
    explanation: "T\u1ED5 h\u1EE3p ph\xEDm Windows + P (Project) trong Windows m\u1EDF tr\xECnh \u0111\u01A1n Project cho ph\xE9p l\u1EF1a ch\u1ECDn 4 ch\u1EBF \u0111\u1ED9: PC screen only (ch\u1EC9 m\xE0n h\xECnh m\xE1y t\xEDnh), Duplicate (nh\xE2n b\u1EA3n gi\u1ED1ng nhau), Extend (m\u1EDF r\u1ED9ng th\xEAm kh\xF4ng gian) v\xE0 Second screen only (ch\u1EC9 m\xE0n h\xECnh ngo\xE0i).",
    keyTakeaway: "Ph\xEDm t\u1EAFt Windows + P d\xF9ng \u0111\u1EC3 chuy\u1EC3n \u0111\u1ED5i nhanh c\xE1c ch\u1EBF \u0111\u1ED9 tr\xECnh chi\u1EBFu m\xE0n h\xECnh ngo\xE0i.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 22: Th\u1EF1c h\xE0nh k\u1EBFt n\u1ED1i c\xE1c thi\u1EBFt b\u1ECB s\u1ED1",
    sourceYear: 2024,
    isVerified: true
  },
  {
    id: "Q_CS12_APP_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Khi x\xE2y d\u1EF1ng trang web gi\u1EDBi thi\u1EC7u c\xE2u l\u1EA1c b\u1ED9 b\u1EB1ng c\xF4ng c\u1EE5 tr\u1EF1c quan Google Sites, t\xEDnh n\u0103ng n\xE0o cho ph\xE9p nh\xFAng tr\u1EF1c ti\u1EBFp bi\u1EC3u m\u1EABu kh\u1EA3o s\xE1t \xFD ki\u1EBFn th\xE0nh vi\xEAn v\xE0 t\u1EF1 \u0111\u1ED9ng t\u1ED5ng h\u1EE3p k\u1EBFt qu\u1EA3 v\xE0o trang t\xEDnh?",
    conceptId: "CS12_ICT_GOOGLE_SITES",
    topicId: "APPLIED_INFORMATICS_12",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "Ch\xE8n \u0111\u1ED1i t\u01B0\u1EE3ng Google Forms t\u1EEB menu Ch\xE8n (Insert).", isCorrect: true },
      { label: "B", text: "So\u1EA1n th\u1EA3o m\xE3 ngu\u1ED3n Java applet trong t\u1EC7p .html.", isCorrect: false, distractorExplanation: "Google Sites l\xE0 n\u1EC1n t\u1EA3ng tr\u1EF1c quan kh\xF4ng y\xEAu c\u1EA7u vi\u1EBFt Java applet." },
      { label: "C", text: "Vi\u1EBFt truy v\u1EA5n SQL CREATE TABLE tr\xEAn m\xE1y ch\u1EE7 \u1EA3o.", isCorrect: false, distractorExplanation: "Google Sites \u0111\u01B0\u1EE3c qu\u1EA3n l\xFD ho\xE0n to\xE0n t\u1EF1 \u0111\u1ED9ng tr\xEAn m\xE1y ch\u1EE7 Google." },
      { label: "D", text: "C\xE0i \u0111\u1EB7t ph\u1EA7n m\u1EC1m m\xE1y ch\u1EE7 Apache c\u1EE5c b\u1ED9.", isCorrect: false, distractorExplanation: "Google Sites ch\u1EA1y tr\xEAn n\u1EC1n t\u1EA3ng \u0111\xE1m m\xE2y c\u1EE7a Google." }
    ],
    explanation: 'Google Sites t\xEDch h\u1EE3p li\u1EC1n m\u1EA1ch trong h\u1EC7 sinh th\xE1i Google Workspace. T\u1EA1i thanh c\xF4ng c\u1EE5 Ch\xE8n (Insert), ta c\xF3 th\u1EC3 ch\u1ECDn "Bi\u1EC3u m\u1EABu" (Forms) \u0111\u1EC3 nh\xFAng form kh\u1EA3o s\xE1t v\xE0o trang web, k\u1EBFt qu\u1EA3 s\u1EBD t\u1EF1 \u0111\u1ED9ng l\u01B0u v\xE0o Google Sheets.',
    keyTakeaway: "Google Sites cho ph\xE9p nh\xFAng tr\u1EF1c quan Google Forms v\xE0 li\xEAn k\u1EBFt \u0111\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u v\xE0o Sheets.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 27: Bi\u1EC3u m\u1EABu tr\xEAn trang web",
    sourceYear: 2024,
    isVerified: true
  },
  // --- CHỦ ĐỀ 1 (TIN 11): HỆ ĐIỀU HÀNH & PHẦN CỨNG MÁY TÍNH ---
  {
    id: "Q_CS11_OS_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Ti\u1EC7n \xEDch Defragment (ch\u1ED1ng ph\xE2n m\u1EA3nh \u0111\u0129a) trong h\u1EC7 \u0111i\u1EC1u h\xE0nh Windows \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng nh\u1EB1m m\u1EE5c \u0111\xEDch ch\xEDnh n\xE0o sau \u0111\xE2y?",
    conceptId: "CS11_OS_HARDWARE",
    topicId: "OPERATING_SYSTEMS_HARDWARE",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "S\u1EAFp x\u1EBFp l\u1EA1i c\xE1c kh\u1ED1i d\u1EEF li\u1EC7u c\u1EE7a t\u1EC7p tin n\u1EB1m li\u1EC1n k\u1EC1 nhau tr\xEAn \u1ED5 c\u1EE9ng c\u01A1 (HDD) \u0111\u1EC3 t\u0103ng t\u1ED1c \u0111\u1ED9 truy xu\u1EA5t.", isCorrect: true },
      { label: "B", text: "Qu\xE9t v\xE0 ti\xEAu di\u1EC7t m\xE3 \u0111\u1ED9c, virus m\xE1y t\xEDnh tr\xEAn RAM.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 ch\u1EE9c n\u0103ng c\u1EE7a ph\u1EA7n m\u1EC1m Antivirus." },
      { label: "C", text: "N\xE9n to\xE0n b\u1ED9 video clip th\xE0nh \u0111\u1ECBnh d\u1EA1ng MP4.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 ch\u1EE9c n\u0103ng c\u1EE7a ph\u1EA7n m\u1EC1m x\u1EED l\xFD video." },
      { label: "D", text: "Kh\u1EAFc ph\u1EE5c s\u1EF1 c\u1ED1 m\u1EA5t k\u1EBFt n\u1ED1i m\u1EA1ng Internet Wi-Fi.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 ch\u1EE9c n\u0103ng ki\u1EC3m tra k\u1EBFt n\u1ED1i m\u1EA1ng." }
    ],
    explanation: "Sau th\u1EDDi gian s\u1EED d\u1EE5ng, c\xE1c t\u1EC7p tin l\u01B0u tr\xEAn \u1ED5 \u0111\u0129a t\u1EEB t\xEDnh HDD b\u1ECB x\xE9 nh\u1ECF l\u01B0u r\u1EA3i r\xE1c kh\u1EAFp n\u01A1i (hi\u1EC7n t\u01B0\u1EE3ng ph\xE2n m\u1EA3nh). Ti\u1EC7n \xEDch Defragment gom c\xE1c m\u1EA3nh d\u1EEF li\u1EC7u l\u1EA1i g\u1EA7n nhau, gi\u1EA3m th\u1EDDi gian \u0111\u1EA7u t\u1EEB di chuy\u1EC3n t\xECm ki\u1EBFm v\xE0 t\u0103ng t\u1ED1c \u0111\u1ED9 \u0111\u1ECDc t\u1EC7p.",
    keyTakeaway: "Ch\u1ED1ng ph\xE2n m\u1EA3nh \u0111\u0129a (Defragment) s\u1EAFp x\u1EBFp d\u1EEF li\u1EC7u li\u1EC1n k\u1EC1 tr\xEAn HDD \u0111\u1EC3 n\xE2ng cao t\u1ED1c \u0111\u1ED9 \u0111\u1ECDc.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 2: Th\u1EF1c h\xE0nh s\u1EED d\u1EE5ng h\u1EC7 \u0111i\u1EC1u h\xE0nh",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_HW_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "B\u1ED9 ph\u1EADn n\xE0o b\xEAn trong b\u1ED9 vi x\u1EED l\xFD (CPU) \u0111\u1EA3m nhi\u1EC7m ch\u1EE9c n\u0103ng th\u1EF1c hi\u1EC7n c\xE1c ph\xE9p to\xE1n s\u1ED1 h\u1ECDc (c\u1ED9ng, tr\u1EEB, nh\xE2n, chia) v\xE0 c\xE1c ph\xE9p to\xE1n logic (AND, OR, NOT)?",
    conceptId: "CS11_OS_HARDWARE",
    topicId: "OPERATING_SYSTEMS_HARDWARE",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "Kh\u1ED1i s\u1ED1 h\u1ECDc v\xE0 logic (ALU - Arithmetic Logic Unit).", isCorrect: true },
      { label: "B", text: "Kh\u1ED1i \u0111i\u1EC1u khi\u1EC3n (CU - Control Unit).", isCorrect: false, distractorExplanation: "CU ch\u1ECBu tr\xE1ch nhi\u1EC7m \u0111i\u1EC1u ph\u1ED1i ho\u1EA1t \u0111\u1ED9ng v\xE0 gi\u1EA3i m\xE3 l\u1EC7nh c\u1EE7a CPU." },
      { label: "C", text: "B\u1ED9 nh\u1EDB \u0111\u1EC7m (Cache).", isCorrect: false, distractorExplanation: "Cache l\xE0 b\u1ED9 nh\u1EDB t\u1EA1m t\u1ED1c \u0111\u1ED9 cao gi\u1EEFa CPU v\xE0 RAM." },
      { label: "D", text: "Kh\u1ED1i ngu\u1ED3n m\xE1y t\xEDnh (PSU).", isCorrect: false, distractorExplanation: "PSU c\u1EA5p \u0111i\u1EC7n \xE1p cho c\xE1c linh ki\u1EC7n." }
    ],
    explanation: "CPU c\xF3 3 th\xE0nh ph\u1EA7n ch\xEDnh: ALU (Arithmetic Logic Unit - th\u1EF1c hi\u1EC7n t\xEDnh to\xE1n s\u1ED1 h\u1ECDc v\xE0 logic), CU (Control Unit - \u0111i\u1EC1u khi\u1EC3n lu\u1ED3ng l\u1EC7nh) v\xE0 c\xE1c thanh ghi Register l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u t\u1EE9c th\u1EDDi.",
    keyTakeaway: "ALU b\xEAn trong CPU ch\u1ECBu tr\xE1ch nhi\u1EC7m th\u1EF1c hi\u1EC7n c\xE1c ph\xE9p t\xEDnh s\u1ED1 h\u1ECDc v\xE0 logic.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 4: B\xEAn trong m\xE1y t\xEDnh",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_HW_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "C\u1ED5ng logic n\xE0o sau \u0111\xE2y cho \u0111\u1EA7u ra c\xF3 gi\xE1 tr\u1ECB 1 (True) khi v\xE0 ch\u1EC9 khi HAI \u0111\u1EA7u v\xE0o c\xF3 gi\xE1 tr\u1ECB KH\xC1C NHAU (m\u1ED9t \u0111\u1EA7u v\xE0o l\xE0 0 v\xE0 m\u1ED9t \u0111\u1EA7u v\xE0o l\xE0 1)?",
    conceptId: "CS11_OS_HARDWARE",
    topicId: "OPERATING_SYSTEMS_HARDWARE",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 40,
    competencyCode: "NLc",
    singleChoiceOptions: [
      { label: "A", text: "C\u1ED5ng XOR (Exclusive OR).", isCorrect: true },
      { label: "B", text: "C\u1ED5ng AND.", isCorrect: false, distractorExplanation: "C\u1ED5ng AND ch\u1EC9 cho \u0111\u1EA7u ra 1 khi C\u1EA2 HAI \u0111\u1EA7u v\xE0o \u0111\u1EC1u l\xE0 1." },
      { label: "C", text: "C\u1ED5ng OR.", isCorrect: false, distractorExplanation: "C\u1ED5ng OR cho \u0111\u1EA7u ra 1 khi \xEDt nh\u1EA5t m\u1ED9t \u0111\u1EA7u v\xE0o l\xE0 1 (k\u1EC3 c\u1EA3 khi c\u1EA3 hai c\xF9ng l\xE0 1)." },
      { label: "D", text: "C\u1ED5ng NOT.", isCorrect: false, distractorExplanation: "C\u1ED5ng NOT ch\u1EC9 c\xF3 m\u1ED9t \u0111\u1EA7u v\xE0o duy nh\u1EA5t v\xE0 \u0111\u1EA3o bit." }
    ],
    explanation: "C\u1ED5ng XOR (ho\u1EB7c lo\u1EA1i tr\u1EEB) c\xF3 b\u1EA3ng ch\xE2n tr\u1ECB: 0 XOR 0 = 0; 0 XOR 1 = 1; 1 XOR 0 = 1; 1 XOR 1 = 0. C\u1ED5ng XOR cho k\u1EBFt qu\u1EA3 1 khi hai \u0111\u1EA7u v\xE0o kh\xE1c nhau, d\xF9ng l\xE0m m\u1EA1ch c\u1ED9ng nh\u1ECB ph\xE2n n\u1EEDa (Half-Adder).",
    keyTakeaway: "C\u1ED5ng XOR xu\u1EA5t bit 1 khi hai \u0111\u1EA7u v\xE0o c\xF3 gi\xE1 tr\u1ECB kh\xE1c nhau.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 4: B\xEAn trong m\xE1y t\xEDnh",
    sourceYear: 2023,
    isVerified: true
  },
  // --- CHỦ ĐỀ 2 & 3 (TIN 11): LƯU TRỮ, TÌM KIẾM & AN TOÀN SỐ ---
  {
    id: "Q_CS11_SEARCH_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: 'Tr\xEAn c\xF4ng c\u1EE5 t\xECm ki\u1EBFm Google, c\xFA ph\xE1p n\xE0o sau \u0111\xE2y gi\xFAp t\xECm ki\u1EBFm ch\xEDnh x\xE1c c\xE1c t\u1EC7p t\xE0i li\u1EC7u \u0111\u1ECBnh d\u1EA1ng PDF ch\u1EE9a nguy\xEAn v\u0103n c\u1EE5m t\u1EEB "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o"?',
    conceptId: "CS11_STORAGE_SECURITY",
    topicId: "STORAGE_SEARCH_SECURITY",
    grade: 11,
    strand: "DL",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: '"Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o" filetype:pdf', isCorrect: true },
      { label: "B", text: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o .docx", isCorrect: false, distractorExplanation: "Kh\xF4ng c\xF3 d\u1EA5u ngo\u1EB7c k\xE9p \u0111\u1EC3 t\xECm c\u1EE5m t\u1EEB ch\xEDnh x\xE1c v\xE0 kh\xF4ng \u0111\xFAng to\xE1n t\u1EED \u0111\u1ECBnh d\u1EA1ng file." },
      { label: "C", text: "SELECT * FROM Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 c\xFA ph\xE1p truy v\u1EA5n CSDL SQL, kh\xF4ng ph\u1EA3i c\xFA ph\xE1p t\xECm ki\u1EBFm Google." },
      { label: "D", text: 'ping "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o"', isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 l\u1EC7nh ki\u1EC3m tra m\u1EA1ng, kh\xF4ng ph\u1EA3i t\xECm ki\u1EBFm t\xE0i li\u1EC7u." }
    ],
    explanation: '\u0110\u1EB7t c\u1EE5m t\u1EEB trong d\u1EA5u ngo\u1EB7c k\xE9p "..." y\xEAu c\u1EA7u t\xECm ki\u1EBFm ch\xEDnh x\xE1c nguy\xEAn v\u0103n th\u1EE9 t\u1EF1 t\u1EEB. To\xE1n t\u1EED filetype:pdf y\xEAu c\u1EA7u ch\u1EC9 tr\u1EA3 v\u1EC1 c\xE1c t\u1EC7p tin c\xF3 \u0111u\xF4i \u0111\u1ECBnh d\u1EA1ng .pdf.',
    keyTakeaway: 'C\xFA ph\xE1p "c\u1EE5m t\u1EEB" filetype:lo\u1EA1i_t\u1EC7p l\u1ECDc k\u1EBFt qu\u1EA3 t\xE0i li\u1EC7u ch\xEDnh x\xE1c tr\xEAn Google.',
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 7: Th\u1EF1c h\xE0nh t\xECm ki\u1EBFm th\xF4ng tin tr\xEAn Internet",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_SEC_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: '\u0110\u1EC3 ph\xF2ng tr\xE1nh c\xE1c c\u1EA1m b\u1EABy l\u1EEBa \u0111\u1EA3o tr\u1EF1c tuy\u1EBFn (Phishing) chi\u1EBFm \u0111o\u1EA1t t\xE0i kho\u1EA3n v\xE0 ti\u1EC1n b\u1EA1c tr\xEAn m\xF4i tr\u01B0\u1EDDng s\u1ED1, h\u1ECDc sinh c\u1EA7n ghi nh\u1EDB "3 nguy\xEAn t\u1EAFc v\xE0ng" n\xE0o?',
    conceptId: "CS11_STORAGE_SECURITY",
    topicId: "STORAGE_SEARCH_SECURITY",
    grade: 11,
    strand: "DL",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLd",
    singleChoiceOptions: [
      { label: "A", text: "1. H\xE3y ch\u1EADm l\u1EA1i - 2. Ki\u1EC3m tra ngay - 3. D\u1EEBng l\u1EA1i, kh\xF4ng g\u1EEDi.", isCorrect: true },
      { label: "B", text: "1. Chuy\u1EC3n ti\u1EC1n nhanh - 2. B\u1EA5m v\xE0o link - 3. \u0110\u1ED5i m\u1EADt kh\u1EA9u.", isCorrect: false, distractorExplanation: "B\u1EA5m v\xE0o link l\u1EA1 v\xE0 chuy\u1EC3n ti\u1EC1n v\u1ED9i v\xE0ng l\xE0 h\xE0nh \u0111\u1ED9ng nguy c\u01A1 cao b\u1ECB s\u1EADp b\u1EABy l\u1EEBa \u0111\u1EA3o." },
      { label: "C", text: "1. Chia s\u1EBB OTP - 2. K\u1EBFt b\u1EA1n ng\u01B0\u1EDDi l\u1EA1 - 3. X\xF3a l\u1ECBch s\u1EED.", isCorrect: false, distractorExplanation: "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c chia s\u1EBB m\xE3 OTP cho b\u1EA5t k\u1EF3 ai." },
      { label: "D", text: "1. C\u1EAFt ngu\u1ED3n \u0111i\u1EC7n - 2. Th\xE1o \u1ED5 c\u1EE9ng - 3. C\xE0i l\u1EA1i Windows.", isCorrect: false, distractorExplanation: "\u0110\xE2y kh\xF4ng ph\u1EA3i c\xE1c nguy\xEAn t\u1EAFc \u1EE9ng x\u1EED ph\xF2ng ng\u1EEBa." }
    ],
    explanation: "SGK Tin h\u1ECDc 11 h\u01B0\u1EDBng d\u1EABn 3 nguy\xEAn t\u1EAFc ph\xF2ng ch\u1ED1ng l\u1EEBa \u0111\u1EA3o: 1. H\xE3y ch\u1EADm l\u1EA1i (b\xECnh t\u0129nh tr\u01B0\u1EDBc l\u1EDDi \u0111e d\u1ECDa ho\u1EB7c m\u1ED3i nh\u1EED) - 2. Ki\u1EC3m tra ngay (x\xE1c th\u1EF1c t\u1EEB ngu\u1ED3n tin c\u1EADy) - 3. D\u1EEBng l\u1EA1i, kh\xF4ng g\u1EEDi (kh\xF4ng cung c\u1EA5p OTP, m\u1EADt kh\u1EA9u, th\xF4ng tin c\xE1 nh\xE2n hay chuy\u1EC3n ti\u1EC1n).",
    keyTakeaway: "3 Nguy\xEAn t\u1EAFc ph\xF2ng tr\xE1nh l\u1EEBa \u0111\u1EA3o s\u1ED1: H\xE3y ch\u1EADm l\u1EA1i - Ki\u1EC3m tra ngay - D\u1EEBng l\u1EA1i, kh\xF4ng g\u1EEDi.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 9: Giao ti\u1EBFp an to\xE0n tr\xEAn Internet",
    sourceYear: 2023,
    isVerified: true
  },
  // --- CHỦ ĐỀ 4 & 6 (TIN 11): CƠ SỞ DỮ LIỆU & SQL ---
  {
    id: "Q_CS11_DB_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong m\xF4 h\xECnh C\u01A1 s\u1EDF d\u1EEF li\u1EC7u quan h\u1EC7 (RDBMS), tr\u01B0\u1EDDng (thu\u1ED9c t\xEDnh) \u0111\xF3ng vai tr\xF2 l\xE0 KH\xD3A CH\xCDNH (Primary Key) c\u1EE7a m\u1ED9t b\u1EA3ng ph\u1EA3i th\u1ECFa m\xE3n \u0111i\u1EC1u ki\u1EC7n ti\xEAn quy\u1EBFt n\xE0o?",
    conceptId: "CS11_DB_RELATIONAL",
    topicId: "RELATIONAL_DATABASE",
    grade: 11,
    strand: "CS",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLc",
    singleChoiceOptions: [
      { label: "A", text: "Gi\xE1 tr\u1ECB x\xE1c \u0111\u1ECBnh duy nh\u1EA5t m\u1ED7i b\u1EA3n ghi, kh\xF4ng \u0111\u01B0\u1EE3c tr\xF9ng l\u1EB7p v\xE0 kh\xF4ng \u0111\u01B0\u1EE3c nh\u1EADn gi\xE1 tr\u1ECB r\u1ED7ng (NULL).", isCorrect: true },
      { label: "B", text: "B\u1EAFt bu\u1ED9c ph\u1EA3i l\xE0 ki\u1EC3u d\u1EEF li\u1EC7u ng\xE0y th\xE1ng n\u0103m (DATE).", isCorrect: false, distractorExplanation: "Kh\xF3a ch\xEDnh th\u01B0\u1EDDng l\xE0 ki\u1EC3u s\u1ED1 nguy\xEAn INT ho\u1EB7c chu\u1ED7i k\xFD t\u1EF1 VARCHAR, kh\xF4ng b\u1EAFt bu\u1ED9c l\xE0 DATE." },
      { label: "C", text: "\u0110\u01B0\u1EE3c ph\xE9p ch\u1EE9a nhi\u1EC1u gi\xE1 tr\u1ECB tr\xF9ng nhau \u0111\u1EC3 ti\u1EC7n tra c\u1EE9u.", isCorrect: false, distractorExplanation: "N\u1EBFu tr\xF9ng l\u1EB7p th\xEC kh\xF4ng th\u1EC3 x\xE1c \u0111\u1ECBnh duy nh\u1EA5t b\u1EA3n ghi." },
      { label: "D", text: "Ch\u1EC9 \u0111\u01B0\u1EE3c ph\xE9p t\u1EA1o duy nh\u1EA5t trong b\u1EA3ng c\xF3 d\u01B0\u1EDBi 10 b\u1EA3n ghi.", isCorrect: false, distractorExplanation: "M\u1ECDi b\u1EA3ng trong CSDL quan h\u1EC7 \u0111\u1EC1u c\u1EA7n c\xF3 kh\xF3a ch\xEDnh kh\xF4ng ph\u1EE5 thu\u1ED9c s\u1ED1 l\u01B0\u1EE3ng b\u1EA3n ghi." }
    ],
    explanation: "Kh\xF3a ch\xEDnh (Primary Key) l\xE0 thu\u1ED9c t\xEDnh ho\u1EB7c t\u1EADp thu\u1ED9c t\xEDnh d\xF9ng \u0111\u1EC3 ph\xE2n bi\u1EC7t duy nh\u1EA5t t\u1EEBng b\u1EA3n ghi trong b\u1EA3ng quan h\u1EC7. Quy t\u1EAFc b\u1EAFt bu\u1ED9c: c\xE1c gi\xE1 tr\u1ECB c\u1EE7a kh\xF3a ch\xEDnh ph\u1EA3i l\xE0 duy nh\u1EA5t (Unique) v\xE0 kh\xF4ng \u0111\u01B0\u1EE3c r\u1ED7ng (NOT NULL).",
    keyTakeaway: "Kh\xF3a ch\xEDnh ph\u1EA3i l\xE0 duy nh\u1EA5t (Unique) v\xE0 kh\xF4ng bao gi\u1EDD \u0111\u01B0\u1EE3c nh\u1EADn gi\xE1 tr\u1ECB r\u1ED7ng (NOT NULL).",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 13: C\u01A1 s\u1EDF d\u1EEF li\u1EC7u quan h\u1EC7",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_DB_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong ph\u1EA7n m\u1EC1m HeidiSQL qu\u1EA3n tr\u1ECB MySQL, thu\u1ED9c t\xEDnh n\xE0o \u0111\u01B0\u1EE3c \u0111\xE1nh d\u1EA5u khi thi\u1EBFt k\u1EBF c\u1ED9t kh\xF3a ch\xEDnh ki\u1EC3u s\u1ED1 nguy\xEAn \u0111\u1EC3 gi\xE1 tr\u1ECB t\u1EF1 \u0111\u1ED9ng t\u0103ng l\xEAn 1 \u0111\u01A1n v\u1ECB m\u1ED7i khi th\xEAm b\u1EA3n ghi m\u1EDBi?",
    conceptId: "CS11_SQL_QUERIES",
    topicId: "SQL_LANGUAGE",
    grade: 11,
    strand: "CS",
    cognitiveLevel: "knowledge",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLe",
    singleChoiceOptions: [
      { label: "A", text: "AUTO_INCREMENT (T\u1EF1 \u0111\u1ED9ng t\u0103ng).", isCorrect: true },
      { label: "B", text: "UNIQUE (Kh\xF4ng tr\xF9ng l\u1EB7p).", isCorrect: false, distractorExplanation: "UNIQUE r\xE0ng bu\u1ED9c kh\xF4ng tr\xF9ng l\u1EB7p nh\u01B0ng kh\xF4ng t\u1EF1 \u0111\u1ED9ng sinh s\u1ED1 t\u0103ng." },
      { label: "C", text: "DEFAULT NULL.", isCorrect: false, distractorExplanation: "DEFAULT NULL \u0111\u1EB7t gi\xE1 tr\u1ECB m\u1EB7c \u0111\u1ECBnh l\xE0 r\u1ED7ng." },
      { label: "D", text: "BINARY.", isCorrect: false, distractorExplanation: "BINARY l\xE0 ki\u1EC3u d\u1EEF li\u1EC7u nh\u1ECB ph\xE2n." }
    ],
    explanation: "Thu\u1ED9c t\xEDnh AUTO_INCREMENT trong MySQL v\xE0 giao di\u1EC7n HeidiSQL gi\xFAp h\u1EC7 qu\u1EA3n tr\u1ECB t\u1EF1 \u0111\u1ED9ng sinh gi\xE1 tr\u1ECB s\u1ED1 nguy\xEAn t\u0103ng d\u1EA7n ti\u1EBFp theo (1, 2, 3...) cho kh\xF3a ch\xEDnh m\u1ED7i khi m\u1ED9t b\u1EA3n ghi m\u1EDBi \u0111\u01B0\u1EE3c ch\xE8n v\xE0o m\xE0 kh\xF4ng c\u1EA7n ng\u01B0\u1EDDi d\xF9ng nh\u1EADp tay.",
    keyTakeaway: "AUTO_INCREMENT gi\xFAp t\u1EF1 \u0111\u1ED9ng t\u0103ng gi\xE1 tr\u1ECB kh\xF3a ch\xEDnh khi th\xEAm b\u1EA3n ghi m\u1EDBi trong MySQL.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 19: Th\u1EF1c h\xE0nh t\u1EA1o l\u1EADp c\u01A1 s\u1EDF d\u1EEF li\u1EC7u v\xE0 c\xE1c b\u1EA3ng",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_SQL_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Cho b\u1EA3ng HOCSINH(MaHS, HoTen, DiemToan, DiemVan). C\xE2u l\u1EC7nh SQL n\xE0o sau \u0111\xE2y l\u1EA5y ra danh s\xE1ch H\u1ECD t\xEAn v\xE0 \u0110i\u1EC3m To\xE1n c\u1EE7a nh\u1EEFng h\u1ECDc sinh c\xF3 \u0110i\u1EC3m To\xE1n t\u1EEB 8.0 tr\u1EDF l\xEAn v\xE0 s\u1EAFp x\u1EBFp gi\u1EA3m d\u1EA7n theo \u0110i\u1EC3m To\xE1n?",
    conceptId: "CS11_SQL_QUERIES",
    topicId: "SQL_LANGUAGE",
    grade: 11,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 50,
    competencyCode: "NLc",
    codeSnippet: {
      language: "sql",
      code: "SELECT HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0 ORDER BY DiemToan DESC;"
    },
    singleChoiceOptions: [
      { label: "A", text: "SELECT HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0 ORDER BY DiemToan DESC;", isCorrect: true },
      { label: "B", text: "SELECT * FROM HOCSINH WHERE DiemToan > 8.0 SORT BY DiemToan;", isCorrect: false, distractorExplanation: "SQL kh\xF4ng c\xF3 t\u1EEB kh\xF3a SORT BY, ch\u1EC9 c\xF3 ORDER BY; c\xE2u h\u1ECFi y\xEAu c\u1EA7u >= v\xE0 ch\u1EC9 l\u1EA5y HoTen, DiemToan." },
      { label: "C", text: "SELECT HoTen, DiemToan FROM HOCSINH IF DiemToan >= 8.0 ORDER BY DiemToan ASC;", isCorrect: false, distractorExplanation: "SQL l\u1ECDc b\u1EA3n ghi b\u1EB1ng m\u1EC7nh \u0111\u1EC1 WHERE, kh\xF4ng d\xF9ng IF; ASC l\xE0 s\u1EAFp x\u1EBFp t\u0103ng d\u1EA7n." },
      { label: "D", text: "GET HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0;", isCorrect: false, distractorExplanation: "SQL truy v\u1EA5n d\u1EEF li\u1EC7u b\u1EB1ng t\u1EEB kh\xF3a SELECT, kh\xF4ng c\xF3 l\u1EC7nh GET." }
    ],
    explanation: "C\u1EA5u tr\xFAc chu\u1EA9n c\u1EE7a c\xE2u truy v\u1EA5n: `SELECT [danh s\xE1ch c\u1ED9t] FROM [b\u1EA3ng] WHERE [\u0111i\u1EC1u ki\u1EC7n l\u1ECDc] ORDER BY [c\u1ED9t] DESC;`. Trong \u0111\xF3 DESC l\xE0 gi\u1EA3m d\u1EA7n (Descending).",
    keyTakeaway: "SELECT l\u1ECDc c\u1ED9t, WHERE l\u1ECDc h\xE0ng, ORDER BY [c\u1ED9t] DESC s\u1EAFp x\u1EBFp gi\u1EA3m d\u1EA7n.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 14: SQL - Ng\xF4n ng\u1EEF truy v\u1EA5n c\xF3 c\u1EA5u tr\xFAc",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_SQL_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Cho hai b\u1EA3ng: LOP(MaLop, TenLop) v\xE0 HOCSINH(MaHS, HoTen, MaLop). \u0110\u1EC3 k\u1EBFt n\u1ED1i d\u1EEF li\u1EC7u t\u1EEB c\u1EA3 hai b\u1EA3ng hi\u1EC3n th\u1ECB th\xF4ng tin h\u1ECDc sinh c\xF9ng t\xEAn l\u1EDBp t\u01B0\u01A1ng \u1EE9ng, m\u1EC7nh \u0111\u1EC1 k\u1EBFt n\u1ED1i n\xE0o \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng?",
    conceptId: "CS11_SQL_QUERIES",
    topicId: "SQL_LANGUAGE",
    grade: 11,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 50,
    competencyCode: "NLc",
    codeSnippet: {
      language: "sql",
      code: "SELECT HOCSINH.HoTen, LOP.TenLop\nFROM HOCSINH\nINNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop;"
    },
    singleChoiceOptions: [
      { label: "A", text: "INNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop", isCorrect: true },
      { label: "B", text: "COMBINE LOP WITH HOCSINH", isCorrect: false, distractorExplanation: "SQL kh\xF4ng c\xF3 t\u1EEB kh\xF3a COMBINE WITH." },
      { label: "C", text: "UNION ALL LOP WHERE MaLop = MaLop", isCorrect: false, distractorExplanation: "UNION d\xF9ng \u0111\u1EC3 gh\xE9p n\u1ED1i c\xE1c d\xF2ng c\u1EE7a hai b\u1EA3ng c\xF3 c\u1EA5u tr\xFAc t\u01B0\u01A1ng th\xEDch, kh\xF4ng d\xF9ng \u0111\u1EC3 k\u1EBFt n\u1ED1i b\u1EA3ng theo quan h\u1EC7 kh\xF3a." },
      { label: "D", text: "ATTACH LOP TO HOCSINH", isCorrect: false, distractorExplanation: "SQL kh\xF4ng c\xF3 c\xFA ph\xE1p ATTACH TO n\xE0y." }
    ],
    explanation: "M\u1EC7nh \u0111\u1EC1 `INNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop` th\u1EF1c hi\u1EC7n ph\xE9p n\u1ED1i trong gi\u1EEFa hai b\u1EA3ng d\u1EF1a tr\xEAn s\u1EF1 b\u1EB1ng nhau c\u1EE7a tr\u01B0\u1EDDng kh\xF3a ngo\u1EA1i MaLop trong b\u1EA3ng HOCSINH v\xE0 tr\u01B0\u1EDDng kh\xF3a ch\xEDnh MaLop trong b\u1EA3ng LOP.",
    keyTakeaway: "INNER JOIN ... ON k\u1EBFt n\u1ED1i hai b\u1EA3ng theo c\u1EB7p kh\xF3a ch\xEDnh - kh\xF3a ngo\u1EA1i t\u01B0\u01A1ng \u1EE9ng.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 23: Th\u1EF1c h\xE0nh truy xu\u1EA5t d\u1EEF li\u1EC7u qua li\xEAn k\u1EBFt c\xE1c b\u1EA3ng",
    sourceYear: 2023,
    isVerified: true
  },
  // --- CHỦ ĐỀ 7 (TIN 11): ĐỒ HỌA GIMP & BIÊN TẬP VIDEO VIDEOPAD ---
  {
    id: "Q_CS11_MEDIA_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: 'Trong ph\u1EA7n m\u1EC1m ch\u1EC9nh s\u1EEDa \u1EA3nh GIMP, t\xEDnh n\u0103ng "L\u1EDBp \u1EA3nh" (Layer) mang l\u1EA1i l\u1EE3i \xEDch quan tr\u1ECDng n\xE0o sau \u0111\xE2y cho ng\u01B0\u1EDDi thi\u1EBFt k\u1EBF?',
    conceptId: "CS11_ICT_MEDIA_EDITING",
    topicId: "MULTIMEDIA_EDITING",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 35,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "Cho ph\xE9p ch\u1EC9nh s\u1EEDa, di chuy\u1EC3n t\u1EEBng \u0111\u1ED1i t\u01B0\u1EE3ng ho\u1EB7c chi ti\u1EBFt \u0111\u1ED9c l\u1EADp m\xE0 kh\xF4ng \u1EA3nh h\u01B0\u1EDFng l\xE0m h\u1ECFng c\xE1c ph\u1EA7n t\u1EED \u1EDF c\xE1c l\u1EDBp kh\xE1c.", isCorrect: true },
      { label: "B", text: "T\u1EF1 \u0111\u1ED9ng s\u1EEDa l\u1ED7i ch\xEDnh t\u1EA3 v\u0103n b\u1EA3n ti\u1EBFng Vi\u1EC7t tr\xEAn \u1EA3nh.", isCorrect: false, distractorExplanation: "Layer kh\xF4ng ph\u1EA3i c\xF4ng c\u1EE5 ki\u1EC3m tra ch\xEDnh t\u1EA3 v\u0103n b\u1EA3n." },
      { label: "C", text: "Gi\u1EA3m \u0111\u1ED9 ph\xE2n gi\u1EA3i c\u1EE7a b\u1EE9c \u1EA3nh xu\u1ED1ng m\u1EE9c th\u1EA5p nh\u1EA5t.", isCorrect: false, distractorExplanation: "Layer kh\xF4ng l\xE0m gi\u1EA3m \u0111\u1ED9 ph\xE2n gi\u1EA3i c\u1EE7a \u1EA3nh." },
      { label: "D", text: "Chuy\u1EC3n \u0111\u1ED5i h\xECnh \u1EA3nh t\u0129nh th\xE0nh t\u1EC7p \xE2m thanh MP3.", isCorrect: false, distractorExplanation: "\u1EA2nh kh\xF4ng th\u1EC3 chuy\u1EC3n th\xE0nh t\u1EC7p \xE2m thanh qua Layer." }
    ],
    explanation: "C\xE1c l\u1EDBp \u1EA3nh (Layers) trong GIMP gi\u1ED1ng nh\u01B0 c\xE1c t\u1EA5m k\xEDnh trong su\u1ED1t x\u1EBFp ch\u1ED3ng l\xEAn nhau. Thi\u1EBFt k\u1EBF tr\xEAn t\u1EEBng layer gi\xFAp ng\u01B0\u1EDDi d\xF9ng th\u1ECFa s\u1EE9c v\u1EBD, \u0111\u1ED5i m\xE0u, di chuy\u1EC3n ho\u1EB7c \u1EA9n/hi\u1EC7n m\xE0 kh\xF4ng l\xE0m bi\u1EBFn d\u1EA1ng c\xE1c \u0111\u1ED1i t\u01B0\u1EE3ng n\u1EB1m \u1EDF l\u1EDBp kh\xE1c.",
    keyTakeaway: "L\u1EDBp \u1EA3nh (Layer) trong GIMP gi\xFAp qu\u1EA3n l\xFD v\xE0 ch\u1EC9nh s\u1EEDa c\xE1c \u0111\u1ED1i t\u01B0\u1EE3ng \u0111\u1ED3 h\u1ECDa ho\xE0n to\xE0n \u0111\u1ED9c l\u1EADp.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 25: Ph\u1EA7n m\u1EC1m ch\u1EC9nh s\u1EEDa \u1EA3nh",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS11_MEDIA_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Trong ph\u1EA7n m\u1EC1m bi\xEAn t\u1EADp phim VideoPad, hi\u1EC7u \u1EE9ng n\xE0o sau \u0111\xE2y th\u01B0\u1EDDng \u0111\u01B0\u1EE3c ch\xE8n v\xE0o gi\u1EEFa hai \u0111o\u1EA1n video clip k\u1EC1 nhau tr\xEAn d\xF2ng th\u1EDDi gian Timeline \u0111\u1EC3 t\u1EA1o s\u1EF1 chuy\u1EC3n ti\u1EBFp m\u01B0\u1EE3t m\xE0?",
    conceptId: "CS11_ICT_MEDIA_EDITING",
    topicId: "MULTIMEDIA_EDITING",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "easy",
    estimatedTimeSec: 30,
    competencyCode: "NLa",
    singleChoiceOptions: [
      { label: "A", text: "Hi\u1EC7u \u1EE9ng chuy\u1EC3n c\u1EA3nh (Transition nh\u01B0 Fade, Dissolve, CrossFade).", isCorrect: true },
      { label: "B", text: "L\u1EC7nh \u0111\u1ECBnh d\u1EA1ng ph\xF4ng ch\u1EEF font-family.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 thu\u1ED9c t\xEDnh trong CSS, kh\xF4ng ph\u1EA3i hi\u1EC7u \u1EE9ng video." },
      { label: "C", text: "L\u1EC7nh n\xE9n t\u1EC7p tin WinRAR.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 ph\u1EA7n m\u1EC1m n\xE9n t\u1EC7p tin." },
      { label: "D", text: "L\u1EC7nh chia s\u1EBB m\xE1y in Print Server.", isCorrect: false, distractorExplanation: "\u0110\xE2y l\xE0 t\xEDnh n\u0103ng m\u1EA1ng m\xE1y t\xEDnh." }
    ],
    explanation: "Hi\u1EC7u \u1EE9ng chuy\u1EC3n c\u1EA3nh Transition (nh\u01B0 m\u1EDD d\u1EA7n - Fade, h\xF2a tan - Dissolve) \u0111\u01B0\u1EE3c \u0111\u1EB7t t\u1EA1i \u0111i\u1EC3m n\u1ED1i gi\u1EEFa hai c\u1EA3nh phim gi\xFAp video chuy\u1EC3n t\u1EEB c\u1EA3nh tr\u01B0\u1EDBc sang c\u1EA3nh sau uy\u1EC3n chuy\u1EC3n, t\u1EF1 nhi\xEAn v\xE0 chuy\xEAn nghi\u1EC7p.",
    keyTakeaway: "Hi\u1EC7u \u1EE9ng Transition trong VideoPad t\u1EA1o s\u1EF1 chuy\u1EC3n ti\u1EBFp m\u01B0\u1EE3t m\xE0 gi\u1EEFa c\xE1c \u0111o\u1EA1n clip.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 30: Bi\xEAn t\u1EADp phim",
    sourceYear: 2023,
    isVerified: true
  },
  // --- CHỦ ĐỀ THUẬT TOÁN & LẬP TRÌNH PYTHON CỐT LÕI (TIN 10) ---
  {
    id: "Q_CS10_PY_01",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "Cho danh s\xE1ch Python: a = [10, 20, 30, 40, 50, 60]. C\xFA ph\xE1p c\u1EAFt l\xE1t (slicing) n\xE0o sau \u0111\xE2y s\u1EBD tr\xEDch xu\u1EA5t ra danh s\xE1ch con g\u1ED3m 3 ph\u1EA7n t\u1EED [20, 30, 40]?",
    conceptId: "CS10_PYTHON_DATA_STRUCT",
    topicId: "PYTHON_PROGRAMMING",
    grade: 10,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLc",
    codeSnippet: {
      language: "python",
      code: "a = [10, 20, 30, 40, 50, 60]\nsub = a[1:4]"
    },
    singleChoiceOptions: [
      { label: "A", text: "a[1:4]", isCorrect: true },
      { label: "B", text: "a[1:3]", isCorrect: false, distractorExplanation: "a[1:3] ch\u1EC9 l\u1EA5y ph\u1EA7n t\u1EED t\u1EA1i v\u1ECB tr\xED 1 v\xE0 2, t\u1EE9c l\xE0 [20, 30]." },
      { label: "C", text: "a[2:4]", isCorrect: false, distractorExplanation: "a[2:4] l\u1EA5y v\u1ECB tr\xED 2 v\xE0 3, t\u1EE9c l\xE0 [30, 40]." },
      { label: "D", text: "a[0:3]", isCorrect: false, distractorExplanation: "a[0:3] l\u1EA5y t\u1EEB \u0111\u1EA7u: [10, 20, 30]." }
    ],
    explanation: "Trong Python, ch\u1EC9 s\u1ED1 danh s\xE1ch b\u1EAFt \u0111\u1EA7u t\u1EEB 0. Ph\u1EA7n t\u1EED 20 \u1EDF ch\u1EC9 s\u1ED1 1, 30 \u1EDF ch\u1EC9 s\u1ED1 2, 40 \u1EDF ch\u1EC9 s\u1ED1 3. C\xFA ph\xE1p a[start:stop] l\u1EA5y c\xE1c ph\u1EA7n t\u1EED t\u1EEB start \u0111\u1EBFn stop-1. Do \u0111\xF3 a[1:4] l\u1EA5y ph\u1EA7n t\u1EED t\u1EA1i c\xE1c ch\u1EC9 s\u1ED1 1, 2, 3 -> [20, 30, 40].",
    keyTakeaway: "a[start:stop] l\u1EA5y ph\u1EA7n t\u1EED t\u1EEB ch\u1EC9 s\u1ED1 start \u0111\u1EBFn stop-1 trong Python.",
    source: "SGK Tin h\u1ECDc 10 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 22: Ki\u1EC3u d\u1EEF li\u1EC7u danh s\xE1ch",
    sourceYear: 2023,
    isVerified: true
  },
  {
    id: "Q_CS10_PY_02",
    questionType: "single_choice",
    sectionScope: "mandatory",
    track: "ALL",
    stem: "\u0110o\u1EA1n m\xE3 Python sau in ra gi\xE1 tr\u1ECB c\u1EE7a bi\u1EBFn s b\u1EB1ng bao nhi\xEAu sau khi k\u1EBFt th\xFAc v\xF2ng l\u1EB7p?\n\ns = 0\nfor i in range(1, 6):\n    if i % 2 == 1:\n        s += i\nprint(s)",
    conceptId: "CS10_PYTHON_CONTROL",
    topicId: "PYTHON_PROGRAMMING",
    grade: 10,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 45,
    competencyCode: "NLc",
    codeSnippet: {
      language: "python",
      code: "s = 0\nfor i in range(1, 6):\n    if i % 2 == 1:\n        s += i\nprint(s)"
    },
    singleChoiceOptions: [
      { label: "A", text: "9", isCorrect: true },
      { label: "B", text: "15", isCorrect: false, distractorExplanation: "15 l\xE0 t\u1ED5ng c\u1EE7a m\u1ECDi s\u1ED1 t\u1EEB 1 \u0111\u1EBFn 5, nh\u01B0ng \u0111i\u1EC1u ki\u1EC7n if ch\u1EC9 c\u1ED9ng c\xE1c s\u1ED1 l\u1EBB." },
      { label: "C", text: "6", isCorrect: false, distractorExplanation: "6 l\xE0 t\u1ED5ng c\u1EE7a c\xE1c s\u1ED1 ch\u1EB5n (2 + 4)." },
      { label: "D", text: "25", isCorrect: false, distractorExplanation: "T\xEDnh to\xE1n sai ph\u1EA1m vi range." }
    ],
    explanation: "H\xE0m range(1, 6) sinh ra c\xE1c gi\xE1 tr\u1ECB i l\u1EA7n l\u01B0\u1EE3t l\xE0: 1, 2, 3, 4, 5. \u0110i\u1EC1u ki\u1EC7n if i % 2 == 1 l\u1ECDc c\xE1c s\u1ED1 l\u1EBB g\u1ED3m 1, 3, 5. Bi\u1EBFn s c\u1ED9ng d\u1ED3n: s = 1 + 3 + 5 = 9.",
    keyTakeaway: "range(1, 6) sinh c\xE1c gi\xE1 tr\u1ECB t\u1EEB 1 \u0111\u1EBFn 5; to\xE1n t\u1EED % l\u1EA5y ph\u1EA7n d\u01B0 \u0111\u1EC3 ki\u1EC3m tra ch\u1EB5n/l\u1EBB.",
    source: "SGK Tin h\u1ECDc 10 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 20: C\xE2u l\u1EC7nh l\u1EB7p for",
    sourceYear: 2023,
    isVerified: true
  },
  // =========================================================================
  // =========================================================================
  // PHẦN II & III: CÂU HỎI TRẮC NGHIỆM ĐÚNG / SAI
  // Mỗi thí sinh làm 2 câu chung và 2 câu theo định hướng (mỗi câu tối đa 1.0 điểm).
  // =========================================================================
  // --- CÂU ĐÚNG/SAI CHUNG CHO TẤT CẢ THÍ SINH ---
  // CÂU CHUNG 1: TRÍ TUỆ NHÂN TẠO & ĐẠO ĐỨC CÔNG NGHỆ (TIN 12 - CHỦ ĐỀ 1)
  {
    id: "Q_CS12_TF_01",
    questionType: "true_false_multistatement",
    sectionScope: "mandatory_tf",
    track: "ALL",
    stem: 'Trong m\u1ED9t bu\u1ED5i sinh ho\u1EA1t chuy\xEAn \u0111\u1EC1 v\u1EC1 "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o v\xE0 t\u01B0\u01A1ng lai s\u1ED1", c\xE1c b\u1EA1n h\u1ECDc sinh th\u1EA3o lu\u1EADn v\u1EC1 \u0111\u1EB7c tr\u01B0ng, \u1EE9ng d\u1EE5ng v\xE0 r\u1EE7i ro c\u1EE7a AI. H\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a m\u1ED7i ph\xE1t bi\u1EC3u sau \u0111\xE2y:',
    conceptId: "CS12_AI_CONCEPTS",
    topicId: "AI_FUNDAMENTALS",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 150,
    competencyCode: "NLc",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "H\u1EC7 th\u1ED1ng nh\u1EADn di\u1EC7n khu\xF4n m\u1EB7t t\u1EF1 \u0111\u1ED9ng \u0111i\u1EC3m danh t\u1EA1i c\u1ED5ng tr\u01B0\u1EDDng h\u1ECDc l\xE0 m\u1ED9t v\xED d\u1EE5 \u1EE9ng d\u1EE5ng c\u1EE7a Th\u1ECB gi\xE1c m\xE1y t\xEDnh (Computer Vision) trong AI.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Nh\u1EADn di\u1EC7n khu\xF4n m\u1EB7t l\xE0 b\xE0i to\xE1n nh\u1EADn d\u1EA1ng m\u1EABu h\xECnh \u1EA3nh thu\u1ED9c l\u0129nh v\u1EF1c Th\u1ECB gi\xE1c m\xE1y t\xEDnh (Computer Vision)."
      },
      {
        subOrder: "b",
        statementText: "T\u1EA5t c\u1EA3 c\xE1c h\u1EC7 th\u1ED1ng AI th\u01B0\u01A1ng m\u1EA1i hi\u1EC7n nay \u0111\u1EC1u \u0111\xE3 \u0111\u1EA1t t\u1EDBi m\u1EE9c Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o t\u1ED5ng qu\xE1t (AGI) c\xF3 th\u1EC3 t\u1EF1 \xFD th\u1EE9c v\xE0 l\xE0m ch\u1EE7 m\u1ECDi l\u0129nh v\u1EF1c nh\u1EADn th\u1EE9c c\u1EE7a con ng\u01B0\u1EDDi.",
        isCorrect: false,
        explanation: "Sai. C\xE1c h\u1EC7 th\u1ED1ng AI hi\u1EC7n nay \u0111\u1EC1u l\xE0 AI h\u1EB9p (Narrow AI), chuy\xEAn s\xE2u v\xE0o m\u1ED9t t\xE1c v\u1EE5 c\u1EE5 th\u1EC3; AGI v\u1EABn l\xE0 m\u1EE5c ti\xEAu nghi\xEAn c\u1EE9u d\xE0i h\u1EA1n trong t\u01B0\u01A1ng lai."
      },
      {
        subOrder: "c",
        statementText: "M\xF4 h\xECnh ng\xF4n ng\u1EEF l\u1EDBn (LLM) c\xF3 th\u1EC3 t\u1EA1o ra c\xE1c c\xE2u tr\u1EA3 l\u1EDDi \u0111\u1ECDc r\u1EA5t tr\xF4i ch\u1EA3y nh\u01B0ng ch\u1EE9a \u0111\u1EF1ng d\u1EEF li\u1EC7u sai l\u1EC7ch ho\u1EB7c h\u01B0 c\u1EA5u (hi\u1EC7n t\u01B0\u1EE3ng \u1EA2o gi\xE1c AI - Hallucination).",
        isCorrect: true,
        explanation: "\u0110\xFAng. \u0110\xE2y l\xE0 h\u1EA1n ch\u1EBF \u0111\u01B0\u1EE3c ghi nh\u1EADn r\xF5 trong gi\xE1o tr\xECnh Tin h\u1ECDc 12, ng\u01B0\u1EDDi h\u1ECDc c\u1EA7n c\xF3 t\u01B0 duy ph\u1EA3n bi\u1EC7n khi s\u1EED d\u1EE5ng d\u1EEF li\u1EC7u t\u1EEB AI."
      },
      {
        subOrder: "d",
        statementText: "H\u1ECDc sinh \u0111\u01B0\u1EE3c ph\xE9p s\u1EED d\u1EE5ng AI t\u1EA1o sinh \u0111\u1EC3 vi\u1EBFt to\xE0n b\u1ED9 b\xE0i lu\u1EADn v\u0103n v\xE0 n\u1ED9p d\u01B0\u1EDBi t\xEAn c\u1EE7a m\xECnh m\xE0 kh\xF4ng c\u1EA7n ghi ngu\u1ED3n tham kh\u1EA3o.",
        isCorrect: false,
        explanation: "Sai. H\xE0nh vi n\xE0y vi ph\u1EA1m t\xEDnh li\xEAm ch\xEDnh h\u1ECDc thu\u1EADt v\xE0 b\u1EA3n quy\u1EC1n s\u1EDF h\u1EEFu tr\xED tu\u1EC7."
      }
    ],
    explanation: "C\xE2u h\u1ECFi ki\u1EC3m tra ki\u1EBFn th\u1EE9c v\u1EC1 c\xE1c nh\xE1nh c\u1EE7a AI (Th\u1ECB gi\xE1c m\xE1y t\xEDnh, AGI vs Narrow AI), hi\u1EC7n t\u01B0\u1EE3ng \u1EA3o gi\xE1c c\u1EE7a m\xF4 h\xECnh ng\xF4n ng\u1EEF v\xE0 \u0111\u1EA1o \u0111\u1EE9c s\u1EED d\u1EE5ng AI trong h\u1ECDc t\u1EADp.",
    keyTakeaway: "Ph\u1EA7n II \u0111\xE1nh gi\xE1 to\xE0n di\u1EC7n nh\u1EADn th\u1EE9c \u0110\xFAng/Sai theo 4 m\u1EC7nh \u0111\u1EC1 \u0111\u1ED9c l\u1EADp.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 1: M\xE1y t\xEDnh v\xE0 x\xE3 h\u1ED9i tri th\u1EE9c",
    sourceYear: 2024,
    isVerified: true
  },
  // CÂU CHUNG 2: CƠ SỞ DỮ LIỆU QUAN HỆ & SQL (TIN 11 - CHỦ ĐỀ 4, 6)
  {
    id: "Q_CS11_TF_01",
    questionType: "true_false_multistatement",
    sectionScope: "mandatory_tf",
    track: "ALL",
    stem: "Cho c\u01A1 s\u1EDF d\u1EEF li\u1EC7u qu\u1EA3n l\xFD m\u01B0\u1EE3n s\xE1ch th\u01B0 vi\u1EC7n c\u1EE7a tr\u01B0\u1EDDng THPT g\u1ED3m 3 b\u1EA3ng quan h\u1EC7 sau:\n- DOCGIA(MaDG, HoTen, Lop, NgaySinh) v\u1EDBi MaDG l\xE0 kh\xF3a ch\xEDnh.\n- SACH(MaSach, TenSach, TacGia, SoLuong) v\u1EDBi MaSach l\xE0 kh\xF3a ch\xEDnh.\n- PHIEUMUON(SoPhieu, MaDG, MaSach, NgayMuon, NgayTra) v\u1EDBi SoPhieu l\xE0 kh\xF3a ch\xEDnh.\n\nH\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a m\u1ED7i ph\xE1t bi\u1EC3u sau:",
    conceptId: "CS11_DB_RELATIONAL",
    topicId: "RELATIONAL_DATABASE",
    grade: 11,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 150,
    competencyCode: "NLc",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "Trong b\u1EA3ng PHIEUMUON, hai tr\u01B0\u1EDDng MaDG v\xE0 MaSach l\u1EA7n l\u01B0\u1EE3t l\xE0 c\xE1c kh\xF3a ngo\u1EA1i (Foreign Key) tham chi\u1EBFu \u0111\u1EBFn b\u1EA3ng DOCGIA v\xE0 SACH.",
        isCorrect: true,
        explanation: "\u0110\xFAng. MaDG v\xE0 MaSach trong PHIEUMUON li\xEAn k\u1EBFt t\u1EDBi kh\xF3a ch\xEDnh c\u1EE7a hai b\u1EA3ng \u0111\u1ED9c gi\u1EA3 v\xE0 s\xE1ch \u0111\u1EC3 ghi nh\u1EADn ai m\u01B0\u1EE3n cu\u1ED1n s\xE1ch n\xE0o."
      },
      {
        subOrder: "b",
        statementText: "M\u1ED9t \u0111\u1ED9c gi\u1EA3 kh\xF4ng th\u1EC3 m\u01B0\u1EE3n s\xE1ch nhi\u1EC1u l\u1EA7n v\xEC MaDG kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p l\u1EB7p l\u1EA1i trong b\u1EA3ng PHIEUMUON.",
        isCorrect: false,
        explanation: "Sai. Trong PHIEUMUON, kh\xF3a ch\xEDnh l\xE0 SoPhieu. Tr\u01B0\u1EDDng MaDG l\xE0 kh\xF3a ngo\u1EA1i n\xEAn ho\xE0n to\xE0n c\xF3 th\u1EC3 l\u1EB7p l\u1EA1i nhi\u1EC1u l\u1EA7n (m\u1ED1i quan h\u1EC7 1-Nhi\u1EC1u: m\u1ED9t \u0111\u1ED9c gi\u1EA3 c\xF3 th\u1EC3 m\u01B0\u1EE3n nhi\u1EC1u l\u1EA7n)."
      },
      {
        subOrder: "c",
        statementText: "R\xE0ng bu\u1ED9c to\xE0n v\u1EB9n tham chi\u1EBFu ng\u0103n c\u1EA5m vi\u1EC7c x\xF3a m\u1ED9t \u0111\u1ED9c gi\u1EA3 trong b\u1EA3ng DOCGIA n\u1EBFu \u0111\u1ED9c gi\u1EA3 \u0111\xF3 \u0111ang c\xF3 phi\u1EBFu m\u01B0\u1EE3n ch\u01B0a tr\u1EA3 trong b\u1EA3ng PHIEUMUON.",
        isCorrect: true,
        explanation: "\u0110\xFAng. \u0110\u1EC3 b\u1EA3o \u0111\u1EA3m t\xEDnh to\xE0n v\u1EB9n d\u1EEF li\u1EC7u, RDBMS kh\xF4ng cho ph\xE9p x\xF3a b\u1EA3n ghi cha khi b\u1EA3n ghi con \u0111ang tham chi\u1EBFu t\u1EDBi (tr\u1EEB khi thi\u1EBFt l\u1EADp CASCADE)."
      },
      {
        subOrder: "d",
        statementText: "\u0110\u1EC3 x\xF3a to\xE0n b\u1ED9 m\u1ED9t b\u1EA3ng SACH kh\u1ECFi c\u01A1 s\u1EDF d\u1EEF li\u1EC7u, ta d\xF9ng c\xE2u l\u1EC7nh SQL: DELETE TABLE SACH;",
        isCorrect: false,
        explanation: "Sai. L\u1EC7nh x\xF3a b\u1ECF ho\xE0n to\xE0n c\u1EA5u tr\xFAc b\u1EA3ng trong SQL l\xE0 DROP TABLE SACH;. L\u1EC7nh DELETE ch\u1EC9 d\xF9ng \u0111\u1EC3 x\xF3a c\xE1c d\xF2ng d\u1EEF li\u1EC7u b\xEAn trong b\u1EA3ng."
      }
    ],
    explanation: "C\xE2u h\u1ECFi ph\xE2n t\xEDch thi\u1EBFt k\u1EBF CSDL quan h\u1EC7: kh\xF3a ch\xEDnh, kh\xF3a ngo\u1EA1i, t\xEDnh to\xE0n v\u1EB9n tham chi\u1EBFu v\xE0 s\u1EF1 kh\xE1c bi\u1EC7t gi\u1EEFa l\u1EC7nh DDL (DROP TABLE) v\xE0 DML (DELETE FROM).",
    keyTakeaway: "Kh\xF3a ngo\u1EA1i trong b\u1EA3ng con c\xF3 th\u1EC3 l\u1EB7p l\u1EA1i; DROP TABLE x\xF3a b\u1EA3ng, DELETE FROM x\xF3a b\u1EA3n ghi.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 4: Gi\u1EDBi thi\u1EC7u c\xE1c h\u1EC7 c\u01A1 s\u1EDF d\u1EEF li\u1EC7u",
    sourceYear: 2023,
    isVerified: true
  },
  // --- ĐỊNH HƯỚNG KHOA HỌC MÁY TÍNH (CS TRACK) ---
  // CÂU TỰ CHỌN CS 1: LẬP TRÌNH PYTHON & THUẬT TOÁN TÌM KIẾM NHỊ PHÂN (TIN 10)
  {
    id: "Q_CS10_TF_01",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "CS",
    stem: "M\u1ED9t h\u1ECDc sinh x\xE2y d\u1EF1ng ch\u01B0\u01A1ng tr\xECnh Python c\xE0i \u0111\u1EB7t thu\u1EADt to\xE1n t\xECm ki\u1EBFm nh\u1ECB ph\xE2n (Binary Search) v\xE0 thao t\xE1c v\u1EDBi c\u1EA5u tr\xFAc d\u1EEF li\u1EC7u. Xem x\xE9t c\xE1c ph\xE1t bi\u1EC3u sau:",
    conceptId: "CS10_PYTHON_DATA_STRUCT",
    topicId: "PYTHON_PROGRAMMING",
    grade: 10,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "hard",
    estimatedTimeSec: 150,
    competencyCode: "NLc",
    codeSnippet: {
      language: "python",
      code: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1"
    },
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "Thu\u1EADt to\xE1n t\xECm ki\u1EBFm nh\u1ECB ph\xE2n ch\u1EC9 \xE1p d\u1EE5ng \u0111\u01B0\u1EE3c tr\xEAn danh s\xE1ch (m\u1EA3ng) \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EAFp x\u1EBFp th\u1EE9 t\u1EF1.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Thu\u1EADt to\xE1n d\u1EF1a tr\xEAn t\xEDnh ch\u1EA5t th\u1EE9 t\u1EF1 c\u1EE7a m\u1EA3ng \u0111\u1EC3 thu h\u1EB9p m\u1ED9t n\u1EEDa ph\u1EA1m vi t\xECm ki\u1EBFm sau m\u1ED7i b\u01B0\u1EDBc so s\xE1nh."
      },
      {
        subOrder: "b",
        statementText: "Trong tr\u01B0\u1EDDng h\u1EE3p x\u1EA5u nh\u1EA5t tr\xEAn danh s\xE1ch g\u1ED3m n ph\u1EA7n t\u1EED, s\u1ED1 l\u1EA7n l\u1EB7p t\u1ED1i \u0111a c\u1EE7a thu\u1EADt to\xE1n t\xECm ki\u1EBFm nh\u1ECB ph\xE2n t\u1EF7 l\u1EC7 v\u1EDBi log2(n).",
        isCorrect: true,
        explanation: "\u0110\xFAng. \u0110\u1ED9 ph\u1EE9c t\u1EA1p th\u1EDDi gian c\u1EE7a t\xECm ki\u1EBFm nh\u1ECB ph\xE2n l\xE0 O(log n), hi\u1EC7u qu\u1EA3 h\u01A1n nhi\u1EC1u so v\u1EDBi t\xECm ki\u1EBFm tu\u1EA7n t\u1EF1 O(n)."
      },
      {
        subOrder: "c",
        statementText: "N\u1EBFu danh s\xE1ch \u0111\u1EA7u v\xE0o ch\u1EE9a c\xE1c ph\u1EA7n t\u1EED ch\u01B0a s\u1EAFp x\u1EBFp: [40, 10, 50, 20], h\xE0m tr\xEAn lu\xF4n tr\u1EA3 v\u1EC1 \u0111\xFAng v\u1ECB tr\xED c\u1EE7a ph\u1EA7n t\u1EED c\u1EA7n t\xECm.",
        isCorrect: false,
        explanation: "Sai. V\u1EDBi m\u1EA3ng ch\u01B0a s\u1EAFp x\u1EBFp, t\xECm ki\u1EBFm nh\u1ECB ph\xE2n c\xF3 th\u1EC3 lo\u1EA1i b\u1ECF nh\u1EA7m n\u1EEDa ch\u1EE9a ph\u1EA7n t\u1EED c\u1EA7n t\xECm v\xE0 tr\u1EA3 v\u1EC1 -1."
      },
      {
        subOrder: "d",
        statementText: "C\u1EA5u tr\xFAc t\u1EEB \u0111i\u1EC3n (dict) trong Python l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u d\u01B0\u1EDBi d\u1EA1ng c\xE1c c\u1EB7p key-value v\xE0 cho ph\xE9p c\xE1c kh\xF3a (key) b\u1ECB tr\xF9ng l\u1EB7p.",
        isCorrect: false,
        explanation: "Sai. Trong t\u1EEB \u0111i\u1EC3n Python, m\u1ED7i kh\xF3a (key) ph\u1EA3i l\xE0 duy nh\u1EA5t (unique) v\xE0 b\u1EA5t bi\u1EBFn (immutable)."
      }
    ],
    explanation: "Ki\u1EC3m tra b\u1EA3n ch\u1EA5t thu\u1EADt to\xE1n t\xECm ki\u1EBFm nh\u1ECB ph\xE2n, \u0111i\u1EC1u ki\u1EC7n ti\xEAn quy\u1EBFt s\u1EAFp x\u1EBFp m\u1EA3ng, \u0111\u1ED9 ph\u1EE9c t\u1EA1p O(log n) v\xE0 \u0111\u1EB7c tr\u01B0ng c\u1EA5u tr\xFAc d\u1EEF li\u1EC7u Dictionary trong Python.",
    keyTakeaway: "T\xECm ki\u1EBFm nh\u1ECB ph\xE2n y\xEAu c\u1EA7u m\u1EA3ng \u0111\xE3 s\u1EAFp x\u1EBFp v\xE0 c\xF3 \u0111\u1ED9 ph\u1EE9c t\u1EA1p O(log n).",
    source: "SGK Tin h\u1ECDc 10 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - B\xE0i 24: Thu\u1EADt to\xE1n t\xECm ki\u1EBFm nh\u1ECB ph\xE2n",
    sourceYear: 2023,
    isVerified: true
  },
  // CÂU TỰ CHỌN CS 4: MÔ HÌNH HỌC MÁY & PHÂN LOẠI DỮ LIỆU (TIN 12 - CHỦ ĐỀ 1)
  {
    id: "Q_CS12_TF_05",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "CS",
    stem: "Trong d\u1EF1 \xE1n nghi\xEAn c\u1EE9u ph\xE2n lo\u1EA1i d\u1EEF li\u1EC7u h\u1ECDc m\xE1y (Machine Learning), nh\xF3m h\u1ECDc sinh \xE1p d\u1EE5ng c\xE1c k\u1EF9 thu\u1EADt hu\u1EA5n luy\u1EC7n m\xF4 h\xECnh. H\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a m\u1ED7i nh\u1EADn \u0111\u1ECBnh sau:",
    conceptId: "CS12_AI_CONCEPTS",
    topicId: "AI_FUNDAMENTALS",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "hard",
    estimatedTimeSec: 150,
    competencyCode: "NLa",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "Ph\u01B0\u01A1ng ph\xE1p h\u1ECDc c\xF3 gi\xE1m s\xE1t (Supervised Learning) y\xEAu c\u1EA7u t\u1EADp d\u1EEF li\u1EC7u hu\u1EA5n luy\u1EC7n ph\u1EA3i c\xF3 s\u1EB5n c\xE1c nh\xE3n k\u1EBFt qu\u1EA3 (Labels) t\u01B0\u01A1ng \u1EE9ng v\u1EDBi m\u1ED7i m\u1EABu \u0111\u1EA7u v\xE0o.",
        isCorrect: true,
        explanation: "\u0110\xFAng. H\u1ECDc c\xF3 gi\xE1m s\xE1t h\u1ECDc \xE1nh x\u1EA1 t\u1EEB \u0111\u1EB7c tr\u01B0ng \u0111\u1EA7u v\xE0o t\u1EDBi nh\xE3n m\u1EE5c ti\xEAu \u0111\u01B0\u1EE3c cung c\u1EA5p s\u1EB5n."
      },
      {
        subOrder: "b",
        statementText: "B\xE0i to\xE1n d\u1EF1 \u0111o\xE1n gi\xE1 b\xE1n c\u1EE7a m\u1ED9t chi\u1EBFc m\xE1y t\xEDnh x\xE1ch tay (d\u1EA1ng s\u1ED1 th\u1EF1c li\xEAn t\u1EE5c) d\u1EF1a tr\xEAn c\u1EA5u h\xECnh CPU v\xE0 RAM l\xE0 m\u1ED9t b\xE0i to\xE1n Ph\xE2n lo\u1EA1i (Classification).",
        isCorrect: false,
        explanation: "Sai. D\u1EF1 \u0111o\xE1n gi\xE1 tr\u1ECB s\u1ED1 th\u1EF1c li\xEAn t\u1EE5c l\xE0 b\xE0i to\xE1n H\u1ED3i quy (Regression), kh\xF4ng ph\u1EA3i Ph\xE2n lo\u1EA1i (Classification d\u1EF1 \u0111o\xE1n nh\xE3n r\u1EDDi r\u1EA1c)."
      },
      {
        subOrder: "c",
        statementText: "Hi\u1EC7n t\u01B0\u1EE3ng Qu\xE1 kh\u1EDBp (Overfitting) x\u1EA3y ra khi m\xF4 h\xECnh ghi nh\u1EDB qu\xE1 m\u1EE9c d\u1EEF li\u1EC7u hu\u1EA5n luy\u1EC7n nh\u01B0ng ho\u1EA1t \u0111\u1ED9ng k\xE9m tr\xEAn d\u1EEF li\u1EC7u ki\u1EC3m th\u1EED m\u1EDBi ch\u01B0a t\u1EEBng th\u1EA5y.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Overfitting l\xE0 hi\u1EC7n t\u01B0\u1EE3ng m\xF4 h\xECnh h\u1ECDc c\u1EA3 nhi\u1EC5u c\u1EE7a t\u1EADp hu\u1EA5n luy\u1EC7n, m\u1EA5t \u0111i t\xEDnh t\u1ED5ng qu\xE1t h\xF3a."
      },
      {
        subOrder: "d",
        statementText: "Trong h\u1ECDc m\xE1y, ta n\xEAn d\xF9ng 100% d\u1EEF li\u1EC7u thu th\u1EADp \u0111\u01B0\u1EE3c \u0111\u1EC3 hu\u1EA5n luy\u1EC7n m\xF4 h\xECnh v\xE0 kh\xF4ng c\u1EA7n gi\u1EEF l\u1EA1i t\u1EADp d\u1EEF li\u1EC7u ki\u1EC3m th\u1EED (Test set).",
        isCorrect: false,
        explanation: "Sai. Lu\xF4n c\u1EA7n ph\xE2n chia t\u1EADp ki\u1EC3m th\u1EED \u0111\u1ED9c l\u1EADp (th\u01B0\u1EDDng 20-30%) \u0111\u1EC3 \u0111\xE1nh gi\xE1 kh\xE1ch quan \u0111\u1ED9 ch\xEDnh x\xE1c c\u1EE7a m\xF4 h\xECnh."
      }
    ],
    explanation: "Ki\u1EC3m tra ki\u1EBFn th\u1EE9c n\u1EC1n t\u1EA3ng Khoa h\u1ECDc m\xE1y t\xEDnh v\u1EC1 H\u1ECDc c\xF3 gi\xE1m s\xE1t, ph\xE2n bi\u1EC7t H\u1ED3i quy vs Ph\xE2n lo\u1EA1i, hi\u1EC7n t\u01B0\u1EE3ng Qu\xE1 kh\u1EDBp (Overfitting) v\xE0 quy t\u1EAFc chia t\u1EADp Train/Test.",
    keyTakeaway: "H\u1ECDc c\xF3 gi\xE1m s\xE1t c\u1EA7n d\u1EEF li\u1EC7u c\xF3 nh\xE3n; d\u1EF1 \u0111o\xE1n gi\xE1 l\xE0 H\u1ED3i quy; lu\xF4n c\u1EA7n t\u1EADp Test set \u0111\u1ED9c l\u1EADp.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Chuy\xEAn \u0111\u1EC1 Khoa h\u1ECDc m\xE1y t\xEDnh",
    sourceYear: 2024,
    isVerified: true
  },
  // --- ĐỊNH HƯỚNG TIN HỌC ỨNG DỤNG (ICT TRACK) ---
  // CÂU TỰ CHỌN ICT 1: THIẾT BỊ MẠNG & GIAO THỨC TRUYỀN THÔNG (TIN 12 - CHỦ ĐỀ 2)
  {
    id: "Q_CS12_TF_02",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "ICT",
    stem: "M\u1ED9t tr\u01B0\u1EDDng THPT ti\u1EBFn h\xE0nh l\u1EAFp \u0111\u1EB7t m\u1EA1ng m\xE1y t\xEDnh cho ph\xF2ng th\u1EF1c h\xE0nh Tin h\u1ECDc g\u1ED3m 45 m\xE1y t\xEDnh \u0111\u1EC3 b\xE0n, 1 m\xE1y in d\xF9ng chung v\xE0 1 b\u1ED9 \u0111\u1ECBnh tuy\u1EBFn Router k\u1EBFt n\u1ED1i m\u1EA1ng c\xE1p quang Internet. H\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a c\xE1c ph\xE1t bi\u1EC3u sau:",
    conceptId: "CS12_NETWORK_DEVICES",
    topicId: "COMPUTER_NETWORKING",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 150,
    competencyCode: "NLa",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "S\u1EED d\u1EE5ng b\u1ED9 chuy\u1EC3n m\u1EA1ch Switch thay v\xEC Hub s\u1EBD gi\xFAp h\u1EA1n ch\u1EBF ngh\u1EBDn m\u1EA1ng v\xE0 gi\u1EA3m thi\u1EC3u t\u1ED1i \u0111a hi\u1EC7n t\u01B0\u1EE3ng xung \u0111\u1ED9t (collision) gi\u1EEFa c\xE1c m\xE1y t\xEDnh trong ph\xF2ng th\u1EF1c h\xE0nh.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Switch ph\xE2n chia c\xE1c c\u1ED5ng th\xE0nh c\xE1c mi\u1EC1n xung \u0111\u1ED9t ri\xEAng bi\u1EC7t, ch\u1EC9 g\u1EEDi g\xF3i tin \u0111\u1EBFn c\u1ED5ng \u0111\xEDch."
      },
      {
        subOrder: "b",
        statementText: "C\u1ED5ng WAN tr\xEAn b\u1ED9 \u0111\u1ECBnh tuy\u1EBFn Router \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1EC3 c\u1EAFm d\xE2y c\xE1p n\u1ED1i tr\u1EF1c ti\u1EBFp t\u1EDBi t\u1EEBng m\xE1y t\xEDnh \u0111\u1EC3 b\xE0n c\u1EE7a h\u1ECDc sinh.",
        isCorrect: false,
        explanation: "Sai. C\u1ED5ng WAN (Wide Area Network) d\xF9ng \u0111\u1EC3 k\u1EBFt n\u1ED1i v\u1EDBi m\u1EA1ng b\xEAn ngo\xE0i (Modem/Internet). C\xE1c m\xE1y t\xEDnh trong ph\xF2ng th\u1EF1c h\xE0nh c\u1EAFm v\xE0o c\xE1c c\u1ED5ng LAN (Local Area Network)."
      },
      {
        subOrder: "c",
        statementText: "Trong m\u1EA1ng LAN, \u0111\u1ECBa ch\u1EC9 IP c\u1EE7a m\u1ED7i m\xE1y t\xEDnh ph\u1EA3i l\xE0 duy nh\u1EA5t v\xE0 kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p tr\xF9ng l\u1EB7p \u0111\u1EC3 tr\xE1nh xung \u0111\u1ED9t \u0111\u1ECBa ch\u1EC9 IP.",
        isCorrect: true,
        explanation: "\u0110\xFAng. N\u1EBFu hai thi\u1EBFt b\u1ECB trong c\xF9ng m\u1EA1ng nh\u1EADn c\xF9ng m\u1ED9t \u0111\u1ECBa ch\u1EC9 IP s\u1EBD g\xE2y ra l\u1ED7i xung \u0111\u1ED9t IP (IP conflict) v\xE0 kh\xF4ng th\u1EC3 giao ti\u1EBFp b\xECnh th\u01B0\u1EDDng."
      },
      {
        subOrder: "d",
        statementText: "Sau khi m\xE1y in \u0111\u01B0\u1EE3c k\u1EBFt n\u1ED1i v\u1EDBi m\u1ED9t m\xE1y t\xEDnh v\xE0 chia s\u1EBB (Share), m\u1ECDi m\xE1y t\xEDnh kh\xE1c trong m\u1EA1ng LAN \u0111\u1EC1u c\xF3 th\u1EC3 in v\u0103n b\u1EA3n m\xE0 kh\xF4ng c\u1EA7n m\xE1y t\xEDnh g\u1EAFn m\xE1y in ph\u1EA3i b\u1EADt ngu\u1ED3n.",
        isCorrect: false,
        explanation: "Sai. N\u1EBFu m\xE1y in \u0111\u01B0\u1EE3c chia s\u1EBB qua m\u1ED9t m\xE1y t\xEDnh trung gian, khi m\xE1y t\xEDnh \u0111\xF3 t\u1EAFt ngu\u1ED3n th\xEC c\xE1c m\xE1y t\xEDnh kh\xE1c trong m\u1EA1ng kh\xF4ng th\u1EC3 g\u1EEDi l\u1EC7nh in \u0111\u01B0\u1EE3c (tr\u1EEB khi m\xE1y in l\xE0 Network Printer c\u1EAFm tr\u1EF1c ti\u1EBFp v\xE0o Switch)."
      }
    ],
    explanation: "\u0110\xE1nh gi\xE1 hi\u1EC3u bi\u1EBFt th\u1EF1c t\u1EBF v\u1EC1 c\u1EA5u tr\xFAc m\u1EA1ng LAN tr\u01B0\u1EDDng h\u1ECDc: vai tr\xF2 Switch vs Hub, c\u1ED5ng WAN/LAN c\u1EE7a Router, \u0111\u1ECBa ch\u1EC9 IP c\u1EE5c b\u1ED9 v\xE0 nguy\xEAn l\xFD chia s\u1EBB t\xE0i nguy\xEAn ph\u1EA7n c\u1EE9ng.",
    keyTakeaway: "Switch ch\u1ED1ng xung \u0111\u1ED9t t\u1ED1t h\u01A1n Hub; c\u1ED5ng WAN k\u1EBFt n\u1ED1i Internet, c\u1ED5ng LAN k\u1EBFt n\u1ED1i m\u1EA1ng n\u1ED9i b\u1ED9.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 2: M\u1EA1ng m\xE1y t\xEDnh v\xE0 Internet",
    sourceYear: 2024,
    isVerified: true
  },
  // CÂU TỰ CHỌN ICT 2: THIẾT KẾ TRANG WEB VỚI HTML5 & CSS3 (TIN 12 - CHỦ ĐỀ 4)
  {
    id: "Q_CS12_TF_03",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "ICT",
    stem: 'M\u1ED9t h\u1ECDc sinh thi\u1EBFt k\u1EBF giao di\u1EC7n trang web gi\u1EDBi thi\u1EC7u c\xE2u l\u1EA1c b\u1ED9 Tin h\u1ECDc. Xem x\xE9t \u0111o\u1EA1n m\xE3 HTML v\xE0 CSS sau:\n\n<div id="main-banner" class="highlight-box flex-center">\n  <h1 class="title">CLB TIN H\u1ECCC TR\u1EBA</h1>\n  <a href="dangky.html">\u0110\u0103ng k\xFD ngay</a>\n</div>\n\nH\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a c\xE1c ph\xE1t bi\u1EC3u sau:',
    conceptId: "CS12_WEB_CSS_ADVANCED",
    topicId: "WEB_DEVELOPMENT",
    grade: 12,
    strand: "CS",
    cognitiveLevel: "application",
    difficulty: "hard",
    estimatedTimeSec: 160,
    competencyCode: "NLe",
    codeSnippet: {
      language: "html",
      code: '<div id="main-banner" class="highlight-box flex-center">\n  <h1 class="title">CLB TIN H\u1ECCC TR\u1EBA</h1>\n  <a href="dangky.html">\u0110\u0103ng k\xFD ngay</a>\n</div>'
    },
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "Trong CSS, b\u1ED9 ch\u1ECDn #main-banner c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn (Specificity) cao h\u01A1n b\u1ED9 ch\u1ECDn .highlight-box khi c\u1EA3 hai c\xF9ng \u0111\u1ECBnh ngh\u0129a thu\u1ED9c t\xEDnh color.",
        isCorrect: true,
        explanation: "\u0110\xFAng. ID selector (#id) c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn (100) cao h\u01A1n nhi\u1EC1u so v\u1EDBi Class selector (.class c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn 10)."
      },
      {
        subOrder: "b",
        statementText: 'Th\u1EBB <div> tr\xEAn c\xF3 th\u1EC3 \u0111\u1ED3ng th\u1EDDi nh\u1EADn \u0111\u1ECBnh d\u1EA1ng t\u1EEB c\u1EA3 hai l\u1EDBp CSS l\xE0 "highlight-box" v\xE0 "flex-center".',
        isCorrect: true,
        explanation: "\u0110\xFAng. Thu\u1ED9c t\xEDnh class cho ph\xE9p ch\u1EC9 \u0111\u1ECBnh nhi\u1EC1u l\u1EDBp c\xE1ch nhau b\u1EDFi d\u1EA5u c\xE1ch tr\u1EAFng."
      },
      {
        subOrder: "c",
        statementText: 'Li\xEAn k\u1EBFt href="dangky.html" l\xE0 m\u1ED9t li\xEAn k\u1EBFt tuy\u1EC7t \u0111\u1ED1i (Absolute URL) tr\u1ECF \u0111\u1EBFn m\u1ED9t m\xE1y ch\u1EE7 tr\xEAn Internet.',
        isCorrect: false,
        explanation: 'Sai. "dangky.html" l\xE0 li\xEAn k\u1EBFt t\u01B0\u01A1ng \u0111\u1ED1i (Relative URL), tr\u1ECF \u0111\u1EBFn t\u1EC7p tin n\u1EB1m c\xF9ng th\u01B0 m\u1EE5c tr\xEAn m\xE1y ch\u1EE7 c\u1EE5c b\u1ED9.'
      },
      {
        subOrder: "d",
        statementText: "Kho\u1EA3ng c\xE1ch gi\u1EEFa n\u1ED9i dung ch\u1EEF b\xEAn trong th\u1EBB <div> v\xE0 \u0111\u01B0\u1EDDng vi\u1EC1n (border) bao quanh n\xF3 \u0111\u01B0\u1EE3c x\xE1c \u0111\u1ECBnh b\u1EDFi thu\u1ED9c t\xEDnh margin.",
        isCorrect: false,
        explanation: "Sai. Kho\u1EA3ng c\xE1ch gi\u1EEFa n\u1ED9i dung v\xE0 \u0111\u01B0\u1EDDng vi\u1EC1n l\xE0 padding; margin l\xE0 kho\u1EA3ng c\xE1ch t\u1EEB \u0111\u01B0\u1EDDng vi\u1EC1n ra kh\xF4ng gian b\xEAn ngo\xE0i."
      }
    ],
    explanation: "C\xE2u h\u1ECFi ki\u1EC3m tra ki\u1EBFn th\u1EE9c chuy\xEAn s\xE2u v\u1EC1 \u0111\u1ED9 \u01B0u ti\xEAn CSS (Specificity), nhi\u1EC1u class, \u0111\u01B0\u1EDDng d\u1EABn t\u01B0\u01A1ng \u0111\u1ED1i v\xE0 m\xF4 h\xECnh h\u1ED9p Box Model (Padding vs Margin).",
    keyTakeaway: "ID c\xF3 \u0111\u1ED9 \u01B0u ti\xEAn cao h\u01A1n Class; Padding l\xE0 \u0111\u1EC7m b\xEAn trong vi\u1EC1n, Margin l\xE0 l\u1EC1 ngo\xE0i vi\u1EC1n.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 4: Thi\u1EBFt k\u1EBF trang web",
    sourceYear: 2024,
    isVerified: true
  },
  // CÂU TỰ CHỌN ICT 3: HỆ ĐIỀU HÀNH & PHẦN CỨNG MÁY TÍNH (TIN 11 - CHỦ ĐỀ 1)
  {
    id: "Q_CS11_TF_02",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "ICT",
    stem: "Khi t\xECm hi\u1EC3u v\u1EC1 c\u1EA5u tr\xFAc m\xE1y t\xEDnh v\xE0 ph\u1EA7n m\u1EC1m h\u1EC7 th\u1ED1ng trong ch\u01B0\u01A1ng tr\xECnh Tin h\u1ECDc 11, h\u1ECDc sinh ph\xE2n t\xEDch vai tr\xF2 c\u1EE7a H\u1EC7 \u0111i\u1EC1u h\xE0nh v\xE0 c\xE1c linh ki\u1EC7n ph\u1EA7n c\u1EE9ng. H\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a c\xE1c m\u1EC7nh \u0111\u1EC1 sau:",
    conceptId: "CS11_OS_HARDWARE",
    topicId: "OPERATING_SYSTEMS_HARDWARE",
    grade: 11,
    strand: "ICT",
    cognitiveLevel: "comprehension",
    difficulty: "medium",
    estimatedTimeSec: 140,
    competencyCode: "NLa",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "B\u1ED9 nh\u1EDB RAM l\xE0 b\u1ED9 nh\u1EDB kh\u1EA3 bi\u1EBFn (volatile), to\xE0n b\u1ED9 d\u1EEF li\u1EC7u \u0111ang l\u01B0u trong RAM s\u1EBD b\u1ECB bi\u1EBFn m\u1EA5t khi m\xE1y t\xEDnh b\u1ECB m\u1EA5t ngu\u1ED3n \u0111i\u1EC7n.",
        isCorrect: true,
        explanation: "\u0110\xFAng. RAM l\xE0 b\u1ED9 nh\u1EDB truy c\u1EADp ng\u1EABu nhi\xEAn t\u1EA1m th\u1EDDi, c\u1EA7n \u0111i\u1EC7n th\u1EBF li\xEAn t\u1EE5c \u0111\u1EC3 duy tr\xEC tr\u1EA1ng th\xE1i d\u1EEF li\u1EC7u."
      },
      {
        subOrder: "b",
        statementText: "\u1ED4 \u0111\u0129a th\u1EC3 r\u1EAFn (SSD) s\u1EED d\u1EE5ng c\xE1c chip nh\u1EDB Flash NAND n\xEAn c\xF3 t\u1ED1c \u0111\u1ED9 \u0111\u1ECDc/ghi d\u1EEF li\u1EC7u nhanh h\u01A1n v\xE0 kh\u1EA3 n\u0103ng ch\u1ED1ng s\u1ED1c c\u01A1 h\u1ECDc t\u1ED1t h\u01A1n so v\u1EDBi \u1ED5 c\u1EE9ng c\u01A1 quay (HDD).",
        isCorrect: true,
        explanation: "\u0110\xFAng. SSD kh\xF4ng c\xF3 c\xE1c phi\u1EBFn \u0111\u0129a quay v\xE0 \u0111\u1EA7u \u0111\u1ECDc c\u01A1 kh\xED nh\u01B0 HDD n\xEAn t\u1ED1c \u0111\u1ED9 truy xu\u1EA5t v\u01B0\u1EE3t tr\u1ED9i v\xE0 b\u1EC1n b\u1EC9 h\u01A1n khi di chuy\u1EC3n."
      },
      {
        subOrder: "c",
        statementText: "H\u1EC7 \u0111i\u1EC1u h\xE0nh Linux l\xE0 ph\u1EA7n m\u1EC1m ngu\u1ED3n \u0111\xF3ng \u0111\u1ED9c quy\u1EC1n th\u01B0\u01A1ng m\u1EA1i v\xE0 ng\u01B0\u1EDDi d\xF9ng kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p ch\u1EC9nh s\u1EEDa m\xE3 ngu\u1ED3n.",
        isCorrect: false,
        explanation: "Sai. Nh\xE2n Linux \u0111\u01B0\u1EE3c ph\xE1t h\xE0nh theo gi\u1EA5y ph\xE9p ngu\u1ED3n m\u1EDF GNU General Public License (GPL), cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng t\u1EF1 do xem, s\u1EEDa \u0111\u1ED5i v\xE0 ph\xE2n ph\u1ED1i m\xE3 ngu\u1ED3n."
      },
      {
        subOrder: "d",
        statementText: "M\u1EA1ch c\u1ED9ng nh\u1ECB ph\xE2n 1 bit (Half-Adder) s\u1EED d\u1EE5ng k\u1EBFt h\u1EE3p m\u1ED9t c\u1ED5ng XOR \u0111\u1EC3 t\xEDnh bit T\u1ED5ng (Sum) v\xE0 m\u1ED9t c\u1ED5ng AND \u0111\u1EC3 t\xEDnh bit Nh\u1EDB (Carry).",
        isCorrect: true,
        explanation: "\u0110\xFAng. Trong s\u01A1 \u0111\u1ED3 m\u1EA1ch c\u1ED9ng n\u1EEDa Half-Adder: Sum = A XOR B v\xE0 Carry = A AND B."
      }
    ],
    explanation: "C\xE2u h\u1ECFi ki\u1EC3m tra ki\u1EBFn th\u1EE9c v\u1EC1 b\u1ED9 nh\u1EDB trong/ngo\xE0i (RAM vs SSD/HDD), ph\u1EA7n m\u1EC1m ngu\u1ED3n m\u1EDF Linux theo chu\u1EA9n GNU GPL v\xE0 c\u1EA5u tr\xFAc m\u1EA1ch logic c\u01A1 b\u1EA3n trong CPU.",
    keyTakeaway: "RAM m\u1EA5t d\u1EEF li\u1EC7u khi m\u1EA5t \u0111i\u1EC7n; SSD b\u1EC1n v\xE0 nhanh h\u01A1n HDD; Linux l\xE0 ngu\u1ED3n m\u1EDF; Half-Adder g\u1ED3m XOR v\xE0 AND.",
    source: "SGK Tin h\u1ECDc 11 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 1: M\xE1y t\xEDnh v\xE0 x\xE3 h\u1ED9i tri th\u1EE9c",
    sourceYear: 2023,
    isVerified: true
  },
  // CÂU TỰ CHỌN ICT 4: THIẾT BỊ SỐ, SMART HOME & GOOGLE SITES (TIN 12 - CHỦ ĐỀ 6, 7)
  {
    id: "Q_CS12_TF_04",
    questionType: "true_false_multistatement",
    sectionScope: "elective",
    track: "ICT",
    stem: 'M\u1ED9t nh\xF3m h\u1ECDc sinh tri\u1EC3n khai d\u1EF1 \xE1n "Ng\xF4i tr\u01B0\u1EDDng th\xF4ng minh" \u1EE9ng d\u1EE5ng c\xE1c ki\u1EBFn th\u1EE9c Tin h\u1ECDc \u1EE9ng d\u1EE5ng l\u1EDBp 12: l\u1EAFp \u0111\u1EB7t thi\u1EBFt b\u1ECB nh\xE0 th\xF4ng minh Smart Home v\xE0 x\xE2y d\u1EF1ng website gi\u1EDBi thi\u1EC7u b\u1EB1ng Google Sites. H\xE3y x\xE1c \u0111\u1ECBnh t\xEDnh \u0110\xDANG ho\u1EB7c SAI c\u1EE7a m\u1ED7i ph\xE1t bi\u1EC3u sau:',
    conceptId: "CS12_ICT_SMART_DEVICES",
    topicId: "APPLIED_INFORMATICS_12",
    grade: 12,
    strand: "ICT",
    cognitiveLevel: "application",
    difficulty: "medium",
    estimatedTimeSec: 150,
    competencyCode: "NLe",
    trueFalseStatements: [
      {
        subOrder: "a",
        statementText: "C\xF4ng t\u1EAFc \u0111i\u1EC7n th\xF4ng minh k\u1EBFt n\u1ED1i m\u1EA1ng Wi-Fi cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng h\u1EB9n gi\u1EDD t\u1EF1 \u0111\u1ED9ng b\u1EADt/t\u1EAFt \u0111\xE8n ho\u1EB7c \u0111i\u1EC1u khi\u1EC3n t\u1EEB xa qua \u1EE9ng d\u1EE5ng tr\xEAn \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh.",
        isCorrect: true,
        explanation: "\u0110\xFAng. \u0110\xE2y l\xE0 t\xEDnh n\u0103ng c\u01A1 b\u1EA3n c\u1EE7a c\xE1c thi\u1EBFt b\u1ECB ch\u1EA5p h\xE0nh trong h\u1EC7 th\u1ED1ng Smart Home (s\u1EED d\u1EE5ng \u1EE9ng d\u1EE5ng nh\u01B0 Vhome, R\u1EA1ng \u0110\xF4ng, Tuya)."
      },
      {
        subOrder: "b",
        statementText: "C\u1ED5ng giao ti\u1EBFp VGA truy\u1EC1n t\u1EA3i \u0111\u1ED3ng th\u1EDDi c\u1EA3 t\xEDn hi\u1EC7u h\xECnh \u1EA3nh k\u1EF9 thu\u1EADt s\u1ED1 ch\u1EA5t l\u01B0\u1EE3ng cao v\xE0 t\xEDn hi\u1EC7u \xE2m thanh \u0111a k\xEAnh qua m\u1ED9t s\u1EE3i c\xE1p duy nh\u1EA5t.",
        isCorrect: false,
        explanation: "Sai. C\u1ED5ng VGA ch\u1EC9 truy\u1EC1n t\xEDn hi\u1EC7u h\xECnh \u1EA3nh d\u1EA1ng t\u01B0\u01A1ng t\u1EF1 (analog) v\xE0 kh\xF4ng truy\u1EC1n \xE2m thanh. C\u1ED5ng HDMI m\u1EDBi truy\u1EC1n \u0111\u1ED3ng th\u1EDDi c\u1EA3 \xE2m thanh v\xE0 h\xECnh \u1EA3nh k\u1EF9 thu\u1EADt s\u1ED1."
      },
      {
        subOrder: "c",
        statementText: "Tr\xEAn trang web Google Sites, ta c\xF3 th\u1EC3 nh\xFAng tr\u1EF1c ti\u1EBFp b\u1EA3n \u0111\u1ED3 Google Maps ch\u1EC9 d\u1EABn \u0111\u01B0\u1EDDng \u0111i t\u1EDBi tr\u01B0\u1EDDng h\u1ECDc b\u1EB1ng c\xE1ch d\xE1n li\xEAn k\u1EBFt ho\u1EB7c ch\u1ECDn \u0111\u1ECBa \u0111i\u1EC3m trong c\xF4ng c\u1EE5 Ch\xE8n.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Google Sites c\xF3 t\xEDnh n\u0103ng t\xEDch h\u1EE3p s\u1EB5n Google Maps \u0111\u1EC3 nh\xFAng khung b\u1EA3n \u0111\u1ED3 t\u01B0\u01A1ng t\xE1c v\xE0o n\u1ED9i dung trang web."
      },
      {
        subOrder: "d",
        statementText: "T\u1EC7p bi\u1EC3u t\u01B0\u1EE3ng thu nh\u1ECF Favicon tr\xEAn Google Sites s\u1EBD hi\u1EC3n th\u1ECB \u1EDF g\xF3c tr\xE1i tr\xEAn tab c\u1EE7a tr\xECnh duy\u1EC7t web khi ng\u01B0\u1EDDi d\xF9ng truy c\u1EADp trang web.",
        isCorrect: true,
        explanation: "\u0110\xFAng. Favicon l\xE0 bi\u1EC3u t\u01B0\u1EE3ng nh\u1EADn di\u1EC7n th\u01B0\u01A1ng hi\u1EC7u nh\u1ECF (th\u01B0\u1EDDng 16x16 ho\u1EB7c 32x32 pixel) xu\u1EA5t hi\u1EC7n tr\xEAn tab tr\xECnh duy\u1EC7t c\u1EA1nh ti\xEAu \u0111\u1EC1 trang."
      }
    ],
    explanation: "Ki\u1EC3m tra ki\u1EBFn th\u1EE9c \u1EE9ng d\u1EE5ng th\u1EF1c t\u1EBF: h\u1EC7 th\u1ED1ng Smart Home \u0111i\u1EC1u khi\u1EC3n qua Wi-Fi, s\u1EF1 kh\xE1c bi\u1EC7t gi\u1EEFa c\u1ED5ng VGA v\xE0 HDMI, v\xE0 c\xE1c t\xEDnh n\u0103ng thi\u1EBFt k\u1EBF web tr\u1EF1c quan tr\xEAn Google Sites (Maps, Favicon).",
    keyTakeaway: "HDMI truy\u1EC1n c\u1EA3 h\xECnh \u1EA3nh v\xE0 \xE2m thanh; VGA ch\u1EC9 truy\u1EC1n h\xECnh \u1EA3nh analog; Favicon hi\u1EC3n th\u1ECB tr\xEAn tab tr\xECnh duy\u1EC7t.",
    source: "SGK Tin h\u1ECDc 12 (K\u1EBFt n\u1ED1i tri th\u1EE9c) - Ch\u1EE7 \u0111\u1EC1 6 & 7: \u1EE8ng d\u1EE5ng tin h\u1ECDc & Thi\u1EBFt b\u1ECB s\u1ED1",
    sourceYear: 2024,
    isVerified: true
  }
];
var SERVER_DIAGNOSTIC_QUESTION_BANK_VERSION = "tinmaster-diagnostic-v1";
function getServerDiagnosticGrades(grade) {
  switch (grade) {
    case 10:
      return [10];
    case 11:
      return [10, 11];
    case 12:
      return [10, 11, 12];
    default:
      throw new RangeError("A valid student grade (10, 11, or 12) is required.");
  }
}
function filterServerDiagnosticQuestions(grade, questions, examTrack) {
  const eligibleGrades = new Set(getServerDiagnosticGrades(grade));
  if (examTrack !== void 0 && examTrack !== null && examTrack !== "CS" && examTrack !== "ICT") {
    throw new RangeError("A valid student exam orientation is required.");
  }
  return questions.filter(
    (question) => eligibleGrades.has(question.grade) && (examTrack === void 0 || examTrack === null || question.track === "ALL" || question.track === examTrack)
  );
}
function selectServerDiagnosticQuestions(grade, examTrack) {
  return filterServerDiagnosticQuestions(grade, SERVER_DIAGNOSTIC_QUESTION_BANK, examTrack);
}
function diagnosticOptionId(questionId, label) {
  return `${questionId}:option:${label}`;
}
function projectDiagnosticQuestion(question) {
  const shared = {
    id: question.id,
    stem: question.stem,
    ...question.codeSnippet ? { codeSnippet: question.codeSnippet } : {},
    ...question.diagramDesc ? { diagramDesc: question.diagramDesc } : {}
  };
  if (question.questionType === "single_choice") {
    return {
      ...shared,
      questionType: "single_choice",
      singleChoiceOptions: (question.singleChoiceOptions ?? []).map((option) => ({
        optionId: diagnosticOptionId(question.id, option.label),
        label: option.label,
        text: option.text
      }))
    };
  }
  return {
    ...shared,
    questionType: "true_false_multistatement",
    trueFalseStatements: (question.trueFalseStatements ?? []).map((statement) => ({
      subOrder: statement.subOrder,
      statementText: statement.statementText
    }))
  };
}
function getPrivateDiagnosticScoringData(question) {
  if (question.questionType === "single_choice") {
    const correctOptions = (question.singleChoiceOptions ?? []).filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error(`Question ${question.id} must have exactly one correct option.`);
    }
    return {
      questionId: question.id,
      questionType: "single_choice",
      correctOptionId: diagnosticOptionId(question.id, correctOptions[0].label)
    };
  }
  const statements = question.trueFalseStatements ?? [];
  if (statements.length !== 4 || new Set(statements.map((statement) => statement.subOrder)).size !== 4) {
    throw new Error(`Question ${question.id} must have four uniquely ordered statements.`);
  }
  return {
    questionId: question.id,
    questionType: "true_false_multistatement",
    correctAnswers: statements.reduce(
      (answers, statement) => {
        answers[statement.subOrder] = statement.isCorrect;
        return answers;
      },
      { a: false, b: false, c: false, d: false }
    )
  };
}

// src/server/diagnosticRpc.ts
import { createClient as createClient3 } from "@supabase/supabase-js";
var diagnosticRpcKey = /* @__PURE__ */ Symbol.for("tinmaster.diagnostic-rpc");
var serviceClient = null;
function currentDiagnosticRpc() {
  return Reflect.get(globalThis, diagnosticRpcKey) ?? null;
}
function configuredDiagnosticRpc() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Server-side Supabase service-role configuration is missing.");
  }
  if (!serviceClient) {
    serviceClient = createClient3(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    });
  }
  const client = serviceClient;
  return async (functionName, args) => {
    const { data, error } = await client.rpc(functionName, args);
    return {
      data,
      error: error ? { code: error.code, message: error.message } : null
    };
  };
}
async function callDiagnosticRpc(functionName, args) {
  const rpc = currentDiagnosticRpc() ?? configuredDiagnosticRpc();
  const { data, error } = await rpc(functionName, args);
  if (error) throw error;
  return data;
}

// src/server/diagnosticStart.ts
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var DiagnosticProfileError = class extends Error {
};
var diagnosticDependenciesKey = /* @__PURE__ */ Symbol.for("tinmaster.diagnostic-start-dependencies");
function currentDiagnosticStartDependencies() {
  return Reflect.get(globalThis, diagnosticDependenciesKey) ?? null;
}
async function resolveDiagnosticGrade(userId, accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new DiagnosticProfileError("Supabase profile lookup is not configured.");
  }
  const client = createClient4(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await client.from("profiles").select("grade,exam_track").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? { found: true, grade: data.grade, examTrack: data.exam_track } : { found: false, grade: null, examTrack: null };
}
function readBearerToken(authorization) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
function createDiagnosticAssessmentStartHandler(resolveGrade, selectQuestions) {
  return async (req, res) => {
    const userId = res.locals.authenticatedUserId;
    const accessToken = readBearerToken(req.header("authorization"));
    if (!userId || !accessToken) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
      return;
    }
    let profile;
    try {
      profile = await (resolveGrade ?? currentDiagnosticStartDependencies()?.resolveGrade ?? resolveDiagnosticGrade)(
        userId,
        accessToken
      );
    } catch {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i h\u1ED3 s\u01A1 h\u1ECDc sinh. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "PROFILE_LOOKUP_FAILED"
      });
      return;
    }
    if (!profile.found) {
      res.status(404).json({
        error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 h\u1ECDc sinh.",
        code: "PROFILE_NOT_FOUND"
      });
      return;
    }
    const grade = profile.grade;
    if (grade === null || grade === void 0) {
      res.status(400).json({
        error: "H\xE3y c\u1EADp nh\u1EADt kh\u1ED1i l\u1EDBp h\u1EE3p l\u1EC7 (10, 11 ho\u1EB7c 12) trong h\u1ED3 s\u01A1 tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u.",
        code: "PROFILE_GRADE_REQUIRED"
      });
      return;
    }
    try {
      getServerDiagnosticGrades(grade);
    } catch {
      res.status(400).json({
        error: "H\xE3y c\u1EADp nh\u1EADt kh\u1ED1i l\u1EDBp h\u1EE3p l\u1EC7 (10, 11 ho\u1EB7c 12) trong h\u1ED3 s\u01A1 tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u.",
        code: "PROFILE_GRADE_INVALID"
      });
      return;
    }
    let questions;
    try {
      questions = (selectQuestions ?? currentDiagnosticStartDependencies()?.selectQuestions ?? selectServerDiagnosticQuestions)(grade, profile.examTrack);
    } catch {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 chu\u1EA9n b\u1ECB b\u1ED9 c\xE2u h\u1ECFi. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "QUESTION_SELECTION_FAILED"
      });
      return;
    }
    if (questions.length === 0) {
      res.status(503).json({
        error: "Hi\u1EC7n ch\u01B0a c\xF3 c\xE2u h\u1ECFi ph\xF9 h\u1EE3p v\u1EDBi kh\u1ED1i l\u1EDBp trong h\u1ED3 s\u01A1.",
        code: "QUESTION_POOL_EMPTY"
      });
      return;
    }
    let publicQuestions;
    let scoringSnapshot;
    try {
      publicQuestions = questions.map(projectDiagnosticQuestion);
      scoringSnapshot = questions.map(getPrivateDiagnosticScoringData);
    } catch {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 chu\u1EA9n b\u1ECB b\u1ED9 c\xE2u h\u1ECFi. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "QUESTION_PROJECTION_FAILED"
      });
      return;
    }
    const idempotencyKey = req.body?.idempotencyKey;
    if (typeof idempotencyKey !== "string" || !UUID_PATTERN.test(idempotencyKey)) {
      res.status(400).json({
        error: "A valid assessment idempotency key is required.",
        code: "IDEMPOTENCY_KEY_INVALID"
      });
      return;
    }
    let createdSession;
    try {
      createdSession = await callDiagnosticRpc("create_diagnostic_session", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_question_ids: questions.map((question) => question.id),
        p_presentation_snapshot: publicQuestions,
        p_question_bank_version: SERVER_DIAGNOSTIC_QUESTION_BANK_VERSION,
        p_scoring_snapshot: scoringSnapshot
      });
    } catch (error) {
      const code = error?.code;
      if (code === "55000") {
        res.status(409).json({
          error: "An assessment is already in progress.",
          code: "ASSESSMENT_ALREADY_IN_PROGRESS"
        });
        return;
      }
      if (code === "22023") {
        res.status(400).json({
          error: "The assessment could not be created from the current student profile.",
          code: "ASSESSMENT_INVALID"
        });
        return;
      }
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 l\u01B0u b\xE0i \u0111\xE1nh gi\xE1. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "ASSESSMENT_STORAGE_UNAVAILABLE"
      });
      return;
    }
    const session = Array.isArray(createdSession) ? createdSession[0] : createdSession;
    if (!session || typeof session !== "object") {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 l\u01B0u b\xE0i \u0111\xE1nh gi\xE1. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "ASSESSMENT_STORAGE_UNAVAILABLE"
      });
      return;
    }
    const stored = session;
    if (typeof stored.id !== "string" || !Array.isArray(stored.presentation_snapshot) || !Array.isArray(stored.eligible_grades)) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i b\xE0i \u0111\xE1nh gi\xE1 \u0111\xE3 l\u01B0u. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "ASSESSMENT_RESPONSE_INVALID"
      });
      return;
    }
    res.status(200).json({
      assessment: {
        id: stored.id,
        grade: stored.grade_snapshot,
        eligibleGrades: stored.eligible_grades,
        startedAt: stored.started_at,
        deadlineAt: stored.deadline_at,
        status: stored.status,
        targetDurationMinutes: 25,
        persisted: true
      },
      questions: stored.presentation_snapshot
    });
  };
}

// src/server/diagnosticSession.ts
import { createClient as createClient5 } from "@supabase/supabase-js";
var UUID_PATTERN2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var latestCompletedSessionResolverKey = /* @__PURE__ */ Symbol.for(
  "tinmaster.diagnostic-latest-completed-session-resolver"
);
function recordFromRpc(data) {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}
function respondToRpcError(error, res, context) {
  const code = error?.code;
  if (code === "P0002") {
    res.status(404).json({
      error: "Assessment not found.",
      code: "ASSESSMENT_NOT_FOUND"
    });
    return;
  }
  if (code === "40001") {
    res.status(409).json({
      error: "This answer changed elsewhere. Reload the assessment before retrying.",
      code: "ANSWER_REVISION_CONFLICT"
    });
    return;
  }
  if (code === "55000") {
    res.status(409).json({
      error: context === "submit" ? "This assessment cannot be submitted in its current state." : "This assessment is no longer accepting answers.",
      code: context === "submit" ? "ASSESSMENT_NOT_SUBMITTABLE" : "ASSESSMENT_NOT_ACCEPTING_ANSWERS"
    });
    return;
  }
  if (code === "22023" && context === "write") {
    res.status(400).json({
      error: "The answer does not match this assessment question.",
      code: "ANSWER_INVALID"
    });
    return;
  }
  res.status(503).json({
    error: context === "read" ? "Kh\xF4ng th\u1EC3 t\u1EA3i b\xE0i \u0111\xE1nh gi\xE1. Vui l\xF2ng th\u1EED l\u1EA1i sau." : context === "submit" ? "Kh\xF4ng th\u1EC3 n\u1ED9p b\xE0i \u0111\xE1nh gi\xE1. Vui l\xF2ng th\u1EED l\u1EA1i sau." : "Kh\xF4ng th\u1EC3 l\u01B0u c\xE2u tr\u1EA3 l\u1EDDi. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
    code: context === "read" ? "ASSESSMENT_STORAGE_UNAVAILABLE" : context === "submit" ? "ASSESSMENT_SUBMISSION_UNAVAILABLE" : "ANSWER_STORAGE_UNAVAILABLE"
  });
}
function validSessionId(value) {
  return UUID_PATTERN2.test(value);
}
function readBearerToken2(authorization) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
function currentLatestCompletedSessionResolver() {
  return Reflect.get(globalThis, latestCompletedSessionResolverKey) ?? null;
}
async function resolveLatestCompletedSession(userId, accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase session lookup is not configured.");
  const client = createClient5(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await client.from("diagnostic_sessions").select("id").eq("status", "completed").order("finalized_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return typeof data?.id === "string" ? data.id : null;
}
function resultFromRpc(data) {
  return recordFromRpc(data);
}
function publicResult(row) {
  const score = Number(row.score);
  const maximumScore = Number(row.maximum_score);
  const answeredQuestions = Number(row.answered_questions);
  const fullyCorrectQuestions = Number(row.fully_correct_questions);
  const totalQuestions = Number(row.total_questions);
  if (!Number.isFinite(score) || !Number.isFinite(maximumScore) || maximumScore <= 0 || !Number.isSafeInteger(answeredQuestions) || !Number.isSafeInteger(fullyCorrectQuestions) || !Number.isSafeInteger(totalQuestions) || score < 0 || score > maximumScore || answeredQuestions < 0 || answeredQuestions > totalQuestions || fullyCorrectQuestions < 0 || fullyCorrectQuestions > answeredQuestions || totalQuestions <= 0 || typeof row.submitted_at !== "string") {
    return null;
  }
  return {
    score,
    maximumScore,
    percentage: Number((score / maximumScore * 100).toFixed(1)),
    answeredQuestions,
    fullyCorrectQuestions,
    totalQuestions,
    submittedAt: row.submitted_at
  };
}
var getLatestDiagnosticAssessmentResultHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId;
  const accessToken = readBearerToken2(req.header("authorization"));
  if (!userId || !accessToken) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  try {
    const resolver = currentLatestCompletedSessionResolver() ?? resolveLatestCompletedSession;
    const sessionId = await resolver(userId, accessToken);
    if (!sessionId) {
      res.status(200).json({ result: null });
      return;
    }
    if (!validSessionId(sessionId)) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i k\u1EBFt qu\u1EA3 \u0111\xE1nh gi\xE1 \u0111\xE3 l\u01B0u.",
        code: "ASSESSMENT_RESULT_UNAVAILABLE"
      });
      return;
    }
    const data = await callDiagnosticRpc("get_diagnostic_session_result", {
      p_user_id: userId,
      p_session_id: sessionId
    });
    const row = resultFromRpc(data);
    const result = row ? publicResult(row) : null;
    if (!result) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i k\u1EBFt qu\u1EA3 \u0111\xE1nh gi\xE1 \u0111\xE3 l\u01B0u.",
        code: "ASSESSMENT_RESULT_UNAVAILABLE"
      });
      return;
    }
    res.status(200).json({ result });
  } catch {
    res.status(503).json({
      error: "Kh\xF4ng th\u1EC3 t\u1EA3i \u0111i\u1EC3m n\u0103ng l\u1EF1c. Vui l\xF2ng th\u1EED l\u1EA1i.",
      code: "ASSESSMENT_RESULT_LOOKUP_FAILED"
    });
  }
};
var getDiagnosticAssessmentHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId;
  const sessionId = req.params.sessionId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: "Invalid assessment ID.", code: "ASSESSMENT_ID_INVALID" });
    return;
  }
  try {
    const data = await callDiagnosticRpc("get_diagnostic_session_state", {
      p_user_id: userId,
      p_session_id: sessionId
    });
    const state = recordFromRpc(data);
    if (!state || typeof state.session_id !== "string" || !Array.isArray(state.presentation_snapshot) || !state.answer_selections || typeof state.answer_selections !== "object" || Array.isArray(state.answer_selections)) {
      res.status(404).json({ error: "Assessment not found.", code: "ASSESSMENT_NOT_FOUND" });
      return;
    }
    let result = null;
    if (state.status === "completed") {
      const resultData = await callDiagnosticRpc("get_diagnostic_session_result", {
        p_user_id: userId,
        p_session_id: sessionId
      });
      const resultRow = resultFromRpc(resultData);
      result = resultRow ? publicResult(resultRow) : null;
      if (!result) {
        res.status(503).json({
          error: "Kh\xF4ng th\u1EC3 t\u1EA3i k\u1EBFt qu\u1EA3 b\xE0i \u0111\xE1nh gi\xE1 \u0111\xE3 l\u01B0u.",
          code: "ASSESSMENT_RESULT_UNAVAILABLE"
        });
        return;
      }
    }
    res.status(200).json({
      assessment: {
        id: state.session_id,
        grade: state.grade_snapshot,
        eligibleGrades: state.eligible_grades,
        questionBankVersion: state.question_bank_version,
        startedAt: state.started_at,
        deadlineAt: state.deadline_at,
        status: state.status,
        submittedAt: state.submitted_at,
        finalizedAt: state.finalized_at
      },
      questions: state.presentation_snapshot,
      answers: state.answer_selections,
      result
    });
  } catch (error) {
    respondToRpcError(error, res, "read");
  }
};
var submitDiagnosticAssessmentHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId;
  const sessionId = req.params.sessionId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: "Invalid assessment ID.", code: "ASSESSMENT_ID_INVALID" });
    return;
  }
  try {
    const data = await callDiagnosticRpc("submit_diagnostic_session", {
      p_user_id: userId,
      p_session_id: sessionId
    });
    const submission = recordFromRpc(data);
    if (!submission || !["completed", "incomplete"].includes(String(submission.session_status))) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 x\xE1c nh\u1EADn tr\u1EA1ng th\xE1i n\u1ED9p b\xE0i.",
        code: "ASSESSMENT_SUBMISSION_RESPONSE_INVALID"
      });
      return;
    }
    if (submission.session_status === "incomplete") {
      res.status(200).json({ status: "incomplete", result: null });
      return;
    }
    const result = publicResult(submission);
    if (!result) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i k\u1EBFt qu\u1EA3 b\xE0i \u0111\xE1nh gi\xE1 \u0111\xE3 l\u01B0u.",
        code: "ASSESSMENT_RESULT_UNAVAILABLE"
      });
      return;
    }
    res.status(200).json({ status: "completed", result });
  } catch (error) {
    respondToRpcError(error, res, "submit");
  }
};
function readExpectedRevision(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
async function writeDiagnosticAnswer(userId, sessionId, questionId, selection, expectedRevision, res) {
  try {
    const result = await callDiagnosticRpc("save_diagnostic_answer", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_question_id: questionId,
      p_answer_selection: selection,
      p_expected_revision: expectedRevision
    });
    const revision = typeof result === "number" ? result : typeof result === "string" ? Number(result) : NaN;
    if (!Number.isSafeInteger(revision) || revision < 1) {
      res.status(503).json({
        error: "Kh\xF4ng th\u1EC3 l\u01B0u c\xE2u tr\u1EA3 l\u1EDDi. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
        code: "ANSWER_RESPONSE_INVALID"
      });
      return;
    }
    res.status(200).json({ revision });
  } catch (error) {
    respondToRpcError(error, res, "write");
  }
}
var saveDiagnosticAnswerHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId;
  const sessionId = req.params.sessionId;
  const { questionId, answerSelection, expectedRevision } = req.body ?? {};
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: "Invalid assessment ID.", code: "ASSESSMENT_ID_INVALID" });
    return;
  }
  if (typeof questionId !== "string" || !QUESTION_ID_PATTERN.test(questionId) || !Object.hasOwn(req.body ?? {}, "answerSelection") || !(answerSelection === null || isJsonObject(answerSelection))) {
    res.status(400).json({ error: "Invalid answer payload.", code: "ANSWER_INVALID" });
    return;
  }
  const revision = readExpectedRevision(expectedRevision);
  if (revision === null) {
    res.status(400).json({
      error: "A valid expected revision is required.",
      code: "ANSWER_REVISION_INVALID"
    });
    return;
  }
  await writeDiagnosticAnswer(userId, sessionId, questionId, answerSelection, revision, res);
};
var clearDiagnosticAnswerHandler = async (req, res) => {
  const userId = res.locals.authenticatedUserId;
  const sessionId = req.params.sessionId;
  const questionId = req.params.questionId;
  const revision = readExpectedRevision(req.body?.expectedRevision);
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  if (!validSessionId(sessionId)) {
    res.status(400).json({ error: "Invalid assessment ID.", code: "ASSESSMENT_ID_INVALID" });
    return;
  }
  if (!QUESTION_ID_PATTERN.test(questionId)) {
    res.status(400).json({ error: "Invalid question ID.", code: "QUESTION_ID_INVALID" });
    return;
  }
  if (revision === null) {
    res.status(400).json({
      error: "A valid expected revision is required.",
      code: "ANSWER_REVISION_INVALID"
    });
    return;
  }
  await writeDiagnosticAnswer(userId, sessionId, questionId, null, revision, res);
};

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
    "/api/diagnostic/assessment/start",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    createDiagnosticAssessmentStartHandler()
  );
  app.get(
    "/api/diagnostic/assessment/latest-result",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    getLatestDiagnosticAssessmentResultHandler
  );
  app.get(
    "/api/diagnostic/assessment/:sessionId",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    getDiagnosticAssessmentHandler
  );
  app.post(
    "/api/diagnostic/assessment/:sessionId/submit",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    submitDiagnosticAssessmentHandler
  );
  app.post(
    "/api/diagnostic/assessment/:sessionId/answers",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    saveDiagnosticAnswerHandler
  );
  app.delete(
    "/api/diagnostic/assessment/:sessionId/answers/:questionId",
    requireSupabaseUser,
    requireSupabaseRole(["student"]),
    clearDiagnosticAnswerHandler
  );
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
