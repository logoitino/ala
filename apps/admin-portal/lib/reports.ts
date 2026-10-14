/**
 * ADM-02: Next keeps cookie-backed transport; the unified Expo admin shares its report parsers.
 * Compatibility exports preserve existing portal pages and model tests without importing Next into Expo.
 * Revenue's existing RPC synchronizes ledger rows internally; the UI exposes no write controls here.
 */
export * from '@tapuai/shared-types/admin/reports';
import {
  breakdownFromTips, emptyPortalMaloBreakdown, emptyPortalReports, emptyPortalRevenue,
  MALO_FALLBACK_LIMIT, parseBreakdown, parseReportsPayload, parseRevenueSummary,
  type PortalMaloBreakdown, type PortalReports, type PortalRevenue,
} from '@tapuai/shared-types/admin/reports';

async function serverClient() {
  const { getSupabaseServerClient } = await import('@/lib/supabase.server');
  return getSupabaseServerClient();
}
export async function fetchPortalReports(): Promise<PortalReports> {
  const supabase = await serverClient();
  if (!supabase) return emptyPortalReports(false, 'Supabase env missing');
  const { data, error } = await supabase.rpc('get_admin_reports');
  return error ? emptyPortalReports(true, error.message) : parseReportsPayload(data);
}
export async function fetchPortalRevenue(): Promise<PortalRevenue> {
  const supabase = await serverClient();
  if (!supabase) return emptyPortalRevenue(false, 'Supabase env missing');
  const { data, error } = await supabase.rpc('get_company_revenue_summary');
  return error ? emptyPortalRevenue(true, error.message) : parseRevenueSummary(data);
}
export async function fetchPortalMaloBreakdown(): Promise<PortalMaloBreakdown> {
  const supabase = await serverClient();
  if (!supabase) return emptyPortalMaloBreakdown(false, 'Supabase env missing');
  const rpc = await supabase.rpc('get_admin_malo_breakdown');
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') return parseBreakdown(rpc.data as Record<string, unknown>);
  const listed = await supabase.from('tips')
    .select('id, amount_cents, created_at, origin, entry, source_label, reel_id, wishlist_item_id, player_id')
    .order('created_at', { ascending: false }).limit(MALO_FALLBACK_LIMIT);
  if (listed.error || !Array.isArray(listed.data)) {
    return emptyPortalMaloBreakdown(true, rpc.error?.message ?? listed.error?.message ?? 'Could not load donations.');
  }
  return breakdownFromTips(listed.data as Record<string, unknown>[]);
}
