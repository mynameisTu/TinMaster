import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  archiveClassroom,
  createClassroom,
  createClassroomInvitation,
  getClassroomInvitations,
  getClassroomStudents,
  joinClassroom,
  leaveClassroom,
  listMyClassrooms,
  removeClassroomStudent,
  revokeClassroomInvitation,
  updateClassroom,
  validateClassroomGrade,
  validateClassroomName,
  validateInvitationCode,
  validateMaxUses,
} from '../src/services/classroomService';

function mockClientWithRpc(
  handler: (name: string, args?: Record<string, unknown>) => Promise<unknown>
): SupabaseClient {
  return { rpc: handler } as unknown as SupabaseClient;
}

test('classroom input validation rules', () => {
  assert.equal(validateClassroomName('Lớp 12A1 Tin học Chuyên'), null);
  assert.match(validateClassroomName('') ?? '', /1 đến 120/);
  assert.match(validateClassroomName('   ') ?? '', /1 đến 120/);
  assert.match(validateClassroomName('A'.repeat(121)) ?? '', /1 đến 120/);

  assert.equal(validateClassroomGrade(10), null);
  assert.equal(validateClassroomGrade(11), null);
  assert.equal(validateClassroomGrade(12), null);
  assert.equal(validateClassroomGrade(null), null);
  assert.equal(validateClassroomGrade(undefined), null);
  assert.match(validateClassroomGrade(9) ?? '', /10, 11 hoặc 12/);
  assert.match(validateClassroomGrade(13) ?? '', /10, 11 hoặc 12/);
  assert.match(validateClassroomGrade(10.5) ?? '', /10, 11 hoặc 12/);

  assert.equal(validateInvitationCode('a'.repeat(48)), null);
  assert.match(validateInvitationCode('a'.repeat(47)) ?? '', /48 ký tự thập lục phân/);
  assert.match(validateInvitationCode('g'.repeat(48)) ?? '', /48 ký tự thập lục phân/);

  assert.equal(validateMaxUses(1), null);
  assert.equal(validateMaxUses(100), null);
  assert.equal(validateMaxUses(500), null);
  assert.match(validateMaxUses(0) ?? '', /1 đến 500/);
  assert.match(validateMaxUses(501) ?? '', /1 đến 500/);
});

test('createClassroom successfully passes validated parameters and returns created record', async () => {
  const client = mockClientWithRpc(async (name, args) => {
    assert.equal(name, 'create_classroom');
    assert.deepEqual(args, {
      p_name: 'Lớp 11B2',
      p_grade: 11,
    });
    return {
      data: [{
        classroom_id: '31000000-0000-0000-0000-000000000001',
        invitation_code: 'a'.repeat(48),
        invitation_expires_at: '2026-10-06T00:00:00Z',
      }],
      error: null,
    };
  });

  const result = await createClassroom(client, { name: '  Lớp 11B2  ', grade: 11 });
  assert.deepEqual(result, {
    classroomId: '31000000-0000-0000-0000-000000000001',
    invitationCode: 'a'.repeat(48),
    invitationExpiresAt: '2026-10-06T00:00:00Z',
  });
});

test('createClassroomInvitation successfully creates code with bounded max uses', async () => {
  const client = mockClientWithRpc(async (name, args) => {
    assert.equal(name, 'create_classroom_invitation');
    assert.deepEqual(args, {
      p_classroom_id: '31000000-0000-0000-0000-000000000001',
      p_max_uses: 50,
    });
    return {
      data: [{
        invitation_code: 'b'.repeat(48),
        invitation_expires_at: '2026-10-06T00:00:00Z',
      }],
      error: null,
    };
  });

  const result = await createClassroomInvitation(
    client,
    '31000000-0000-0000-0000-000000000001',
    50
  );
  assert.deepEqual(result, {
    invitationCode: 'b'.repeat(48),
    invitationExpiresAt: '2026-10-06T00:00:00Z',
  });
});

test('joinClassroom normalizes code case and returns classroom UUID', async () => {
  const client = mockClientWithRpc(async (name, args) => {
    assert.equal(name, 'join_classroom');
    assert.deepEqual(args, {
      p_code: 'c'.repeat(48),
    });
    return {
      data: '31000000-0000-0000-0000-000000000001',
      error: null,
    };
  });

  const classroomId = await joinClassroom(client, `  ${'C'.repeat(48)}  `);
  assert.equal(classroomId, '31000000-0000-0000-0000-000000000001');
});

test('joinClassroom accepts wrapped object payloads and validation guards malformed values', async () => {
  const wrappedClient = mockClientWithRpc(async () => ({
    data: [{ classroom_id: '31000000-0000-0000-0000-000000000002' }],
    error: null,
  }));

  const result = await joinClassroom(wrappedClient, 'd'.repeat(48));
  assert.equal(result, '31000000-0000-0000-0000-000000000002');

  assert.match(validateClassroomName(null as unknown as string) ?? '', /1 đến 120/);
  assert.match(validateInvitationCode(undefined as unknown as string) ?? '', /48 ký tự thập lục phân/);
  assert.equal(validateClassroomGrade('11'), null);
  assert.equal(validateMaxUses('50'), null);
  assert.match(validateMaxUses('0') ?? '', /1 đến 500/);
});

test('leaveClassroom, removeClassroomStudent, archiveClassroom, revokeClassroomInvitation pass correct RPC parameters', async () => {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const client = mockClientWithRpc(async (name, args) => {
    calls.push({ name, args });
    return { data: null, error: null };
  });

  await leaveClassroom(client, '31000000-0000-0000-0000-000000000001');
  await removeClassroomStudent(client, '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005');
  await archiveClassroom(client, '31000000-0000-0000-0000-000000000001');
  await revokeClassroomInvitation(client, 'invitation-uuid-1');

  assert.deepEqual(calls, [
    { name: 'leave_classroom', args: { p_classroom_id: '31000000-0000-0000-0000-000000000001' } },
    {
      name: 'remove_classroom_student',
      args: {
        p_classroom_id: '31000000-0000-0000-0000-000000000001',
        p_student_id: '30000000-0000-0000-0000-000000000005',
      },
    },
    { name: 'archive_classroom', args: { p_classroom_id: '31000000-0000-0000-0000-000000000001' } },
    { name: 'revoke_classroom_invitation', args: { p_invitation_id: 'invitation-uuid-1' } },
  ]);
});

test('getClassroomStudents returns mapped student roster', async () => {
  const client = mockClientWithRpc(async (name) => {
    assert.equal(name, 'get_classroom_students');
    return {
      data: [
        {
          student_id: '30000000-0000-0000-0000-000000000004',
          display_name: 'Học sinh An',
          joined_at: '2026-09-28T10:00:00Z',
          left_at: null,
        },
        {
          student_id: '30000000-0000-0000-0000-000000000005',
          display_name: 'Học sinh Bình',
          joined_at: '2026-09-28T11:00:00Z',
          left_at: '2026-09-29T08:00:00Z',
        },
      ],
      error: null,
    };
  });

  const students = await getClassroomStudents(client, '31000000-0000-0000-0000-000000000001');
  assert.deepEqual(students, [
    {
      studentId: '30000000-0000-0000-0000-000000000004',
      displayName: 'Học sinh An',
      joinedAt: '2026-09-28T10:00:00Z',
      leftAt: null,
    },
    {
      studentId: '30000000-0000-0000-0000-000000000005',
      displayName: 'Học sinh Bình',
      joinedAt: '2026-09-28T11:00:00Z',
      leftAt: '2026-09-29T08:00:00Z',
    },
  ]);
});

test('listMyClassrooms queries table and maps records correctly', async () => {
  const fakeFrom = (table: string) => {
    assert.equal(table, 'classrooms');
    return {
      select: (columns: string) => {
        assert.ok(columns.includes('name'));
        return {
          order: async (column: string, opts: { ascending: boolean }) => {
            assert.equal(column, 'created_at');
            assert.equal(opts.ascending, false);
            return {
              data: [
                {
                  id: 'c-1',
                  teacher_id: 't-1',
                  name: 'Lớp 12 Tin',
                  grade: 12,
                  archived_at: null,
                  created_at: '2026-09-27T00:00:00Z',
                  updated_at: '2026-09-27T00:00:00Z',
                },
              ],
              error: null,
            };
          },
        };
      },
    };
  };

  const client = { from: fakeFrom } as unknown as SupabaseClient;
  const classrooms = await listMyClassrooms(client);
  assert.deepEqual(classrooms, [
    {
      id: 'c-1',
      teacherId: 't-1',
      name: 'Lớp 12 Tin',
      grade: 12,
      archivedAt: null,
      createdAt: '2026-09-27T00:00:00Z',
      updatedAt: '2026-09-27T00:00:00Z',
    },
  ]);
});

test('getClassroomInvitations queries invitation table and maps records correctly', async () => {
  const fakeFrom = (table: string) => {
    assert.equal(table, 'classroom_invitation_codes');
    return {
      select: () => ({
        eq: (col: string, val: string) => {
          assert.equal(col, 'classroom_id');
          assert.equal(val, 'c-1');
          return {
            order: async () => ({
              data: [
                {
                  id: 'inv-1',
                  classroom_id: 'c-1',
                  created_by: 't-1',
                  expires_at: '2026-10-04T00:00:00Z',
                  max_uses: 100,
                  use_count: 5,
                  revoked_at: null,
                  created_at: '2026-09-27T00:00:00Z',
                },
              ],
              error: null,
            }),
          };
        },
      }),
    };
  };

  const client = { from: fakeFrom } as unknown as SupabaseClient;
  const invitations = await getClassroomInvitations(client, 'c-1');
  assert.deepEqual(invitations, [
    {
      id: 'inv-1',
      classroomId: 'c-1',
      createdBy: 't-1',
      expiresAt: '2026-10-04T00:00:00Z',
      maxUses: 100,
      useCount: 5,
      revokedAt: null,
      createdAt: '2026-09-27T00:00:00Z',
    },
  ]);
});

test('updateClassroom validates input, executes update and maps updated row', async () => {
  const fakeFrom = (table: string) => {
    assert.equal(table, 'classrooms');
    return {
      update: (payload: Record<string, unknown>) => {
        assert.deepEqual(payload, { name: 'Lớp 12 Chuyên Mới', grade: 12 });
        return {
          eq: (col: string, val: string) => {
            assert.equal(col, 'id');
            assert.equal(val, 'c-1');
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'c-1',
                    teacher_id: 't-1',
                    name: 'Lớp 12 Chuyên Mới',
                    grade: 12,
                    archived_at: null,
                    created_at: '2026-09-27T00:00:00Z',
                    updated_at: '2026-09-29T12:00:00Z',
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    };
  };

  const client = { from: fakeFrom } as unknown as SupabaseClient;
  const updated = await updateClassroom(client, 'c-1', {
    name: '  Lớp 12 Chuyên Mới  ',
    grade: 12,
  });

  assert.equal(updated.name, 'Lớp 12 Chuyên Mới');
  assert.equal(updated.grade, 12);
});

test('authentication failures are mapped to user-friendly Vietnamese messages', async () => {
  const client = mockClientWithRpc(async () => ({
    data: null,
    error: { code: '42501', message: 'Authentication required' },
  }));

  await assert.rejects(
    createClassroom(client, { name: 'Lớp Tin' }),
    { message: 'Yêu cầu đăng nhập hoặc quyền hạn không đủ.' }
  );
});

test('permission errors distinguish teacher, student, and classroom access', async () => {
  const teacherOnlyClient = mockClientWithRpc(async () => ({
    data: null,
    error: { code: '42501', message: 'Teacher access required' },
  }));
  await assert.rejects(
    createClassroom(teacherOnlyClient, { name: 'Lớp Tin' }),
    { message: 'Thao tác này chỉ dành cho tài khoản giáo viên.' }
  );

  const studentOnlyClient = mockClientWithRpc(async () => ({
    data: null,
    error: { code: '42501', message: 'Student access required' },
  }));
  await assert.rejects(
    joinClassroom(studentOnlyClient, 'a'.repeat(48)),
    { message: 'Chỉ học sinh mới có thể tham gia lớp học.' }
  );

  const classroomAccessClient = mockClientWithRpc(async () => ({
    data: null,
    error: { code: '42501', message: 'Classroom access required' },
  }));
  await assert.rejects(
    archiveClassroom(classroomAccessClient, 'c-1'),
    { message: 'Bạn không có quyền truy cập hoặc thao tác trên lớp học này.' }
  );
});

test('invalid, expired, revoked, or exhausted invitation codes are translated safely', async () => {
  const client = mockClientWithRpc(async () => ({
    data: null,
    error: {
      code: '22023',
      message: 'Invitation code is invalid, expired, revoked, or fully used',
    },
  }));

  await assert.rejects(
    joinClassroom(client, 'b'.repeat(48)),
    { message: 'Mã mời không hợp lệ, đã hết hạn, bị thu hồi hoặc đã hết lượt sử dụng.' }
  );
});

test('duplicate membership error is translated clearly', async () => {
  const client = mockClientWithRpc(async () => ({
    data: null,
    error: {
      code: '23505',
      message: 'Active classroom membership already exists',
    },
  }));

  await assert.rejects(
    joinClassroom(client, 'a'.repeat(48)),
    { message: 'Bạn đã là thành viên đang hoạt động của lớp học này.' }
  );
});

test('archived classroom immutability error is translated clearly', async () => {
  const client = mockClientWithRpc(async () => ({
    data: null,
    error: {
      code: '55000',
      message: 'Archived classrooms are immutable',
    },
  }));

  await assert.rejects(
    removeClassroomStudent(client, 'c-1', 's-1'),
    { message: 'Lớp học đã lưu trữ không thể chỉnh sửa thêm.' }
  );
});

test('unexpected database errors do not leak internal SQL details', async () => {
  const client = mockClientWithRpc(async () => ({
    data: null,
    error: {
      code: 'XX000',
      message: 'internal crash in plpgsql stack trace pg_catalog dump',
    },
  }));

  await assert.rejects(
    createClassroom(client, { name: 'Lớp Tin' }),
    { message: 'Không thể hoàn tất yêu cầu lớp học. Vui lòng thử lại.' }
  );
});
