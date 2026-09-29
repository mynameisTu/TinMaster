import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Search, Users } from 'lucide-react';
import type { UserRole } from '../types';
import { supabase } from '../services/supabaseClient';
import {
  createSignedAvatarUrls,
  listPublicMembers,
  type PublicMember,
} from '../services/memberService';
import { MemberAvatar } from './MemberAvatar';

interface MemberDirectoryProps {
  onOpenMember: (username: string) => void;
}

const roleLabels: Record<UserRole, string> = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  admin: 'Quản trị viên',
};

const PAGE_SIZE = 24;

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({ onOpenMember }) => {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);

  const loadMembers = useCallback(async (search: string, offset: number, append: boolean) => {
    if (!supabase) {
      setError('Cấu hình Supabase chưa đầy đủ.');
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const request = ++generation.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }

    try {
      const results = await listPublicMembers(supabase, search, offset, PAGE_SIZE);
      const urls = await createSignedAvatarUrls(supabase, results);
      if (request !== generation.current) return;
      setMembers((previous) => append ? [...previous, ...results] : results);
      setAvatarUrls((previous) => ({ ...(append ? previous : {}), ...urls }));
      setHasMore(results.length === PAGE_SIZE);
    } catch (loadError) {
      if (request === generation.current) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách thành viên.');
      }
    } finally {
      if (request === generation.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMembers(query, 0, false), 250);
    return () => {
      window.clearTimeout(timeout);
      generation.current += 1;
    };
  }, [query, loadMembers]);

  return (
    <section className="member-page">
      <header className="member-page-header">
        <div>
          <div className="member-eyebrow">CỘNG ĐỒNG TINMASTER</div>
          <h1>Thành viên</h1>
          <p>Tìm kiếm hồ sơ công khai trong cộng đồng học tập.</p>
        </div>
        <div className="member-count">
          <Users aria-hidden="true" />
          <span>{loading ? 'Đang tải' : `${members.length}${hasMore ? '+' : ''} hồ sơ`}</span>
        </div>
      </header>

      <label className="member-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Tìm theo tên, username hoặc mã thành viên</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm tên, username hoặc mã thành viên"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="member-search-clear" onClick={() => setQuery('')}>
            Xóa
          </button>
        )}
      </label>

      {error && (
        <div className="member-alert member-alert-error" role="alert">
          <p>{error}</p>
          <button type="button" className="member-inline-button" onClick={() => void loadMembers(query, 0, false)}>
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="member-empty" aria-live="polite">Đang tải thành viên…</div>
      ) : !error && members.length === 0 ? (
        <div className="member-empty">
          <Users aria-hidden="true" />
          <h2>Chưa có thành viên để hiển thị</h2>
          <p>Hồ sơ công khai sẽ xuất hiện khi thành viên chọn username.</p>
        </div>
      ) : (
        <>
          <div className="member-grid">
            {members.map((member) => (
              <button
                key={member.username}
                type="button"
                className="member-card"
                onClick={() => onOpenMember(member.username)}
              >
                <MemberAvatar
                  name={member.displayName}
                  src={avatarUrls[member.avatarPath ?? '']}
                />
                <span className="member-card-main">
                  <strong>{member.displayName}</strong>
                  <span className="member-card-username">@{member.username}</span>
                  <span className="member-card-meta">
                    {roleLabels[member.role]}
                    {member.examTrack ? ` · ${member.examTrack}` : ''}
                  </span>
                </span>
                <ArrowRight className="member-card-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
          {hasMore && (
            <div className="member-load-more">
              <button
                type="button"
                className="member-button member-button-secondary"
                disabled={loadingMore}
                onClick={() => void loadMembers(query, members.length, true)}
              >
                {loadingMore ? 'Đang tải…' : 'Tải thêm thành viên'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
