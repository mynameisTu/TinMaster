# TinMaster – Hệ thống luyện thi Tin học THPT thích ứng

TinMaster là dự án Khoa học Kỹ thuật hướng đến việc xây dựng nền tảng ôn luyện thông minh cho học sinh THPT. Dự án ứng dụng trí tuệ nhân tạo (AI) để phân tích năng lực học tập, cá nhân hóa lộ trình ôn luyện và hỗ trợ học sinh chuẩn bị hiệu quả cho kỳ thi tốt nghiệp THPT môn Tin học.

## Chạy ứng dụng cục bộ

**Yêu cầu:** Node.js

1. Cài đặt dependencies: `npm install`
2. Sao chép `.env.example` thành `.env` và cấu hình `GEMINI_API_KEY` trong file cục bộ.
3. Khởi động ứng dụng: `npm run dev`

Xem [hướng dẫn triển khai Vercel](docs/deployment-vercel.md) để biết thêm về triển khai và các giới hạn tải tệp Supabase Storage hiện tại.

Xem [hướng dẫn Supabase Auth](docs/supabase-auth-setup.md) về Google OAuth, Supabase Auth, khởi tạo quản trị viên và bảo mật vai trò giáo viên.
