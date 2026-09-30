import { useState } from 'react';
import { redeemTeacherInvitation } from '../services/authService';
import { supabase } from '../services/supabaseClient';

interface TeacherInvitationModalProps {
  onClose: () => void;
  onRedeemed: () => Promise<void>;
}

export function TeacherInvitationModal({ onClose, onRedeemed }: TeacherInvitationModalProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await redeemTeacherInvitation(supabase, token);
      await onRedeemed();
      onClose();
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Không thể sử dụng mã mời.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md bg-white rounded-xl p-5 space-y-4 shadow-xl">
        <div>
          <h2 className="font-bold text-lg text-slate-900">Mã mời giáo viên</h2>
          <p className="text-sm text-slate-600 mt-1">
            Mã chỉ dùng được một lần với tài khoản Google đã xác minh đúng email được mời.
          </p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Mã mời
          <input
            autoComplete="off"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-600">
            Hủy
          </button>
          <button disabled={isSubmitting} className="var-btn text-sm disabled:opacity-60">
            {isSubmitting ? 'Đang xác minh…' : 'Xác minh lời mời'}
          </button>
        </div>
      </form>
    </div>
  );
}
