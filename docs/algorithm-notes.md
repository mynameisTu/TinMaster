# Ghi Chú Kiến Trúc Thuật Toán TinMaster (Algorithm & Academic Notes)

Tài liệu nội bộ dành cho đội ngũ phát triển và nghiên cứu giáo dục.
Hệ thống TinMaster kết hợp các mô hình Khoa học Học tập (Learning Sciences) và Trí tuệ Nhân tạo trong Giáo dục (AIED).

---

## 1. Vùng Phát Triển Gần (ZPD - Zone of Proximal Development)
- **Cơ sở lý thuyết**: Đề xuất bởi nhà tâm lý học Lev Vygotsky. ZPD là khoảng cách giữa mức độ phát triển thực tế (học sinh tự giải quyết độc lập) và mức độ phát triển tiềm năng (học sinh giải quyết được khi có sự trợ giúp hoặc bài toán có độ thử thách vừa vặn).
- **Vị trí áp dụng trong mã nguồn**:
  - `src/services/adaptiveEngine.ts`: Hàm tính điểm đề xuất câu hỏi `calculateRecommendationScore`.
  - Tiêu chí `difficultyFitScore`: Đánh giá sự khớp giữa năng lực ước lượng hiện tại của thí sinh ($\theta$) và độ khó câu hỏi ($b$).
  - **Ánh xạ ngôn ngữ giao diện (UI Copy Mapping)**:
    - *Thuật ngữ học thuật*: ZPD, Zone of Proximal Development, ZPD Adaptive.
    - *Hiển thị cho học sinh*: **"Thích ứng thông minh"**, **"Tự động điều chỉnh"**, **"Gợi ý luyện tập"**, **"Độ khó phù hợp với năng lực"**.

---

## 2. Mô Hình Lần Vết Tri Thức Bayesian (BKT - Bayesian Knowledge Tracing)
- **Cơ sở lý thuyết**: Mô hình ẩn Markov của Corbett & Anderson (1995), theo dõi trạng thái nắm vững (Mastery State $L_t \in [0, 1]$) của học sinh đối với từng khái niệm kiến thức đơn lẻ qua chuỗi quan sát nhị phân (Đúng/Sai).
- **Tham số cơ bản**:
  - $P(L_0)$: Xác suất đã vững kiến thức ban đầu (Prior).
  - $P(T)$: Xác suất chuyển đổi học tập (Transition probability sau mỗi lượt làm bài).
  - $P(G)$: Xác suất đoán mò đúng (Guess probability).
  - $P(S)$: Xác suất sơ suất làm sai dù đã vững (Slip probability).
  - Kết hợp đường cong suy giảm trí nhớ Ebbinghaus: $R(t) = e^{-\Delta t / S}$.
- **Vị trí áp dụng trong mã nguồn**:
  - `src/services/adaptiveEngine.ts`: Hàm `updateConceptMasteryBKT`.
  - Cập nhật xác suất sau quan sát theo công thức Bayes:
    $$P(L_t | \text{Correct}) = \frac{P(L_{t-1}) \cdot (1 - P(S))}{P(L_{t-1}) \cdot (1 - P(S)) + (1 - P(L_{t-1})) \cdot P(G)}$$
    $$P(L_t | \text{Incorrect}) = \frac{P(L_{t-1}) \cdot P(S)}{P(L_{t-1}) \cdot P(S) + (1 - P(L_{t-1})) \cdot (1 - P(G))}$$
    Sau đó tính chuyển đổi trạng thái: $P(L_{t+1}) = P(L_t) + (1 - P(L_t)) \cdot P(T)$.
  - **Ánh xạ ngôn ngữ giao diện (UI Copy Mapping)**:
    - *Thuật ngữ học thuật*: BKT, Bayesian Knowledge Tracing, Posterior Knowledge State.
    - *Hiển thị cho học sinh*: **"Mức độ vững kiến thức"**, **"Điểm năng lực ước lượng"**, **"Đánh giá làm chủ kiến thức"**.

---

## 3. Phân Tích Dữ Liệu Tương Tác Hành Vi (Telemetry & Hesitation Analysis)
- **Phân loại 4 góc phần tư**:
  1. *Nhanh & Đúng (Fluency / Tự tin vững vàng)*: Thời gian ngắn, không đổi đáp án.
  2. *Chậm & Đúng (Effortful Success / Suy nghĩ thấu đáo)*: Thời gian kéo dài, có thể có phân vân nhưng đạt kết quả tốt.
  3. *Nhanh & Sai (Impulsive / Vội vàng hoặc Đoán mò)*: Thời gian < 10s, cần nhắc nhở đọc kỹ đề bài.
  4. *Chậm & Sai (Struggling / Lỗ hổng kiến thức nghiêm trọng)*: Tốn nhiều thời gian, đổi đáp án nhiều lần -> Ưu tiên đưa vào "Điểm yếu cần khắc phục" và tạo Video bài học AI.
- **Ánh xạ ngôn ngữ giao diện (UI Copy Mapping)**:
  - *Thuật ngữ học thuật*: Telemetry, Answer changes count, Hesitation score.
  - *Hiển thị cho học sinh*: **"Thời gian làm bài"**, **"Số lần đổi đáp án"**, **"Câu hỏi cần xem lại"**.
