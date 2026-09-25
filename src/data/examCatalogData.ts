import { ExamBlueprint, Question, ExamTrack } from '../types';
import { OFFICIAL_EXAM_BLUEPRINT_2025 } from './curriculumData';

export type ExamCategory = 'national_standard' | 'test_45m' | 'test_15m' | 'survey' | 'custom';
export type ExamDifficulty = 'standard' | 'basic' | 'advanced' | 'comprehensive';

export interface ExamCatalogItem {
  id: string;
  title: string;
  subtitle: string;
  category: ExamCategory;
  durationMinutes: number;
  totalQuestions: number;
  totalScore: number;
  section1Count: number; // Single choice 4 options
  section2Count: number; // True/False 4 sub-statements hoặc Tự chọn
  difficulty: ExamDifficulty;
  difficultyLabel: string;
  topicName: string;
  status: 'open' | 'upcoming' | 'closed';
  openDate: string;
  closeDate: string;
  targetGrade: 10 | 11 | 12 | 'all';
  isFeatured?: boolean;
  isCustom?: boolean;
  hasElectiveTracks?: boolean; // true nếu có phân ban tự chọn CS/ICT
  blueprint: ExamBlueprint;
  attemptsCount: number;
  averageScore: number;
  questionSource?: 'bank_shuffle' | 'upload_custom';
  shuffledVariantsCount?: number;
  sourceFileName?: string;
  questions?: Question[];
}

export interface ExamAttemptRecord {
  id: string;
  examId: string;
  examTitle: string;
  category: ExamCategory;
  dateTaken: string; // ISO string or human formatted
  score: number; // e.g. 8.25
  maxScore: number; // 10.0
  totalQuestions: number;
  correctCount: number;
  durationSeconds: number; // Time spent
  accuracy: number; // Percentage, e.g. 82
  trendDiff?: number; // e.g. +0.75 compared to previous attempt
  sessionData?: any; // To load in ExamReview
  studentTrack?: ExamTrack;
  mandatoryScore?: number;
  electiveScore?: number;
}

export interface ClassStudentExamResult {
  studentId: string;
  studentName: string;
  className: string;
  examId: string;
  examTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  status: 'completed' | 'in_progress' | 'not_started';
}

// Blueprints for auxiliary exams
export const BLUEPRINT_SQL_15M: ExamBlueprint = {
  id: 'BLUEPRINT_SQL_15M',
  title: 'Kiểm tra 15 phút - Truy vấn SQL & RDBMS',
  academicYear: 2025,
  durationMinutes: 15,
  totalQuestions: 10,
  totalScore: 10.0,
  sections: {
    sectionI: {
      name: 'Phần I: Trắc nghiệm 4 lựa chọn',
      questionCount: 10,
      scorePerQuestion: 1.0,
    },
    sectionII: {
      name: 'Phần II: Đúng/Sai',
      questionCount: 0,
      scoringRules: { oneCorrect: 0, twoCorrect: 0, threeCorrect: 0, fourCorrect: 0 },
    },
  },
  topicDistribution: { 'Ngôn ngữ truy vấn SQL': 6, 'Cơ sở dữ liệu quan hệ (RDBMS)': 4 },
};

export const BLUEPRINT_AI_45M: ExamBlueprint = {
  id: 'BLUEPRINT_AI_45M',
  title: 'Kiểm tra 1 tiết - Trí tuệ nhân tạo (AI) & Học máy',
  academicYear: 2025,
  durationMinutes: 45,
  totalQuestions: 20,
  totalScore: 10.0,
  sections: {
    sectionI: {
      name: 'Phần I: Trắc nghiệm 4 lựa chọn (16 câu - 6.4 điểm)',
      questionCount: 16,
      scorePerQuestion: 0.4,
    },
    sectionII: {
      name: 'Phần II: Câu hỏi Đúng/Sai (4 câu - 3.6 điểm)',
      questionCount: 4,
      scoringRules: { oneCorrect: 0.09, twoCorrect: 0.225, threeCorrect: 0.45, fourCorrect: 0.9 },
    },
  },
  topicDistribution: { 'Trí tuệ nhân tạo (AI) & Học máy': 14, 'Đạo đức, Pháp luật & Văn hóa số': 6 },
};

export const BLUEPRINT_WEB_45M: ExamBlueprint = {
  id: 'BLUEPRINT_WEB_45M',
  title: 'Kiểm tra 1 tiết - Thiết kế Web HTML5 & CSS3',
  academicYear: 2025,
  durationMinutes: 45,
  totalQuestions: 20,
  totalScore: 10.0,
  sections: {
    sectionI: {
      name: 'Phần I: Trắc nghiệm 4 lựa chọn',
      questionCount: 16,
      scorePerQuestion: 0.4,
    },
    sectionII: {
      name: 'Phần II: Đúng/Sai',
      questionCount: 4,
      scoringRules: { oneCorrect: 0.09, twoCorrect: 0.225, threeCorrect: 0.45, fourCorrect: 0.9 },
    },
  },
  topicDistribution: { 'Thiết kế & Phát triển trang Web': 18, 'Mạng máy tính & Giao thức truyền thông': 2 },
};

export const BLUEPRINT_SEMESTER_PYTHON: ExamBlueprint = {
  id: 'BLUEPRINT_SEMESTER_PYTHON',
  title: 'Kiểm tra học kỳ I - Lập trình Python & Cấu trúc dữ liệu',
  academicYear: 2025,
  durationMinutes: 45,
  totalQuestions: 24,
  totalScore: 10.0,
  sections: {
    sectionI: {
      name: 'Phần I: Trắc nghiệm 4 lựa chọn (20 câu - 7.0 điểm)',
      questionCount: 20,
      scorePerQuestion: 0.35,
    },
    sectionII: {
      name: 'Phần II: Đúng/Sai (4 câu - 3.0 điểm)',
      questionCount: 4,
      scoringRules: { oneCorrect: 0.075, twoCorrect: 0.187, threeCorrect: 0.375, fourCorrect: 0.75 },
    },
  },
  topicDistribution: { 'Lập trình Python căn bản': 20, 'Hệ điều hành & Quản lý tài nguyên': 4 },
};

export const BLUEPRINT_NETWORK_SURVEY: ExamBlueprint = {
  id: 'BLUEPRINT_NETWORK_SURVEY',
  title: 'Khảo sát năng lực - Mạng máy tính & An toàn thông tin số',
  academicYear: 2025,
  durationMinutes: 20,
  totalQuestions: 15,
  totalScore: 10.0,
  sections: {
    sectionI: {
      name: 'Phần I: Trắc nghiệm 4 lựa chọn (15 câu - 10.0 điểm)',
      questionCount: 15,
      scorePerQuestion: 0.667,
    },
    sectionII: {
      name: 'Phần II: Đúng/Sai',
      questionCount: 0,
      scoringRules: { oneCorrect: 0, twoCorrect: 0, threeCorrect: 0, fourCorrect: 0 },
    },
  },
  topicDistribution: { 'Mạng máy tính & Giao thức truyền thông': 9, 'Đạo đức, Pháp luật & Văn hóa số': 6 },
};

// Initial catalog of exams
export const INITIAL_EXAMS_CATALOG: ExamCatalogItem[] = [
  {
    id: 'exam-thpt-2025-std',
    title: 'Phòng Thi Chuẩn Hóa Môn Tin Học (THPT 2025)',
    subtitle: 'Chuẩn BGDĐT 2025: 24 câu trắc nghiệm + 2 câu Đúng/Sai chung + 2 câu Đúng/Sai tự chọn theo định hướng (10.0đ)',
    category: 'national_standard',
    durationMinutes: 50,
    totalQuestions: 28, // 24 trắc nghiệm + 2 Đúng/Sai chung + 2 Đúng/Sai tự chọn
    totalScore: 10.0,
    section1Count: 24,
    section2Count: 2,
    hasElectiveTracks: true,
    difficulty: 'standard',
    difficultyLabel: 'Chuẩn BGDĐT (24 TN + 2 Đ/S chung + 2 Đ/S tự chọn)',
    topicName: 'Tổng hợp toàn diện kiến thức THPT GDPT 2018',
    status: 'open',
    openDate: '2026-09-01',
    closeDate: '2026-12-31',
    targetGrade: 12,
    isFeatured: true,
    blueprint: OFFICIAL_EXAM_BLUEPRINT_2025,
    attemptsCount: 1420,
    averageScore: 7.45,
  },
  {
    id: 'exam-sql-15m',
    title: 'Kiểm tra 15 phút - Chủ đề SQL & Hệ QTCSDL Quan Hệ',
    subtitle: 'Đánh giá kỹ năng viết truy vấn SELECT, JOIN, GROUP BY và toàn vẹn dữ liệu',
    category: 'test_15m',
    durationMinutes: 15,
    totalQuestions: 10,
    totalScore: 10.0,
    section1Count: 10,
    section2Count: 0,
    difficulty: 'advanced',
    difficultyLabel: 'Vận dụng (8+)',
    topicName: 'Ngôn ngữ truy vấn SQL & RDBMS',
    status: 'open',
    openDate: '2026-09-10',
    closeDate: '2026-10-15',
    targetGrade: 11,
    blueprint: BLUEPRINT_SQL_15M,
    attemptsCount: 856,
    averageScore: 7.9,
  },
  {
    id: 'exam-ai-45m',
    title: 'Kiểm tra 1 tiết (45 phút) - Trí tuệ nhân tạo (AI) & Học máy',
    subtitle: 'Khảo sát khái niệm AI, Deep Learning, ứng dụng nhận dạng và đạo đức AI trong đời sống',
    category: 'test_45m',
    durationMinutes: 45,
    totalQuestions: 20,
    totalScore: 10.0,
    section1Count: 16,
    section2Count: 4,
    difficulty: 'standard',
    difficultyLabel: 'Thông hiểu & Vận dụng',
    topicName: 'Trí tuệ nhân tạo (AI) & Học máy',
    status: 'open',
    openDate: '2026-09-15',
    closeDate: '2026-10-30',
    targetGrade: 12,
    blueprint: BLUEPRINT_AI_45M,
    attemptsCount: 624,
    averageScore: 7.6,
  },
  {
    id: 'exam-web-45m',
    title: 'Kiểm tra 1 tiết - Thiết kế Web & HTML5 / CSS3',
    subtitle: 'Kỹ thuật cấu trúc thẻ HTML semantic, bảng form, bố cục CSS Flexbox và liên kết web',
    category: 'test_45m',
    durationMinutes: 45,
    totalQuestions: 20,
    totalScore: 10.0,
    section1Count: 16,
    section2Count: 4,
    difficulty: 'basic',
    difficultyLabel: 'Nhận biết & Thông hiểu',
    topicName: 'Thiết kế & Phát triển trang Web',
    status: 'open',
    openDate: '2026-09-05',
    closeDate: '2026-11-01',
    targetGrade: 12,
    blueprint: BLUEPRINT_WEB_45M,
    attemptsCount: 712,
    averageScore: 8.1,
  },
  {
    id: 'exam-python-semester',
    title: 'Kiểm tra học kỳ I - Lập trình Python & Cấu trúc dữ liệu',
    subtitle: 'Đánh giá tư duy thuật toán, vòng lặp, xử lý danh sách, chuỗi và hàm trong Python',
    category: 'test_45m',
    durationMinutes: 45,
    totalQuestions: 24,
    totalScore: 10.0,
    section1Count: 20,
    section2Count: 4,
    difficulty: 'comprehensive',
    difficultyLabel: 'Tổng hợp phân hóa',
    topicName: 'Lập trình Python căn bản',
    status: 'open',
    openDate: '2026-09-12',
    closeDate: '2026-11-15',
    targetGrade: 11,
    blueprint: BLUEPRINT_SEMESTER_PYTHON,
    attemptsCount: 940,
    averageScore: 7.25,
  },
  {
    id: 'exam-network-survey',
    title: 'Khảo sát năng lực - Mạng máy tính & An toàn thông tin số',
    subtitle: 'Đánh giá kiến thức giao thức mạng TCP/IP, địa chỉ IP, bảo mật và phòng chống lừa đảo số',
    category: 'survey',
    durationMinutes: 20,
    totalQuestions: 15,
    totalScore: 10.0,
    section1Count: 15,
    section2Count: 0,
    difficulty: 'basic',
    difficultyLabel: 'Cơ bản - Đại trà',
    topicName: 'Mạng máy tính & Đạo đức số',
    status: 'open',
    openDate: '2026-09-01',
    closeDate: '2026-12-31',
    targetGrade: 'all',
    blueprint: BLUEPRINT_NETWORK_SURVEY,
    attemptsCount: 1105,
    averageScore: 8.4,
  },
];

// Initial mock exam history for student
export const INITIAL_STUDENT_EXAM_HISTORY: ExamAttemptRecord[] = [
  {
    id: 'attempt-1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa Môn Tin Học (THPT 2025)',
    category: 'national_standard',
    dateTaken: '2026-09-18T14:35:00.000Z',
    score: 8.25,
    maxScore: 10.0,
    totalQuestions: 28,
    correctCount: 22,
    durationSeconds: 2355, // ~39 phút 15 giây
    accuracy: 84.6,
    trendDiff: 0.75,
  },
  {
    id: 'attempt-2',
    examId: 'exam-sql-15m',
    examTitle: 'Kiểm tra 15 phút - Chủ đề SQL & Hệ QTCSDL',
    category: 'test_15m',
    dateTaken: '2026-09-15T09:20:00.000Z',
    score: 9.0,
    maxScore: 10.0,
    totalQuestions: 10,
    correctCount: 9,
    durationSeconds: 700, // ~11 phút 40 giây
    accuracy: 90.0,
    trendDiff: 1.0,
  },
  {
    id: 'attempt-3',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa Môn Tin Học (THPT 2025)',
    category: 'national_standard',
    dateTaken: '2026-09-10T16:10:00.000Z',
    score: 7.5,
    maxScore: 10.0,
    totalQuestions: 28,
    correctCount: 20,
    durationSeconds: 2645, // ~44 phút 05 giây
    accuracy: 76.9,
  },
  {
    id: 'attempt-4',
    examId: 'exam-ai-45m',
    examTitle: 'Kiểm tra 1 tiết (45 phút) - Trí tuệ nhân tạo (AI)',
    category: 'test_45m',
    dateTaken: '2026-09-06T10:45:00.000Z',
    score: 8.5,
    maxScore: 10.0,
    totalQuestions: 20,
    correctCount: 17,
    durationSeconds: 2240, // ~37 phút 20 giây
    accuracy: 85.0,
    trendDiff: 0.5,
  },
];

// Initial mock class student exam results for Teacher/Admin view
export const INITIAL_CLASS_EXAM_RESULTS: ClassStudentExamResult[] = [
  {
    studentId: 'hs-01',
    studentName: 'Nguyễn Văn An',
    className: '12A1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 8.75,
    correctCount: 23,
    totalQuestions: 28,
    durationSeconds: 2410,
    submittedAt: '2026-09-19 15:40',
    status: 'completed',
  },
  {
    studentId: 'hs-02',
    studentName: 'Trần Thị Bích',
    className: '12A1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 9.25,
    correctCount: 24,
    totalQuestions: 28,
    durationSeconds: 2280,
    submittedAt: '2026-09-19 15:35',
    status: 'completed',
  },
  {
    studentId: 'hs-03',
    studentName: 'Lê Hoàng Cường',
    className: '12A1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 6.75,
    correctCount: 18,
    totalQuestions: 28,
    durationSeconds: 2890,
    submittedAt: '2026-09-19 15:48',
    status: 'completed',
  },
  {
    studentId: 'hs-04',
    studentName: 'Phạm Minh Đức',
    className: '12A1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 9.5,
    correctCount: 25,
    totalQuestions: 28,
    durationSeconds: 2150,
    submittedAt: '2026-09-19 15:30',
    status: 'completed',
  },
  {
    studentId: 'hs-05',
    studentName: 'Hoàng Thị Giang',
    className: '12A1',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 7.5,
    correctCount: 20,
    totalQuestions: 28,
    durationSeconds: 2710,
    submittedAt: '2026-09-19 15:45',
    status: 'completed',
  },
  {
    studentId: 'hs-06',
    studentName: 'Đặng Quốc Huy',
    className: '12A2',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 8.0,
    correctCount: 21,
    totalQuestions: 28,
    durationSeconds: 2540,
    submittedAt: '2026-09-19 15:42',
    status: 'completed',
  },
  {
    studentId: 'hs-07',
    studentName: 'Vũ Ngọc Khánh',
    className: '12A2',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 5.5,
    correctCount: 14,
    totalQuestions: 28,
    durationSeconds: 2950,
    submittedAt: '2026-09-19 15:50',
    status: 'completed',
  },
  {
    studentId: 'hs-08',
    studentName: 'Bùi Lan Phương',
    className: '12A2',
    examId: 'exam-thpt-2025-std',
    examTitle: 'Phòng Thi Chuẩn Hóa THPT 2025',
    score: 8.25,
    correctCount: 22,
    totalQuestions: 28,
    durationSeconds: 2480,
    submittedAt: '2026-09-19 15:38',
    status: 'completed',
  },
];
