/**
 * One way to call a database function that is newer than the generated client types: untyped call, a missing
 * migration reads as "not switched on", any other error keeps its message. Shared by the admin controls and the
 * privacy controls so neither keeps its own copy (DATA-01 merge rule).
 */
import { isMissingFunction } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const NOT_SWITCHED_ON = 'This control is not switched on yet: its database update has not been applied.';

export type RpcError = { code?: string; message?: string } | null;

/**
 * @purpose Call a function the generated client types do not know yet, returning `{ data, error }` untouched.
 *   `supabase.rpc` must stay bound to the client: stored in a variable and called on its own it loses `this` and every
 *   call throws (found 2026-10-14 by a test using the real client; tests with arrow-function mocks hid it).
 */
export function untypedRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}, client = supabase): Promise<{ data: T; error: RpcError }> {
  const rpc = client.rpc.bind(client) as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: T; error: RpcError }>;
  return rpc(fn, args);
}

/**
 * @purpose Call a database function and return its data, or throw a readable error.
 * @param fn Function name.
 * @param args Named arguments exactly as the SQL function declares them.
 */
export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await untypedRpc<T>(fn, args);
  if (error) throw new Error(isMissingFunction(error) ? NOT_SWITCHED_ON : error.message || 'That did not work.');
  return data;
}
