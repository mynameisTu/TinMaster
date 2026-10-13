import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Code2,
  Globe2,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Save,
  Settings2,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../types';
import {
  updateMyStudentGrade,
  updatePassword,
  STUDENT_GRADE_OPTIONS,
  validateStudentGrade,
} from '../services/authService';
import { supabase } from '../services/supabaseClient';
import {
  createAvatarUrl,
  cropAvatarImage,
  deleteOldAvatar,
  getMyMemberProfile,
  getPublicMember,
  removeMyAvatar,
  updateMyMemberProfile,
  uploadMyAvatar,
  validateAvatarFile,
  validateUsername,
  type MemberProfile,
  type PublicMember,
} from '../services/memberService';
import { MemberAvatar } from './MemberAvatar';

const roleLabels: Record<UserRole, string> = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  admin: 'Quản trị viên',
};

function configurationMessage(): string {
  return supabase
    ? 'Tính năng hồ sơ chưa được cấu hình trên Supabase.'
    : 'Cấu hình Supabase chưa đầy đủ.';
}

export function PublicMemberProfilePage({
  username,
  ownProfile,
  onBack,
  onOpenSettings,
}: {
  username: string;
  ownProfile: MemberProfile | null;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const [member, setMember] = useState<PublicMember | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setError(configurationMessage());
      setLoading(false);
      return () => { active = false; };
    }

    const client = supabase;
    setLoading(true);
    setError(null);
    void getPublicMember(client, username)
      .then(async (result) => {
        if (!active) return;
        setMember(result);
        if (result?.avatarPath) {
          const url = await createAvatarUrl(client, result.avatarPath);
          if (active) setAvatarUrl(url);
        } else {
          setAvatarUrl(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải hồ sơ thành viên.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [username]);

  const isOwnProfile = Boolean(ownProfile && ownProfile.username === username);
  const displayedMember = member ?? (isOwnProfile ? ownProfile : null);

  return (
    <section className="member-page member-profile-page">
      <button type="button" className="member-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> Thành viên
      </button>
      {loading ? (
        <div className="member-empty" aria-live="polite">Đang tải hồ sơ…</div>
      ) : error ? (
        <div className="member-alert member-alert-error" role="alert">{error}</div>
      ) : !displayedMember ? (
        <div className="member-empty">
          <UserRound aria-hidden="true" />
          <h1>Không tìm thấy thành viên</h1>
          <p>Hồ sơ này không tồn tại hoặc chưa có username công khai.</p>
        </div>
      ) : (
        <article className="member-profile-card">
          <div className="member-profile-cover" />
          <div className="member-profile-body">
            <div className="member-profile-heading">
              <MemberAvatar
                name={displayedMember.displayName}
                src={avatarUrl}
                size="xl"
              />
              <div className="member-profile-title">
                <span className="member-eyebrow">HỒ SƠ THÀNH VIÊN</span>
                <h1>{displayedMember.displayName}</h1>
                <p>@{displayedMember.username}</p>
              </div>
              {isOwnProfile && (
                <button
                  type="button"
                  className="member-button member-button-secondary member-edit-profile"
                  onClick={onOpenSettings}
                >
                  <Settings2 aria-hidden="true" /> Chỉnh sửa hồ sơ
                </button>
              )}
            </div>

            <dl className="member-profile-details">
              <div>
                <dt>Mã thành viên</dt>
                <dd className="member-id">{displayedMember.publicMemberId}</dd>
              </div>
              <div>
                <dt>Vai trò</dt>
                <dd><span className="member-role-badge">{roleLabels[displayedMember.role]}</span></dd>
              </div>
              <div>
                <dt>Định hướng học tập</dt>
                <dd>
                  {displayedMember.examTrack === 'CS' ? (
                    <span className="member-track"><Code2 aria-hidden="true" /> Khoa học máy tính · CS</span>
                  ) : displayedMember.examTrack === 'ICT' ? (
                    <span className="member-track"><Globe2 aria-hidden="true" /> Tin học ứng dụng · ICT</span>
                  ) : 'Chưa thiết lập'}
                </dd>
              </div>
            </dl>

            <section className="member-achievements">
              <h2>Thành tích học tập</h2>
              <p>Thành tích xác minh sẽ hiển thị khi có dữ liệu học tập được lưu trữ an toàn.</p>
            </section>
          </div>
        </article>
      )}
    </section>
  );
}

export function AccountSettingsPage({
  email,
  grade,
  onBack,
  onSaved,
  onGradeSaved,
}: {
  email: string;
  grade?: 10 | 11 | 12;
  onBack: () => void;
  onSaved: (profile: MemberProfile) => void;
  onGradeSaved: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [examTrack, setExamTrack] = useState<'ICT' | 'CS' | ''>('');
  const [selectedGrade, setSelectedGrade] = useState<'10' | '11' | '12' | ''>(
    () => validateStudentGrade(grade) ? String(grade) as '10' | '11' | '12' : ''
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gradeLoading, setGradeLoading] = useState(true);
  const [gradeLoaded, setGradeLoaded] = useState(false);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeSuccess, setGradeSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setPageError(configurationMessage());
      setLoading(false);
      return () => { active = false; };
    }

    const client = supabase;
    void getMyMemberProfile(client)
      .then(async (result) => {
        if (!active) return;
        setProfile(result);
        setDisplayName(result.displayName);
        setUsername(result.username ?? '');
        setExamTrack(result.examTrack ?? '');
        if (result.role === 'student') {
          try {
            const { data: gradeRecord, error: gradeLoadError } = await client
              .from('profiles')
              .select('grade')
              .eq('id', result.id)
              .maybeSingle();
            if (gradeLoadError || !gradeRecord) {
              throw new Error('Không thể tải khối lớp đã lưu. Vui lòng tải lại cài đặt.');
            }
            setSelectedGrade(
              validateStudentGrade(gradeRecord.grade)
                ? String(gradeRecord.grade) as '10' | '11' | '12'
                : ''
            );
            setGradeLoaded(true);
          } catch (gradeLoadError) {
            setSelectedGrade('');
            setGradeError(
              gradeLoadError instanceof Error
                ? gradeLoadError.message
                : 'Không thể tải khối lớp đã lưu. Vui lòng tải lại cài đặt.'
            );
          } finally {
            setGradeLoading(false);
          }
        } else {
          setGradeLoaded(true);
          setGradeLoading(false);
        }
        const signedUrl = await createAvatarUrl(client, result.avatarPath);
        if (active) setAvatarUrl(signedUrl);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setPageError(loadError instanceof Error ? loadError.message : 'Không thể tải cài đặt tài khoản.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSelectedGrade(
      validateStudentGrade(grade) ? String(grade) as '10' | '11' | '12' : ''
    );
  }, [grade]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  const usernameValidation = useMemo(() => validateUsername(username), [username]);

  const saveGrade = async () => {
    if (!supabase || !profile || profile.role !== 'student') return;
    setGradeSaving(true);
    setGradeError(null);
    setGradeSuccess(null);
    try {
      const gradeToSave = selectedGrade === '' ? null : Number(selectedGrade);
      const savedGrade = await updateMyStudentGrade(supabase, gradeToSave);
      setSelectedGrade(
        savedGrade !== null && savedGrade !== undefined
          ? (String(savedGrade) as '10' | '11' | '12')
          : ''
      );
      await onGradeSaved();
      setGradeSuccess(savedGrade ? 'Đã lưu khối lớp.' : 'Đã xóa khối lớp.');
    } catch (saveError) {
      setGradeError(saveError instanceof Error ? saveError.message : 'Không thể lưu khối lớp.');
    } finally {
      setGradeSaving(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const updated = await updateMyMemberProfile(supabase, {
        displayName,
        username,
        examTrack: examTrack || null,
      });
      setProfile(updated);
      onSaved(updated);
      setProfileSuccess('Đã lưu hồ sơ.');
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : 'Không thể lưu hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAvatarError(null);
    if (!file) return;
    const validation = validateAvatarFile(file);
    if (validation) {
      setAvatarError(validation);
      return;
    }
    setZoom(1);
    setSelectedImage(file);
  };

  const uploadAvatar = async () => {
    if (!supabase || !profile || !selectedImage) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const cropped = await cropAvatarImage(selectedImage, zoom);
      const uploaded = await uploadMyAvatar(supabase, profile.id, cropped);
      const updatedProfile = { ...profile, avatarPath: uploaded.avatarPath };
      setProfile(updatedProfile);
      onSaved(updatedProfile);
      setSelectedImage(null);
      try {
        const signedUrl = await createAvatarUrl(supabase, uploaded.avatarPath);
        setAvatarUrl(signedUrl);
      } catch (urlError) {
        setAvatarUrl(null);
        setAvatarError(urlError instanceof Error ? urlError.message : 'Ảnh đã lưu nhưng chưa tải được bản xem.');
      }
      try {
        await deleteOldAvatar(supabase, uploaded.oldAvatarPath);
      } catch (cleanupError) {
        setAvatarError(cleanupError instanceof Error ? cleanupError.message : 'Chưa dọn được ảnh cũ.');
      }
    } catch (uploadError) {
      setAvatarError(uploadError instanceof Error ? uploadError.message : 'Không thể cập nhật ảnh.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!supabase) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const oldAvatarPath = await removeMyAvatar(supabase);
      setAvatarUrl(null);
      const updatedProfile = profile ? { ...profile, avatarPath: null } : null;
      setProfile(updatedProfile);
      if (updatedProfile) onSaved(updatedProfile);
      try {
        await deleteOldAvatar(supabase, oldAvatarPath);
      } catch (cleanupError) {
        setAvatarError(cleanupError instanceof Error ? cleanupError.message : 'Ảnh đã gỡ nhưng chưa dọn được tệp cũ.');
      }
    } catch (removeError) {
      setAvatarError(removeError instanceof Error ? removeError.message : 'Không thể gỡ ảnh đại diện.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu cần có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setPasswordBusy(true);
    try {
      await updatePassword(supabase, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Đã cập nhật mật khẩu.');
    } catch {
      setPasswordError('Không thể đổi mật khẩu. Hãy đăng nhập lại rồi thử lại.');
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <section className="member-page settings-page">
      <button type="button" className="member-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> Quay lại
      </button>
      <header className="member-page-header">
        <div>
          <div className="member-eyebrow">TÀI KHOẢN</div>
          <h1>Cài đặt hồ sơ</h1>
          <p>Quản lý thông tin công khai và bảo mật tài khoản.</p>
        </div>
      </header>

      {pageError && <div className="member-alert member-alert-error" role="alert">{pageError}</div>}
      {loading ? (
        <div className="member-empty" aria-live="polite">Đang tải cài đặt…</div>
      ) : profile && (
        <div className="settings-layout">
          <form className="settings-panel" onSubmit={(event) => void saveProfile(event)}>
            <div className="settings-panel-heading">
              <UserRound aria-hidden="true" />
              <div><h2>Hồ sơ công khai</h2><p>Thông tin hiển thị trong danh bạ thành viên.</p></div>
            </div>

            <div className="avatar-editor">
              <div className="avatar-current">
                <MemberAvatar name={displayName || profile.displayName} src={avatarUrl} size="lg" />
                <div>
                  <strong>Ảnh đại diện</strong>
                  <p>JPEG, PNG hoặc WebP · tối đa 4 MB</p>
                  <div className="avatar-actions">
                    <label className="member-button member-button-secondary member-file-button">
                      <ImagePlus aria-hidden="true" /> Tải ảnh
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} />
                    </label>
                    {profile.avatarPath && (
                      <button
                        type="button"
                        className="member-button member-button-quiet"
                        disabled={avatarBusy}
                        onClick={() => void removeAvatar()}
                      >
                        <Trash2 aria-hidden="true" /> Gỡ ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {selectedImage && imagePreview && (
                <div className="avatar-cropper">
                  <div className="avatar-crop-preview">
                    <img
                      src={imagePreview}
                      alt="Xem trước ảnh đã chọn"
                      style={{ transform: `scale(${zoom})` }}
                    />
                  </div>
                  <label className="avatar-zoom-control">
                    Phóng to
                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className="member-button member-button-primary"
                    disabled={avatarBusy}
                    onClick={() => void uploadAvatar()}
                  >
                    {avatarBusy ? <LoaderCircle className="member-spin" /> : <Check />}
                    {avatarBusy ? 'Đang tải…' : 'Cắt và lưu ảnh'}
                  </button>
                </div>
              )}
              {avatarBusy && !selectedImage && <p className="member-inline-status">Đang cập nhật ảnh…</p>}
              {avatarError && <p className="member-inline-error" role="alert">{avatarError}</p>}
            </div>

            <label className="member-field">
              <span>Tên hiển thị</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
            </label>
            <label className="member-field">
              <span>Username</span>
              <div className="username-input-wrap">
                <span>@</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />
              </div>
              <small>3–24 ký tự: chữ thường, chữ số và dấu gạch dưới.</small>
              {usernameValidation && <small className="member-inline-error">{usernameValidation}</small>}
            </label>
            <label className="member-field">
              <span>Định hướng học tập <em>Không bắt buộc</em></span>
              <select value={examTrack} onChange={(event) => setExamTrack(event.target.value as 'ICT' | 'CS' | '')}>
                <option value="">Chưa thiết lập</option>
                <option value="CS">Khoa học máy tính · CS</option>
                <option value="ICT">Tin học ứng dụng · ICT</option>
              </select>
            </label>

            {profile.role === 'student' && (
              <section className="member-field" aria-labelledby="student-grade-label">
                <h3>Thông tin học tập</h3>
                <label id="student-grade-label" htmlFor="student-grade">
                  Khối lớp
                </label>
                <select
                  id="student-grade"
                  value={selectedGrade}
                  onChange={(event) => {
                    setSelectedGrade(event.target.value as '10' | '11' | '12' | '');
                    setGradeError(null);
                    setGradeSuccess(null);
                  }}
                  disabled={gradeLoading || !gradeLoaded || gradeSaving}
                >
                  <option value="">Chưa thiết lập</option>
                  {STUDENT_GRADE_OPTIONS.map((gradeOption) => (
                    <option key={gradeOption} value={gradeOption}>
                      Khối {gradeOption}
                    </option>
                  ))}
                </select>
                <small>Chỉ dùng để chọn nội dung đánh giá phù hợp, không hiển thị trong hồ sơ công khai.</small>
                {gradeLoading && <small role="status">Đang tải khối lớp đã lưu…</small>}
                {gradeError && <small className="member-inline-error" role="alert">{gradeError}</small>}
                {gradeSuccess && <small className="member-inline-success" role="status">{gradeSuccess}</small>}
                <button
                  type="button"
                  className="member-button member-button-secondary"
                  disabled={gradeLoading || !gradeLoaded || gradeSaving}
                  onClick={() => void saveGrade()}
                >
                  {gradeSaving ? <LoaderCircle className="member-spin" /> : <Save aria-hidden="true" />}
                  {gradeSaving ? 'Đang lưu khối lớp…' : 'Lưu khối lớp'}
                </button>
              </section>
            )}

            <div className="member-private-id">
              <span>Mã thành viên</span>
              <strong>{profile.publicMemberId}</strong>
              <small>Mã định danh công khai, chỉ quản trị viên được phép thay đổi.</small>
            </div>

            {profileError && <div className="member-alert member-alert-error" role="alert">{profileError}</div>}
            {profileSuccess && <div className="member-alert member-alert-success" role="status">{profileSuccess}</div>}
            <button className="member-button member-button-primary" type="submit" disabled={saving || Boolean(usernameValidation)}>
              {saving ? <LoaderCircle className="member-spin" /> : <Save aria-hidden="true" />}
              {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </form>

          <div className="settings-side">
            <section className="settings-panel">
              <div className="settings-panel-heading">
                <LockKeyhole aria-hidden="true" />
                <div><h2>Bảo mật tài khoản</h2><p>Thông tin đăng nhập và mật khẩu.</p></div>
              </div>
              <label className="member-field">
                <span>Email đăng nhập</span>
                <input value={email} readOnly aria-readonly="true" />
                <small>Email không hiển thị trên hồ sơ công khai.</small>
              </label>
              <a className="auth-link member-recovery-link" href="/forgot-password">
                Quên mật khẩu?
              </a>
              <form onSubmit={(event) => void savePassword(event)} className="password-form">
                <label className="member-field">
                  <span>Mật khẩu mới</span>
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                </label>
                <label className="member-field">
                  <span>Xác nhận mật khẩu</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                </label>
                {passwordError && <p className="member-inline-error" role="alert">{passwordError}</p>}
                {passwordSuccess && <p className="member-inline-success" role="status">{passwordSuccess}</p>}
                <button className="member-button member-button-secondary" type="submit" disabled={passwordBusy}>
                  {passwordBusy ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
                </button>
              </form>
            </section>

            <section className="settings-panel member-privacy-note">
              <Settings2 aria-hidden="true" />
              <div>
                <h2>Quyền riêng tư</h2>
                <p>Email, câu trả lời và lịch sử bài thi không xuất hiện trên hồ sơ công khai.</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
