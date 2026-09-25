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
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { SAMPLE_QUESTION_BANK } from '../data/questionBank';

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

  /**
   * Động cơ Đề xuất Câu hỏi Thích ứng (Recommendation Engine)
   */
  public static getAdaptiveRecommendations(
    masteries: Record<string, StudentMastery>,
    availableQuestions: Question[] = SAMPLE_QUESTION_BANK,
    limit: number = 5,
    excludeQuestionIds: string[] = []
  ): AdaptiveRecommendation[] {
    const candidates = availableQuestions.filter((q) => !excludeQuestionIds.includes(q.id));

    const scored = candidates.map((q) => {
      const mastery = masteries[q.conceptId]?.masteryScore ?? 0.5;
      const concept = CONCEPTS_LIST.find((c) => c.id === q.conceptId);
      const importance = concept?.importanceWeight ?? 0.8;

      // 1. Weakness Score (Càng yếu điểm càng cao)
      const weaknessScore = 1.0 - mastery;

      // 2. Recency Score (Đã lâu chưa ôn hoặc đến hạn spaced repetition)
      let recencyScore = 0.5;
      const lastPracticed = masteries[q.conceptId]?.lastPracticedAt;
      if (lastPracticed) {
        const daysSince = (Date.now() - new Date(lastPracticed).getTime()) / (1000 * 3600 * 24);
        recencyScore = Math.min(1.0, daysSince / 4);
      } else {
        recencyScore = 0.9; // Chưa bao giờ làm
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

      // Xây dựng lời giải thích tường minh (Explainability for students; underlying logic: ZPD & Ebbinghaus curve)
      let explanationText = '';
      if (mastery < 0.5) {
        explanationText = `Khái niệm "${concept?.name}" của bạn hiện đạt ${Math.round(mastery * 100)}% (thuộc nhóm điểm cần củng cố). Câu hỏi này ở mức ${q.difficulty === 'easy' ? 'Cơ bản' : 'Vừa sức'} giúp bạn xây dựng nền tảng vững chắc.`;
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
        reasons: {
          weaknessScore,
          recencyScore,
          difficultyFitScore,
          importanceScore: importance,
          textExplanation: explanationText,
        },
      };
    });

    // Sắp xếp điểm ưu tiên từ cao xuống thấp
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Tạo Lộ trình Học tập Cá nhân hóa 7 ngày (7-Day Adaptive Learning Roadmap)
   */
  public static generate7DayLearningPath(
    masteries: Record<string, StudentMastery>
  ): LearningPathDay[] {
    // Sắp xếp các khái niệm từ yếu nhất đến mạnh nhất
    const sortedConcepts = [...CONCEPTS_LIST].sort((a, b) => {
      const scoreA = masteries[a.id]?.masteryScore ?? 0.5;
      const scoreB = masteries[b.id]?.masteryScore ?? 0.5;
      return scoreA - scoreB;
    });

    const path: LearningPathDay[] = [];
    const titles = [
      'Củng cố Lỗ hổng Cốt lõi',
      'Luyện phản xạ Khái niệm',
      'Đột phá Kỹ năng Vận dụng',
      'Giải quyết Bẫy đề thi THPT',
      'Thực hành Tổng hợp Đa chuyên đề',
      'Ôn tập Ngắt quãng Ebbinghaus',
      'Mini Assessment - Đo lường Tiến bộ',
    ];

    for (let day = 1; day <= 7; day++) {
      const concept = sortedConcepts[(day - 1) % sortedConcepts.length];
      const currentScore = Math.round((masteries[concept.id]?.masteryScore ?? 0.5) * 100);

      path.push({
        dayNumber: day,
        title: `Ngày ${day}: ${titles[day - 1]}`,
        focusConceptId: concept.id,
        conceptName: concept.name,
        targetMinutes: day === 7 ? 25 : 15,
        status: day === 1 ? 'in_progress' : 'upcoming',
        questionCount: day === 7 ? 10 : 5,
        learningGoal: `Nâng mức làm chủ từ ${currentScore}% lên mục tiêu ${Math.min(95, currentScore + 15)}% với trọng tâm chuyên đề ${concept.topicName}.`,
      });
    }

    return path;
  }
}
