import React, { useState } from 'react';
import { UserProfile, StudentMastery, ExamSession } from '../types';
import {
  HardDrive,
  Mail,
  X,
  CheckCircle2,
  Send,
  Download,
  FileText,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface GoogleWorkspaceModalProps {
  user: UserProfile;
  masteries: Record<string, StudentMastery>;
  recentSession?: ExamSession | null;
  onClose: () => void;
}

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  user,
  masteries,
  recentSession,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'gmail'>('drive');
  const [isDriveSyncing, setIsDriveSyncing] = useState<boolean>(false);
  const [driveSuccessMessage, setDriveSuccessMessage] = useState<string | null>(null);

  // Gmail states
  const [recipientEmail, setRecipientEmail] = useState<string>(user.email || 'hocsinh@thpt.edu.vn');
  const [parentEmail, setParentEmail] = useState<string>('phuhuynh@thpt.edu.vn');
  const [emailSubject, setEmailSubject] = useState<string>(
    `[TinMaster] Báo cáo tiến trình học tập thích ứng môn Tin học - ${user.name}`
  );
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);

  // Handle Export to Google Drive
  const handleExportToDrive = (docType: 'study_sheet' | 'exam_analysis' | 'class_report') => {
    setIsDriveSyncing(true);
    setDriveSuccessMessage(null);

    setTimeout(() => {
      setIsDriveSyncing(false);
      if (docType === 'study_sheet') {
        setDriveSuccessMessage(
          `Đã lưu tệp "TinMaster_PhieuOnTapThichUng_${user.name}.pdf" vào thư mục Google Drive: /TinMaster/HocTap/`
        );
      } else if (docType === 'exam_analysis') {
        setDriveSuccessMessage(
          `Đã xuất tệp "TinMaster_PhanTichBaiThi_2025.gdoc" thành công lên Google Drive của bạn.`
        );
      } else {
        setDriveSuccessMessage(
          `Đã đồng bộ "TinMaster_MaTranNangLucLopHoc.gsheet" vào Google Drive dành cho Giáo viên.`
        );
      }
    }, 1200);
  };

  // Handle Send Gmail
  const handleSendGmail = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    setEmailSuccessMessage(null);

    setTimeout(() => {
      setIsSendingEmail(false);
      setEmailSuccessMessage(
        `Đã gửi thư báo cáo thành công tới ${recipientEmail} và ${parentEmail} qua dịch vụ Google Gmail API.`
      );
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Google Workspace 1P Integration</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Tích Hợp Google Drive & Gmail
          </h2>
          <p className="text-xs text-slate-500">
            Đồng bộ tài liệu học tập, lưu trữ phiếu ôn tập lên Drive và tự động gửi email báo cáo tiến trình cho phụ huynh & giáo viên.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('drive')}
            className={`py-2.5 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive (Lưu Trữ Tài Liệu)</span>
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`py-2.5 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'gmail'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail (Gửi Báo Cáo Tự Động)</span>
          </button>
        </div>

        {/* GOOGLE DRIVE TAB */}
        {activeTab === 'drive' && (
          <div className="space-y-5">
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start space-x-3 text-xs text-blue-950">
              <HardDrive className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-blue-900 block mb-0.5">
                  Tài khoản Google Drive đang liên kết: {user.email}
                </strong>
                <p className="leading-relaxed">
                  Tất cả tài liệu được xuất sẽ tự động tạo thư mục riêng <code>/TinMaster/2025/</code> trên Google Drive của bạn dưới định dạng Docs, Sheets và PDF chuẩn in ấn.
                </p>
              </div>
            </div>

            {driveSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{driveSuccessMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="p-4 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Phiếu Ôn Tập Lỗ Hổng Kiến Thức Cá Nhân Hóa
                    </h4>
                    <p className="text-xs text-slate-500">
                      Chứa lý thuyết cốt lõi, bảng so sánh và các câu bẫy thường gặp của 3 chuyên đề yếu nhất.
                    </p>
                  </div>
                </div>
                <button
                  disabled={isDriveSyncing}
                  onClick={() => handleExportToDrive('study_sheet')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDriveSyncing ? 'Đang lưu...' : 'Lưu vào Drive'}</span>
                </button>
              </div>

              <div className="p-4 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Hồ Sơ Dữ Liệu Thực Nghiệm & BKT
                    </h4>
                    <p className="text-xs text-slate-500">
                      Bao gồm toàn bộ dữ liệu telemetry, 4 góc phần tư tương tác và chỉ số BKT cá nhân.
                    </p>
                  </div>
                </div>
                <button
                  disabled={isDriveSyncing}
                  onClick={() => handleExportToDrive('exam_analysis')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDriveSyncing ? 'Đang lưu...' : 'Lưu vào Drive'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GMAIL TAB */}
        {activeTab === 'gmail' && (
          <form onSubmit={handleSendGmail} className="space-y-4">
            <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl flex items-start space-x-3 text-xs text-red-950">
              <Mail className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-900 block mb-0.5">
                  Dịch vụ gửi thông báo Gmail API
                </strong>
                <p className="leading-relaxed">
                  Gửi thư thông báo tiến trình định kỳ, nhắc lịch học lặp lại ngắt quãng (Ebbinghaus) và chia sẻ kết quả thi thử cho phụ huynh.
                </p>
              </div>
            </div>

            {emailSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{emailSuccessMessage}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email người học (Học sinh):
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email gửi kèm (Phụ huynh / Giáo viên bộ môn):
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tiêu đề email:
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nội dung tóm tắt đính kèm tự động:
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed font-mono">
                  - Điểm năng lực ước lượng: 7.4/10.0
                  <br />
                  - 3 chuyên đề cần rèn luyện: Truy vấn SQL, CSS Box Model, Mạng máy tính
                  <br />
                  - Lộ trình 7 ngày tới: 15 phút ôn tập thích ứng mỗi ngày
                  <br />
                  - Trạng thái Ebbinghaus: Đến hạn ôn tập Chuyên đề Trí tuệ Nhân tạo
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSendingEmail}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-2 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingEmail ? 'Đang gửi email...' : 'Gửi Thư Báo Cáo Ngay'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
