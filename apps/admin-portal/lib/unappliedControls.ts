/**
 * Health page read of controls whose database update is not applied.
 * Same catalog as the Expo admin Home card. Read only.
 * @sideEffects One RPC probe per catalog row through the portal's server client.
 */
import { missingRpc, UNAPPLIED_CONTROLS, type UnappliedControl } from '@tapuai/shared-types/admin/unappliedControls';

export type UnappliedRead = { configured: boolean; waiting: UnappliedControl[] };

/** @purpose Rows still missing. An unconfigured portal returns no rows and configured false. */
export async function fetchUnappliedControls(): Promise<UnappliedRead> {
  const { getSupabaseServerClient } = await import('@/lib/supabase.server');
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { configured: false, waiting: [] };
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { code?: string | null; message?: string | null } | null }>;
  const checks = await Promise.all(UNAPPLIED_CONTROLS.map(async (control) => {
    try {
      const { error } = await rpc(control.rpc, control.args);
      return missingRpc(error) ? control : null;
    } catch {
      return null;
    }
  }));
  return { configured: true, waiting: checks.filter((control): control is UnappliedControl => control !== null) };
}
