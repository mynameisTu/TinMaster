import React, { useState } from 'react';
import { Mail, ShieldCheck, X } from 'lucide-react';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (email: string, name: string) => void;
  currentEmail?: string;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  currentEmail = '',
}) => {
  const [emailInput, setEmailInput] = useState<string>(currentEmail || 'ngoctu@gmail.com');
  const [nameInput, setNameInput] = useState<string>('Ngoc Tu');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const cleanEmail = emailInput.trim();
    const cleanName = nameInput.trim() || cleanEmail.split('@')[0];
    onSignIn(cleanEmail, cleanName);
    onClose();
  };

  const handleQuickSelect = (email: string, name: string) => {
    onSignIn(email, name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-[#d1d5db] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d1d5db] bg-[#f8fafc]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-[#0066cc] text-white flex items-center justify-center font-mono font-bold text-xs">
              &gt;_
            </div>
            <h3 className="font-sans font-bold text-base text-[#1a1a1a]">
              ĐĂNG NHẬP BẰNG GMAIL
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed font-sans">
            Hệ thống chuẩn hóa phiên bản luyện thi thích ứng Tin học THPT. Tất cả dữ liệu học tập, Bayesian Knowledge Tracing và lịch sử luyện thi sẽ được đồng bộ theo tài khoản Google/Gmail của bạn.
          </p>

          {/* Preset Google Accounts */}
          <div className="space-y-2">
            <span className="font-sans text-xs font-semibold text-slate-500 uppercase">
              Tài khoản Google đề xuất:
            </span>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect('ngoctu@gmail.com', 'Ngoc Tu')}
                className="w-full flex items-center justify-between p-2.5 rounded border border-[#d1d5db] hover:border-[#0066cc] hover:bg-[#f0f7ff] transition cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0066cc] flex items-center justify-center font-bold text-xs">
                    N
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#1a1a1a]">Ngoc Tu</div>
                    <div className="mono text-xs text-slate-500">ngoctu@gmail.com</div>
                  </div>
                </div>
                <span className="var-badge text-[10px] text-[#0066cc]">Chọn</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickSelect('tungotrinhho2703@gmail.com', 'Tú Ngô Trình')}
                className="w-full flex items-center justify-between p-2.5 rounded border border-[#d1d5db] hover:border-[#0066cc] hover:bg-[#f0f7ff] transition cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#1a1a1a]">Tú Ngô Trình</div>
                    <div className="mono text-xs text-slate-500">tungotrinhho2703@gmail.com</div>
                  </div>
                </div>
                <span className="var-badge text-[10px] text-[#0066cc]">Chọn</span>
              </button>
            </div>
          </div>

          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-[#d1d5db]" />
            <span className="px-2 text-xs text-slate-400 uppercase font-sans">Hoặc nhập Gmail khác</span>
            <div className="flex-1 border-t border-[#d1d5db]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-sans text-xs font-semibold text-slate-700 mb-1">
                Họ và Tên hiển thị
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ví dụ: Nguyễn Minh Tú"
                className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
              />
            </div>

            <div>
              <label className="block font-sans text-xs font-semibold text-slate-700 mb-1">
                Địa chỉ Gmail (@gmail.com)
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] mono"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="var-btn-outline text-xs"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="var-btn text-xs flex items-center space-x-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Xác nhận đăng nhập Gmail</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
