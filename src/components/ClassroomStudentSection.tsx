import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  DoorOpen,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import {
  joinClassroom,
  leaveClassroom,
  listMyClassrooms,
  type Classroom,
} from '../services/classroomService';

interface ClassroomStudentSectionProps {
  client?: SupabaseClient | null;
}

export const ClassroomStudentSection: React.FC<ClassroomStudentSectionProps> = ({
  client = supabase,
}) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Join Modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Leave Modal state
  const [leavingClassroom, setLeavingClassroom] = useState<Classroom | null>(null);
  const [leaving, setLeaving] = useState(false);

  const fetchClassrooms = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listMyClassrooms(client);
      setClassrooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách lớp học.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchClassrooms();
  }, [fetchClassrooms]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || joining) return;

    setJoinError(null);
    setJoining(true);
    try {
      await joinClassroom(client, invitationCode);
      setSuccessMessage('Tham gia lớp học thành công!');
      setInvitationCode('');
      setShowJoinModal(false);
      await fetchClassrooms();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Không thể tham gia lớp học.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!client || !leavingClassroom || leaving) return;

    setLeaving(true);
    try {
      await leaveClassroom(client, leavingClassroom.id);
      setSuccessMessage(`Đã rời khỏi lớp "${leavingClassroom.name}".`);
      setLeavingClassroom(null);
      await fetchClassrooms();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể rời lớp học.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="panel space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Lớp học của tôi</h2>
            <p className="text-xs text-slate-500">
              Lớp học chính thức được hướng dẫn bởi giáo viên bộ môn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchClassrooms()}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition disabled:opacity-50"
            title="Làm mới danh sách lớp"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setJoinError(null);
              setInvitationCode('');
              setShowJoinModal(true);
            }}
            className="btn text-xs py-1.5 px-3 flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tham gia lớp học</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-sm">Đang tải danh sách lớp học…</span>
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <BookOpen className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Chưa tham gia lớp học nào</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Nhận mã mời gồm 48 ký tự từ giáo viên Tin học của bạn và nhấn &quot;Tham gia lớp học&quot; để kết nối.
          </p>
          <button
            type="button"
            onClick={() => {
              setJoinError(null);
              setInvitationCode('');
              setShowJoinModal(true);
            }}
            className="btn-secondary text-xs mt-3.5 inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nhập mã tham gia</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {classrooms.map((c) => (
            <div
              key={c.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{c.name}</h3>
                  {c.grade && (
                    <span className="badge-track-ict shrink-0 text-[11px] font-medium px-2 py-0.5 rounded">
                      Khối {c.grade}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Đã tham gia: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Đang hoạt động
                </span>
                <button
                  type="button"
                  onClick={() => setLeavingClassroom(c)}
                  className="text-[11px] text-slate-500 hover:text-red-600 font-medium cursor-pointer inline-flex items-center space-x-1 transition"
                  title="Rời khỏi lớp học này"
                >
                  <DoorOpen className="h-3.5 w-3.5" />
                  <span>Rời lớp</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: THAM GIA LỚP HỌC */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleJoin(e)}
            className="w-full max-w-md bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-base text-slate-900">Tham gia lớp học</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Nhập mã mời do giáo viên cung cấp để ghi danh vào lớp. Mã mời gồm 48 ký tự thập lục phân (hex).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mã mời tham gia
              </label>
              <textarea
                rows={2}
                required
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                placeholder="Ví dụ: a1b2c3d4e5f6..."
                className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs focus:border-blue-600 focus:outline-hidden resize-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {invitationCode.trim().length}/48 ký tự
              </span>
            </div>

            {joinError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {joinError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                disabled={joining}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={joining || !invitationCode.trim()}
                className="btn text-xs py-2 px-4.5 cursor-pointer flex items-center space-x-1.5"
              >
                {joining && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{joining ? 'Đang kiểm tra…' : 'Xác nhận tham gia'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRM LEAVE */}
      {leavingClassroom && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-semibold text-base text-slate-900">Xác nhận rời lớp học</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn rời khỏi lớp{' '}
              <strong className="text-slate-900">&quot;{leavingClassroom.name}&quot;</strong>? Nếu muốn tham gia lại, bạn sẽ cần xin mã mời mới từ giáo viên.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLeavingClassroom(null)}
                disabled={leaving}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleLeave()}
                disabled={leaving}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs py-2 px-4 font-medium transition cursor-pointer flex items-center space-x-1.5"
              >
                {leaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{leaving ? 'Đang xử lý…' : 'Xác nhận rời'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
