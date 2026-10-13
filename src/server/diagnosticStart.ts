import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import type { PublicQuestionPresentation, Question } from '../types';
import {
  getPrivateDiagnosticScoringData,
  SERVER_DIAGNOSTIC_QUESTION_BANK_VERSION,
} from './diagnosticQuestionBank';
import {
  getServerDiagnosticGrades,
  projectDiagnosticQuestion,
  selectServerDiagnosticQuestions,
} from './diagnosticQuestionBank';
import { callDiagnosticRpc } from './diagnosticRpc';

type DiagnosticGradeResolver = (
  userId: string,
  accessToken: string
) => Promise<{ found: boolean; grade: unknown; examTrack?: unknown }>;

type DiagnosticQuestionSelector = (grade: unknown, examTrack?: unknown) => Question[];
type DiagnosticStartDependencies = {
  resolveGrade: DiagnosticGradeResolver;
  selectQuestions: DiagnosticQuestionSelector;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class DiagnosticProfileError extends Error {}

const diagnosticDependenciesKey = Symbol.for('tinmaster.diagnostic-start-dependencies');

function currentDiagnosticStartDependencies(): DiagnosticStartDependencies | null {
  return Reflect.get(globalThis, diagnosticDependenciesKey) as
    DiagnosticStartDependencies | null ?? null;
}

async function resolveDiagnosticGrade(
  userId: string,
  accessToken: string
): Promise<{ found: boolean; grade: unknown; examTrack: unknown }> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new DiagnosticProfileError('Supabase profile lookup is not configured.');
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client
    .from('profiles')
    .select('grade,exam_track')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data
    ? { found: true, grade: data.grade, examTrack: data.exam_track }
    : { found: false, grade: null, examTrack: null };
}

function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function createDiagnosticAssessmentStartHandler(
  resolveGrade?: DiagnosticGradeResolver,
  selectQuestions?: DiagnosticQuestionSelector
): RequestHandler {
  return async (req, res) => {
    const userId = res.locals.authenticatedUserId as string | undefined;
    const accessToken = readBearerToken(req.header('authorization'));
    if (!userId || !accessToken) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    let profile: { found: boolean; grade: unknown; examTrack?: unknown };
    try {
      profile = await (resolveGrade ?? currentDiagnosticStartDependencies()?.resolveGrade ?? resolveDiagnosticGrade)(
        userId,
        accessToken
      );
    } catch {
      res.status(503).json({
        error: 'Không thể tải hồ sơ học sinh. Vui lòng thử lại sau.',
        code: 'PROFILE_LOOKUP_FAILED',
      });
      return;
    }

    if (!profile.found) {
      res.status(404).json({
        error: 'Không tìm thấy hồ sơ học sinh.',
        code: 'PROFILE_NOT_FOUND',
      });
      return;
    }

    const grade = profile.grade;
    if (grade === null || grade === undefined) {
      res.status(400).json({
        error: 'Hãy cập nhật khối lớp hợp lệ (10, 11 hoặc 12) trong hồ sơ trước khi bắt đầu.',
        code: 'PROFILE_GRADE_REQUIRED',
      });
      return;
    }

    try {
      getServerDiagnosticGrades(grade);
    } catch {
      res.status(400).json({
        error: 'Hãy cập nhật khối lớp hợp lệ (10, 11 hoặc 12) trong hồ sơ trước khi bắt đầu.',
        code: 'PROFILE_GRADE_INVALID',
      });
      return;
    }

    let questions: Question[];
    try {
      questions = (selectQuestions ?? currentDiagnosticStartDependencies()?.selectQuestions ??
        selectServerDiagnosticQuestions)(grade, profile.examTrack);
    } catch {
      res.status(503).json({
        error: 'Không thể chuẩn bị bộ câu hỏi. Vui lòng thử lại sau.',
        code: 'QUESTION_SELECTION_FAILED',
      });
      return;
    }

    if (questions.length === 0) {
      res.status(503).json({
        error: 'Hiện chưa có câu hỏi phù hợp với khối lớp trong hồ sơ.',
        code: 'QUESTION_POOL_EMPTY',
      });
      return;
    }

    let publicQuestions: PublicQuestionPresentation[];
    let scoringSnapshot: ReturnType<typeof getPrivateDiagnosticScoringData>[];
    try {
      publicQuestions = questions.map(projectDiagnosticQuestion);
      scoringSnapshot = questions.map(getPrivateDiagnosticScoringData);
    } catch {
      res.status(503).json({
        error: 'Không thể chuẩn bị bộ câu hỏi. Vui lòng thử lại sau.',
        code: 'QUESTION_PROJECTION_FAILED',
      });
      return;
    }

    const idempotencyKey = req.body?.idempotencyKey;
    if (typeof idempotencyKey !== 'string' || !UUID_PATTERN.test(idempotencyKey)) {
      res.status(400).json({
        error: 'A valid assessment idempotency key is required.',
        code: 'IDEMPOTENCY_KEY_INVALID',
      });
      return;
    }

    let createdSession: unknown;
    try {
      createdSession = await callDiagnosticRpc('create_diagnostic_session', {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_question_ids: questions.map((question) => question.id),
        p_presentation_snapshot: publicQuestions,
        p_question_bank_version: SERVER_DIAGNOSTIC_QUESTION_BANK_VERSION,
        p_scoring_snapshot: scoringSnapshot,
      });
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === '55000') {
        res.status(409).json({
          error: 'An assessment is already in progress.',
          code: 'ASSESSMENT_ALREADY_IN_PROGRESS',
        });
        return;
      }
      if (code === '22023') {
        res.status(400).json({
          error: 'The assessment could not be created from the current student profile.',
          code: 'ASSESSMENT_INVALID',
        });
        return;
      }
      res.status(503).json({
        error: 'Không thể lưu bài đánh giá. Vui lòng thử lại sau.',
        code: 'ASSESSMENT_STORAGE_UNAVAILABLE',
      });
      return;
    }

    const session = Array.isArray(createdSession) ? createdSession[0] : createdSession;
    if (!session || typeof session !== 'object') {
      res.status(503).json({
        error: 'Không thể lưu bài đánh giá. Vui lòng thử lại sau.',
        code: 'ASSESSMENT_STORAGE_UNAVAILABLE',
      });
      return;
    }
    const stored = session as {
      id?: unknown;
      grade_snapshot?: unknown;
      eligible_grades?: unknown;
      started_at?: unknown;
      deadline_at?: unknown;
      status?: unknown;
      presentation_snapshot?: unknown;
    };
    if (
      typeof stored.id !== 'string' ||
      !Array.isArray(stored.presentation_snapshot) ||
      !Array.isArray(stored.eligible_grades)
    ) {
      res.status(503).json({
        error: 'Không thể tải bài đánh giá đã lưu. Vui lòng thử lại sau.',
        code: 'ASSESSMENT_RESPONSE_INVALID',
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
        persisted: true,
      },
      questions: stored.presentation_snapshot,
    });
  };
}

export function configureDiagnosticStartDependencies(
  dependencies: DiagnosticStartDependencies
): () => void {
  const previous = currentDiagnosticStartDependencies();
  Reflect.set(globalThis, diagnosticDependenciesKey, dependencies);
  return () => {
    if (previous) Reflect.set(globalThis, diagnosticDependenciesKey, previous);
    else Reflect.deleteProperty(globalThis, diagnosticDependenciesKey);
  };
}
