import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../types';

export const AVATAR_BUCKET = 'tinmaster-avatars';
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
export const AVATAR_SIGNED_URL_SECONDS = 60 * 60;

export interface PublicMember {
  username: string;
  publicMemberId: string;
  displayName: string;
  role: UserRole;
  examTrack: 'ICT' | 'CS' | null;
  avatarPath: string | null;
}

export interface MemberProfile extends Omit<PublicMember, 'username'> {
  id: string;
  username: string | null;
}

export function validateUsername(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 24) {
    return 'Tên người dùng cần có từ 3 đến 24 ký tự.';
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return 'Chỉ dùng chữ thường, chữ số và dấu gạch dưới.';
  }
  return null;
}

export function validateAvatarFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Chọn ảnh JPEG, PNG hoặc WebP.';
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return 'Ảnh cần có dung lượng tối đa 4 MB.';
  }
  return null;
}

function mapMemberRecord(record: Record<string, unknown>): PublicMember {
  if (
    typeof record.username !== 'string' ||
    typeof record.public_member_id !== 'string' ||
    typeof record.display_name !== 'string' ||
    !['student', 'teacher', 'admin'].includes(String(record.role))
  ) {
    throw new Error('Hồ sơ thành viên trả về không hợp lệ.');
  }

  const examTrack = record.exam_track;
  if (examTrack !== null && examTrack !== undefined && examTrack !== 'ICT' && examTrack !== 'CS') {
    throw new Error('Định hướng học tập trong hồ sơ không hợp lệ.');
  }

  return {
    username: record.username,
    publicMemberId: record.public_member_id,
    displayName: record.display_name,
    role: record.role as UserRole,
    examTrack: examTrack === 'ICT' || examTrack === 'CS' ? examTrack : null,
    avatarPath: typeof record.avatar_path === 'string' ? record.avatar_path : null,
  };
}

function mapMyMemberRecord(record: Record<string, unknown>): MemberProfile {
  const username = record.username;
  if (
    (username !== null && username !== undefined && typeof username !== 'string') ||
    typeof record.public_member_id !== 'string' ||
    typeof record.display_name !== 'string' ||
    !['student', 'teacher', 'admin'].includes(String(record.role)) ||
    typeof record.id !== 'string'
  ) {
    throw new Error('Hồ sơ thành viên trả về không hợp lệ.');
  }

  const examTrack = record.exam_track;
  if (examTrack !== null && examTrack !== undefined && examTrack !== 'ICT' && examTrack !== 'CS') {
    throw new Error('Định hướng học tập trong hồ sơ không hợp lệ.');
  }

  return {
    publicMemberId: record.public_member_id,
    displayName: record.display_name,
    role: record.role as UserRole,
    examTrack: examTrack === 'ICT' || examTrack === 'CS' ? examTrack : null,
    avatarPath: typeof record.avatar_path === 'string' ? record.avatar_path : null,
    username: typeof username === 'string' ? username : null,
    id: record.id,
  };
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function mapRpcError(error: { code?: string; message?: string; details?: string }): Error {
  if (error.code === '23505') {
    return new Error('Tên người dùng này đã được sử dụng.');
  }
  if (
    error.details?.includes('PROFILE_RATE_LIMIT') ||
    error.details?.includes('AVATAR_RATE_LIMIT') ||
    error.message?.includes('limit exceeded')
  ) {
    return new Error('Bạn đã cập nhật quá thường xuyên. Vui lòng thử lại sau.');
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return new Error('Tính năng thành viên chưa được cấu hình trên Supabase.');
  }
  return new Error('Không thể hoàn tất yêu cầu hồ sơ. Vui lòng thử lại.');
}

export async function listPublicMembers(
  client: SupabaseClient,
  query: string,
  offset: number,
  limit = 24
): Promise<PublicMember[]> {
  const { data, error } = await client.rpc('list_public_members', {
    p_query: query.trim(),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw mapRpcError(error);
  if (!Array.isArray(data)) throw new Error('Danh sách thành viên trả về không hợp lệ.');
  return data.map((record: Record<string, unknown>) => mapMemberRecord(record));
}

export async function getPublicMember(
  client: SupabaseClient,
  username: string
): Promise<PublicMember | null> {
  const { data, error } = await client.rpc('get_public_member', {
    p_username: username.trim().toLowerCase(),
  });
  if (error) throw mapRpcError(error);
  const record = firstRecord(data);
  return record ? mapMemberRecord(record) : null;
}

export async function getMyMemberProfile(
  client: SupabaseClient
): Promise<MemberProfile> {
  const { data, error } = await client.rpc('get_my_member_profile');
  if (error) throw mapRpcError(error);
  const record = firstRecord(data);
  if (!record || typeof record.id !== 'string') {
    throw new Error('Chưa tìm thấy hồ sơ thành viên của tài khoản này.');
  }
  return mapMyMemberRecord(record);
}

export async function updateMyMemberProfile(
  client: SupabaseClient,
  input: { displayName: string; username: string; examTrack: 'ICT' | 'CS' | null }
): Promise<MemberProfile> {
  const usernameError = validateUsername(input.username);
  if (usernameError) throw new Error(usernameError);
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    throw new Error('Tên hiển thị cần có từ 1 đến 80 ký tự.');
  }

  const { data, error } = await client.rpc('update_my_member_profile', {
    p_display_name: displayName,
    p_username: input.username.trim().toLowerCase(),
    p_exam_track: input.examTrack,
  });
  if (error) throw mapRpcError(error);
  const record = firstRecord(data);
  if (!record || typeof record.id !== 'string') {
    throw new Error('Không thể xác nhận hồ sơ vừa cập nhật.');
  }
  return mapMyMemberRecord(record);
}

export async function createAvatarUrl(
  client: SupabaseClient,
  avatarPath: string | null
): Promise<string | null> {
  if (!avatarPath) return null;
  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_SECONDS);
  if (error) throw new Error('Không thể tải ảnh đại diện. Vui lòng thử lại.');
  return data.signedUrl;
}

export async function createSignedAvatarUrls(
  client: SupabaseClient,
  members: PublicMember[]
): Promise<Record<string, string>> {
  const paths = [...new Set(
    members.map((member) => member.avatarPath).filter((path): path is string => Boolean(path))
  )];
  if (!paths.length) return {};

  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(paths, AVATAR_SIGNED_URL_SECONDS);
  if (error) throw new Error('Không thể tải ảnh đại diện. Vui lòng thử lại.');
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

export async function cropAvatarImage(file: File, zoom: number): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không thể xử lý ảnh này.');

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh đã cắt.')),
        'image/jpeg',
        0.88
      );
    });
  } catch {
    throw new Error('Không thể đọc hoặc cắt ảnh. Hãy chọn một ảnh khác.');
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function uploadMyAvatar(
  client: SupabaseClient,
  userId: string,
  croppedImage: Blob
): Promise<{ avatarPath: string; oldAvatarPath: string | null }> {
  const objectName = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error: reserveError } = await client.rpc('reserve_my_avatar_upload', {
    p_object_name: objectName,
  });
  if (reserveError) throw mapRpcError(reserveError);

  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(objectName, croppedImage, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadError) throw new Error('Tải ảnh lên thất bại. Vui lòng thử lại.');

  const { data, error: setAvatarError } = await client.rpc('set_my_avatar_path', {
    p_object_name: objectName,
  });
  if (setAvatarError) {
    const cleanup = await client.storage.from(AVATAR_BUCKET).remove([objectName]);
    if (cleanup.error) {
      throw new Error('Ảnh đã tải lên nhưng chưa thể lưu hồ sơ hoặc dọn ảnh tạm.');
    }
    throw mapRpcError(setAvatarError);
  }

  return {
    avatarPath: objectName,
    oldAvatarPath: typeof data === 'string' ? data : null,
  };
}

export async function removeMyAvatar(
  client: SupabaseClient
): Promise<string | null> {
  const { data, error } = await client.rpc('remove_my_avatar');
  if (error) throw mapRpcError(error);
  return typeof data === 'string' && data ? data : null;
}

export async function deleteOldAvatar(
  client: SupabaseClient,
  avatarPath: string | null
): Promise<void> {
  if (!avatarPath) return;
  const { error } = await client.storage.from(AVATAR_BUCKET).remove([avatarPath]);
  if (error) {
    throw new Error('Đã đổi ảnh đại diện nhưng chưa dọn được tệp cũ.');
  }
  const { error: cleanupError } = await client.rpc('complete_my_avatar_cleanup', {
    p_object_name: avatarPath,
  });
  if (cleanupError) {
    throw new Error('Đã đổi ảnh nhưng chưa hoàn tất dọn hồ sơ ảnh cũ.');
  }
}
