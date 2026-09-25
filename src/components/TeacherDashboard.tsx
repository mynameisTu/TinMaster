import React, { useState } from 'react';
import {
  Download,
  Sparkles,
  HardDrive,
  TrendingUp,
} from 'lucide-react';

interface MockStudentRow {
  id: string;
  name: string;
  avgScore: number;
  aiCore: number;
  htmlCss: number;
  sqlSelect: number;
  sqlAdv: number;
  status: 'Ổn định' | 'Cẩn trọng' | 'Lỗ hổng';
  statusBadge: 'badge-success' | 'badge-warning' | 'badge-error';
}

const SAMPLE_STUDENTS: MockStudentRow[] = [
  {
    id: 's1',
    name: 'Nguyễn Văn An',
    avgScore: 7.8,
    aiCore: 88,
    htmlCss: 92,
    sqlSelect: 42,
    sqlAdv: 50,
    status: 'Ổn định',
    statusBadge: 'badge-success',
  },
  {
    id: 's2',
    name: 'Trần Thị Bích',
    avgScore: 7.1,
    aiCore: 65,
    htmlCss: 91,
    sqlSelect: 74,
    sqlAdv: 50,
    status: 'Cẩn trọng',
    statusBadge: 'badge-warning',
  },
  {
    id: 's3',
    name: 'Lê Hoàng Cường',
    avgScore: 6.9,
    aiCore: 91,
    htmlCss: 90,
    sqlSelect: 37,
    sqlAdv: 50,
    status: 'Lỗ hổng',
    statusBadge: 'badge-error',
  },
  {
    id: 's4',
    name: 'Phạm Minh Đức',
    avgScore: 8.6,
    aiCore: 95,
    htmlCss: 96,
    sqlSelect: 82,
    sqlAdv: 50,
    status: 'Ổn định',
    statusBadge: 'badge-success',
  },
  {
    id: 's5',
    name: 'Đỗ Thùy Dung',
    avgScore: 6.2,
    aiCore: 70,
    htmlCss: 60,
    sqlSelect: 35,
    sqlAdv: 50,
    status: 'Lỗ hổng',
    statusBadge: 'badge-error',
  },
];

interface TeacherDashboardProps {
  onOpenVideoModal?: () => void;
  onOpenGoogleWorkspace?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onOpenVideoModal,
  onOpenGoogleWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('12A1');
  const [showPrediction, setShowPrediction] = useState<boolean>(false);

  const filteredStudents = SAMPLE_STUDENTS.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Học sinh', 'Điểm TB', 'AI Core', 'HTML5/CSS', 'SQL Select', 'SQL Advanced', 'Trạng thái'];
    const rows = SAMPLE_STUDENTS.map((s) => [
      s.name,
      s.avgScore,
      `${s.aiCore}%`,
      `${s.htmlCss}%`,
      `${s.sqlSelect}%`,
      `${s.sqlAdv}%`,
      s.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TinMaster_BaoCao_${selectedClass}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ổn định':
        return <span className="status-stable">Ổn định</span>;
      case 'Cần lưu ý':
        return <span className="status-caution">Cần lưu ý</span>;
      case 'Lỗ hổng':
        return <span className="status-gap">Lỗ hổng</span>;
      default:
        return <span className="status-caution">{status}</span>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="status-stable">{score}%</span>;
    if (score >= 60) return <span className="text-slate-700 font-mono text-xs font-medium">{score}%</span>;
    if (score >= 45) return <span className="status-caution">{score}%</span>;
    return <span className="status-gap">{score}%</span>;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_380px] lg:grid-cols-[1fr_320px] gap-6 sm:gap-7 pb-12">
      {/* LEFT CONTENT AREA */}
      <div className="space-y-5">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Báo cáo phân tích lớp {selectedClass}
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
              Hệ thống giám sát sư phạm thích ứng & bản đồ năng lực thời gian thực
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs sm:text-[13px] font-medium bg-white border border-slate-200 rounded-md px-3.5 py-1.5 text-slate-700 cursor-pointer"
            >
              <option value="12A1">Lớp 12A1 (Sĩ số: 38)</option>
              <option value="12A2">Lớp 12A2 (Sĩ số: 40)</option>
              <option value="12A3">Lớp 12A3 (Sĩ số: 36)</option>
            </select>
          </div>
        </div>

        {/* Prediction insight banner if triggered */}
        {showPrediction && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-[13px] text-slate-700 flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-slate-600 shrink-0" />
              <span>
                <strong>Dự báo AI 2025:</strong> Xác suất đạt từ 8.0 trở lên của lớp {selectedClass} đạt <strong>68.4%</strong>. Chuyên đề then chốt cần bồi dưỡng: <em>Truy vấn CSDL & SQL</em>.
              </span>
            </div>
            <button
              onClick={() => setShowPrediction(false)}
              className="text-slate-400 hover:text-slate-700 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Panel 1: Mastery Map Table */}
        <div className="panel">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="text-[14px] font-semibold text-slate-800">Ma trận năng lực chi tiết (Mastery Map)</div>
            <input
              type="text"
              placeholder="Tìm học sinh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-200 px-3 py-1.5 text-xs sm:text-[13px] rounded-md bg-white w-44 sm:w-56 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs sm:text-[13px]">
                  <th className="py-3 px-4">Học sinh</th>
                  <th className="py-3 px-4 text-center">Điểm TB</th>
                  <th className="py-3 px-4 text-center">AI Core</th>
                  <th className="py-3 px-4 text-center">HTML5/CSS</th>
                  <th className="py-3 px-4 text-center">SQL Select</th>
                  <th className="py-3 px-4 text-center">SQL Advanced</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-medium text-slate-900 text-[14.5px]">{s.name}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 text-[14px]">
                      {s.avgScore}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getScoreBadge(s.aiCore)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getScoreBadge(s.htmlCss)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getScoreBadge(s.sqlSelect)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getScoreBadge(s.sqlAdv)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(s.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 2: System Stats & Behavior */}
        <div className="panel">
          <div className="text-xs font-semibold text-slate-800 pb-3 border-b border-slate-100">
            Hành vi làm bài & Thống kê hệ thống
          </div>
          <div className="pt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-400">
                Thời gian TB
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-slate-900">
                114s
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">
                Độ chính xác
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-slate-900">
                74.2%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">
                Số câu hỏi
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-slate-900">
                2,410
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR (ASIDE) */}
      <aside className="panel flex flex-col justify-between space-y-6">
        <div>
          <span className="text-[14px] font-semibold text-slate-800 block mb-3.5">Thông báo sư phạm AI</span>

          <div className="space-y-3">
            <div className="p-3 bg-red-50/60 rounded-md border border-red-200 text-xs sm:text-[13px] text-slate-800 leading-relaxed">
              <p>
                <strong className="text-red-700">Cảnh báo:</strong> 68% học sinh có lỗ hổng kiến thức SQL JOIN. Thời gian phản hồi vượt quá 145s/câu.
              </p>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-md border border-amber-200 text-xs sm:text-[13px] text-slate-800 leading-relaxed">
              <p>
                <strong className="text-amber-700">Cảnh báo hành vi:</strong> 12 lượt thi đoán mò tại Phần II (Đúng/Sai). Thời gian đọc đề &lt; 20s.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs sm:text-[13px] text-slate-700 leading-relaxed">
              <p>
                <strong className="text-slate-900">Tiến bộ:</strong> Chuyên đề HTML5 & CSS tăng trưởng +18% độ làm chủ trong 7 ngày qua.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
          <span className="text-xs sm:text-[13px] font-semibold text-slate-700 block mb-1">Hành động nhanh</span>
          
          {/* SINGLE PRIMARY ACTION PER PAGE */}
          <button
            onClick={handleExportCSV}
            className="btn w-full justify-center text-xs sm:text-[13px] py-2.5"
            title="Xuất file CSV báo cáo kết quả lớp"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất báo cáo CSV</span>
          </button>

          <button
            onClick={() => setShowPrediction(true)}
            className="btn-secondary w-full justify-center text-xs sm:text-[13px] py-2.5"
            title="Dự báo phân phối điểm thi THPT"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Dự báo kết quả thi</span>
          </button>

          {onOpenVideoModal && (
            <button
              onClick={onOpenVideoModal}
              className="btn-secondary w-full justify-center text-xs py-2"
              title="Tạo video bài học AI 3 phút"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tạo bài giảng AI</span>
            </button>
          )}

          {onOpenGoogleWorkspace && (
            <button
              onClick={onOpenGoogleWorkspace}
              className="btn-secondary w-full justify-center text-xs py-2"
              title="Đồng bộ Google Drive & Báo cáo Gmail"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Google Workspace</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
