/**
 * Health page read of open app failures: syntax, logic, glitches, and the rest.
 * Same snapshot as Expo /admin/support. Read only.
 * @sideEffects One `get_engineering_support_snapshot` call through the portal's server client.
 */
import { failurePoints, parseEngineeringSupportSnapshot, type FailurePoint } from '@tapuai/shared-types/admin/engineeringSupport';
import { missingRpc } from '@tapuai/shared-types/admin/unappliedControls';

export type FailureRead = {
  configured: boolean;
  missing: boolean;
  unread: boolean;
  points: FailurePoint[];
};

/** @purpose Open failure counts. A missing function is `missing`; a bad payload is `unread`, never zero. */
export async function fetchFailurePoints(): Promise<FailureRead> {
  const empty = { configured: false, missing: false, unread: false, points: [] };
  const { getSupabaseServerClient } = await import('@/lib/supabase.server');
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty;
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string | null; message?: string | null } | null }>;
  try {
    const { data, error } = await rpc('get_engineering_support_snapshot', {});
    if (missingRpc(error)) return { configured: true, missing: true, unread: false, points: [] };
    if (error || data == null) return { configured: true, missing: false, unread: true, points: [] };
    return { configured: true, missing: false, unread: false, points: failurePoints(parseEngineeringSupportSnapshot(data)) };
  } catch {
    return { configured: true, missing: false, unread: true, points: [] };
  }
}
