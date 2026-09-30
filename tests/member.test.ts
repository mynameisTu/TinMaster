import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSignedAvatarUrls,
  getMyMemberProfile,
  listPublicMembers,
  updateMyMemberProfile,
  uploadMyAvatar,
  validateAvatarFile,
  validateUsername,
} from '../src/services/memberService';

function clientWithRpc(
  handler: (name: string, args?: Record<string, unknown>) => Promise<unknown>
): SupabaseClient {
  return { rpc: handler } as unknown as SupabaseClient;
}

test('username validation normalizes case and enforces the public handle rules', () => {
  assert.equal(validateUsername('Student_01'), null);
  assert.match(validateUsername('ab') ?? '', /3 đến 24/);
  assert.match(validateUsername('name with space') ?? '', /Chỉ dùng/);
});

test('avatar validation accepts supported images and enforces the upload limit', () => {
  assert.equal(validateAvatarFile(new File(['image'], 'avatar.png', { type: 'image/png' })), null);
  assert.match(
    validateAvatarFile(new File(['svg'], 'avatar.svg', { type: 'image/svg+xml' })) ?? '',
    /JPEG, PNG hoặc WebP/
  );
});

test('public directory returns only the explicit public profile projection', async () => {
  const client = clientWithRpc(async (name) => {
    assert.equal(name, 'list_public_members');
    return {
      data: [{
        username: 'learner_1',
        public_member_id: 'TM-0123456789ABCDEF',
        display_name: 'Người học',
        role: 'student',
        exam_track: 'CS',
        avatar_path: null,
        email: 'private@example.test',
        exam_answers: ['A'],
      }],
      error: null,
    };
  });

  const members = await listPublicMembers(client, 'learner', 0);
  assert.deepEqual(members, [{
    username: 'learner_1',
    publicMemberId: 'TM-0123456789ABCDEF',
    displayName: 'Người học',
    role: 'student',
    examTrack: 'CS',
    avatarPath: null,
  }]);
});

test('existing profiles without usernames can be opened in private settings', async () => {
  const client = clientWithRpc(async (name) => {
    assert.equal(name, 'get_my_member_profile');
    return {
      data: [{
        id: 'auth-user-id',
        username: null,
        public_member_id: 'TM-0123456789ABCDEF',
        display_name: 'Người học',
        role: 'student',
        exam_track: null,
        avatar_path: null,
      }],
      error: null,
    };
  });

  const profile = await getMyMemberProfile(client);
  assert.equal(profile.username, null);
  assert.equal(profile.id, 'auth-user-id');
});

test('duplicate username errors are translated without exposing database details', async () => {
  const client = clientWithRpc(async () => ({
    data: null,
    error: { code: '23505', message: 'profiles_username_unique internal details' },
  }));

  await assert.rejects(
    updateMyMemberProfile(client, {
      displayName: 'Learner',
      username: 'taken_name',
      examTrack: null,
    }),
    { message: 'Tên người dùng này đã được sử dụng.' }
  );
});

test('avatar uploads reserve a path before writing and linking the object', async () => {
  const calls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push(name);
      return name === 'set_my_avatar_path'
        ? { data: 'user-id/old-avatar.jpg', error: null }
        : { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => {
          calls.push('storage.upload');
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  } as unknown as SupabaseClient;

  const result = await uploadMyAvatar(
    client,
    'user-id',
    new Blob(['cropped-image'], { type: 'image/jpeg' })
  );

  assert.deepEqual(calls, [
    'reserve_my_avatar_upload',
    'storage.upload',
    'set_my_avatar_path',
  ]);
  assert.equal(result.oldAvatarPath, 'user-id/old-avatar.jpg');
  assert.match(result.avatarPath, /^user-id\/[0-9a-f-]{36}\.jpg$/);
});

test('signed avatar URLs are omitted when no public member has an avatar', async () => {
  const client = {
    storage: {
      from: () => {
        throw new Error('Storage should not be called for empty paths');
      },
    },
  } as unknown as SupabaseClient;

  assert.deepEqual(await createSignedAvatarUrls(client, []), {});
});
