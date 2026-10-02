/**
 * Data Models and Types for TinMaster
 * Nền tảng học tập thích ứng luyện thi THPT Tin học
 */

export type UserRole = 'student' | 'teacher' | 'admin';

export type ResearchGroup = 'adaptive' | 'control' | 'unassigned';

// Định hướng thi THPT: Khoa học máy tính (CS) hoặc Tin học ứng dụng (ICT)
export type ExamTrack = 'CS' | 'ICT';

export const EXAM_TRACK_LABELS: Record<ExamTrack, { code: ExamTrack; title: string; subtitle: string; desc: string }> = {
  CS: {
    code: 'CS',
    title: 'Khoa học máy tính (CS)',
    subtitle: 'Computer Science Track',
    desc: 'Trọng tâm thuật toán, cấu trúc dữ liệu, lập trình Python & hệ cơ sở dữ liệu quan hệ SQL.',
  },
  ICT: {
    code: 'ICT',
    title: 'Tin học ứng dụng / Khoa học ứng dụng (ICT)',
    subtitle: 'Applied Informatics / Computer Applications',
    desc: 'Trọng tâm mạng máy tính & Internet, thiết bị số Smart Home, thiết kế Web & ứng dụng số.',
  },
};

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  school?: string;
  grade?: 10 | 11 | 12;
  researchGroup: ResearchGroup;
  examTrack?: ExamTrack | null; // Định hướng thi đã đăng ký
  xp: number;
  streakDays: number;
  targetScore: number;
  completedQuestionsCount: number;
  totalStudyMinutes: number;
}

// 4 Cấp độ tư duy theo ma trận BGDĐT
export type CognitiveLevel = 'knowledge' | 'comprehension' | 'application' | 'high_application';

export const COGNITIVE_LEVEL_LABELS: Record<CognitiveLevel, string> = {
  knowledge: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
  high_application: 'Vận dụng cao',
};

// Phân loại độ khó
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// 3 Mạch kiến thức chương trình GDPT 2018
export type CurriculumStrand = 'DL' | 'ICT' | 'CS';

export const STRAND_LABELS: Record<CurriculumStrand, { code: string; title: string; desc: string }> = {
  DL: { code: 'DL', title: 'Học vấn số hóa phổ thông', desc: 'Đạo đức, văn hóa mạng, an toàn số' },
  ICT: { code: 'ICT', title: 'Công nghệ thông tin & truyền thông', desc: 'Phần mềm, hệ điều hành, mạng máy tính' },
  CS: { code: 'CS', title: 'Khoa học máy tính', desc: 'Thuật toán, lập trình Python, CSDL SQL, HTML/CSS, Trí tuệ nhân tạo' },
};

// Khái niệm trong Bản đồ tri thức (Knowledge Map)
export interface ConceptNode {
  id: string;
  topicId: string;
  topicName: string;
  name: string;
  grade: 10 | 11 | 12;
  strand: CurriculumStrand;
  description: string;
  prerequisites: string[]; // IDs của các khái niệm tiên quyết
  importanceWeight: number; // 0.0 - 1.0 (trọng số trong đề thi BGDĐT)
  subconcepts: string[];
}

export interface StudentMastery {
  conceptId: string;
  masteryScore: number; // 0.0 -> 1.0 (hoặc 0 - 100%)
  confidenceScore: number; // 0.0 -> 1.0
  totalAttempts: number;
  correctAttempts: number;
  consecutiveSuccessStreak: number;
  lastPracticedAt: string; // ISO timestamp
  nextSpacedReviewAt: string; // ISO timestamp
  trend: 'improving' | 'stable' | 'declining';
}

// Loại câu hỏi theo chuẩn cấu trúc Đề thi TN THPT từ năm 2025
export type QuestionType = 'single_choice' | 'true_false_multistatement';

export interface SingleChoiceOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
  distractorExplanation?: string;
}

export interface TrueFalseStatement {
  subOrder: 'a' | 'b' | 'c' | 'd';
  statementText: string;
  isCorrect: boolean;
  explanation: string;
}

export interface Question {
  id: string;
  questionType: QuestionType;
  stem: string; // Đề bài
  codeSnippet?: {
    language: 'python' | 'sql' | 'html' | 'css' | 'pseudo';
    code: string;
  };
  diagramDesc?: string;
  conceptId: string;
  topicId: string;
  grade: 10 | 11 | 12;
  strand: CurriculumStrand;
  cognitiveLevel: CognitiveLevel;
  difficulty: DifficultyLevel;
  estimatedTimeSec: number;
  competencyCode: string; // e.g. 'NLa', 'NLc', 'NLe'
  // Phân loại phạm vi phần thi & định hướng:
  sectionScope?: 'mandatory' | 'mandatory_tf' | 'elective'; // 'mandatory' (TN bắt buộc) | 'mandatory_tf' (Đúng/Sai chung) | 'elective' (Tự chọn)
  track?: ExamTrack | 'ALL'; // 'CS' | 'ICT' | 'ALL'
  // Tùy theo loại câu hỏi:
  singleChoiceOptions?: SingleChoiceOption[];
  trueFalseStatements?: TrueFalseStatement[];
  explanation: string;
  keyTakeaway: string;
  source: string; // e.g. 'Đề minh họa 2025 BGDĐT', 'SGK Tin 11 CS KNTT'
  sourceYear: number;
  isVerified: boolean;
}

// Ma trận cấu trúc đề thi (Configurable Blueprint)
export interface ExamBlueprint {
  id: string;
  title: string;
  academicYear: number;
  durationMinutes: number; // 50 phút chuẩn BGDĐT
  totalQuestions: number;  // 28 câu (24 TN + 2 Đ/S chung + 2 Đ/S tự chọn) hoặc tùy biến
  totalScore: number;      // 10.0
  hasElectiveTracks?: boolean; // true nếu có phân luồng CS / ICT
  sections: {
    sectionI: {
      name: string;
      questionCount: number; // 24 câu trắc nghiệm đơn (6.0 điểm)
      scorePerQuestion: number; // 0.25
      totalScore?: number; // 6.0
    };
    sectionII: {
      name: string;
      questionCount: number; // 2 câu đúng sai CHUNG cho tất cả thí sinh
      totalScore?: number; // 2.0 điểm
      scorePerQuestion?: number; // 1.0 điểm mỗi câu
      scoringRules?: {
        oneCorrect: number;   // 0.1
        twoCorrect: number;   // 0.25
        threeCorrect: number; // 0.5
        fourCorrect: number;  // 1.0
      };
    };
    sectionIII?: {
      name: string;
      questionCount: number; // Tổng số câu tự chọn (2 câu mỗi thí sinh theo track)
      electivePerStudentCount?: number; // 2 câu cho mỗi thí sinh
      totalScore?: number; // 2.0 điểm
      scorePerQuestion?: number; // 1.0 điểm mỗi câu
      // Thang điểm lũy tiến BGDĐT thang 1.0đ:
      scoringRules?: {
        oneCorrect: number;   // 0.1
        twoCorrect: number;   // 0.25
        threeCorrect: number; // 0.5
        fourCorrect: number;  // 1.0
      };
      tracks?: {
        CS?: { name: string; questionCount: number };
        ICT?: { name: string; questionCount: number };
      };
    };
  };
  topicDistribution: Record<string, number>;
}

// Hành vi tương tác ghi vết (Telemetry)
export type InteractionQuadrant = 'fast_correct' | 'slow_correct' | 'fast_incorrect' | 'slow_incorrect';

export interface QuestionAttemptTelemetry {
  questionId: string;
  startTime: number;
  firstInteractionTime?: number;
  answerChangesCount: number;
  activeTimeSec: number;
  revisited: boolean;
  markedForReview: boolean;
  userAnswer: string | Record<string, boolean>; // 'A' or { a: true, b: false, c: true, d: false }
  isCorrect: boolean;
  scoreAwarded: number;
  quadrant: InteractionQuadrant;
  hesitationScore: number; // Tỉ lệ độ ngập ngừng
  detectedPattern?: string;
}

export interface ExamSession {
  id: string;
  blueprintId: string;
  examTitle: string;
  startedAt: string;
  submittedAt?: string;
  durationSeconds: number;
  timeRemainingSeconds: number;
  isCompleted: boolean;
  totalScore: number;
  totalCorrect: number;
  questionTelemetries: Record<string, QuestionAttemptTelemetry>;
  // Phân rã điểm theo định hướng:
  studentTrack?: ExamTrack;
  mandatoryScore?: number;
  mandatoryMaxScore?: number;
  electiveScore?: number;
  electiveMaxScore?: number;
}

// Adaptive Recommendation
export interface AdaptiveRecommendation {
  question: Question;
  score: number;
  reasons: {
    weaknessScore: number;
    recencyScore: number;
    difficultyFitScore: number;
    importanceScore: number;
    textExplanation: string;
  };
}

export interface AdaptivePracticeResult {
  question: Question;
  isCorrect: boolean;
  scoreRatio: number;
  activeTimeSec: number;
}

export interface LearningPathDay {
  dayNumber: number;
  title: string;
  focusConceptId: string;
  conceptName: string;
  targetMinutes: number;
  status: 'completed' | 'in_progress' | 'upcoming';
  questionCount: number;
  learningGoal: string;
}

// AI Video Lesson Script
export interface VideoStoryboardScene {
  sceneNumber: number;
  durationSeconds: number;
  title: string;
  visualDescription: string;
  codeSnippet?: string;
  narrationVoiceover: string;
  keyHighlight: string;
}

export interface VideoLessonScript {
  conceptId: string;
  conceptName: string;
  targetDurationMinutes: number;
  learningObjective: string;
  scenes: VideoStoryboardScene[];
  miniQuiz: {
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}
