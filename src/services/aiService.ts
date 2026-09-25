/**
 * AI Pedagogical Service for TinMaster
 * Tích hợp Trí tuệ Nhân tạo hỗ trợ Sư phạm & Cá nhân hóa
 */

import { Question, VideoLessonScript } from '../types';

export class AIPedagogicalService {
  /**
   * Giải thích chi tiết câu hỏi & chẩn đoán nguyên nhân lỗi sai
   */
  public static async explainQuestion(
    question: Question,
    userAnswer: string | Record<string, boolean> | undefined,
    conceptName: string,
    studentScore: number
  ): Promise<{
    explanation: string;
    misconceptionDiagnosis: string;
    studyTips: string[];
    isAiGenerated: boolean;
  }> {
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          userAnswer,
          conceptName,
          studentScore,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          explanation: data.explanation,
          misconceptionDiagnosis: data.misconceptionDiagnosis,
          studyTips: data.studyTips || [],
          isAiGenerated: true,
        };
      }
    } catch {
      // Fallback khi chạy offline hoặc server chưa kết nối
    }

    // Heuristic Fallback sư phạm chất lượng cao
    return {
      explanation: question.explanation,
      misconceptionDiagnosis: `Dựa trên phân tích tương tác, có thể bạn đang gặp hiện tượng nhầm lẫn giữa định nghĩa lý thuyết và tình huống áp dụng thực tế ở chuyên đề ${conceptName}. Hãy chú ý các từ khóa bẫy trong đề bài.`,
      studyTips: [
        `Ghi nhớ trọng tâm: ${question.keyTakeaway}`,
        `Đọc kỹ câu lệnh hỏi (chú ý từ ĐÚNG, SAI, KHÔNG PHẢI trong đề thi BGDĐT)`,
        `Làm lại câu hỏi tương tự sau 2 ngày theo chu kỳ ôn tập ngắt quãng`,
      ],
      isAiGenerated: false,
    };
  }

  /**
   * Tạo Kịch bản Video Bài giảng Cá nhân hóa (Scene-by-scene Storyboard)
   */
  public static async generateVideoLessonScript(
    conceptId: string,
    conceptName: string,
    topicName: string
  ): Promise<VideoLessonScript> {
    try {
      const res = await fetch('/api/ai/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptId, conceptName, topicName }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scenes && data.scenes.length > 0) {
          return data;
        }
      }
    } catch {
      // Fallback to structured pedagogical storyboard
    }

    // Default High-Quality Pedagogical Storyboard
    return {
      conceptId,
      conceptName,
      targetDurationMinutes: 3,
      learningObjective: `Nắm vững bản chất cốt lõi của ${conceptName}, xử lý gọn các câu hỏi mức độ Vận dụng trong Đề thi Tốt nghiệp THPT Tin học.`,
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 25,
          title: 'Phân cảnh 1: Đặt vấn đề & Tình huống thực tế',
          visualDescription: `Hiển thị slide hoạt họa sinh động: Tình huống phát sinh bài toán trong môi trường thực tiễn liên quan đến ${topicName}.`,
          narrationVoiceover: `Chào các bạn học sinh 2k7! Trong cấu trúc đề thi tốt nghiệp THPT môn Tin học, phần ${conceptName} thường là điểm phân hóa điểm 8+. Hôm nay chúng ta sẽ cùng giải mã bản chất trong đúng 3 phút.`,
          keyHighlight: `Trọng tâm đề thi: ${conceptName}`,
        },
        {
          sceneNumber: 2,
          durationSeconds: 65,
          title: 'Phân cảnh 2: Khám phá Bản chất & Cơ chế hoạt động',
          visualDescription: `Sơ đồ đồ họa chuyển động minh họa các thành phần cấu tạo, mũi tên luồng dữ liệu và quy tắc ngữ nghĩa.`,
          codeSnippet: conceptId.includes('SQL')
            ? 'SELECT TenHS, Diem\nFROM HOCSINH\nWHERE Diem >= 8.0\nORDER BY Diem DESC;'
            : conceptId.includes('WEB')
            ? '<div class="card">\n  <h2>Tiêu đề</h2>\n  <p>Nội dung</p>\n</div>'
            : 'def solve(arr):\n    return [x for x in arr if x > 0]',
          narrationVoiceover: `Hãy quan sát cơ chế hoạt động. Thay vì ghi nhớ máy móc từng câu lệnh, bạn cần nắm vững luồng xử lý dữ liệu từng bước. Hãy chú ý điều kiện biên và cách hệ thống thực thi.`,
          keyHighlight: 'Hiểu bản chất thay vì học vẹt cú pháp',
        },
        {
          sceneNumber: 3,
          durationSeconds: 50,
          title: 'Phân cảnh 3: Các bẫy đề thi BGDĐT thường gặp',
          visualDescription: `Biển cảnh báo màu đỏ/vàng: 3 lỗi sai phổ biến mà 70% thí sinh thường mắc phải trong phòng thi.`,
          narrationVoiceover: `Các giám khảo ra đề thường cài cắm bẫy ở những chi tiết này: Sự nhầm lẫn giữa điều kiện so sánh, phạm vi chỉ số bắt đầu từ 0, và trường hợp dữ liệu rỗng. Hãy đánh dấu cẩn thận trong sổ tay ôn tập!`,
          keyHighlight: 'Cảnh giác 3 bẫy kinh điển',
        },
        {
          sceneNumber: 4,
          durationSeconds: 40,
          title: 'Phân cảnh 4: Mini Challenge & Tổng kết',
          visualDescription: `Màn hình hiển thị câu hỏi trắc nghiệm nhanh 15 giây đếm ngược có kèm pháo hoa khi hiển thị đáp án.`,
          narrationVoiceover: `Tuyệt vời! Bây giờ hãy vận dụng ngay với câu hỏi thử thách bên dưới để củng cố trí nhớ dài hạn vào bản đồ tri thức của bạn nhé.`,
          keyHighlight: 'Ôn tập ngắt quãng sau 24 giờ',
        },
      ],
      miniQuiz: {
        questionText: `Đặc điểm quan trọng nhất cần ghi nhớ khi xử lý bài toán về ${conceptName} là gì?`,
        options: [
          'Chỉ cần học thuộc lòng đáp án của các đề thi năm trước',
          'Xác định rõ ràng kiểu dữ liệu đầu vào, ràng buộc toàn vẹn và phạm vi giá trị',
          'Bỏ qua các bước kiểm tra cú pháp và chỉ chạy thử nghiệm',
          'Không cần đọc kỹ câu hỏi phủ định',
        ],
        correctIndex: 1,
        explanation: 'Xác định đúng kiểu dữ liệu và ràng buộc là chìa khóa để đạt điểm tối đa ở mọi dạng câu hỏi trắc nghiệm Tin học.',
      },
    };
  }
}
