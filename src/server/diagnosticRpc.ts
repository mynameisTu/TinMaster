import { createClient } from '@supabase/supabase-js';

export type DiagnosticRpcError = {
  code?: string;
  message: string;
};

export type DiagnosticRpcResult = {
  data: unknown;
  error: DiagnosticRpcError | null;
};

export type DiagnosticRpc = (
  functionName: string,
  args: Record<string, unknown>
) => Promise<DiagnosticRpcResult>;

const diagnosticRpcKey = Symbol.for('tinmaster.diagnostic-rpc');
let serviceClient: ReturnType<typeof createClient> | null = null;

function currentDiagnosticRpc(): DiagnosticRpc | null {
  return Reflect.get(globalThis, diagnosticRpcKey) as DiagnosticRpc | null ?? null;
}

function configuredDiagnosticRpc(): DiagnosticRpc {
  // Fall back to VITE_-prefixed vars so the dev server works when only those
  // are set in .env (same pattern as supabaseAuth.ts).
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Server-side Supabase service-role configuration is missing.');
  }

  if (!serviceClient) {
    serviceClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  const client = serviceClient;
  return async (functionName, args) => {
    const { data, error } = await client.rpc(functionName as never, args as never);
    return {
      data: data as unknown,
      error: error ? { code: error.code, message: error.message } : null,
    };
  };
}

export async function callDiagnosticRpc(
  functionName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const rpc = currentDiagnosticRpc() ?? configuredDiagnosticRpc();
  const { data, error } = await rpc(functionName, args);
  if (error) throw error;
  return data;
}

export function configureDiagnosticRpc(rpc: DiagnosticRpc): () => void {
  const previous = currentDiagnosticRpc();
  Reflect.set(globalThis, diagnosticRpcKey, rpc);
  return () => {
    if (previous) Reflect.set(globalThis, diagnosticRpcKey, previous);
    else Reflect.deleteProperty(globalThis, diagnosticRpcKey);
  };
}
