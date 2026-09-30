import React, { useEffect, useState, useCallback } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  HardDrive,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import {
  archiveClassroom,
  createClassroom,
  createClassroomInvitation,
  getClassroomInvitations,
  getClassroomStudents,
  listMyClassrooms,
  removeClassroomStudent,
  revokeClassroomInvitation,
  updateClassroom,
  type Classroom,
  type ClassroomInvitationSummary,
  type ClassroomStudent,
} from '../services/classroomService';

interface TeacherDashboardProps {
  onOpenVideoModal?: () => void;
  onOpenGoogleWorkspace?: () => void;
  client?: SupabaseClient | null;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onOpenVideoModal,
  onOpenGoogleWorkspace,
  client = supabase,
}) => {
  // Main Classrooms State
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'active' | 'archived'>('active');

  // Selected Classroom Detail State
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [invitations, setInvitations] = useState<ClassroomInvitationSummary[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<'students' | 'invitations' | 'settings'>('students');
  const [studentSearch, setStudentSearch] = useState('');

  // Classroom Edit State
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create Classroom Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createGrade, setCreateGrade] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // New Invitation Modal State
  const [showNewInvitationModal, setShowNewInvitationModal] = useState(false);
  const [invitationMaxUses, setInvitationMaxUses] = useState(100);
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Newly Created Code Display Modal
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<{
    code: string;
    expiresAt: string;
    classroomName: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Generic Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Fetch Classrooms List
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

  // Fetch Classroom Details (Students + Invitations)
  const fetchClassroomDetails = useCallback(
    async (classroom: Classroom) => {
      if (!client) return;
      setLoadingDetails(true);
      setError(null);
      try {
        const [studentsData, invitationsData] = await Promise.all([
          getClassroomStudents(client, classroom.id),
          getClassroomInvitations(client, classroom.id),
        ]);
        setStudents(studentsData);
        setInvitations(invitationsData);
        setEditName(classroom.name);
        setEditGrade(classroom.grade);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải chi tiết lớp học.');
      } finally {
        setLoadingDetails(false);
      }
    },
    [client]
  );

  // Handle Open Classroom Detail
  const handleOpenClassroom = (classroom: Classroom) => {
    setSelectedClassroom(classroom);
    setDetailTab('students');
    setStudentSearch('');
    void fetchClassroomDetails(classroom);
  };

  // Handle Create Classroom
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || creating) return;

    setCreateError(null);
    setCreating(true);
    try {
      const grade = typeof createGrade === 'number' ? createGrade : null;
      const created = await createClassroom(client, {
        name: createName,
        grade,
      });

      setShowCreateModal(false);
      setCreateName('');
      setCreateGrade('');
      setNewlyCreatedCode({
        code: created.invitationCode,
        expiresAt: created.invitationExpiresAt,
        classroomName: createName.trim(),
      });
      await fetchClassrooms();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Không thể tạo lớp học.');
    } finally {
      setCreating(false);
    }
  };

  // Handle Create Invitation Code
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedClassroom || creatingInvitation) return;

    setInvitationError(null);
    setCreatingInvitation(true);
    try {
      const invitation = await createClassroomInvitation(
        client,
        selectedClassroom.id,
        invitationMaxUses
      );
      setShowNewInvitationModal(false);
      setNewlyCreatedCode({
        code: invitation.invitationCode,
        expiresAt: invitation.invitationExpiresAt,
        classroomName: selectedClassroom.name,
      });
      await fetchClassroomDetails(selectedClassroom);
    } catch (err) {
      setInvitationError(err instanceof Error ? err.message : 'Không thể tạo mã mời mới.');
    } finally {
      setCreatingInvitation(false);
    }
  };

  // Handle Copy Code to Clipboard
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Trigger Confirmation for Revoking Invitation
  const triggerRevokeInvitation = (invitation: ClassroomInvitationSummary) => {
    setConfirmDialog({
      title: 'Thu hồi mã mời',
      message:
        'Bạn có chắc chắn muốn thu hồi mã mời này? Học sinh sẽ không thể sử dụng mã này để tham gia lớp nữa.',
      confirmText: 'Thu hồi mã',
      danger: true,
      onConfirm: async () => {
        if (!client || !selectedClassroom) return;
        await revokeClassroomInvitation(client, invitation.id);
        setSuccessMessage('Đã thu hồi mã mời thành công.');
        setTimeout(() => setSuccessMessage(null), 3500);
        await fetchClassroomDetails(selectedClassroom);
      },
    });
  };

  // Trigger Confirmation for Removing Student
  const triggerRemoveStudent = (student: ClassroomStudent) => {
    if (!selectedClassroom) return;
    setConfirmDialog({
      title: 'Xóa học sinh khỏi lớp',
      message: `Bạn có chắc chắn muốn xóa học sinh "${student.displayName}" khỏi lớp? Lịch sử tham gia của học sinh vẫn được lưu giữ an toàn.`,
      confirmText: 'Xóa học sinh',
      danger: true,
      onConfirm: async () => {
        if (!client) return;
        await removeClassroomStudent(client, selectedClassroom.id, student.studentId);
        setSuccessMessage(`Đã xóa học sinh "${student.displayName}" khỏi lớp.`);
        setTimeout(() => setSuccessMessage(null), 3500);
        await fetchClassroomDetails(selectedClassroom);
      },
    });
  };

  // Trigger Confirmation for Archiving Classroom
  const triggerArchiveClassroom = (classroom: Classroom) => {
    setConfirmDialog({
      title: 'Lưu trữ lớp học',
      message: `Bạn có chắc chắn muốn lưu trữ lớp "${classroom.name}"? Khi đã lưu trữ: toàn bộ mã mời chưa dùng sẽ tự động bị thu hồi, học sinh không thể thao tác thêm, và lớp học chuyển sang trạng thái chỉ đọc vĩnh viễn.`,
      confirmText: 'Xác nhận lưu trữ',
      danger: true,
      onConfirm: async () => {
        if (!client) return;
        await archiveClassroom(client, classroom.id);
        setSuccessMessage(`Đã lưu trữ lớp "${classroom.name}".`);
        setTimeout(() => setSuccessMessage(null), 3500);
        await fetchClassrooms();
        if (selectedClassroom?.id === classroom.id) {
          setSelectedClassroom((prev) =>
            prev ? { ...prev, archivedAt: new Date().toISOString() } : null
          );
        }
      },
    });
  };

  // Handle Edit Classroom Name & Grade
  const handleSaveClassroomEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedClassroom || savingEdit) return;

    setSavingEdit(true);
    setError(null);
    try {
      const updated = await updateClassroom(client, selectedClassroom.id, {
        name: editName,
        grade: editGrade,
      });
      setSelectedClassroom(updated);
      setSuccessMessage('Đã cập nhật thông tin lớp học thành công.');
      setTimeout(() => setSuccessMessage(null), 3500);
      await fetchClassrooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật lớp học.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredClassrooms = classrooms.filter((c) =>
    activeTabFilter === 'active' ? c.archivedAt === null : c.archivedAt !== null
  );

  const filteredStudents = students.filter((s) =>
    s.displayName.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <section className="mx-auto max-w-6xl space-y-5 pb-12">
      {/* SUCCESS / ERROR ALERTS */}
      {successMessage && (
        <div className="flex items-center space-x-2 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs shadow-xs">
          {error}
        </div>
      )}

      {/* VIEW 1: CLASSROOM DETAIL VIEW */}
      {selectedClassroom ? (
        <div className="space-y-5">
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedClassroom(null);
                void fetchClassrooms();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center space-x-1.5 cursor-pointer py-1.5 px-2.5 rounded-md hover:bg-slate-100 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại danh sách lớp</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchClassroomDetails(selectedClassroom)}
                disabled={loadingDetails}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition disabled:opacity-50"
                title="Làm mới dữ liệu lớp"
              >
                <RefreshCw className={`h-4 w-4 ${loadingDetails ? 'animate-spin' : ''}`} />
              </button>
              {selectedClassroom.archivedAt === null && (
                <button
                  type="button"
                  onClick={() => setShowNewInvitationModal(true)}
                  className="btn text-xs py-1.5 px-3 flex items-center space-x-1.5 cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Tạo mã mời mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Classroom Header Banner */}
          <div className="panel space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-xl font-bold text-slate-900">{selectedClassroom.name}</h1>
                  {selectedClassroom.grade && (
                    <span className="badge-track-ict text-xs font-semibold px-2.5 py-0.5 rounded-md">
                      Khối {selectedClassroom.grade}
                    </span>
                  )}
                  {selectedClassroom.archivedAt !== null ? (
                    <span className="badge-diff-hard text-xs font-medium px-2 py-0.5 rounded-md">
                      Đã lưu trữ
                    </span>
                  ) : (
                    <span className="badge-diff-easy text-xs font-medium px-2 py-0.5 rounded-md">
                      Đang hoạt động
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Ngày tạo: {new Date(selectedClassroom.createdAt).toLocaleDateString('vi-VN')}
                  {selectedClassroom.archivedAt && (
                    <> • Lưu trữ ngày: {new Date(selectedClassroom.archivedAt).toLocaleDateString('vi-VN')}</>
                  )}
                </p>
              </div>

              {selectedClassroom.archivedAt === null && (
                <button
                  type="button"
                  onClick={() => triggerArchiveClassroom(selectedClassroom)}
                  className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 py-1.5 px-3 rounded-lg transition inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Lưu trữ lớp học</span>
                </button>
              )}
            </div>

            {selectedClassroom.archivedAt !== null && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center space-x-2">
                <Archive className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Lớp học này đã được lưu trữ và đang ở chế độ chỉ đọc. Toàn bộ mã mời đã bị thu hồi.
                </span>
              </div>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-4">
            <button
              type="button"
              onClick={() => setDetailTab('students')}
              className={`pb-2.5 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center space-x-1.5 ${
                detailTab === 'students'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Học sinh ({students.filter((s) => !s.leftAt).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('invitations')}
              className={`pb-2.5 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center space-x-1.5 ${
                detailTab === 'invitations'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Mã mời ({invitations.length})</span>
            </button>
            {selectedClassroom.archivedAt === null && (
              <button
                type="button"
                onClick={() => setDetailTab('settings')}
                className={`pb-2.5 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center space-x-1.5 ${
                  detailTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Edit2 className="h-4 w-4" />
                <span>Cài đặt lớp</span>
              </button>
            )}
          </div>

          {/* DETAIL TAB 1: STUDENTS ROSTER */}
          {detailTab === 'students' && (
            <div className="panel space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Tìm học sinh theo tên…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Tổng: <strong className="text-slate-900">{students.length}</strong> học sinh (
                  {students.filter((s) => !s.leftAt).length} đang học)
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center items-center py-8 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm">Đang tải danh sách học sinh…</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg">
                  <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">
                    {studentSearch ? 'Không tìm thấy học sinh phù hợp' : 'Chưa có học sinh nào trong lớp'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Hãy tạo mã mời và gửi cho học sinh để các em tham gia vào lớp.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="var-table">
                    <thead>
                      <tr>
                        <th>Họ và tên</th>
                        <th>Ngày tham gia</th>
                        <th>Trạng thái</th>
                        {selectedClassroom.archivedAt === null && (
                          <th style={{ textAlign: 'center' }}>Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.studentId}>
                          <td className="font-semibold text-slate-900">{s.displayName}</td>
                          <td className="text-slate-600 text-xs">
                            {new Date(s.joinedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td>
                            {s.leftAt ? (
                              <span className="badge-diff-hard text-[11px] font-medium px-2 py-0.5 rounded">
                                Đã rời lớp ({new Date(s.leftAt).toLocaleDateString('vi-VN')})
                              </span>
                            ) : (
                              <span className="badge-diff-easy text-[11px] font-medium px-2 py-0.5 rounded">
                                Đang học
                              </span>
                            )}
                          </td>
                          {selectedClassroom.archivedAt === null && (
                            <td style={{ textAlign: 'center' }}>
                              {!s.leftAt && (
                                <button
                                  type="button"
                                  onClick={() => triggerRemoveStudent(s)}
                                  className="text-[11px] text-slate-500 hover:text-red-600 font-medium inline-flex items-center space-x-1 cursor-pointer py-1 px-2 rounded hover:bg-red-50 transition"
                                  title="Xóa học sinh khỏi lớp"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                  <span>Xóa</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DETAIL TAB 2: INVITATIONS */}
          {detailTab === 'invitations' && (
            <div className="panel space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Mã mời tham gia lớp</h3>
                  <p className="text-xs text-slate-500">
                    Mã mời bảo mật tự động hết hạn sau 7 ngày hoặc khi đạt giới hạn số lượt.
                  </p>
                </div>
                {selectedClassroom.archivedAt === null && (
                  <button
                    type="button"
                    onClick={() => setShowNewInvitationModal(true)}
                    className="btn text-xs py-1.5 px-3 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tạo mã mời mới</span>
                  </button>
                )}
              </div>

              {loadingDetails ? (
                <div className="flex justify-center items-center py-8 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm">Đang tải mã mời…</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg">
                  <KeyRound className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Chưa có mã mời nào</p>
                  <button
                    type="button"
                    onClick={() => setShowNewInvitationModal(true)}
                    className="btn-secondary text-xs mt-3 inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tạo mã mời đầu tiên</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="var-table">
                    <thead>
                      <tr>
                        <th>Mã định danh</th>
                        <th>Lượt sử dụng</th>
                        <th>Hạn dùng</th>
                        <th>Trạng thái</th>
                        {selectedClassroom.archivedAt === null && (
                          <th style={{ textAlign: 'center' }}>Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((inv) => {
                        const isExpired = new Date(inv.expiresAt) <= new Date();
                        const isRevoked = inv.revokedAt !== null;
                        const isExhausted = inv.useCount >= inv.maxUses;
                        const isValid = !isExpired && !isRevoked && !isExhausted;

                        return (
                          <tr key={inv.id}>
                            <td className="font-mono text-xs text-slate-600">
                              {inv.id.slice(0, 8)}…{inv.id.slice(-4)}
                            </td>
                            <td className="font-mono text-xs">
                              <span className="font-semibold text-slate-900">{inv.useCount}</span>
                              <span className="text-slate-400"> / {inv.maxUses}</span>
                            </td>
                            <td className="text-xs text-slate-600">
                              {new Date(inv.expiresAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td>
                              {isRevoked ? (
                                <span className="badge-diff-hard text-[11px] font-medium px-2 py-0.5 rounded">
                                  Đã thu hồi
                                </span>
                              ) : isExpired ? (
                                <span className="badge-diff-medium text-[11px] font-medium px-2 py-0.5 rounded">
                                  Hết hạn
                                </span>
                              ) : isExhausted ? (
                                <span className="badge-diff-hard text-[11px] font-medium px-2 py-0.5 rounded">
                                  Đã hết lượt
                                </span>
                              ) : (
                                <span className="badge-diff-easy text-[11px] font-medium px-2 py-0.5 rounded">
                                  Đang hiệu lực
                                </span>
                              )}
                            </td>
                            {selectedClassroom.archivedAt === null && (
                              <td style={{ textAlign: 'center' }}>
                                {isValid && (
                                  <button
                                    type="button"
                                    onClick={() => triggerRevokeInvitation(inv)}
                                    className="text-[11px] text-slate-500 hover:text-red-600 font-medium inline-flex items-center space-x-1 cursor-pointer py-1 px-2 rounded hover:bg-red-50 transition"
                                    title="Thu hồi mã mời này"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Thu hồi</span>
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DETAIL TAB 3: CLASSROOM SETTINGS */}
          {detailTab === 'settings' && selectedClassroom.archivedAt === null && (
            <div className="panel max-w-xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
                Chỉnh sửa thông tin lớp
              </h3>
              <form onSubmit={(e) => void handleSaveClassroomEdit(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên lớp học
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={120}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khối lớp
                  </label>
                  <select
                    value={editGrade ?? ''}
                    onChange={(e) =>
                      setEditGrade(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="">Chưa thiết lập</option>
                    <option value="10">Khối 10</option>
                    <option value="11">Khối 11</option>
                    <option value="12">Khối 12</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingEdit || !editName.trim()}
                    className="btn text-xs py-2 px-4 cursor-pointer flex items-center space-x-1.5"
                  >
                    {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>{savingEdit ? 'Đang lưu…' : 'Lưu thay đổi'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: CLASSROOMS OVERVIEW LIST */
        <div className="space-y-5">
          {/* Header & Quick Actions */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý Lớp học</h1>
              <p className="mt-1 text-xs text-slate-500">
                Tạo lớp, phát hành mã mời và theo dõi hoạt động học tập của học sinh.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchClassrooms()}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition disabled:opacity-50"
                title="Làm mới danh sách lớp"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {onOpenVideoModal && (
                <button
                  type="button"
                  onClick={onOpenVideoModal}
                  className="btn-secondary text-xs py-2 px-3.5 cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>Bài giảng AI</span>
                </button>
              )}
              {onOpenGoogleWorkspace && (
                <button
                  type="button"
                  onClick={onOpenGoogleWorkspace}
                  className="btn-secondary text-xs py-2 px-3.5 cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <HardDrive className="h-4 w-4 text-emerald-600" />
                  <span>Google Workspace</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateName('');
                  setCreateGrade('');
                  setShowCreateModal(true);
                }}
                className="btn text-xs py-2 px-4 cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo lớp học mới</span>
              </button>
            </div>
          </header>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-200 space-x-3">
            <button
              type="button"
              onClick={() => setActiveTabFilter('active')}
              className={`pb-2.5 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center space-x-1.5 ${
                activeTabFilter === 'active'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Đang hoạt động ({classrooms.filter((c) => !c.archivedAt).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter('archived')}
              className={`pb-2.5 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center space-x-1.5 ${
                activeTabFilter === 'archived'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Đã lưu trữ ({classrooms.filter((c) => c.archivedAt).length})</span>
            </button>
          </div>

          {/* Classrooms List / Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải danh sách lớp học…</span>
            </div>
          ) : filteredClassrooms.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                {activeTabFilter === 'active' ? 'Chưa có lớp học nào' : 'Chưa có lớp học đã lưu trữ'}
              </h2>
              <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                {activeTabFilter === 'active'
                  ? 'Nhấn "Tạo lớp học mới" để tạo lớp đầu tiên và nhận mã mời phát cho học sinh.'
                  : 'Các lớp học khi được lưu trữ sẽ xuất hiện tại đây ở trạng thái chỉ đọc.'}
              </p>
              {activeTabFilter === 'active' && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="btn text-xs mt-4 inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tạo lớp học ngay</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClassrooms.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                        {c.name}
                      </h3>
                      {c.grade && (
                        <span className="badge-track-ict shrink-0 text-xs font-semibold px-2 py-0.5 rounded">
                          Khối {c.grade}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tạo ngày: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenClassroom(c)}
                      className="btn text-xs py-1.5 px-3 cursor-pointer"
                    >
                      Quản lý lớp
                    </button>
                    {c.archivedAt === null ? (
                      <button
                        type="button"
                        onClick={() => triggerArchiveClassroom(c)}
                        className="text-[11px] text-slate-500 hover:text-red-600 font-medium py-1 px-2 rounded hover:bg-slate-50 transition cursor-pointer"
                      >
                        Lưu trữ
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Đã lưu trữ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: TẠO LỚP HỌC MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleCreateClassroom(e)}
            className="w-full max-w-md bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-base text-slate-900">Tạo lớp học mới</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tên lớp học *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ví dụ: 12A1 - Tin học THPT 2025"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Khối lớp (Tùy chọn)
              </label>
              <select
                value={createGrade}
                onChange={(e) =>
                  setCreateGrade(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
              >
                <option value="">Không phân khối cụ thể</option>
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hệ thống sẽ tự động tạo một mã mời 7 ngày đầu tiên sau khi lớp học được khởi tạo.
            </p>

            {createError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating || !createName.trim()}
                className="btn text-xs py-2 px-4 cursor-pointer flex items-center space-x-1.5"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{creating ? 'Đang tạo lớp…' : 'Xác nhận tạo lớp'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: TẠO MÃ MỜI MỚI */}
      {showNewInvitationModal && selectedClassroom && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleCreateInvitation(e)}
            className="w-full max-w-md bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-base text-slate-900">Tạo mã mời tham gia lớp</h3>
              <button
                type="button"
                onClick={() => setShowNewInvitationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Lớp:{' '}
              <strong className="text-slate-900">&quot;{selectedClassroom.name}&quot;</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Giới hạn lượt tham gia (1 đến 500)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={invitationMaxUses}
                onChange={(e) => setInvitationMaxUses(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Mặc định: 100 lượt. Mã sẽ hết hiệu lực sau 7 ngày hoặc khi hết lượt.
              </span>
            </div>

            {invitationError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {invitationError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowNewInvitationModal(false)}
                disabled={creatingInvitation}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creatingInvitation}
                className="btn text-xs py-2 px-4 cursor-pointer flex items-center space-x-1.5"
              >
                {creatingInvitation && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{creatingInvitation ? 'Đang tạo mã…' : 'Phát hành mã mời'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: HIỂN THỊ MÃ MỜI MỚI TẠO (CHỈ HIỂN THỊ 1 LẦN) */}
      {newlyCreatedCode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-emerald-600 pb-2 border-b border-slate-100">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="font-semibold text-base text-slate-900">Mã mời lớp học mới</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mã mời cho lớp{' '}
              <strong className="text-slate-900">&quot;{newlyCreatedCode.classroomName}&quot;</strong>{' '}
              đã sẵn sàng. Vì lý do bảo mật, chuỗi mã này chỉ hiển thị một lần duy nhất:
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="font-mono text-xs text-slate-900 break-all select-all p-2 bg-white rounded border border-slate-200">
                {newlyCreatedCode.code}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Hết hạn: {new Date(newlyCreatedCode.expiresAt).toLocaleDateString('vi-VN')}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode(newlyCreatedCode.code)}
                  className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center space-x-1 cursor-pointer"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Đã chép!' : 'Sao chép mã'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNewlyCreatedCode(null)}
                className="btn text-xs py-2 px-4 cursor-pointer"
              >
                Đã lưu mã xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN HÀNH ĐỘNG PHÁ HỦY / THAY ĐỔI LỚN */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-semibold text-base text-slate-900">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={confirming}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirming(true);
                  try {
                    await confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Thao tác không thành công.');
                  } finally {
                    setConfirming(false);
                  }
                }}
                disabled={confirming}
                className={`text-white rounded-lg text-xs py-2 px-4 font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                  confirmDialog.danger ? 'bg-red-600 hover:bg-red-700' : 'btn'
                }`}
              >
                {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{confirming ? 'Đang xử lý…' : confirmDialog.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
