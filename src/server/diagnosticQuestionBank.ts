import type {
  PrivateQuestionScoringData,
  PublicQuestionPresentation,
  Question,
  TrustedQuestionRecord,
} from '../types';

/**
 * NGÂN HÀNG BÀI TẬP VÀ ĐỀ THI MÔN TIN HỌC THPT (GDPT 2018)
 * Biên soạn trực tiếp bám sát theo bộ sách giáo khoa:
 * - Tin học 12 (Kết nối tri thức với cuộc sống - Định hướng Tin học ứng dụng & Cốt lõi)
 * - Tin học 11 (Kết nối tri thức với cuộc sống - Định hướng Tin học ứng dụng & CSDL)
 * - Tin học 10 (Kết nối tri thức với cuộc sống - Thuật toán & Lập trình Python)
 * Chuẩn cấu trúc ma trận Đề thi tốt nghiệp THPT năm 2025 của Bộ GD&ĐT:
 * - Phần I: 24 câu hỏi trắc nghiệm 4 lựa chọn (6.0 điểm)
 * - Phần II: 2 câu Đúng/Sai chung (2.0 điểm) + 2 câu Đúng/Sai tự chọn theo định hướng (2.0 điểm)
 */

export const SERVER_DIAGNOSTIC_QUESTION_BANK: Question[] = [
  // =========================================================================
  // PHẦN I: CÂU TRẮC NGHIỆM 4 LỰA CHỌN (SINGLE CHOICE)
  // =========================================================================

  // --- CHỦ ĐỀ 1 (TIN 12): MÁY TÍNH VÀ XÃ HỘI TRI THỨC - TRÍ TUỆ NHÂN TẠO ---
  {
    id: 'Q_CS12_AI_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Thuật ngữ "Trí tuệ nhân tạo" (Artificial Intelligence - AI) chính thức được đề xuất lần đầu tiên tại sự kiện lịch sử nào?',
    conceptId: 'CS12_AI_CONCEPTS',
    topicId: 'AI_FUNDAMENTALS',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Hội thảo Dartmouth (Mỹ) năm 1956.', isCorrect: true },
      { label: 'B', text: 'Công bố phép thử Turing của Alan Turing năm 1950.', isCorrect: false, distractorExplanation: 'Năm 1950 Alan Turing công bố bài báo về phép thử Turing, nhưng thuật ngữ AI chưa ra đời.' },
      { label: 'C', text: 'Ra mắt hệ chuyên gia y tế MYCIN năm 1972.', isCorrect: false, distractorExplanation: 'MYCIN là hệ chuyên gia chẩn đoán bệnh nhiễm trùng máu ra đời năm 1972.' },
      { label: 'D', text: 'Sự kiện ra mắt ChatGPT của tổ chức OpenAI năm 2022.', isCorrect: false, distractorExplanation: 'ChatGPT ra mắt cuối năm 2022, thuộc làn sóng AI tạo sinh hiện đại.' },
    ],
    explanation: 'Thuật ngữ "Trí tuệ nhân tạo" được nhà khoa học máy tính John McCarthy và các đồng nghiệp chính thức đưa ra tại Hội thảo Dartmouth (Mỹ) vào mùa hè năm 1956, đánh dấu sự ra đời của ngành khoa học AI.',
    keyTakeaway: 'Hội thảo Dartmouth năm 1956 là mốc lịch sử khai sinh thuật ngữ Trí tuệ nhân tạo.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 1: Làm quen với Trí tuệ nhân tạo',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_AI_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Đặc trưng nào sau đây của Trí tuệ nhân tạo thể hiện khả năng máy tính tự rút ra tri thức mới từ dữ liệu quan sát được thay vì chỉ thực thi các quy tắc lập trình sẵn?',
    conceptId: 'CS12_AI_CONCEPTS',
    topicId: 'AI_FUNDAMENTALS',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Khả năng tính toán số học tốc độ cao.', isCorrect: false, distractorExplanation: 'Tính toán tốc độ cao là năng lực phần cứng máy tính truyền thống, không phải đặc trưng của AI.' },
      { label: 'B', text: 'Khả năng học (Learning) từ dữ liệu thực nghiệm.', isCorrect: true },
      { label: 'C', text: 'Khả năng lưu trữ dung lượng lớn trên ổ đĩa SSD.', isCorrect: false, distractorExplanation: 'Lưu trữ là tính năng của thiết bị nhớ.' },
      { label: 'D', text: 'Khả năng hiển thị đồ họa độ phân giải 4K sắc nét.', isCorrect: false, distractorExplanation: 'Đây là tính năng của màn hình và card đồ họa.' },
    ],
    explanation: 'Theo SGK Tin học 12, các đặc trưng cốt lõi của AI gồm: khả năng học (learning), khả năng suy luận (reasoning), nhận thức môi trường (perception), hiểu ngôn ngữ tự nhiên và giải quyết vấn đề. Khả năng tự đúc kết tri thức từ dữ liệu chính là khả năng học.',
    keyTakeaway: 'Khả năng học (học máy) giúp AI cải thiện năng lực từ dữ liệu thay vì mã hóa cứng quy tắc.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 1: Làm quen với Trí tuệ nhân tạo',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_AI_03',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Hiện tượng mô hình ngôn ngữ lớn (LLM) tạo ra các câu trả lời tự tin, trôi chảy nhưng chứa đựng thông tin hoàn toàn sai lệch hoặc bịa đặt được gọi là gì trong nghiên cứu AI?',
    conceptId: 'CS12_AI_APPLICATIONS',
    topicId: 'AI_FUNDAMENTALS',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 40,
    competencyCode: 'NLc',
    singleChoiceOptions: [
      { label: 'A', text: 'Ảo giác AI (AI Hallucination).', isCorrect: true },
      { label: 'B', text: 'Quá khớp dữ liệu (Overfitting).', isCorrect: false, distractorExplanation: 'Overfitting là hiện tượng mô hình ghi nhớ máy móc dữ liệu huấn luyện, kém khả năng tổng quát.' },
      { label: 'C', text: 'Phân mảnh bộ nhớ (Memory Fragmentation).', isCorrect: false, distractorExplanation: 'Đây là hiện tượng trong quản lý bộ nhớ của hệ điều hành.' },
      { label: 'D', text: 'Tấn công từ chối dịch vụ (DDoS).', isCorrect: false, distractorExplanation: 'Đây là hình thức tấn công an ninh mạng.' },
    ],
    explanation: 'Hiện tượng Ảo giác AI (AI Hallucination) xảy ra khi mô hình sinh ngôn ngữ tự nhiên đưa ra các thông tin sai thực tế nhưng có vẻ rất logic và thuyết phục, đòi hỏi người dùng luôn phải kiểm chứng nguồn tin.',
    keyTakeaway: 'Luôn phản biện và kiểm chứng dữ liệu do AI tạo sinh cung cấp để tránh bẫy ảo giác AI.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 2: Trí tuệ nhân tạo trong khoa học và đời sống',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 2 (TIN 12): MẠNG MÁY TÍNH VÀ THIẾT BỊ MẠNG ---
  {
    id: 'Q_CS12_NET_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Thiết bị mạng nào sau đây có chức năng đọc địa chỉ MAC của gói tin để chuyển tiếp dữ liệu chính xác đến duy nhất cổng của máy tính nhận, giúp tránh va chạm xung đột (collision) trong mạng LAN?',
    conceptId: 'CS12_NETWORK_DEVICES',
    topicId: 'COMPUTER_NETWORKING',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Bộ tập trung (Hub).', isCorrect: false, distractorExplanation: 'Hub phát tán tín hiệu nhận được tới tất cả các cổng còn lại, dễ gây nghẽn và xung đột dữ liệu.' },
      { label: 'B', text: 'Bộ chuyển mạch (Switch).', isCorrect: true },
      { label: 'C', text: 'Bộ lặp tín hiệu (Repeater).', isCorrect: false, distractorExplanation: 'Repeater chỉ khuếch đại tín hiệu vật lý để truyền đi xa hơn, không đọc địa chỉ MAC.' },
      { label: 'D', text: 'Đầu bấm mạng RJ45.', isCorrect: false, distractorExplanation: 'RJ45 là đầu nối cơ học của cáp xoắn đôi UTP.' },
    ],
    explanation: 'Switch (bộ chuyển mạch) lưu trữ bảng địa chỉ MAC và chỉ chuyển tiếp khung dữ liệu đến đúng cổng kết nối với thiết bị đích, tạo ra các miền xung đột riêng rẽ và nâng cao hiệu năng mạng LAN.',
    keyTakeaway: 'Switch chuyển tiếp dữ liệu thông minh theo bảng địa chỉ MAC, Hub phát tán tới mọi cổng.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 3: Một số thiết bị mạng thông dụng',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_NET_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Bộ định tuyến (Router) thực hiện chuyển tiếp các gói dữ liệu giữa các mạng khác nhau (như mạng LAN gia đình và mạng Internet toàn cầu) dựa trên thông tin nào?',
    conceptId: 'CS12_NETWORK_DEVICES',
    topicId: 'COMPUTER_NETWORKING',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Địa chỉ IP đích và Bảng định tuyến (Routing Table).', isCorrect: true },
      { label: 'B', text: 'Tên nhà sản xuất bo mạch chủ (Motherboard).', isCorrect: false, distractorExplanation: 'Router không quan tâm đến phần cứng bo mạch chủ.' },
      { label: 'C', text: 'Tần số quét của màn hình máy tính.', isCorrect: false, distractorExplanation: 'Tần số quét màn hình không liên quan đến truyền thông mạng.' },
      { label: 'D', text: 'Độ dài của dây cáp nguồn điện máy chủ.', isCorrect: false, distractorExplanation: 'Không liên quan đến giao thức mạng.' },
    ],
    explanation: 'Router hoạt động ở tầng Mạng (Network Layer), sử dụng địa chỉ IP đích ghi trong gói tin kết hợp với Bảng định tuyến để quyết định đường đi tối ưu đưa gói tin đến mạng đích.',
    keyTakeaway: 'Router làm việc với địa chỉ IP để định tuyến dữ liệu giữa các mạng máy tính khác nhau.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 3: Một số thiết bị mạng thông dụng',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_NET_03',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Cáp xoắn đôi UTP thông dụng để kết nối máy tính với bộ chuyển mạch Switch trong mạng LAN sử dụng chuẩn đầu nối bấm nào?',
    conceptId: 'CS12_NETWORK_DEVICES',
    topicId: 'COMPUTER_NETWORKING',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Đầu nối chuẩn RJ45 (8 chân tiếp xúc đồng).', isCorrect: true },
      { label: 'B', text: 'Đầu cắm chuẩn RJ11 của đường dây điện thoại bàn.', isCorrect: false, distractorExplanation: 'RJ11 là đầu cắm điện thoại bàn có 4 hoặc 6 chân, nhỏ hơn RJ45.' },
      { label: 'C', text: 'Cổng cắm màn hình analog VGA 15 chân.', isCorrect: false, distractorExplanation: 'Cổng VGA dùng để xuất hình ảnh ra màn hình/máy chiếu.' },
      { label: 'D', text: 'Đầu cắm âm thanh Audio Jack 3.5mm.', isCorrect: false, distractorExplanation: 'Jack 3.5mm dùng để truyền tín hiệu âm thanh.' },
    ],
    explanation: 'Cáp xoắn đôi không bọc kim UTP gồm 4 cặp dây xoắn màu khác nhau, được bấm vào đầu cắm chuẩn RJ45 gồm 8 chân tiếp xúc bằng đồng để cắm vào cổng Ethernet trên máy tính hoặc Switch.',
    keyTakeaway: 'Cáp mạng Ethernet dùng đầu bấm chuẩn RJ45 gồm 8 chân tiếp xúc đồng.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 3: Một số thiết bị mạng thông dụng',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_NET_04',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Lệnh nào trong giao diện dòng lệnh (Command Prompt) của hệ điều hành Windows sử dụng giao thức ICMP để kiểm tra tính thông suốt và đo thời gian phản hồi (Round-Trip Time) giữa máy tính hiện tại tới một địa chỉ máy chủ?',
    conceptId: 'CS12_NETWORK_PROTOCOLS',
    topicId: 'COMPUTER_NETWORKING',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'pseudo',
      code: 'C:\\Users\\Student> ping 8.8.8.8',
    },
    singleChoiceOptions: [
      { label: 'A', text: 'Lệnh ping.', isCorrect: true },
      { label: 'B', text: 'Lệnh ipconfig.', isCorrect: false, distractorExplanation: 'ipconfig dùng để xem thông tin cấu hình IP và card mạng của máy cục bộ.' },
      { label: 'C', text: 'Lệnh cls.', isCorrect: false, distractorExplanation: 'cls dùng để xóa trắng màn hình console.' },
      { label: 'D', text: 'Lệnh mkdir.', isCorrect: false, distractorExplanation: 'mkdir dùng để tạo thư mục mới trên ổ đĩa.' },
    ],
    explanation: 'Lệnh ping gửi các gói tin Echo Request theo giao thức ICMP tới máy chủ đích và lắng nghe gói Echo Reply phản hồi, giúp kiểm tra kết nối mạng và độ trễ mili-giây (ms).',
    keyTakeaway: 'Lệnh ping dùng giao thức ICMP để kiểm tra tính thông suốt kết nối mạng.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 4: Giao thức mạng',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 3 (TIN 12): ĐẠO ĐỨC, PHÁP LUẬT VÀ VĂN HÓA TRONG MÔI TRƯỜNG SỐ ---
  {
    id: 'Q_CS12_ETHIC_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Theo Bộ quy tắc ứng xử trên mạng xã hội do Bộ Thông tin và Truyền thông ban hành theo Quyết định số 874/QĐ-BTTTT, nhóm 4 nguyên tắc nhân văn nào dưới đây được khuyến khích áp dụng trong giao tiếp số?',
    conceptId: 'CS12_DIGITAL_COMMUNICATION',
    topicId: 'ETHICS_SECURITY',
    grade: 12,
    strand: 'DL',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLd',
    singleChoiceOptions: [
      { label: 'A', text: 'Tôn trọng - Lịch sự - Thấu hiểu - Hỗ trợ.', isCorrect: true },
      { label: 'B', text: 'Cạnh tranh - Bí mật - Tự do tuyệt đối - Tranh luận.', isCorrect: false, distractorExplanation: 'Đây không phải các nguyên tắc nhân văn ứng xử mạng chuẩn mực.' },
      { label: 'C', text: 'Ẩn danh - Phát tán - Câu like - Phê phán.', isCorrect: false, distractorExplanation: 'Các hành vi này gây hại và tạo môi trường mạng tiêu cực.' },
      { label: 'D', text: 'Chỉ nghe - Không nói - Không bình luận - Tẩy chay.', isCorrect: false, distractorExplanation: 'Đây không phải 4 nguyên tắc theo quy định.' },
    ],
    explanation: 'Quyết định 874/QĐ-BTTTT và SGK Tin học 12 nhấn mạnh 4 nguyên tắc giao tiếp nhân văn trên không gian mạng: Tôn trọng (tôn trọng người khác), Lịch sự (lời nói hòa nhã), Thấu hiểu (đặt mình vào vị trí người khác) và Hỗ trợ (giúp đỡ khi cộng đồng cần).',
    keyTakeaway: '4 Nguyên tắc ứng xử nhân văn trên môi trường số: Tôn trọng, Lịch sự, Thấu hiểu, Hỗ trợ.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 6: Giao tiếp và ứng xử trong không gian mạng',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 4 (TIN 12): THIẾT KẾ WEB VỚI HTML5 & CSS3 ---
  {
    id: 'Q_CS12_WEB_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Dòng khai báo nào sau đây là bắt buộc ở vị trí đầu tiên của một tệp tài liệu HTML5 để trình duyệt web biết và kết xuất đúng chuẩn ngữ nghĩa?',
    conceptId: 'CS12_WEB_HTML_BASIC',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 25,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: '<!DOCTYPE html>', isCorrect: true },
      { label: 'B', text: '<xml version="1.0">', isCorrect: false, distractorExplanation: 'Đây là khai báo đầu tệp XML.' },
      { label: 'C', text: '<style type="text/css">', isCorrect: false, distractorExplanation: 'Đây là thẻ mở định kiểu CSS.' },
      { label: 'D', text: '<meta charset="UTF-8">', isCorrect: false, distractorExplanation: 'Thẻ meta nằm trong phần tử <head>, không phải khai báo loại tài liệu.' },
    ],
    explanation: '<!DOCTYPE html> là khai báo kiểu tài liệu (Document Type Declaration) không phân biệt hoa thường, đặt ở dòng đầu tiên của tệp tin để chỉ định trình duyệt web hiển thị trang theo chuẩn HTML5.',
    keyTakeaway: '<!DOCTYPE html> là dòng đầu tiên bắt buộc để trình duyệt nhận diện chuẩn HTML5.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 7: HTML và cấu trúc trang web',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Để tạo một danh sách có thứ tự gồm các mục được đánh số thứ tự từ 1, 2, 3... trong HTML5, ta sử dụng cặp thẻ nào sau đây?',
    conceptId: 'CS12_WEB_HTML_BASIC',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'Cặp thẻ <ol> và các phần tử <li> bên trong.', isCorrect: true },
      { label: 'B', text: 'Cặp thẻ <ul> và các phần tử <li> bên trong.', isCorrect: false, distractorExplanation: '<ul> là danh sách không thứ tự (Unordered List) hiển thị bằng dấu chấm đầu dòng (bullet).' },
      { label: 'C', text: 'Cặp thẻ <dl> và các phần tử <dt>, <dd>.', isCorrect: false, distractorExplanation: '<dl> là danh sách mô tả định nghĩa (Description List).' },
      { label: 'D', text: 'Cặp thẻ <table> và <tr>.', isCorrect: false, distractorExplanation: '<table> dùng để dựng bảng dữ liệu lưới.' },
    ],
    explanation: '<ol> là viết tắt của Ordered List (danh sách có thứ tự). Mỗi mục trong danh sách được bao bởi cặp thẻ <li> (List Item).',
    keyTakeaway: '<ol> dùng cho danh sách có thứ tự đánh số, <ul> dùng cho danh sách dấu đầu dòng.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 9: Tạo danh sách, bảng',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_03',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong bảng HTML (thẻ <table>), thuộc tính nào được sử dụng trong thẻ <td> hoặc <th> để gộp nhiều ô liên tiếp trên cùng một cột theo chiều dọc?',
    conceptId: 'CS12_WEB_HTML_BASIC',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 40,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'rowspan="số_hàng_gộp"', isCorrect: true },
      { label: 'B', text: 'colspan="số_cột_gộp"', isCorrect: false, distractorExplanation: 'colspan dùng để gộp nhiều ô theo chiều ngang (nhiều cột trên cùng một hàng).' },
      { label: 'C', text: 'cellpadding="10"', isCorrect: false, distractorExplanation: 'cellpadding quy định khoảng cách đệm từ viền ô tới nội dung.' },
      { label: 'D', text: 'align="center"', isCorrect: false, distractorExplanation: 'align quy định căn lề văn bản trong ô.' },
    ],
    explanation: 'Thuộc tính rowspan gộp các ô theo hàng dọc (chiều cao), còn colspan gộp các ô theo hàng ngang (chiều rộng) trong bảng HTML.',
    keyTakeaway: 'rowspan gộp ô theo chiều dọc nhiều hàng; colspan gộp ô theo chiều ngang nhiều cột.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 9: Tạo danh sách, bảng',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_04',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Xem xét đoạn mã HTML sau:\n\n<a href="#chuyen-muc-2">Xem chuyên mục 2</a>\n\nLiên kết trên thuộc loại siêu liên kết nào trong thiết kế web?',
    conceptId: 'CS12_WEB_HTML_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 40,
    competencyCode: 'NLe',
    codeSnippet: {
      language: 'html',
      code: '<a href="#chuyen-muc-2">Xem chuyên mục 2</a>',
    },
    singleChoiceOptions: [
      { label: 'A', text: 'Liên kết neo nội bộ (Bookmark / Anchor link) cuộn tới phần tử có id="chuyen-muc-2" trong cùng trang web.', isCorrect: true },
      { label: 'B', text: 'Liên kết tuyệt đối trỏ tới một máy chủ nước ngoài.', isCorrect: false, distractorExplanation: 'Liên kết tuyệt đối phải có đầy đủ giao thức http:// hoặc https://.' },
      { label: 'C', text: 'Liên kết tải tệp tin nhạc MP3 về máy.', isCorrect: false, distractorExplanation: 'Đường dẫn bắt đầu bằng dấu # là liên kết neo tới định danh id.' },
      { label: 'D', text: 'Liên kết gửi thư điện tử mailto.', isCorrect: false, distractorExplanation: 'Liên kết gửi thư có tiền tố mailto:.' },
    ],
    explanation: 'Trong HTML, dấu thăng (#) đi kèm định danh (ví dụ href="#id_name") đại diện cho liên kết neo (bookmark). Khi người dùng nhấp vào, trình duyệt sẽ tự động cuộn màn hình tới phần tử có thuộc tính id khớp với tên sau dấu #.',
    keyTakeaway: 'href="#id" là liên kết neo nội bộ cuộn tới vị trí phần tử có id tương ứng.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 10: Tạo liên kết',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_05',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong thẻ biểu mẫu <form>, kiểu dữ liệu input (thuộc tính type) nào sau đây chỉ cho phép người dùng chọn duy nhất MỘT lựa chọn trong một nhóm các phương án có cùng thuộc tính name?',
    conceptId: 'CS12_WEB_HTML_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: '<input type="radio"> (Nút chọn tròn).', isCorrect: true },
      { label: 'B', text: '<input type="checkbox"> (Hộp kiểm vuông).', isCorrect: false, distractorExplanation: 'Checkbox cho phép người dùng đánh dấu chọn nhiều mục đồng thời.' },
      { label: 'C', text: '<input type="text"> (Ô nhập văn bản).', isCorrect: false, distractorExplanation: 'Text dùng để nhập chuỗi ký tự tự do.' },
      { label: 'D', text: '<input type="submit"> (Nút gửi biểu mẫu).', isCorrect: false, distractorExplanation: 'Submit dùng để kích hoạt gửi dữ liệu form lên máy chủ.' },
    ],
    explanation: 'Nút radio (<input type="radio">) có đặc điểm loại trừ lẫn nhau: khi các nút radio có cùng thuộc tính name, người dùng chỉ có thể chọn một phương án duy nhất tại một thời điểm.',
    keyTakeaway: 'type="radio" chọn 1 trong nhóm cùng name; type="checkbox" chọn nhiều mục độc lập.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 12: Tạo biểu mẫu',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_06',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Theo Mô hình hộp (Box Model) trong CSS, thứ tự các lớp từ TRONG RA NGOÀI bao quanh một phần tử nội dung là gì?',
    conceptId: 'CS12_WEB_CSS_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'Nội dung (Content) -> Vùng đệm (Padding) -> Đường viền (Border) -> Lề ngoài (Margin).', isCorrect: true },
      { label: 'B', text: 'Nội dung (Content) -> Lề ngoài (Margin) -> Đường viền (Border) -> Vùng đệm (Padding).', isCorrect: false, distractorExplanation: 'Padding nằm sát nội dung, Margin nằm ở lớp ngoài cùng tiếp giáp các phần tử khác.' },
      { label: 'C', text: 'Đường viền (Border) -> Vùng đệm (Padding) -> Lề ngoài (Margin) -> Nội dung (Content).', isCorrect: false, distractorExplanation: 'Thứ tự này bị đảo ngược.' },
      { label: 'D', text: 'Vùng đệm (Padding) -> Nội dung (Content) -> Lề ngoài (Margin) -> Đường viền (Border).', isCorrect: false, distractorExplanation: 'Nội dung luôn ở trong cùng.' },
    ],
    explanation: 'Mô hình hộp CSS Box Model gồm 4 lớp đồng tâm từ trong ra ngoài: 1. Content (chứa văn bản, hình ảnh) -> 2. Padding (khoảng cách giữa nội dung và viền) -> 3. Border (đường viền bao quanh) -> 4. Margin (lề cách ly phần tử với các phần tử lân cận bên ngoài).',
    keyTakeaway: 'Box Model: Content -> Padding -> Border -> Margin.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 16: Định dạng khung',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_07',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong CSS3, bộ chọn tổ hợp quan hệ nào sau đây dùng để định dạng cho TẤT CẢ các phần tử <p> là con trực tiếp (cấp 1) của thẻ <div>, không áp dụng cho các thẻ <p> nằm lồng sâu hơn ở các cấp con cháu bên dưới?',
    conceptId: 'CS12_WEB_CSS_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'div > p', isCorrect: true },
      { label: 'B', text: 'div p', isCorrect: false, distractorExplanation: 'div p là bộ chọn hậu duệ (descendant), áp dụng cho mọi thẻ p nằm trong div bất kể cấp độ lồng.' },
      { label: 'C', text: 'div + p', isCorrect: false, distractorExplanation: 'div + p là bộ chọn anh em liền kề (adjacent sibling), chọn thẻ p nằm ngay liền kề sau thẻ div.' },
      { label: 'D', text: 'div ~ p', isCorrect: false, distractorExplanation: 'div ~ p là bộ chọn anh em thông thường (general sibling).' },
    ],
    explanation: 'Ký tự lớn hơn (>) đại diện cho Child Combinator trong CSS. Cú pháp `E > F` chỉ chọn các phần tử F là con trực tiếp cấp 1 của E.',
    keyTakeaway: '`E > F` chọn con trực tiếp cấp 1; `E F` chọn mọi con cháu hậu duệ bên trong.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 15: Tạo màu cho chữ và nền',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_WEB_08',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Khi có sự xung đột định dạng màu sắc cho cùng một thẻ HTML, bộ chọn CSS nào dưới đây có độ ưu tiên (Specificity) cao nhất (nếu không xét đến chỉ thị !important)?',
    conceptId: 'CS12_WEB_CSS_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'Thuộc tính style viết trực tiếp trong thẻ HTML (Inline Style).', isCorrect: true },
      { label: 'B', text: 'Bộ chọn định danh theo ID (#header).', isCorrect: false, distractorExplanation: 'ID selector có độ ưu tiên 100, thấp hơn Inline Style (1000).' },
      { label: 'C', text: 'Bộ chọn theo tên lớp Class (.highlight).', isCorrect: false, distractorExplanation: 'Class selector có độ ưu tiên 10.' },
      { label: 'D', text: 'Bộ chọn theo tên thẻ HTML (p, div).', isCorrect: false, distractorExplanation: 'Tag selector có độ ưu tiên thấp nhất (1).' },
    ],
    explanation: 'Thứ tự ưu tiên Specificity trong CSS: Inline Style (1000) > ID Selector (100) > Class / Attribute / Pseudo-class (10) > Tag / Pseudo-element (1) > Universal * (0). Do đó Inline Style có độ ưu tiên cao nhất.',
    keyTakeaway: 'Độ ưu tiên CSS: Inline Style (1000) > ID (100) > Class (10) > Tag name (1).',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 17: Các mức ưu tiên của bộ chọn',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 6 & 7 (TIN 12): KẾT NỐI THIẾT BỊ SỐ & GOOGLE SITES ---
  {
    id: 'Q_CS12_APP_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Khi kết nối máy tính xách tay với máy chiếu hoặc màn hình ngoài qua cổng HDMI trong hệ điều hành Windows, phím tắt nào sau đây mở nhanh bảng chọn chế độ trình chiếu (Duplicate, Extend)?',
    conceptId: 'CS12_ICT_SMART_DEVICES',
    topicId: 'APPLIED_INFORMATICS_12',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Tổ hợp phím Windows + P.', isCorrect: true },
      { label: 'B', text: 'Tổ hợp phím Ctrl + Shift + Esc.', isCorrect: false, distractorExplanation: 'Tổ hợp phím này mở trình quản lý tác vụ Task Manager.' },
      { label: 'C', text: 'Tổ hợp phím Windows + R.', isCorrect: false, distractorExplanation: 'Windows + R mở hộp thoại Run.' },
      { label: 'D', text: 'Tổ hợp phím Alt + F4.', isCorrect: false, distractorExplanation: 'Alt + F4 đóng cửa sổ ứng dụng hiện tại.' },
    ],
    explanation: 'Tổ hợp phím Windows + P (Project) trong Windows mở trình đơn Project cho phép lựa chọn 4 chế độ: PC screen only (chỉ màn hình máy tính), Duplicate (nhân bản giống nhau), Extend (mở rộng thêm không gian) và Second screen only (chỉ màn hình ngoài).',
    keyTakeaway: 'Phím tắt Windows + P dùng để chuyển đổi nhanh các chế độ trình chiếu màn hình ngoài.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 22: Thực hành kết nối các thiết bị số',
    sourceYear: 2024,
    isVerified: true,
  },
  {
    id: 'Q_CS12_APP_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Khi xây dựng trang web giới thiệu câu lạc bộ bằng công cụ trực quan Google Sites, tính năng nào cho phép nhúng trực tiếp biểu mẫu khảo sát ý kiến thành viên và tự động tổng hợp kết quả vào trang tính?',
    conceptId: 'CS12_ICT_GOOGLE_SITES',
    topicId: 'APPLIED_INFORMATICS_12',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'Chèn đối tượng Google Forms từ menu Chèn (Insert).', isCorrect: true },
      { label: 'B', text: 'Soạn thảo mã nguồn Java applet trong tệp .html.', isCorrect: false, distractorExplanation: 'Google Sites là nền tảng trực quan không yêu cầu viết Java applet.' },
      { label: 'C', text: 'Viết truy vấn SQL CREATE TABLE trên máy chủ ảo.', isCorrect: false, distractorExplanation: 'Google Sites được quản lý hoàn toàn tự động trên máy chủ Google.' },
      { label: 'D', text: 'Cài đặt phần mềm máy chủ Apache cục bộ.', isCorrect: false, distractorExplanation: 'Google Sites chạy trên nền tảng đám mây của Google.' },
    ],
    explanation: 'Google Sites tích hợp liền mạch trong hệ sinh thái Google Workspace. Tại thanh công cụ Chèn (Insert), ta có thể chọn "Biểu mẫu" (Forms) để nhúng form khảo sát vào trang web, kết quả sẽ tự động lưu vào Google Sheets.',
    keyTakeaway: 'Google Sites cho phép nhúng trực quan Google Forms và liên kết đồng bộ dữ liệu vào Sheets.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Bài 27: Biểu mẫu trên trang web',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 1 (TIN 11): HỆ ĐIỀU HÀNH & PHẦN CỨNG MÁY TÍNH ---
  {
    id: 'Q_CS11_OS_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Tiện ích Defragment (chống phân mảnh đĩa) trong hệ điều hành Windows được sử dụng nhằm mục đích chính nào sau đây?',
    conceptId: 'CS11_OS_HARDWARE',
    topicId: 'OPERATING_SYSTEMS_HARDWARE',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Sắp xếp lại các khối dữ liệu của tệp tin nằm liền kề nhau trên ổ cứng cơ (HDD) để tăng tốc độ truy xuất.', isCorrect: true },
      { label: 'B', text: 'Quét và tiêu diệt mã độc, virus máy tính trên RAM.', isCorrect: false, distractorExplanation: 'Đây là chức năng của phần mềm Antivirus.' },
      { label: 'C', text: 'Nén toàn bộ video clip thành định dạng MP4.', isCorrect: false, distractorExplanation: 'Đây là chức năng của phần mềm xử lý video.' },
      { label: 'D', text: 'Khắc phục sự cố mất kết nối mạng Internet Wi-Fi.', isCorrect: false, distractorExplanation: 'Đây là chức năng kiểm tra kết nối mạng.' },
    ],
    explanation: 'Sau thời gian sử dụng, các tệp tin lưu trên ổ đĩa từ tính HDD bị xé nhỏ lưu rải rác khắp nơi (hiện tượng phân mảnh). Tiện ích Defragment gom các mảnh dữ liệu lại gần nhau, giảm thời gian đầu từ di chuyển tìm kiếm và tăng tốc độ đọc tệp.',
    keyTakeaway: 'Chống phân mảnh đĩa (Defragment) sắp xếp dữ liệu liền kề trên HDD để nâng cao tốc độ đọc.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 2: Thực hành sử dụng hệ điều hành',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_HW_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Bộ phận nào bên trong bộ vi xử lý (CPU) đảm nhiệm chức năng thực hiện các phép toán số học (cộng, trừ, nhân, chia) và các phép toán logic (AND, OR, NOT)?',
    conceptId: 'CS11_OS_HARDWARE',
    topicId: 'OPERATING_SYSTEMS_HARDWARE',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Khối số học và logic (ALU - Arithmetic Logic Unit).', isCorrect: true },
      { label: 'B', text: 'Khối điều khiển (CU - Control Unit).', isCorrect: false, distractorExplanation: 'CU chịu trách nhiệm điều phối hoạt động và giải mã lệnh của CPU.' },
      { label: 'C', text: 'Bộ nhớ đệm (Cache).', isCorrect: false, distractorExplanation: 'Cache là bộ nhớ tạm tốc độ cao giữa CPU và RAM.' },
      { label: 'D', text: 'Khối nguồn máy tính (PSU).', isCorrect: false, distractorExplanation: 'PSU cấp điện áp cho các linh kiện.' },
    ],
    explanation: 'CPU có 3 thành phần chính: ALU (Arithmetic Logic Unit - thực hiện tính toán số học và logic), CU (Control Unit - điều khiển luồng lệnh) và các thanh ghi Register lưu trữ dữ liệu tức thời.',
    keyTakeaway: 'ALU bên trong CPU chịu trách nhiệm thực hiện các phép tính số học và logic.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 4: Bên trong máy tính',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_HW_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Cổng logic nào sau đây cho đầu ra có giá trị 1 (True) khi và chỉ khi HAI đầu vào có giá trị KHÁC NHAU (một đầu vào là 0 và một đầu vào là 1)?',
    conceptId: 'CS11_OS_HARDWARE',
    topicId: 'OPERATING_SYSTEMS_HARDWARE',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 40,
    competencyCode: 'NLc',
    singleChoiceOptions: [
      { label: 'A', text: 'Cổng XOR (Exclusive OR).', isCorrect: true },
      { label: 'B', text: 'Cổng AND.', isCorrect: false, distractorExplanation: 'Cổng AND chỉ cho đầu ra 1 khi CẢ HAI đầu vào đều là 1.' },
      { label: 'C', text: 'Cổng OR.', isCorrect: false, distractorExplanation: 'Cổng OR cho đầu ra 1 khi ít nhất một đầu vào là 1 (kể cả khi cả hai cùng là 1).' },
      { label: 'D', text: 'Cổng NOT.', isCorrect: false, distractorExplanation: 'Cổng NOT chỉ có một đầu vào duy nhất và đảo bit.' },
    ],
    explanation: 'Cổng XOR (hoặc loại trừ) có bảng chân trị: 0 XOR 0 = 0; 0 XOR 1 = 1; 1 XOR 0 = 1; 1 XOR 1 = 0. Cổng XOR cho kết quả 1 khi hai đầu vào khác nhau, dùng làm mạch cộng nhị phân nửa (Half-Adder).',
    keyTakeaway: 'Cổng XOR xuất bit 1 khi hai đầu vào có giá trị khác nhau.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 4: Bên trong máy tính',
    sourceYear: 2023,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 2 & 3 (TIN 11): LƯU TRỮ, TÌM KIẾM & AN TOÀN SỐ ---
  {
    id: 'Q_CS11_SEARCH_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trên công cụ tìm kiếm Google, cú pháp nào sau đây giúp tìm kiếm chính xác các tệp tài liệu định dạng PDF chứa nguyên văn cụm từ "Trí tuệ nhân tạo"?',
    conceptId: 'CS11_STORAGE_SECURITY',
    topicId: 'STORAGE_SEARCH_SECURITY',
    grade: 11,
    strand: 'DL',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: '"Trí tuệ nhân tạo" filetype:pdf', isCorrect: true },
      { label: 'B', text: 'Trí tuệ nhân tạo .docx', isCorrect: false, distractorExplanation: 'Không có dấu ngoặc kép để tìm cụm từ chính xác và không đúng toán tử định dạng file.' },
      { label: 'C', text: 'SELECT * FROM Trí tuệ nhân tạo', isCorrect: false, distractorExplanation: 'Đây là cú pháp truy vấn CSDL SQL, không phải cú pháp tìm kiếm Google.' },
      { label: 'D', text: 'ping "Trí tuệ nhân tạo"', isCorrect: false, distractorExplanation: 'Đây là lệnh kiểm tra mạng, không phải tìm kiếm tài liệu.' },
    ],
    explanation: 'Đặt cụm từ trong dấu ngoặc kép "..." yêu cầu tìm kiếm chính xác nguyên văn thứ tự từ. Toán tử filetype:pdf yêu cầu chỉ trả về các tệp tin có đuôi định dạng .pdf.',
    keyTakeaway: 'Cú pháp "cụm từ" filetype:loại_tệp lọc kết quả tài liệu chính xác trên Google.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 7: Thực hành tìm kiếm thông tin trên Internet',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_SEC_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Để phòng tránh các cạm bẫy lừa đảo trực tuyến (Phishing) chiếm đoạt tài khoản và tiền bạc trên môi trường số, học sinh cần ghi nhớ "3 nguyên tắc vàng" nào?',
    conceptId: 'CS11_STORAGE_SECURITY',
    topicId: 'STORAGE_SEARCH_SECURITY',
    grade: 11,
    strand: 'DL',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLd',
    singleChoiceOptions: [
      { label: 'A', text: '1. Hãy chậm lại - 2. Kiểm tra ngay - 3. Dừng lại, không gửi.', isCorrect: true },
      { label: 'B', text: '1. Chuyển tiền nhanh - 2. Bấm vào link - 3. Đổi mật khẩu.', isCorrect: false, distractorExplanation: 'Bấm vào link lạ và chuyển tiền vội vàng là hành động nguy cơ cao bị sập bẫy lừa đảo.' },
      { label: 'C', text: '1. Chia sẻ OTP - 2. Kết bạn người lạ - 3. Xóa lịch sử.', isCorrect: false, distractorExplanation: 'Tuyệt đối không được chia sẻ mã OTP cho bất kỳ ai.' },
      { label: 'D', text: '1. Cắt nguồn điện - 2. Tháo ổ cứng - 3. Cài lại Windows.', isCorrect: false, distractorExplanation: 'Đây không phải các nguyên tắc ứng xử phòng ngừa.' },
    ],
    explanation: 'SGK Tin học 11 hướng dẫn 3 nguyên tắc phòng chống lừa đảo: 1. Hãy chậm lại (bình tĩnh trước lời đe dọa hoặc mồi nhử) - 2. Kiểm tra ngay (xác thực từ nguồn tin cậy) - 3. Dừng lại, không gửi (không cung cấp OTP, mật khẩu, thông tin cá nhân hay chuyển tiền).',
    keyTakeaway: '3 Nguyên tắc phòng tránh lừa đảo số: Hãy chậm lại - Kiểm tra ngay - Dừng lại, không gửi.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 9: Giao tiếp an toàn trên Internet',
    sourceYear: 2023,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 4 & 6 (TIN 11): CƠ SỞ DỮ LIỆU & SQL ---
  {
    id: 'Q_CS11_DB_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong mô hình Cơ sở dữ liệu quan hệ (RDBMS), trường (thuộc tính) đóng vai trò là KHÓA CHÍNH (Primary Key) của một bảng phải thỏa mãn điều kiện tiên quyết nào?',
    conceptId: 'CS11_DB_RELATIONAL',
    topicId: 'RELATIONAL_DATABASE',
    grade: 11,
    strand: 'CS',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLc',
    singleChoiceOptions: [
      { label: 'A', text: 'Giá trị xác định duy nhất mỗi bản ghi, không được trùng lặp và không được nhận giá trị rỗng (NULL).', isCorrect: true },
      { label: 'B', text: 'Bắt buộc phải là kiểu dữ liệu ngày tháng năm (DATE).', isCorrect: false, distractorExplanation: 'Khóa chính thường là kiểu số nguyên INT hoặc chuỗi ký tự VARCHAR, không bắt buộc là DATE.' },
      { label: 'C', text: 'Được phép chứa nhiều giá trị trùng nhau để tiện tra cứu.', isCorrect: false, distractorExplanation: 'Nếu trùng lặp thì không thể xác định duy nhất bản ghi.' },
      { label: 'D', text: 'Chỉ được phép tạo duy nhất trong bảng có dưới 10 bản ghi.', isCorrect: false, distractorExplanation: 'Mọi bảng trong CSDL quan hệ đều cần có khóa chính không phụ thuộc số lượng bản ghi.' },
    ],
    explanation: 'Khóa chính (Primary Key) là thuộc tính hoặc tập thuộc tính dùng để phân biệt duy nhất từng bản ghi trong bảng quan hệ. Quy tắc bắt buộc: các giá trị của khóa chính phải là duy nhất (Unique) và không được rỗng (NOT NULL).',
    keyTakeaway: 'Khóa chính phải là duy nhất (Unique) và không bao giờ được nhận giá trị rỗng (NOT NULL).',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 13: Cơ sở dữ liệu quan hệ',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_DB_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong phần mềm HeidiSQL quản trị MySQL, thuộc tính nào được đánh dấu khi thiết kế cột khóa chính kiểu số nguyên để giá trị tự động tăng lên 1 đơn vị mỗi khi thêm bản ghi mới?',
    conceptId: 'CS11_SQL_QUERIES',
    topicId: 'SQL_LANGUAGE',
    grade: 11,
    strand: 'CS',
    cognitiveLevel: 'knowledge',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLe',
    singleChoiceOptions: [
      { label: 'A', text: 'AUTO_INCREMENT (Tự động tăng).', isCorrect: true },
      { label: 'B', text: 'UNIQUE (Không trùng lặp).', isCorrect: false, distractorExplanation: 'UNIQUE ràng buộc không trùng lặp nhưng không tự động sinh số tăng.' },
      { label: 'C', text: 'DEFAULT NULL.', isCorrect: false, distractorExplanation: 'DEFAULT NULL đặt giá trị mặc định là rỗng.' },
      { label: 'D', text: 'BINARY.', isCorrect: false, distractorExplanation: 'BINARY là kiểu dữ liệu nhị phân.' },
    ],
    explanation: 'Thuộc tính AUTO_INCREMENT trong MySQL và giao diện HeidiSQL giúp hệ quản trị tự động sinh giá trị số nguyên tăng dần tiếp theo (1, 2, 3...) cho khóa chính mỗi khi một bản ghi mới được chèn vào mà không cần người dùng nhập tay.',
    keyTakeaway: 'AUTO_INCREMENT giúp tự động tăng giá trị khóa chính khi thêm bản ghi mới trong MySQL.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 19: Thực hành tạo lập cơ sở dữ liệu và các bảng',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_SQL_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Cho bảng HOCSINH(MaHS, HoTen, DiemToan, DiemVan). Câu lệnh SQL nào sau đây lấy ra danh sách Họ tên và Điểm Toán của những học sinh có Điểm Toán từ 8.0 trở lên và sắp xếp giảm dần theo Điểm Toán?',
    conceptId: 'CS11_SQL_QUERIES',
    topicId: 'SQL_LANGUAGE',
    grade: 11,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 50,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'sql',
      code: 'SELECT HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0 ORDER BY DiemToan DESC;',
    },
    singleChoiceOptions: [
      { label: 'A', text: 'SELECT HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0 ORDER BY DiemToan DESC;', isCorrect: true },
      { label: 'B', text: 'SELECT * FROM HOCSINH WHERE DiemToan > 8.0 SORT BY DiemToan;', isCorrect: false, distractorExplanation: 'SQL không có từ khóa SORT BY, chỉ có ORDER BY; câu hỏi yêu cầu >= và chỉ lấy HoTen, DiemToan.' },
      { label: 'C', text: 'SELECT HoTen, DiemToan FROM HOCSINH IF DiemToan >= 8.0 ORDER BY DiemToan ASC;', isCorrect: false, distractorExplanation: 'SQL lọc bản ghi bằng mệnh đề WHERE, không dùng IF; ASC là sắp xếp tăng dần.' },
      { label: 'D', text: 'GET HoTen, DiemToan FROM HOCSINH WHERE DiemToan >= 8.0;', isCorrect: false, distractorExplanation: 'SQL truy vấn dữ liệu bằng từ khóa SELECT, không có lệnh GET.' },
    ],
    explanation: 'Cấu trúc chuẩn của câu truy vấn: `SELECT [danh sách cột] FROM [bảng] WHERE [điều kiện lọc] ORDER BY [cột] DESC;`. Trong đó DESC là giảm dần (Descending).',
    keyTakeaway: 'SELECT lọc cột, WHERE lọc hàng, ORDER BY [cột] DESC sắp xếp giảm dần.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 14: SQL - Ngôn ngữ truy vấn có cấu trúc',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_SQL_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Cho hai bảng: LOP(MaLop, TenLop) và HOCSINH(MaHS, HoTen, MaLop). Để kết nối dữ liệu từ cả hai bảng hiển thị thông tin học sinh cùng tên lớp tương ứng, mệnh đề kết nối nào được sử dụng?',
    conceptId: 'CS11_SQL_QUERIES',
    topicId: 'SQL_LANGUAGE',
    grade: 11,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 50,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'sql',
      code: 'SELECT HOCSINH.HoTen, LOP.TenLop\nFROM HOCSINH\nINNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop;',
    },
    singleChoiceOptions: [
      { label: 'A', text: 'INNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop', isCorrect: true },
      { label: 'B', text: 'COMBINE LOP WITH HOCSINH', isCorrect: false, distractorExplanation: 'SQL không có từ khóa COMBINE WITH.' },
      { label: 'C', text: 'UNION ALL LOP WHERE MaLop = MaLop', isCorrect: false, distractorExplanation: 'UNION dùng để ghép nối các dòng của hai bảng có cấu trúc tương thích, không dùng để kết nối bảng theo quan hệ khóa.' },
      { label: 'D', text: 'ATTACH LOP TO HOCSINH', isCorrect: false, distractorExplanation: 'SQL không có cú pháp ATTACH TO này.' },
    ],
    explanation: 'Mệnh đề `INNER JOIN LOP ON HOCSINH.MaLop = LOP.MaLop` thực hiện phép nối trong giữa hai bảng dựa trên sự bằng nhau của trường khóa ngoại MaLop trong bảng HOCSINH và trường khóa chính MaLop trong bảng LOP.',
    keyTakeaway: 'INNER JOIN ... ON kết nối hai bảng theo cặp khóa chính - khóa ngoại tương ứng.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 23: Thực hành truy xuất dữ liệu qua liên kết các bảng',
    sourceYear: 2023,
    isVerified: true,
  },

  // --- CHỦ ĐỀ 7 (TIN 11): ĐỒ HỌA GIMP & BIÊN TẬP VIDEO VIDEOPAD ---
  {
    id: 'Q_CS11_MEDIA_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong phần mềm chỉnh sửa ảnh GIMP, tính năng "Lớp ảnh" (Layer) mang lại lợi ích quan trọng nào sau đây cho người thiết kế?',
    conceptId: 'CS11_ICT_MEDIA_EDITING',
    topicId: 'MULTIMEDIA_EDITING',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 35,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Cho phép chỉnh sửa, di chuyển từng đối tượng hoặc chi tiết độc lập mà không ảnh hưởng làm hỏng các phần tử ở các lớp khác.', isCorrect: true },
      { label: 'B', text: 'Tự động sửa lỗi chính tả văn bản tiếng Việt trên ảnh.', isCorrect: false, distractorExplanation: 'Layer không phải công cụ kiểm tra chính tả văn bản.' },
      { label: 'C', text: 'Giảm độ phân giải của bức ảnh xuống mức thấp nhất.', isCorrect: false, distractorExplanation: 'Layer không làm giảm độ phân giải của ảnh.' },
      { label: 'D', text: 'Chuyển đổi hình ảnh tĩnh thành tệp âm thanh MP3.', isCorrect: false, distractorExplanation: 'Ảnh không thể chuyển thành tệp âm thanh qua Layer.' },
    ],
    explanation: 'Các lớp ảnh (Layers) trong GIMP giống như các tấm kính trong suốt xếp chồng lên nhau. Thiết kế trên từng layer giúp người dùng thỏa sức vẽ, đổi màu, di chuyển hoặc ẩn/hiện mà không làm biến dạng các đối tượng nằm ở lớp khác.',
    keyTakeaway: 'Lớp ảnh (Layer) trong GIMP giúp quản lý và chỉnh sửa các đối tượng đồ họa hoàn toàn độc lập.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 25: Phần mềm chỉnh sửa ảnh',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS11_MEDIA_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Trong phần mềm biên tập phim VideoPad, hiệu ứng nào sau đây thường được chèn vào giữa hai đoạn video clip kề nhau trên dòng thời gian Timeline để tạo sự chuyển tiếp mượt mà?',
    conceptId: 'CS11_ICT_MEDIA_EDITING',
    topicId: 'MULTIMEDIA_EDITING',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'easy',
    estimatedTimeSec: 30,
    competencyCode: 'NLa',
    singleChoiceOptions: [
      { label: 'A', text: 'Hiệu ứng chuyển cảnh (Transition như Fade, Dissolve, CrossFade).', isCorrect: true },
      { label: 'B', text: 'Lệnh định dạng phông chữ font-family.', isCorrect: false, distractorExplanation: 'Đây là thuộc tính trong CSS, không phải hiệu ứng video.' },
      { label: 'C', text: 'Lệnh nén tệp tin WinRAR.', isCorrect: false, distractorExplanation: 'Đây là phần mềm nén tệp tin.' },
      { label: 'D', text: 'Lệnh chia sẻ máy in Print Server.', isCorrect: false, distractorExplanation: 'Đây là tính năng mạng máy tính.' },
    ],
    explanation: 'Hiệu ứng chuyển cảnh Transition (như mờ dần - Fade, hòa tan - Dissolve) được đặt tại điểm nối giữa hai cảnh phim giúp video chuyển từ cảnh trước sang cảnh sau uyển chuyển, tự nhiên và chuyên nghiệp.',
    keyTakeaway: 'Hiệu ứng Transition trong VideoPad tạo sự chuyển tiếp mượt mà giữa các đoạn clip.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Bài 30: Biên tập phim',
    sourceYear: 2023,
    isVerified: true,
  },

  // --- CHỦ ĐỀ THUẬT TOÁN & LẬP TRÌNH PYTHON CỐT LÕI (TIN 10) ---
  {
    id: 'Q_CS10_PY_01',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Cho danh sách Python: a = [10, 20, 30, 40, 50, 60]. Cú pháp cắt lát (slicing) nào sau đây sẽ trích xuất ra danh sách con gồm 3 phần tử [20, 30, 40]?',
    conceptId: 'CS10_PYTHON_DATA_STRUCT',
    topicId: 'PYTHON_PROGRAMMING',
    grade: 10,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'python',
      code: 'a = [10, 20, 30, 40, 50, 60]\nsub = a[1:4]',
    },
    singleChoiceOptions: [
      { label: 'A', text: 'a[1:4]', isCorrect: true },
      { label: 'B', text: 'a[1:3]', isCorrect: false, distractorExplanation: 'a[1:3] chỉ lấy phần tử tại vị trí 1 và 2, tức là [20, 30].' },
      { label: 'C', text: 'a[2:4]', isCorrect: false, distractorExplanation: 'a[2:4] lấy vị trí 2 và 3, tức là [30, 40].' },
      { label: 'D', text: 'a[0:3]', isCorrect: false, distractorExplanation: 'a[0:3] lấy từ đầu: [10, 20, 30].' },
    ],
    explanation: 'Trong Python, chỉ số danh sách bắt đầu từ 0. Phần tử 20 ở chỉ số 1, 30 ở chỉ số 2, 40 ở chỉ số 3. Cú pháp a[start:stop] lấy các phần tử từ start đến stop-1. Do đó a[1:4] lấy phần tử tại các chỉ số 1, 2, 3 -> [20, 30, 40].',
    keyTakeaway: 'a[start:stop] lấy phần tử từ chỉ số start đến stop-1 trong Python.',
    source: 'SGK Tin học 10 (Kết nối tri thức) - Bài 22: Kiểu dữ liệu danh sách',
    sourceYear: 2023,
    isVerified: true,
  },
  {
    id: 'Q_CS10_PY_02',
    questionType: 'single_choice',
    sectionScope: 'mandatory',
    track: 'ALL',
    stem: 'Đoạn mã Python sau in ra giá trị của biến s bằng bao nhiêu sau khi kết thúc vòng lặp?\n\ns = 0\nfor i in range(1, 6):\n    if i % 2 == 1:\n        s += i\nprint(s)',
    conceptId: 'CS10_PYTHON_CONTROL',
    topicId: 'PYTHON_PROGRAMMING',
    grade: 10,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 45,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'python',
      code: 's = 0\nfor i in range(1, 6):\n    if i % 2 == 1:\n        s += i\nprint(s)',
    },
    singleChoiceOptions: [
      { label: 'A', text: '9', isCorrect: true },
      { label: 'B', text: '15', isCorrect: false, distractorExplanation: '15 là tổng của mọi số từ 1 đến 5, nhưng điều kiện if chỉ cộng các số lẻ.' },
      { label: 'C', text: '6', isCorrect: false, distractorExplanation: '6 là tổng của các số chẵn (2 + 4).' },
      { label: 'D', text: '25', isCorrect: false, distractorExplanation: 'Tính toán sai phạm vi range.' },
    ],
    explanation: 'Hàm range(1, 6) sinh ra các giá trị i lần lượt là: 1, 2, 3, 4, 5. Điều kiện if i % 2 == 1 lọc các số lẻ gồm 1, 3, 5. Biến s cộng dồn: s = 1 + 3 + 5 = 9.',
    keyTakeaway: 'range(1, 6) sinh các giá trị từ 1 đến 5; toán tử % lấy phần dư để kiểm tra chẵn/lẻ.',
    source: 'SGK Tin học 10 (Kết nối tri thức) - Bài 20: Câu lệnh lặp for',
    sourceYear: 2023,
    isVerified: true,
  },

  // =========================================================================
  // =========================================================================
  // PHẦN II & III: CÂU HỎI TRẮC NGHIỆM ĐÚNG / SAI
  // Mỗi thí sinh làm 2 câu chung và 2 câu theo định hướng (mỗi câu tối đa 1.0 điểm).
  // =========================================================================

  // --- CÂU ĐÚNG/SAI CHUNG CHO TẤT CẢ THÍ SINH ---
  // CÂU CHUNG 1: TRÍ TUỆ NHÂN TẠO & ĐẠO ĐỨC CÔNG NGHỆ (TIN 12 - CHỦ ĐỀ 1)
  {
    id: 'Q_CS12_TF_01',
    questionType: 'true_false_multistatement',
    sectionScope: 'mandatory_tf',
    track: 'ALL',
    stem: 'Trong một buổi sinh hoạt chuyên đề về "Trí tuệ nhân tạo và tương lai số", các bạn học sinh thảo luận về đặc trưng, ứng dụng và rủi ro của AI. Hãy xác định tính ĐÚNG hoặc SAI của mỗi phát biểu sau đây:',
    conceptId: 'CS12_AI_CONCEPTS',
    topicId: 'AI_FUNDAMENTALS',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 150,
    competencyCode: 'NLc',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Hệ thống nhận diện khuôn mặt tự động điểm danh tại cổng trường học là một ví dụ ứng dụng của Thị giác máy tính (Computer Vision) trong AI.',
        isCorrect: true,
        explanation: 'Đúng. Nhận diện khuôn mặt là bài toán nhận dạng mẫu hình ảnh thuộc lĩnh vực Thị giác máy tính (Computer Vision).',
      },
      {
        subOrder: 'b',
        statementText: 'Tất cả các hệ thống AI thương mại hiện nay đều đã đạt tới mức Trí tuệ nhân tạo tổng quát (AGI) có thể tự ý thức và làm chủ mọi lĩnh vực nhận thức của con người.',
        isCorrect: false,
        explanation: 'Sai. Các hệ thống AI hiện nay đều là AI hẹp (Narrow AI), chuyên sâu vào một tác vụ cụ thể; AGI vẫn là mục tiêu nghiên cứu dài hạn trong tương lai.',
      },
      {
        subOrder: 'c',
        statementText: 'Mô hình ngôn ngữ lớn (LLM) có thể tạo ra các câu trả lời đọc rất trôi chảy nhưng chứa đựng dữ liệu sai lệch hoặc hư cấu (hiện tượng Ảo giác AI - Hallucination).',
        isCorrect: true,
        explanation: 'Đúng. Đây là hạn chế được ghi nhận rõ trong giáo trình Tin học 12, người học cần có tư duy phản biện khi sử dụng dữ liệu từ AI.',
      },
      {
        subOrder: 'd',
        statementText: 'Học sinh được phép sử dụng AI tạo sinh để viết toàn bộ bài luận văn và nộp dưới tên của mình mà không cần ghi nguồn tham khảo.',
        isCorrect: false,
        explanation: 'Sai. Hành vi này vi phạm tính liêm chính học thuật và bản quyền sở hữu trí tuệ.',
      },
    ],
    explanation: 'Câu hỏi kiểm tra kiến thức về các nhánh của AI (Thị giác máy tính, AGI vs Narrow AI), hiện tượng ảo giác của mô hình ngôn ngữ và đạo đức sử dụng AI trong học tập.',
    keyTakeaway: 'Phần II đánh giá toàn diện nhận thức Đúng/Sai theo 4 mệnh đề độc lập.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Chủ đề 1: Máy tính và xã hội tri thức',
    sourceYear: 2024,
    isVerified: true,
  },

  // CÂU CHUNG 2: CƠ SỞ DỮ LIỆU QUAN HỆ & SQL (TIN 11 - CHỦ ĐỀ 4, 6)
  {
    id: 'Q_CS11_TF_01',
    questionType: 'true_false_multistatement',
    sectionScope: 'mandatory_tf',
    track: 'ALL',
    stem: 'Cho cơ sở dữ liệu quản lý mượn sách thư viện của trường THPT gồm 3 bảng quan hệ sau:\n' +
          '- DOCGIA(MaDG, HoTen, Lop, NgaySinh) với MaDG là khóa chính.\n' +
          '- SACH(MaSach, TenSach, TacGia, SoLuong) với MaSach là khóa chính.\n' +
          '- PHIEUMUON(SoPhieu, MaDG, MaSach, NgayMuon, NgayTra) với SoPhieu là khóa chính.\n\n' +
          'Hãy xác định tính ĐÚNG hoặc SAI của mỗi phát biểu sau:',
    conceptId: 'CS11_DB_RELATIONAL',
    topicId: 'RELATIONAL_DATABASE',
    grade: 11,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 150,
    competencyCode: 'NLc',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Trong bảng PHIEUMUON, hai trường MaDG và MaSach lần lượt là các khóa ngoại (Foreign Key) tham chiếu đến bảng DOCGIA và SACH.',
        isCorrect: true,
        explanation: 'Đúng. MaDG và MaSach trong PHIEUMUON liên kết tới khóa chính của hai bảng độc giả và sách để ghi nhận ai mượn cuốn sách nào.',
      },
      {
        subOrder: 'b',
        statementText: 'Một độc giả không thể mượn sách nhiều lần vì MaDG không được phép lặp lại trong bảng PHIEUMUON.',
        isCorrect: false,
        explanation: 'Sai. Trong PHIEUMUON, khóa chính là SoPhieu. Trường MaDG là khóa ngoại nên hoàn toàn có thể lặp lại nhiều lần (mối quan hệ 1-Nhiều: một độc giả có thể mượn nhiều lần).',
      },
      {
        subOrder: 'c',
        statementText: 'Ràng buộc toàn vẹn tham chiếu ngăn cấm việc xóa một độc giả trong bảng DOCGIA nếu độc giả đó đang có phiếu mượn chưa trả trong bảng PHIEUMUON.',
        isCorrect: true,
        explanation: 'Đúng. Để bảo đảm tính toàn vẹn dữ liệu, RDBMS không cho phép xóa bản ghi cha khi bản ghi con đang tham chiếu tới (trừ khi thiết lập CASCADE).',
      },
      {
        subOrder: 'd',
        statementText: 'Để xóa toàn bộ một bảng SACH khỏi cơ sở dữ liệu, ta dùng câu lệnh SQL: DELETE TABLE SACH;',
        isCorrect: false,
        explanation: 'Sai. Lệnh xóa bỏ hoàn toàn cấu trúc bảng trong SQL là DROP TABLE SACH;. Lệnh DELETE chỉ dùng để xóa các dòng dữ liệu bên trong bảng.',
      },
    ],
    explanation: 'Câu hỏi phân tích thiết kế CSDL quan hệ: khóa chính, khóa ngoại, tính toàn vẹn tham chiếu và sự khác biệt giữa lệnh DDL (DROP TABLE) và DML (DELETE FROM).',
    keyTakeaway: 'Khóa ngoại trong bảng con có thể lặp lại; DROP TABLE xóa bảng, DELETE FROM xóa bản ghi.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Chủ đề 4: Giới thiệu các hệ cơ sở dữ liệu',
    sourceYear: 2023,
    isVerified: true,
  },

  // --- ĐỊNH HƯỚNG KHOA HỌC MÁY TÍNH (CS TRACK) ---
  // CÂU TỰ CHỌN CS 1: LẬP TRÌNH PYTHON & THUẬT TOÁN TÌM KIẾM NHỊ PHÂN (TIN 10)
  {
    id: 'Q_CS10_TF_01',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'CS',
    stem: 'Một học sinh xây dựng chương trình Python cài đặt thuật toán tìm kiếm nhị phân (Binary Search) và thao tác với cấu trúc dữ liệu. Xem xét các phát biểu sau:',
    conceptId: 'CS10_PYTHON_DATA_STRUCT',
    topicId: 'PYTHON_PROGRAMMING',
    grade: 10,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'hard',
    estimatedTimeSec: 150,
    competencyCode: 'NLc',
    codeSnippet: {
      language: 'python',
      code: 'def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1',
    },
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Thuật toán tìm kiếm nhị phân chỉ áp dụng được trên danh sách (mảng) đã được sắp xếp thứ tự.',
        isCorrect: true,
        explanation: 'Đúng. Thuật toán dựa trên tính chất thứ tự của mảng để thu hẹp một nửa phạm vi tìm kiếm sau mỗi bước so sánh.',
      },
      {
        subOrder: 'b',
        statementText: 'Trong trường hợp xấu nhất trên danh sách gồm n phần tử, số lần lặp tối đa của thuật toán tìm kiếm nhị phân tỷ lệ với log2(n).',
        isCorrect: true,
        explanation: 'Đúng. Độ phức tạp thời gian của tìm kiếm nhị phân là O(log n), hiệu quả hơn nhiều so với tìm kiếm tuần tự O(n).',
      },
      {
        subOrder: 'c',
        statementText: 'Nếu danh sách đầu vào chứa các phần tử chưa sắp xếp: [40, 10, 50, 20], hàm trên luôn trả về đúng vị trí của phần tử cần tìm.',
        isCorrect: false,
        explanation: 'Sai. Với mảng chưa sắp xếp, tìm kiếm nhị phân có thể loại bỏ nhầm nửa chứa phần tử cần tìm và trả về -1.',
      },
      {
        subOrder: 'd',
        statementText: 'Cấu trúc từ điển (dict) trong Python lưu trữ dữ liệu dưới dạng các cặp key-value và cho phép các khóa (key) bị trùng lặp.',
        isCorrect: false,
        explanation: 'Sai. Trong từ điển Python, mỗi khóa (key) phải là duy nhất (unique) và bất biến (immutable).',
      },
    ],
    explanation: 'Kiểm tra bản chất thuật toán tìm kiếm nhị phân, điều kiện tiên quyết sắp xếp mảng, độ phức tạp O(log n) và đặc trưng cấu trúc dữ liệu Dictionary trong Python.',
    keyTakeaway: 'Tìm kiếm nhị phân yêu cầu mảng đã sắp xếp và có độ phức tạp O(log n).',
    source: 'SGK Tin học 10 (Kết nối tri thức) - Bài 24: Thuật toán tìm kiếm nhị phân',
    sourceYear: 2023,
    isVerified: true,
  },

  // CÂU TỰ CHỌN CS 4: MÔ HÌNH HỌC MÁY & PHÂN LOẠI DỮ LIỆU (TIN 12 - CHỦ ĐỀ 1)
  {
    id: 'Q_CS12_TF_05',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'CS',
    stem: 'Trong dự án nghiên cứu phân loại dữ liệu học máy (Machine Learning), nhóm học sinh áp dụng các kỹ thuật huấn luyện mô hình. Hãy xác định tính ĐÚNG hoặc SAI của mỗi nhận định sau:',
    conceptId: 'CS12_AI_CONCEPTS',
    topicId: 'AI_FUNDAMENTALS',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'hard',
    estimatedTimeSec: 150,
    competencyCode: 'NLa',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Phương pháp học có giám sát (Supervised Learning) yêu cầu tập dữ liệu huấn luyện phải có sẵn các nhãn kết quả (Labels) tương ứng với mỗi mẫu đầu vào.',
        isCorrect: true,
        explanation: 'Đúng. Học có giám sát học ánh xạ từ đặc trưng đầu vào tới nhãn mục tiêu được cung cấp sẵn.',
      },
      {
        subOrder: 'b',
        statementText: 'Bài toán dự đoán giá bán của một chiếc máy tính xách tay (dạng số thực liên tục) dựa trên cấu hình CPU và RAM là một bài toán Phân loại (Classification).',
        isCorrect: false,
        explanation: 'Sai. Dự đoán giá trị số thực liên tục là bài toán Hồi quy (Regression), không phải Phân loại (Classification dự đoán nhãn rời rạc).',
      },
      {
        subOrder: 'c',
        statementText: 'Hiện tượng Quá khớp (Overfitting) xảy ra khi mô hình ghi nhớ quá mức dữ liệu huấn luyện nhưng hoạt động kém trên dữ liệu kiểm thử mới chưa từng thấy.',
        isCorrect: true,
        explanation: 'Đúng. Overfitting là hiện tượng mô hình học cả nhiễu của tập huấn luyện, mất đi tính tổng quát hóa.',
      },
      {
        subOrder: 'd',
        statementText: 'Trong học máy, ta nên dùng 100% dữ liệu thu thập được để huấn luyện mô hình và không cần giữ lại tập dữ liệu kiểm thử (Test set).',
        isCorrect: false,
        explanation: 'Sai. Luôn cần phân chia tập kiểm thử độc lập (thường 20-30%) để đánh giá khách quan độ chính xác của mô hình.',
      },
    ],
    explanation: 'Kiểm tra kiến thức nền tảng Khoa học máy tính về Học có giám sát, phân biệt Hồi quy vs Phân loại, hiện tượng Quá khớp (Overfitting) và quy tắc chia tập Train/Test.',
    keyTakeaway: 'Học có giám sát cần dữ liệu có nhãn; dự đoán giá là Hồi quy; luôn cần tập Test set độc lập.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Chuyên đề Khoa học máy tính',
    sourceYear: 2024,
    isVerified: true,
  },

  // --- ĐỊNH HƯỚNG TIN HỌC ỨNG DỤNG (ICT TRACK) ---
  // CÂU TỰ CHỌN ICT 1: THIẾT BỊ MẠNG & GIAO THỨC TRUYỀN THÔNG (TIN 12 - CHỦ ĐỀ 2)
  {
    id: 'Q_CS12_TF_02',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'ICT',
    stem: 'Một trường THPT tiến hành lắp đặt mạng máy tính cho phòng thực hành Tin học gồm 45 máy tính để bàn, 1 máy in dùng chung và 1 bộ định tuyến Router kết nối mạng cáp quang Internet. Hãy xác định tính ĐÚNG hoặc SAI của các phát biểu sau:',
    conceptId: 'CS12_NETWORK_DEVICES',
    topicId: 'COMPUTER_NETWORKING',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 150,
    competencyCode: 'NLa',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Sử dụng bộ chuyển mạch Switch thay vì Hub sẽ giúp hạn chế nghẽn mạng và giảm thiểu tối đa hiện tượng xung đột (collision) giữa các máy tính trong phòng thực hành.',
        isCorrect: true,
        explanation: 'Đúng. Switch phân chia các cổng thành các miền xung đột riêng biệt, chỉ gửi gói tin đến cổng đích.',
      },
      {
        subOrder: 'b',
        statementText: 'Cổng WAN trên bộ định tuyến Router được dùng để cắm dây cáp nối trực tiếp tới từng máy tính để bàn của học sinh.',
        isCorrect: false,
        explanation: 'Sai. Cổng WAN (Wide Area Network) dùng để kết nối với mạng bên ngoài (Modem/Internet). Các máy tính trong phòng thực hành cắm vào các cổng LAN (Local Area Network).',
      },
      {
        subOrder: 'c',
        statementText: 'Trong mạng LAN, địa chỉ IP của mỗi máy tính phải là duy nhất và không được phép trùng lặp để tránh xung đột địa chỉ IP.',
        isCorrect: true,
        explanation: 'Đúng. Nếu hai thiết bị trong cùng mạng nhận cùng một địa chỉ IP sẽ gây ra lỗi xung đột IP (IP conflict) và không thể giao tiếp bình thường.',
      },
      {
        subOrder: 'd',
        statementText: 'Sau khi máy in được kết nối với một máy tính và chia sẻ (Share), mọi máy tính khác trong mạng LAN đều có thể in văn bản mà không cần máy tính gắn máy in phải bật nguồn.',
        isCorrect: false,
        explanation: 'Sai. Nếu máy in được chia sẻ qua một máy tính trung gian, khi máy tính đó tắt nguồn thì các máy tính khác trong mạng không thể gửi lệnh in được (trừ khi máy in là Network Printer cắm trực tiếp vào Switch).',
      },
    ],
    explanation: 'Đánh giá hiểu biết thực tế về cấu trúc mạng LAN trường học: vai trò Switch vs Hub, cổng WAN/LAN của Router, địa chỉ IP cục bộ và nguyên lý chia sẻ tài nguyên phần cứng.',
    keyTakeaway: 'Switch chống xung đột tốt hơn Hub; cổng WAN kết nối Internet, cổng LAN kết nối mạng nội bộ.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Chủ đề 2: Mạng máy tính và Internet',
    sourceYear: 2024,
    isVerified: true,
  },

  // CÂU TỰ CHỌN ICT 2: THIẾT KẾ TRANG WEB VỚI HTML5 & CSS3 (TIN 12 - CHỦ ĐỀ 4)
  {
    id: 'Q_CS12_TF_03',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'ICT',
    stem: 'Một học sinh thiết kế giao diện trang web giới thiệu câu lạc bộ Tin học. Xem xét đoạn mã HTML và CSS sau:\n\n' +
          '<div id="main-banner" class="highlight-box flex-center">\n' +
          '  <h1 class="title">CLB TIN HỌC TRẺ</h1>\n' +
          '  <a href="dangky.html">Đăng ký ngay</a>\n' +
          '</div>\n\n' +
          'Hãy xác định tính ĐÚNG hoặc SAI của các phát biểu sau:',
    conceptId: 'CS12_WEB_CSS_ADVANCED',
    topicId: 'WEB_DEVELOPMENT',
    grade: 12,
    strand: 'CS',
    cognitiveLevel: 'application',
    difficulty: 'hard',
    estimatedTimeSec: 160,
    competencyCode: 'NLe',
    codeSnippet: {
      language: 'html',
      code: '<div id="main-banner" class="highlight-box flex-center">\n  <h1 class="title">CLB TIN HỌC TRẺ</h1>\n  <a href="dangky.html">Đăng ký ngay</a>\n</div>',
    },
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Trong CSS, bộ chọn #main-banner có độ ưu tiên (Specificity) cao hơn bộ chọn .highlight-box khi cả hai cùng định nghĩa thuộc tính color.',
        isCorrect: true,
        explanation: 'Đúng. ID selector (#id) có độ ưu tiên (100) cao hơn nhiều so với Class selector (.class có độ ưu tiên 10).',
      },
      {
        subOrder: 'b',
        statementText: 'Thẻ <div> trên có thể đồng thời nhận định dạng từ cả hai lớp CSS là "highlight-box" và "flex-center".',
        isCorrect: true,
        explanation: 'Đúng. Thuộc tính class cho phép chỉ định nhiều lớp cách nhau bởi dấu cách trắng.',
      },
      {
        subOrder: 'c',
        statementText: 'Liên kết href="dangky.html" là một liên kết tuyệt đối (Absolute URL) trỏ đến một máy chủ trên Internet.',
        isCorrect: false,
        explanation: 'Sai. "dangky.html" là liên kết tương đối (Relative URL), trỏ đến tệp tin nằm cùng thư mục trên máy chủ cục bộ.',
      },
      {
        subOrder: 'd',
        statementText: 'Khoảng cách giữa nội dung chữ bên trong thẻ <div> và đường viền (border) bao quanh nó được xác định bởi thuộc tính margin.',
        isCorrect: false,
        explanation: 'Sai. Khoảng cách giữa nội dung và đường viền là padding; margin là khoảng cách từ đường viền ra không gian bên ngoài.',
      },
    ],
    explanation: 'Câu hỏi kiểm tra kiến thức chuyên sâu về độ ưu tiên CSS (Specificity), nhiều class, đường dẫn tương đối và mô hình hộp Box Model (Padding vs Margin).',
    keyTakeaway: 'ID có độ ưu tiên cao hơn Class; Padding là đệm bên trong viền, Margin là lề ngoài viền.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Chủ đề 4: Thiết kế trang web',
    sourceYear: 2024,
    isVerified: true,
  },

  // CÂU TỰ CHỌN ICT 3: HỆ ĐIỀU HÀNH & PHẦN CỨNG MÁY TÍNH (TIN 11 - CHỦ ĐỀ 1)
  {
    id: 'Q_CS11_TF_02',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'ICT',
    stem: 'Khi tìm hiểu về cấu trúc máy tính và phần mềm hệ thống trong chương trình Tin học 11, học sinh phân tích vai trò của Hệ điều hành và các linh kiện phần cứng. Hãy xác định tính ĐÚNG hoặc SAI của các mệnh đề sau:',
    conceptId: 'CS11_OS_HARDWARE',
    topicId: 'OPERATING_SYSTEMS_HARDWARE',
    grade: 11,
    strand: 'ICT',
    cognitiveLevel: 'comprehension',
    difficulty: 'medium',
    estimatedTimeSec: 140,
    competencyCode: 'NLa',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Bộ nhớ RAM là bộ nhớ khả biến (volatile), toàn bộ dữ liệu đang lưu trong RAM sẽ bị biến mất khi máy tính bị mất nguồn điện.',
        isCorrect: true,
        explanation: 'Đúng. RAM là bộ nhớ truy cập ngẫu nhiên tạm thời, cần điện thế liên tục để duy trì trạng thái dữ liệu.',
      },
      {
        subOrder: 'b',
        statementText: 'Ổ đĩa thể rắn (SSD) sử dụng các chip nhớ Flash NAND nên có tốc độ đọc/ghi dữ liệu nhanh hơn và khả năng chống sốc cơ học tốt hơn so với ổ cứng cơ quay (HDD).',
        isCorrect: true,
        explanation: 'Đúng. SSD không có các phiến đĩa quay và đầu đọc cơ khí như HDD nên tốc độ truy xuất vượt trội và bền bỉ hơn khi di chuyển.',
      },
      {
        subOrder: 'c',
        statementText: 'Hệ điều hành Linux là phần mềm nguồn đóng độc quyền thương mại và người dùng không được phép chỉnh sửa mã nguồn.',
        isCorrect: false,
        explanation: 'Sai. Nhân Linux được phát hành theo giấy phép nguồn mở GNU General Public License (GPL), cho phép người dùng tự do xem, sửa đổi và phân phối mã nguồn.',
      },
      {
        subOrder: 'd',
        statementText: 'Mạch cộng nhị phân 1 bit (Half-Adder) sử dụng kết hợp một cổng XOR để tính bit Tổng (Sum) và một cổng AND để tính bit Nhớ (Carry).',
        isCorrect: true,
        explanation: 'Đúng. Trong sơ đồ mạch cộng nửa Half-Adder: Sum = A XOR B và Carry = A AND B.',
      },
    ],
    explanation: 'Câu hỏi kiểm tra kiến thức về bộ nhớ trong/ngoài (RAM vs SSD/HDD), phần mềm nguồn mở Linux theo chuẩn GNU GPL và cấu trúc mạch logic cơ bản trong CPU.',
    keyTakeaway: 'RAM mất dữ liệu khi mất điện; SSD bền và nhanh hơn HDD; Linux là nguồn mở; Half-Adder gồm XOR và AND.',
    source: 'SGK Tin học 11 (Kết nối tri thức) - Chủ đề 1: Máy tính và xã hội tri thức',
    sourceYear: 2023,
    isVerified: true,
  },

  // CÂU TỰ CHỌN ICT 4: THIẾT BỊ SỐ, SMART HOME & GOOGLE SITES (TIN 12 - CHỦ ĐỀ 6, 7)
  {
    id: 'Q_CS12_TF_04',
    questionType: 'true_false_multistatement',
    sectionScope: 'elective',
    track: 'ICT',
    stem: 'Một nhóm học sinh triển khai dự án "Ngôi trường thông minh" ứng dụng các kiến thức Tin học ứng dụng lớp 12: lắp đặt thiết bị nhà thông minh Smart Home và xây dựng website giới thiệu bằng Google Sites. Hãy xác định tính ĐÚNG hoặc SAI của mỗi phát biểu sau:',
    conceptId: 'CS12_ICT_SMART_DEVICES',
    topicId: 'APPLIED_INFORMATICS_12',
    grade: 12,
    strand: 'ICT',
    cognitiveLevel: 'application',
    difficulty: 'medium',
    estimatedTimeSec: 150,
    competencyCode: 'NLe',
    trueFalseStatements: [
      {
        subOrder: 'a',
        statementText: 'Công tắc điện thông minh kết nối mạng Wi-Fi cho phép người dùng hẹn giờ tự động bật/tắt đèn hoặc điều khiển từ xa qua ứng dụng trên điện thoại thông minh.',
        isCorrect: true,
        explanation: 'Đúng. Đây là tính năng cơ bản của các thiết bị chấp hành trong hệ thống Smart Home (sử dụng ứng dụng như Vhome, Rạng Đông, Tuya).',
      },
      {
        subOrder: 'b',
        statementText: 'Cổng giao tiếp VGA truyền tải đồng thời cả tín hiệu hình ảnh kỹ thuật số chất lượng cao và tín hiệu âm thanh đa kênh qua một sợi cáp duy nhất.',
        isCorrect: false,
        explanation: 'Sai. Cổng VGA chỉ truyền tín hiệu hình ảnh dạng tương tự (analog) và không truyền âm thanh. Cổng HDMI mới truyền đồng thời cả âm thanh và hình ảnh kỹ thuật số.',
      },
      {
        subOrder: 'c',
        statementText: 'Trên trang web Google Sites, ta có thể nhúng trực tiếp bản đồ Google Maps chỉ dẫn đường đi tới trường học bằng cách dán liên kết hoặc chọn địa điểm trong công cụ Chèn.',
        isCorrect: true,
        explanation: 'Đúng. Google Sites có tính năng tích hợp sẵn Google Maps để nhúng khung bản đồ tương tác vào nội dung trang web.',
      },
      {
        subOrder: 'd',
        statementText: 'Tệp biểu tượng thu nhỏ Favicon trên Google Sites sẽ hiển thị ở góc trái trên tab của trình duyệt web khi người dùng truy cập trang web.',
        isCorrect: true,
        explanation: 'Đúng. Favicon là biểu tượng nhận diện thương hiệu nhỏ (thường 16x16 hoặc 32x32 pixel) xuất hiện trên tab trình duyệt cạnh tiêu đề trang.',
      },
    ],
    explanation: 'Kiểm tra kiến thức ứng dụng thực tế: hệ thống Smart Home điều khiển qua Wi-Fi, sự khác biệt giữa cổng VGA và HDMI, và các tính năng thiết kế web trực quan trên Google Sites (Maps, Favicon).',
    keyTakeaway: 'HDMI truyền cả hình ảnh và âm thanh; VGA chỉ truyền hình ảnh analog; Favicon hiển thị trên tab trình duyệt.',
    source: 'SGK Tin học 12 (Kết nối tri thức) - Chủ đề 6 & 7: Ứng dụng tin học & Thiết bị số',
    sourceYear: 2024,
    isVerified: true,
  },
];

export type ServerDiagnosticGrade = 10 | 11 | 12;

export const SERVER_DIAGNOSTIC_QUESTION_BANK_VERSION = 'tinmaster-diagnostic-v1';

export function getServerDiagnosticGrades(grade: unknown): ServerDiagnosticGrade[] {
  switch (grade) {
    case 10:
      return [10];
    case 11:
      return [10, 11];
    case 12:
      return [10, 11, 12];
    default:
      throw new RangeError('A valid student grade (10, 11, or 12) is required.');
  }
}

export function filterServerDiagnosticQuestions(
  grade: unknown,
  questions: readonly Question[],
  examTrack?: unknown
): Question[] {
  const eligibleGrades = new Set(getServerDiagnosticGrades(grade));
  if (
    examTrack !== undefined &&
    examTrack !== null &&
    examTrack !== 'CS' &&
    examTrack !== 'ICT'
  ) {
    throw new RangeError('A valid student exam orientation is required.');
  }
  return questions.filter((question) =>
    eligibleGrades.has(question.grade) &&
    (examTrack === undefined || examTrack === null ||
      question.track === 'ALL' || question.track === examTrack)
  );
}

export function selectServerDiagnosticQuestions(
  grade: unknown,
  examTrack?: unknown
): Question[] {
  return filterServerDiagnosticQuestions(grade, SERVER_DIAGNOSTIC_QUESTION_BANK, examTrack);
}

export function diagnosticOptionId(questionId: string, label: string): string {
  return `${questionId}:option:${label}`;
}

export function projectDiagnosticQuestion(
  question: Question
): PublicQuestionPresentation {
  const shared = {
    id: question.id,
    stem: question.stem,
    ...(question.codeSnippet ? { codeSnippet: question.codeSnippet } : {}),
    ...(question.diagramDesc ? { diagramDesc: question.diagramDesc } : {}),
  };

  if (question.questionType === 'single_choice') {
    return {
      ...shared,
      questionType: 'single_choice',
      singleChoiceOptions: (question.singleChoiceOptions ?? []).map((option) => ({
        optionId: diagnosticOptionId(question.id, option.label),
        label: option.label,
        text: option.text,
      })),
    };
  }

  return {
    ...shared,
    questionType: 'true_false_multistatement',
    trueFalseStatements: (question.trueFalseStatements ?? []).map((statement) => ({
      subOrder: statement.subOrder,
      statementText: statement.statementText,
    })),
  };
}

export function getPrivateDiagnosticScoringData(
  question: Question
): PrivateQuestionScoringData {
  if (question.questionType === 'single_choice') {
    const correctOptions = (question.singleChoiceOptions ?? [])
      .filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error(`Question ${question.id} must have exactly one correct option.`);
    }
    return {
      questionId: question.id,
      questionType: 'single_choice',
      correctOptionId: diagnosticOptionId(question.id, correctOptions[0].label),
    };
  }

  const statements = question.trueFalseStatements ?? [];
  if (
    statements.length !== 4 ||
    new Set(statements.map((statement) => statement.subOrder)).size !== 4
  ) {
    throw new Error(`Question ${question.id} must have four uniquely ordered statements.`);
  }

  return {
    questionId: question.id,
    questionType: 'true_false_multistatement',
    correctAnswers: statements.reduce<Record<'a' | 'b' | 'c' | 'd', boolean>>(
      (answers, statement) => {
        answers[statement.subOrder] = statement.isCorrect;
        return answers;
      },
      { a: false, b: false, c: false, d: false }
    ),
  };
}

export function createTrustedDiagnosticQuestionRecord(
  question: Question
): TrustedQuestionRecord {
  return {
    presentation: projectDiagnosticQuestion(question),
    scoring: getPrivateDiagnosticScoringData(question),
  };
}
