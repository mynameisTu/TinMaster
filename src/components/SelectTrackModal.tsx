import React, { useState } from 'react';
import { ExamTrack, EXAM_TRACK_LABELS } from '../types';
import {
  Code2,
  Globe,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Layers,
  Database,
  Network,
  Cpu,
  X,
} from 'lucide-react';

interface SelectTrackModalProps {
  isOpen: boolean;
  currentTrack?: ExamTrack | null;
  onSelectTrack: (track: ExamTrack) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

export const SelectTrackModal: React.FC<SelectTrackModalProps> = ({
  isOpen,
  currentTrack,
  onSelectTrack,
  onClose,
  title = 'Đăng Ký Định Hướng Thi Tốt Nghiệp THPT',
  subtitle = 'Đề thi chuẩn BGDĐT gồm 24 câu trắc nghiệm, 2 câu Đúng/Sai chung và 2 câu Đúng/Sai tự chọn theo định hướng bạn đăng ký.',
}) => {
  const [selected, setSelected] = useState<ExamTrack>(currentTrack || 'CS');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectTrack(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
              Quy chế thi THPT môn Tin học từ 2025
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start space-x-2 text-xs text-slate-600 bg-amber-50 border border-amber-200 p-3 rounded-xl">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý:</strong> Bạn làm 2 câu Đúng/Sai chung và đúng <strong>2 câu hỏi tự chọn</strong> thuộc định hướng đã chọn. Mỗi câu Đúng/Sai tối đa 1.0 điểm.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Track 1: CS */}
            <div
              onClick={() => setSelected('CS')}
              className={`p-4 sm:p-5 rounded-xl border-2 transition cursor-pointer relative flex flex-col justify-between ${
                selected === 'CS'
                  ? 'bg-blue-50/60 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      selected === 'CS'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selected === 'CS' && <CheckCircle2 className="w-3.5 h-3.5 fill-white" />}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="font-bold text-sm text-slate-900">Khoa học máy tính</span>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">CS</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3 font-mono">Computer Science Track</p>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Dành cho học sinh định hướng các ngành Công nghệ thông tin, Kỹ thuật phần mềm, Khoa học dữ liệu và AI.
                </p>

                <div className="space-y-1.5 text-[11px] text-slate-700 pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Thuật toán & Lập trình Python nâng cao</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Cơ sở dữ liệu quan hệ RDBMS & SQL</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Trí tuệ nhân tạo (AI) & Học máy cốt lõi</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Số câu tự chọn:</span>
                <span className="text-blue-700 font-mono font-bold">2 câu (2.0 điểm)</span>
              </div>
            </div>

            {/* Track 2: ICT */}
            <div
              onClick={() => setSelected('ICT')}
              className={`p-4 sm:p-5 rounded-xl border-2 transition cursor-pointer relative flex flex-col justify-between ${
                selected === 'ICT'
                  ? 'bg-emerald-50/60 border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      selected === 'ICT'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selected === 'ICT' && <CheckCircle2 className="w-3.5 h-3.5 fill-white" />}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="font-bold text-sm text-slate-900">Tin học ứng dụng / Khoa học ứng dụng</span>
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">ICT</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3 font-mono">Applied Informatics & Science Track</p>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Dành cho học sinh định hướng ứng dụng thực hành đa ngành: kinh tế số, truyền thông số, quản trị mạng và thiết kế số.
                </p>

                <div className="space-y-1.5 text-[11px] text-slate-700 pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5">
                    <Network className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Mạng máy tính, Internet & Thiết bị mạng</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Thiết kế Web HTML5/CSS3 & Google Sites</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Thiết bị số thông minh Smart Home & Đồ họa</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Số câu tự chọn:</span>
                <span className="text-emerald-700 font-mono font-bold">2 câu (2.0 điểm)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Đã chọn: <strong className="text-slate-800">{EXAM_TRACK_LABELS[selected].title}</strong>
          </span>
          <div className="flex items-center space-x-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer"
              >
                Hủy
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className="btn text-xs py-2 px-5 flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <span>Xác nhận & Bắt đầu làm bài</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
