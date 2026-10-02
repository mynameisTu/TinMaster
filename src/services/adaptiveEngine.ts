/**
 * Adaptive Learning Engine for TinMaster
 * Động cơ học tập thích ứng phân tích năng lực & đề xuất câu hỏi
 */

import {
  Question,
  StudentMastery,
  AdaptiveRecommendation,
  InteractionQuadrant,
  LearningPathDay,
  ConceptNode,
  AdaptivePracticeResult,
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { SAMPLE_QUESTION_BANK } from '../data/questionBank';
import { getVerifiedMastery } from './masteryStorage';
import type { LearningMode } from './learningPreferences';

export class AdaptiveLearningEngine {
  /**
   * Tính toán chấm điểm chuẩn hóa theo quy chế BGDĐT
   */
  public static calculateQuestionScore(
    question: Question,
    userAnswer: string | Record<string, boolean> | undefined,
    maxPointsOverride?: number
  ): { isCorrect: boolean; scoreRatio: number; awardedPoints: number } {
    if (!userAnswer) {
      return { isCorrect: false, scoreRatio: 0, awardedPoints: 0 };
    }

    if (question.questionType === 'single_choice') {
      const selected = userAnswer as string;
      const correctOption = question.singleChoiceOptions?.find((o) => o.isCorrect);
      const isCorrect = correctOption?.label === selected;
      const maxPts = maxPointsOverride !== undefined ? maxPointsOverride : 0.25;
      return {
        isCorrect,
        scoreRatio: isCorrect ? 1.0 : 0.0,
        awardedPoints: isCorrect ? maxPts : 0.0,
      };
    }

    if (question.questionType === 'true_false_multistatement') {
      const answersMap = userAnswer as Record<string, boolean>;
      let correctSubCount = 0;
      question.trueFalseStatements?.forEach((st) => {
        if (answersMap[st.subOrder] === st.isCorrect) {
          correctSubCount++;
        }
      });

      // Biểu điểm chuẩn BGDĐT từ năm 2025:
      // Tỉ lệ lũy tiến: 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%
      let scoreRatio = 0;
      if (correctSubCount === 1) scoreRatio = 0.1;
      else if (correctSubCount === 2) scoreRatio = 0.25;
      else if (correctSubCount === 3) scoreRatio = 0.5;
      else if (correctSubCount === 4) scoreRatio = 1.0;

      const isFullyCorrect = correctSubCount === 4;
      const maxPts = maxPointsOverride !== undefined ? maxPointsOverride : 1.0;
      const awardedPoints = Number((scoreRatio * maxPts).toFixed(2));

      return {
        isCorrect: isFullyCorrect,
        scoreRatio,
        awardedPoints,
      };
    }

    return { isCorrect: false, scoreRatio: 0, awardedPoints: 0 };
  }

  /**
   * Tính toán phân rã điểm số chi tiết theo Phần bắt buộc & Phần tự chọn
   */
  public static calculateExamScoreBreakdown(
    questions: Question[],
    telemetries: Record<string, { userAnswer?: any }>,
    studentTrack?: 'CS' | 'ICT'
  ): {
    mandatoryScore: number;
    mandatoryMaxScore: number;
    mandatoryCorrect: number;
    mandatoryTotal: number;
    electiveScore: number;
    electiveMaxScore: number;
    electiveCorrect: number;
    electiveTotal: number;
    totalScore: number;
    totalMaxScore: number;
  } {
    let mandatoryScore = 0;
    let mandatoryMaxScore = 0;
    let mandatoryCorrect = 0;
    let mandatoryTotal = 0;

    let electiveScore = 0;
    let electiveMaxScore = 0;
    let electiveCorrect = 0;
    let electiveTotal = 0;

    questions.forEach((q) => {
      const tel = telemetries[q.id];
      const isElective = q.sectionScope === 'elective';
      const maxPts = q.questionType === 'true_false_multistatement' ? 1.0 : 0.25;

      if (isElective) {
        const result = AdaptiveLearningEngine.calculateQuestionScore(q, tel?.userAnswer, maxPts);
        electiveScore += result.awardedPoints;
        electiveMaxScore += maxPts;
        if (result.isCorrect) electiveCorrect++;
        electiveTotal++;
      } else {
        const result = AdaptiveLearningEngine.calculateQuestionScore(q, tel?.userAnswer, maxPts);
        mandatoryScore += result.awardedPoints;
        mandatoryMaxScore += maxPts;
        if (result.isCorrect) mandatoryCorrect++;
        mandatoryTotal++;
      }
    });

    mandatoryScore = Number(mandatoryScore.toFixed(2));
    electiveScore = Number(electiveScore.toFixed(2));
    mandatoryMaxScore = Number(mandatoryMaxScore.toFixed(2));
    electiveMaxScore = Number(electiveMaxScore.toFixed(2));

    const totalScore = Number((mandatoryScore + electiveScore).toFixed(2));
    const totalMaxScore = Number((mandatoryMaxScore + electiveMaxScore).toFixed(2));

    return {
      mandatoryScore,
      mandatoryMaxScore,
      mandatoryCorrect,
      mandatoryTotal,
      electiveScore,
      electiveMaxScore,
      electiveCorrect,
      electiveTotal,
      totalScore,
      totalMaxScore,
    };
  }

  /**
   * Phân loại góc phần tư hành vi thời gian (Behavioral Time Quadrant)
   */
  public static evaluateBehaviorQuadrant(
    timeSpentSec: number,
    estimatedTimeSec: number,
    isCorrect: boolean,
    changesCount: number
  ): { quadrant: InteractionQuadrant; hesitationScore: number; patternNote: string } {
    const timeRatio = timeSpentSec / Math.max(15, estimatedTimeSec);
    const isFast = timeRatio < 0.8;
    const isSlow = timeRatio > 1.25;

    let quadrant: InteractionQuadrant;
    let patternNote = '';

    if (isCorrect) {
      if (!isSlow) {
        quadrant = 'fast_correct';
        patternNote = 'Thao tác dứt khoát, thành thạo cao.';
      } else {
        quadrant = 'slow_correct';
        patternNote = 'Trả lời đúng nhưng mất nhiều thời gian cân nhắc; cần củng cố tốc độ phản xạ.';
      }
    } else {
      if (isFast) {
        quadrant = 'fast_incorrect';
        patternNote = 'Làm nhanh và chọn sai; có dấu hiệu cẩu thả, đoán mò hoặc bỏ qua chi tiết đề.';
      } else {
        quadrant = 'slow_incorrect';
        patternNote = 'Mất nhiều thời gian nhưng vẫn chọn sai; dấu hiệu của lỗ hổng kiến thức cốt lõi.';
      }
    }

    // Độ ngập ngừng dựa trên số lần sửa đáp án và thời gian
    const hesitationScore = Math.min(1.0, (changesCount * 0.25) + (isSlow ? 0.4 : 0.1));

    return { quadrant, hesitationScore, patternNote };
  }

  /**
   * Cập nhật Vectơ Năng lực Tri thức (Bayesian Knowledge Updating with Ebbinghaus)
   */
  public static updateConceptMastery(
    currentMastery: StudentMastery | undefined,
    conceptId: string,
    scoreRatio: number,
    difficulty: 'easy' | 'medium' | 'hard',
    behaviorQuadrant: InteractionQuadrant,
    timeSpentSec: number
  ): StudentMastery {
    if (!Number.isFinite(scoreRatio) || scoreRatio < 0 || scoreRatio > 1) {
      throw new RangeError('Mastery score ratio must be a finite number between 0 and 1.');
    }

    const prior = currentMastery ? currentMastery.masteryScore : 0.5;
    const totalAttempts = (currentMastery?.totalAttempts || 0) + 1;
    const isSuccess = scoreRatio >= 0.75;
    const correctAttempts = (currentMastery?.correctAttempts || 0) + (isSuccess ? 1 : 0);

    // Độ khó chuyển đổi thành giá trị đo lường tâm trắc học
    const diffMap = { easy: 0.35, medium: 0.6, hard: 0.85 };
    const d = diffMap[difficulty];

    // Xác suất kỳ vọng trả lời đúng P(correct)
    const expectedP = 1 / (1 + Math.exp(-3 * (prior - d)));

    // Hệ số tốc độ học điều chỉnh theo kinh nghiệm
    const alpha = Math.max(0.12, 0.35 / (1 + totalAttempts * 0.08));

    // Trọng số hành vi
    let behaviorWeight = 1.0;
    if (behaviorQuadrant === 'fast_correct') behaviorWeight = 1.15;
    else if (behaviorQuadrant === 'slow_correct') behaviorWeight = 0.9;
    else if (behaviorQuadrant === 'fast_incorrect') behaviorWeight = 0.8;
    else if (behaviorQuadrant === 'slow_incorrect') behaviorWeight = 1.05; // phản ánh đúng lỗ hổng

    // Cập nhật giá trị mới
    let newScore = prior + alpha * (scoreRatio - expectedP) * behaviorWeight;
    newScore = Math.max(0.05, Math.min(0.98, newScore));

    const streak = isSuccess ? (currentMastery?.consecutiveSuccessStreak || 0) + 1 : 0;

    // Lịch ôn lặp lại ngắt quãng (Spaced Repetition Schedule)
    const now = new Date();
    let nextDays = 1;
    if (streak === 1) nextDays = 2;
    else if (streak === 2) nextDays = 4;
    else if (streak === 3) nextDays = 7;
    else if (streak >= 4) nextDays = 15;

    const nextReview = new Date(now.getTime() + nextDays * 24 * 60 * 60 * 1000);

    const trend: 'improving' | 'stable' | 'declining' =
      newScore > prior + 0.03 ? 'improving' : newScore < prior - 0.03 ? 'declining' : 'stable';

    return {
      conceptId,
      masteryScore: Math.round(newScore * 100) / 100,
      confidenceScore: Math.min(0.95, 0.3 + totalAttempts * 0.1),
      totalAttempts,
      correctAttempts,
      consecutiveSuccessStreak: streak,
      lastPracticedAt: now.toISOString(),
      nextSpacedReviewAt: nextReview.toISOString(),
      trend,
    };
  }

  public static updateMasteriesFromPracticeResults(
    masteries: Record<string, StudentMastery>,
    results: AdaptivePracticeResult[]
  ): Record<string, StudentMastery> {
    const updatedMasteries = { ...masteries };

    results.forEach((result) => {
      const currentMastery = updatedMasteries[result.question.conceptId] || {
        conceptId: result.question.conceptId,
        masteryScore: 0.5,
        confidenceScore: 0.5,
        totalAttempts: 0,
        correctAttempts: 0,
        consecutiveSuccessStreak: 0,
        lastPracticedAt: new Date().toISOString(),
        nextSpacedReviewAt: new Date().toISOString(),
        trend: 'stable' as const,
      };

      updatedMasteries[result.question.conceptId] = this.updateConceptMastery(
        currentMastery,
        result.question.conceptId,
        result.scoreRatio,
        result.question.difficulty,
        result.isCorrect ? 'fast_correct' : 'slow_incorrect',
        result.activeTimeSec
      );
    });

    return updatedMasteries;
  }

  /**
   * Động cơ Đề xuất Câu hỏi Thích ứng (Recommendation Engine)
   */
  public static getAdaptiveRecommendations(
    masteries: Record<string, StudentMastery>,
    availableQuestions: Question[] = SAMPLE_QUESTION_BANK,
    limit: number = 5,
    excludeQuestionIds: string[] = [],
    learningMode: LearningMode = 'smart_review'
  ): AdaptiveRecommendation[] {
    const candidates = availableQuestions.filter((q) => !excludeQuestionIds.includes(q.id));

    const scored = candidates.map((q, originalIndex) => {
      const verifiedMastery = getVerifiedMastery(masteries, q.conceptId);
      const mastery = verifiedMastery?.masteryScore ?? 0.5;
      const concept = CONCEPTS_LIST.find((c) => c.id === q.conceptId);
      const importance = concept?.importanceWeight ?? 0.8;

      // Unmeasured concepts receive a neutral score; this is not a measured weakness.
      const weaknessScore = verifiedMastery ? 1.0 - mastery : 0.5;

      // Missing local evidence is unknown, not proof the student has never practiced.
      let recencyScore = 0.5;
      const lastPracticed = verifiedMastery?.lastPracticedAt;
      if (lastPracticed) {
        const daysSince = (Date.now() - new Date(lastPracticed).getTime()) / (1000 * 3600 * 24);
        recencyScore = Math.min(1.0, daysSince / 4);
      }

      // 3. Difficulty Fit (Vùng phát triển gần nhất ZPD)
      const diffVal = q.difficulty === 'easy' ? 0.35 : q.difficulty === 'medium' ? 0.6 : 0.85;
      const targetDifficulty = mastery + 0.1; // Hơi thách thức hơn một chút
      const difficultyFitScore = Math.max(0, 1.0 - Math.abs(diffVal - targetDifficulty) * 1.5);

      // Trọng số tổng hợp
      const finalScore =
        0.4 * weaknessScore +
        0.25 * difficultyFitScore +
        0.2 * recencyScore +
        0.15 * importance;

      // Explain recommendations according to evidence and the selected strategy.
      let explanationText = '';
      if (!verifiedMastery) {
        explanationText = learningMode === 'structured'
          ? `Bài luyện theo trình tự chương trình ở chuyên đề "${concept?.name}". Chưa có dữ liệu học tập gắn với tài khoản này để đánh giá mức độ nắm vững.`
          : `Bài luyện làm quen với chuyên đề "${concept?.name}". Chưa có dữ liệu học tập gắn với tài khoản này để đánh giá mức độ nắm vững.`;
      } else if (learningMode === 'focus_weak') {
        explanationText = `Ưu tiên luyện tập "${concept?.name}" dựa trên kết quả thực hành đã ghi nhận (${Math.round(mastery * 100)}% mức làm chủ ước tính).`;
      } else if (learningMode === 'structured') {
        explanationText = `Tiếp tục theo trình tự chương trình tại chuyên đề "${concept?.name}".`;
      } else if (recencyScore > 0.7) {
        // Ebbinghaus spaced repetition memory retention
        explanationText = `Bạn đã lâu chưa ôn lại chuyên đề "${concept?.name}". Ôn tập định kỳ giúp bạn ghi nhớ sâu và phản xạ nhanh hơn trong phòng thi.`;
      } else {
        // Zone of Proximal Development (ZPD) gradual challenge step
        explanationText = `Độ khó được nâng lên vừa sức nhằm thử thách và mở rộng khả năng vận dụng chuyên đề "${concept?.name}" của bạn.`;
      }

      return {
        question: q,
        score: finalScore,
        verifiedMastery,
        importance,
        originalIndex,
        reasons: {
          weaknessScore,
          recencyScore,
          difficultyFitScore,
          importanceScore: importance,
          textExplanation: explanationText,
        },
      };
    });

    scored.sort((a, b) => {
      if (learningMode === 'structured') {
        const indexA = CONCEPTS_LIST.findIndex((concept) => concept.id === a.question.conceptId);
        const indexB = CONCEPTS_LIST.findIndex((concept) => concept.id === b.question.conceptId);
        if (indexA !== indexB) return indexA - indexB;
        const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
        const difficultyDiff = difficultyOrder[a.question.difficulty] -
          difficultyOrder[b.question.difficulty];
        return difficultyDiff || a.originalIndex - b.originalIndex;
      }
      if (learningMode === 'focus_weak') {
        if (a.verifiedMastery && b.verifiedMastery) {
          return a.verifiedMastery.masteryScore - b.verifiedMastery.masteryScore;
        }
        if (a.verifiedMastery) return -1;
        if (b.verifiedMastery) return 1;
        return b.importance - a.importance || b.score - a.score;
      }
      return b.score - a.score;
    });
    return scored.slice(0, limit).map(({ question, score, reasons }) => ({
      question,
      score,
      reasons,
    }));
  }

  /**
   * Tạo Lộ trình Học tập Cá nhân hóa 7 ngày (7-Day Adaptive Learning Roadmap)
   */
  public static generate7DayLearningPath(
    masteries: Record<string, StudentMastery>,
    learningMode: LearningMode = 'smart_review'
  ): LearningPathDay[] {
    // Each mode only changes prioritization; the curriculum and daily schedule remain shared.
    const sortedConcepts = [...CONCEPTS_LIST].sort((a, b) => {
      const masteryA = getVerifiedMastery(masteries, a.id);
      const masteryB = getVerifiedMastery(masteries, b.id);
      if (learningMode === 'structured') {
        return CONCEPTS_LIST.indexOf(a) - CONCEPTS_LIST.indexOf(b);
      }
      if (learningMode === 'smart_review') {
        if (masteryA && masteryB) {
          return new Date(masteryA.nextSpacedReviewAt).getTime() -
            new Date(masteryB.nextSpacedReviewAt).getTime();
        }
        if (masteryA) return -1;
        if (masteryB) return 1;
        return CONCEPTS_LIST.indexOf(a) - CONCEPTS_LIST.indexOf(b);
      }
      if (masteryA && masteryB) return masteryA.masteryScore - masteryB.masteryScore;
      if (masteryA) return -1;
      if (masteryB) return 1;
      return b.importanceWeight - a.importanceWeight;
    });

    const path: LearningPathDay[] = [];
    const titles = [
      'Học kiến thức cốt lõi',
      'Luyện tập khái niệm',
      'Thực hành kỹ năng vận dụng',
      'Luyện tập dạng câu hỏi',
      'Thực hành tổng hợp',
      'Ôn tập theo chuyên đề',
      'Tự đánh giá kiến thức',
    ];

    for (let day = 1; day <= 7; day++) {
      const concept = sortedConcepts[(day - 1) % sortedConcepts.length];
      const mastery = getVerifiedMastery(masteries, concept.id);
      const learningGoal = learningMode === 'structured'
        ? `Học theo trình tự chương trình tại chuyên đề ${concept.topicName}.`
        : learningMode === 'focus_weak' && mastery
          ? `Ưu tiên củng cố chuyên đề ${concept.topicName} dựa trên kết quả đã ghi nhận.`
          : learningMode === 'smart_review' && mastery
            ? `Ôn lại chuyên đề ${concept.topicName} theo lịch ôn tập đã ghi nhận.`
            : `Luyện tập chuyên đề ${concept.topicName} để bổ sung dữ liệu học tập gắn với tài khoản này.`;

      path.push({
        dayNumber: day,
        title: `Ngày ${day}: ${titles[day - 1]}`,
        focusConceptId: concept.id,
        conceptName: concept.name,
        targetMinutes: day === 7 ? 25 : 15,
        status: day === 1 ? 'in_progress' : 'upcoming',
        questionCount: day === 7 ? 10 : 5,
        learningGoal,
      });
    }

    return path;
  }
}
