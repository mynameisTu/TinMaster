import { useCallback, useEffect, useState } from 'react';
import {
  createTeacherInvitation,
  revokeTeacherInvitation,
  setUserRole,
} from '../services/authService';
import { supabase } from '../services/supabaseClient';

interface TeacherRecord {
  id: string;
  email: string;
  display_name: string;
}

interface InvitationRecord {
  id: string;
  invited_email: string;
  expires_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
}

function adminActionError(error: { code?: string; status?: number; message: string }): string {
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  if (error.code === '42501' || error.status === 403) {
    return 'Tài khoản hiện tại không có quyền quản trị cho thao tác này.';
  }
  return error.message;
}

export function AdminRoleManagement() {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [email, setEmail] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [teacherResult, invitationResult] = await Promise.all([
      supabase.from('profiles').select('id,email,display_name').eq('role', 'teacher'),
      supabase
        .from('teacher_invitations')
        .select('id,invited_email,expires_at,redeemed_at,revoked_at')
        .order('created_at', { ascending: false }),
    ]);
    const queryError = teacherResult.error || invitationResult.error;
    if (queryError) setError(adminActionError(queryError));
    else {
      setTeachers(teacherResult.data ?? []);
      setInvitations(invitationResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const issueInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    setNewToken(null);
    try {
      const invitation = await createTeacherInvitation(supabase, email);
      setNewToken(invitation.token);
      setEmail('');
      await reload();
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? adminActionError(inviteError)
          : 'Không thể tạo lời mời.'
      );
    } finally {
      setBusy(false);
    }
  };

  const revokeTeacher = async (teacher: TeacherRecord) => {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setUserRole(supabase, teacher.id, 'student');
      await reload();
    } catch (roleError) {
      setError(
        roleError instanceof Error
          ? adminActionError(roleError)
          : 'Không thể thu hồi quyền giáo viên.'
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeTeacherInvitation(supabase, invitationId);
      await reload();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? adminActionError(revokeError)
          : 'Không thể thu hồi lời mời.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto mb-8 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Quản lý vai trò</h2>
        <p className="text-sm text-slate-600">
          Lời mời có hạn 7 ngày. Mã hiển thị đúng một lần; hãy gửi riêng cho email được mời.
        </p>
      </div>

      <form onSubmit={(event) => void issueInvitation(event)} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email Google đã xác minh của giáo viên"
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button disabled={busy} className="var-btn text-sm disabled:opacity-60">
          Tạo mã mời giáo viên
        </button>
      </form>

      {newToken && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">Mã một lần — hãy sao chép và gửi riêng:</p>
          <code className="mt-1 block break-all select-all">{newToken}</code>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-slate-800 mb-2">Giáo viên ({teachers.length})</h3>
          {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : (
            <ul className="divide-y divide-slate-100">
              {teachers.map((teacher) => (
                <li key={teacher.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{teacher.display_name || teacher.email} <span className="text-slate-500">({teacher.email})</span></span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeTeacher(teacher)}
                    className="shrink-0 text-xs text-red-700 hover:underline disabled:opacity-50"
                  >
                    Thu hồi quyền
                  </button>
                </li>
              ))}
              {!teachers.length && <li className="py-2 text-sm text-slate-500">Chưa có giáo viên.</li>}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 mb-2">Lời mời</h3>
          {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : (
            <ul className="divide-y divide-slate-100">
              {invitations.map((invitation) => {
                const active = !invitation.redeemed_at && !invitation.revoked_at &&
                  new Date(invitation.expires_at).getTime() > Date.now();
                return (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      {invitation.invited_email}
                      <span className="block text-xs text-slate-500">
                        {invitation.redeemed_at ? 'Đã sử dụng' : invitation.revoked_at ? 'Đã thu hồi' : active ? 'Đang chờ' : 'Đã hết hạn'}
                      </span>
                    </span>
                    {active && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelInvitation(invitation.id)}
                        className="shrink-0 text-xs text-red-700 hover:underline disabled:opacity-50"
                      >
                        Thu hồi
                      </button>
                    )}
                  </li>
                );
              })}
              {!invitations.length && <li className="py-2 text-sm text-slate-500">Chưa có lời mời.</li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
