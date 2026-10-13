// Quick smoke test for the updateMyStudentGrade PGRST202 fallback path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateMyStudentGrade, validateStudentGrade } from '../src/services/authService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Helper to build a stub SupabaseClient
function stubClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

test('updateMyStudentGrade returns grade when RPC succeeds', async () => {
  const client = stubClient({
    rpc: async (_name: string, _args: unknown) => ({ data: 11, error: null }),
  });
  const result = await updateMyStudentGrade(client, 11);
  assert.equal(result, 11);
});

test('updateMyStudentGrade falls back to direct update on PGRST202', async () => {
  const client = stubClient({
    rpc: async (_name: string, _args: unknown) => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find function' },
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-abc' } }, error: null }),
    },
    from: (_table: string) => ({
      update: (_values: unknown) => ({
        eq: (_col: string, _val: string) => ({
          select: (_cols: string) => ({
            single: async () => ({ data: { grade: 12 }, error: null }),
          }),
        }),
      }),
    }),
  });
  const result = await updateMyStudentGrade(client, 12);
  assert.equal(result, 12);
});

test('updateMyStudentGrade falls back to direct update on 42883', async () => {
  const client = stubClient({
    rpc: async (_name: string, _args: unknown) => ({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-xyz' } }, error: null }),
    },
    from: (_table: string) => ({
      update: (_values: unknown) => ({
        eq: (_col: string, _val: string) => ({
          select: (_cols: string) => ({
            single: async () => ({ data: { grade: 10 }, error: null }),
          }),
        }),
      }),
    }),
  });
  const result = await updateMyStudentGrade(client, 10);
  assert.equal(result, 10);
});

test('updateMyStudentGrade accepts null to unset grade', async () => {
  const client = stubClient({
    rpc: async (_name: string, _args: unknown) => ({ data: null, error: null }),
  });
  const result = await updateMyStudentGrade(client, null);
  assert.equal(result, null);
});

test('updateMyStudentGrade rejects invalid grades before calling RPC', async () => {
  const client = stubClient({
    rpc: async () => { throw new Error('should not be called'); },
  });
  await assert.rejects(
    () => updateMyStudentGrade(client, 9),
    /Khối lớp phải là 10, 11 hoặc 12/
  );
  await assert.rejects(
    () => updateMyStudentGrade(client, 13),
    /Khối lớp phải là 10, 11 hoặc 12/
  );
  await assert.rejects(
    () => updateMyStudentGrade(client, '10'),
    /Khối lớp phải là 10, 11 hoặc 12/
  );
});

test('validateStudentGrade accepts only 10, 11, 12', () => {
  assert.equal(validateStudentGrade(10), true);
  assert.equal(validateStudentGrade(11), true);
  assert.equal(validateStudentGrade(12), true);
  assert.equal(validateStudentGrade(9), false);
  assert.equal(validateStudentGrade(13), false);
  assert.equal(validateStudentGrade(null), false);
  assert.equal(validateStudentGrade(undefined), false);
  assert.equal(validateStudentGrade('10'), false);
});
