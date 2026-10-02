import type { SupabaseClient } from '@supabase/supabase-js';

export interface Classroom {
  id: string;
  teacherId: string;
  name: string;
  grade: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedClassroom {
  classroomId: string;
  invitationCode: string;
  invitationExpiresAt: string;
}

export interface ClassroomInvitation {
  invitationCode: string;
  invitationExpiresAt: string;
}

export interface ClassroomInvitationSummary {
  id: string;
  classroomId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export interface ClassroomStudent {
  studentId: string;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
}

export function validateClassroomName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return 'Tên lớp học cần có từ 1 đến 120 ký tự.';
  }

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    return 'Tên lớp học cần có từ 1 đến 120 ký tự.';
  }
  return null;
}

export function validateClassroomGrade(grade?: number | string | null): string | null {
  const coercedGrade = typeof grade === 'string' ? Number(grade) : grade;
  if (coercedGrade === null || coercedGrade === undefined) return null;
  if (!Number.isInteger(coercedGrade) || coercedGrade < 10 || coercedGrade > 12) {
    return 'Khối lớp phải là 10, 11 hoặc 12.';
  }
  return null;
}

export function validateInvitationCode(code: unknown): string | null {
  const normalized = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{48}$/.test(normalized)) {
    return 'Mã mời phải gồm đúng 48 ký tự thập lục phân (hex).';
  }
  return null;
}

export function validateMaxUses(maxUses?: number | string): string | null {
  if (maxUses === undefined) return null;
  const coercedMaxUses = typeof maxUses === 'string' ? Number(maxUses) : maxUses;
  if (!Number.isInteger(coercedMaxUses) || coercedMaxUses < 1 || coercedMaxUses > 500) {
    return 'Số lượt sử dụng tối đa phải từ 1 đến 500.';
  }
  return null;
}

export function mapClassroomError(error: unknown): Error {
  if (!(error && typeof error === 'object')) {
    return new Error('Không thể hoàn tất yêu cầu lớp học. Vui lòng thử lại.');
  }

  const err = error as { message?: string; code?: string };
  const msg = err.message ?? '';
  const code = err.code ?? '';
  const msgLower = msg.toLowerCase();

  if (code === '42501' || msgLower.includes('authentication required')) {
    if (msgLower.includes('teacher access required')) {
      return new Error('Thao tác này chỉ dành cho tài khoản giáo viên.');
    }
    if (msgLower.includes('student access required')) {
      return new Error('Chỉ học sinh mới có thể tham gia lớp học.');
    }
    if (msgLower.includes('classroom access required')) {
      return new Error('Bạn không có quyền truy cập hoặc thao tác trên lớp học này.');
    }
    return new Error('Yêu cầu đăng nhập hoặc quyền hạn không đủ.');
  }

  if (code === '23505' || msgLower.includes('active classroom membership already exists')) {
    return new Error('Bạn đã là thành viên đang hoạt động của lớp học này.');
  }

  if (msgLower.includes('invitation code is invalid, expired, revoked, or fully used')) {
    return new Error('Mã mời không hợp lệ, đã hết hạn, bị thu hồi hoặc đã hết lượt sử dụng.');
  }

  if (msgLower.includes('a classroom name between 1 and 120 characters is required')) {
    return new Error('Tên lớp học phải có từ 1 đến 120 ký tự.');
  }

  if (msgLower.includes('grade must be between 10 and 12')) {
    return new Error('Khối lớp phải từ 10 đến 12.');
  }

  if (msgLower.includes('maximum uses must be between 1 and 500')) {
    return new Error('Số lượt sử dụng tối đa phải từ 1 đến 500.');
  }

  if (msgLower.includes('archived classrooms cannot issue invitation codes')) {
    return new Error('Không thể tạo mã mời cho lớp học đã lưu trữ.');
  }

  if (msgLower.includes('active classroom membership not found')) {
    return new Error('Không tìm thấy thông tin thành viên đang hoạt động trong lớp học.');
  }

  if (msgLower.includes('classroom not found or already archived')) {
    return new Error('Lớp học không tồn tại hoặc đã được lưu trữ trước đó.');
  }

  if (msgLower.includes('invitation not found, inaccessible, or already revoked')) {
    return new Error('Mã mời không tồn tại, không thể truy cập hoặc đã được thu hồi.');
  }

  if (code === '55000' || msgLower.includes('archived classrooms are immutable')) {
    return new Error('Lớp học đã lưu trữ không thể chỉnh sửa thêm.');
  }

  if (code === 'PGRST202' || code === '42883') {
    return new Error('Tính năng lớp học chưa được cấu hình đầy đủ trên hệ thống.');
  }

  return new Error('Không thể hoàn tất yêu cầu lớp học. Vui lòng thử lại.');
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function mapClassroomRecord(record: Record<string, unknown>): Classroom {
  if (
    typeof record.id !== 'string' ||
    typeof record.teacher_id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.updated_at !== 'string'
  ) {
    throw new Error('Dữ liệu lớp học trả về không hợp lệ.');
  }

  const grade = record.grade;
  const parsedGrade = typeof grade === 'number' && Number.isInteger(grade) ? grade : null;

  return {
    id: record.id,
    teacherId: record.teacher_id,
    name: record.name,
    grade: parsedGrade,
    archivedAt: typeof record.archived_at === 'string' ? record.archived_at : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapClassroomStudentRecord(record: Record<string, unknown>): ClassroomStudent {
  if (
    typeof record.student_id !== 'string' ||
    typeof record.display_name !== 'string' ||
    typeof record.joined_at !== 'string'
  ) {
    throw new Error('Dữ liệu học sinh trả về không hợp lệ.');
  }

  return {
    studentId: record.student_id,
    displayName: record.display_name,
    joinedAt: record.joined_at,
    leftAt: typeof record.left_at === 'string' ? record.left_at : null,
  };
}

function mapInvitationSummaryRecord(record: Record<string, unknown>): ClassroomInvitationSummary {
  if (
    typeof record.id !== 'string' ||
    typeof record.classroom_id !== 'string' ||
    typeof record.created_by !== 'string' ||
    typeof record.expires_at !== 'string' ||
    typeof record.max_uses !== 'number' ||
    typeof record.use_count !== 'number' ||
    typeof record.created_at !== 'string'
  ) {
    throw new Error('Dữ liệu mã mời trả về không hợp lệ.');
  }

  return {
    id: record.id,
    classroomId: record.classroom_id,
    createdBy: record.created_by,
    expiresAt: record.expires_at,
    maxUses: record.max_uses,
    useCount: record.use_count,
    revokedAt: typeof record.revoked_at === 'string' ? record.revoked_at : null,
    createdAt: record.created_at,
  };
}

export async function createClassroom(
  client: SupabaseClient,
  input: { name: string; grade?: number | null }
): Promise<CreatedClassroom> {
  const nameError = validateClassroomName(input.name);
  if (nameError) throw new Error(nameError);

  const gradeError = validateClassroomGrade(input.grade);
  if (gradeError) throw new Error(gradeError);

  const { data, error } = await client.rpc('create_classroom', {
    p_name: input.name.trim(),
    p_grade: input.grade ?? null,
  });

  if (error) throw mapClassroomError(error);

  const record = firstRecord(data);
  if (
    !record ||
    typeof record.classroom_id !== 'string' ||
    typeof record.invitation_code !== 'string' ||
    typeof record.invitation_expires_at !== 'string'
  ) {
    throw new Error('Không thể xác nhận lớp học vừa tạo.');
  }

  return {
    classroomId: record.classroom_id,
    invitationCode: record.invitation_code,
    invitationExpiresAt: record.invitation_expires_at,
  };
}

export async function createClassroomInvitation(
  client: SupabaseClient,
  classroomId: string,
  maxUses = 100
): Promise<ClassroomInvitation> {
  const maxUsesError = validateMaxUses(maxUses);
  if (maxUsesError) throw new Error(maxUsesError);

  const { data, error } = await client.rpc('create_classroom_invitation', {
    p_classroom_id: classroomId,
    p_max_uses: maxUses,
  });

  if (error) throw mapClassroomError(error);

  const record = firstRecord(data);
  if (
    !record ||
    typeof record.invitation_code !== 'string' ||
    typeof record.invitation_expires_at !== 'string'
  ) {
    throw new Error('Không thể xác nhận mã mời vừa tạo.');
  }

  return {
    invitationCode: record.invitation_code,
    invitationExpiresAt: record.invitation_expires_at,
  };
}

export async function joinClassroom(
  client: SupabaseClient,
  code: string
): Promise<string> {
  const codeError = validateInvitationCode(code);
  if (codeError) throw new Error(codeError);

  const normalizedCode = code.trim().toLowerCase();
  const { data, error } = await client.rpc('join_classroom', {
    p_code: normalizedCode,
  });

  if (error) throw mapClassroomError(error);

  const record = typeof data === 'string' ? data : firstRecord(data);
  const classroomId = typeof record === 'string'
    ? record
    : record && typeof record === 'object' && 'classroom_id' in record
      ? String((record as { classroom_id?: unknown }).classroom_id ?? '')
      : null;

  if (!classroomId || typeof classroomId !== 'string' || classroomId.length === 0) {
    throw new Error('Không nhận được mã xác nhận lớp học sau khi tham gia.');
  }

  return classroomId;
}

export async function leaveClassroom(
  client: SupabaseClient,
  classroomId: string
): Promise<void> {
  const { error } = await client.rpc('leave_classroom', {
    p_classroom_id: classroomId,
  });

  if (error) throw mapClassroomError(error);
}

export async function removeClassroomStudent(
  client: SupabaseClient,
  classroomId: string,
  studentId: string
): Promise<void> {
  const { error } = await client.rpc('remove_classroom_student', {
    p_classroom_id: classroomId,
    p_student_id: studentId,
  });

  if (error) throw mapClassroomError(error);
}

export async function archiveClassroom(
  client: SupabaseClient,
  classroomId: string
): Promise<void> {
  const { error } = await client.rpc('archive_classroom', {
    p_classroom_id: classroomId,
  });

  if (error) throw mapClassroomError(error);
}

export async function revokeClassroomInvitation(
  client: SupabaseClient,
  invitationId: string
): Promise<void> {
  const { error } = await client.rpc('revoke_classroom_invitation', {
    p_invitation_id: invitationId,
  });

  if (error) throw mapClassroomError(error);
}

export async function getClassroomStudents(
  client: SupabaseClient,
  classroomId: string
): Promise<ClassroomStudent[]> {
  const { data, error } = await client.rpc('get_classroom_students', {
    p_classroom_id: classroomId,
  });

  if (error) throw mapClassroomError(error);
  if (!Array.isArray(data)) {
    throw new Error('Danh sách học sinh trả về không hợp lệ.');
  }

  return data.map((record: Record<string, unknown>) => mapClassroomStudentRecord(record));
}

export async function listMyClassrooms(
  client: SupabaseClient
): Promise<Classroom[]> {
  const { data, error } = await client
    .from('classrooms')
    .select('id, teacher_id, name, grade, archived_at, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw mapClassroomError(error);
  if (!Array.isArray(data)) {
    throw new Error('Danh sách lớp học trả về không hợp lệ.');
  }

  return data.map((record: Record<string, unknown>) => mapClassroomRecord(record));
}

export async function getClassroomInvitations(
  client: SupabaseClient,
  classroomId: string
): Promise<ClassroomInvitationSummary[]> {
  const { data, error } = await client
    .from('classroom_invitation_codes')
    .select('id, classroom_id, created_by, expires_at, max_uses, use_count, revoked_at, created_at')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });

  if (error) throw mapClassroomError(error);
  if (!Array.isArray(data)) {
    throw new Error('Danh sách mã mời trả về không hợp lệ.');
  }

  return data.map((record: Record<string, unknown>) => mapInvitationSummaryRecord(record));
}

export async function updateClassroom(
  client: SupabaseClient,
  classroomId: string,
  input: { name?: string; grade?: number | null }
): Promise<Classroom> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const nameError = validateClassroomName(input.name);
    if (nameError) throw new Error(nameError);
    updates.name = input.name.trim();
  }

  if (input.grade !== undefined) {
    const gradeError = validateClassroomGrade(input.grade);
    if (gradeError) throw new Error(gradeError);
    updates.grade = input.grade;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Không có thông tin thay đổi.');
  }

  const { data, error } = await client
    .from('classrooms')
    .update(updates)
    .eq('id', classroomId)
    .select('id, teacher_id, name, grade, archived_at, created_at, updated_at')
    .single();

  if (error) throw mapClassroomError(error);
  if (!data || typeof data !== 'object') {
    throw new Error('Không thể nhận thông tin lớp học sau khi cập nhật.');
  }

  return mapClassroomRecord(data as Record<string, unknown>);
}
