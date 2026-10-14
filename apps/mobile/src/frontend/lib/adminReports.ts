/**
 * ADM-02: report reads use the current Expo session and the same RPCs as the Next portal.
 * Missing values and per-read errors survive parsing; write desks keep their existing SDKs.
 * Revenue's existing RPC synchronizes its ledger internally. No service credentials live here.
 */
import {
  PROFILE_CHROME_FLAGS, SOFT_WALL_AUTH_PROVIDERS, SOFT_WALL_GATES,
} from '@tapuai/shared-types';
import {
  breakdownFromTips, emptyPortalMaloBreakdown, emptyPortalReports, emptyPortalRevenue,
  MALO_FALLBACK_LIMIT, parseBreakdown, parseReportsPayload, parseRevenueSummary,
  type PortalMaloBreakdown, type PortalReports, type PortalRevenue,
} from '@tapuai/shared-types/admin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { parseAppRuntimeConfig, runtimeConfigsEqual } from '@/lib/runtime';
import { isMissingColumn, isMissingFunction } from '@/lib/dbErrors';

type ReadError = { message?: string; code?: string };
type ReadResult = { data: unknown; error: ReadError | null; count?: number | null };
interface ReadQuery extends PromiseLike<ReadResult> {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): ReadQuery;
  eq(column: string, value: string | boolean): ReadQuery;
  gt(column: string, value: number): ReadQuery;
  lt(column: string, value: number): ReadQuery;
  not(column: string, operator: string, value: unknown): ReadQuery;
  or(filter: string): ReadQuery;
  gte(column: string, value: string): ReadQuery;
  order(column: string, options: { ascending: boolean }): ReadQuery;
  limit(count: number): ReadQuery;
  maybeSingle(): ReadQuery;
}
type ReadClient = { rpc(name: string): PromiseLike<ReadResult>; from(table: string): ReadQuery };
// The structural boundary supports the legacy donation RPC absent from the generated local map.
const client = supabase as unknown as ReadClient;
type ReadState = { configured: boolean; error: string | null };
export type PortalRuntimeSnapshot = ReadState & {
  draft: Record<string, unknown>; published: Record<string, unknown>; publishedAt: string | null; dirty: boolean | null;
};
export type PortalProfileSnapshot = ReadState & {
  claimedAthletes: number | null; athleteProfiles: number | null; publishedAt: string | null;
  showCard: boolean | null; showCrew: boolean | null; showStats: boolean | null; showVault: boolean | null;
  actionsOnTop: boolean | null; statsFirst: boolean | null; chromeFlags: typeof PROFILE_CHROME_FLAGS;
};
export type PortalSoftWallSnapshot = ReadState & {
  fanProfiles: number | null; fansLast7d: number | null; publishedAt: string | null;
  operatorConsoleLive: boolean | null; operatorConsoleDraft: boolean | null;
  maloLive: boolean | null; crewLive: boolean | null; wishlistLive: boolean | null;
  softWallGates: typeof SOFT_WALL_GATES; authProviders: typeof SOFT_WALL_AUTH_PROVIDERS;
};
export type PortalPerson = {
  id: string; full_name: string; username: string | null; role: string;
  is_verified: boolean; verification_status: string | null; is_admin: boolean;
  player_id: string | null; created_at: string | null;
};
export type PortalPeopleSnapshot = ReadState & { people: PortalPerson[] };
export type PortalStockSnapshot = ReadState & { lowStock: number | null };
export type AdminReportData = {
  reports: PortalReports; revenue: PortalRevenue; breakdown: PortalMaloBreakdown;
  runtime: PortalRuntimeSnapshot; profile: PortalProfileSnapshot; softWall: PortalSoftWallSnapshot; people: PortalPeopleSnapshot; stock: PortalStockSnapshot;
};

function bag(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function bool(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null; }
function count(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function message(error: unknown): string {
  return error instanceof Error ? error.message : text(bag(error).message) ?? 'Could not load this report.';
}
function missingState(error: string | null = null): ReadState { return { configured: isSupabaseConfigured, error }; }
function emptyRuntime(error: string | null = null): PortalRuntimeSnapshot {
  return { ...missingState(error), draft: {}, published: {}, publishedAt: null, dirty: null };
}
function emptyProfile(error: string | null = null): PortalProfileSnapshot {
  return { ...missingState(error), claimedAthletes: null, athleteProfiles: null, publishedAt: null,
    showCard: null, showCrew: null, showStats: null, showVault: null, actionsOnTop: null, statsFirst: null, chromeFlags: PROFILE_CHROME_FLAGS };
}
function emptySoftWall(error: string | null = null): PortalSoftWallSnapshot {
  return { ...missingState(error), fanProfiles: null, fansLast7d: null, publishedAt: null,
    operatorConsoleLive: null, operatorConsoleDraft: null, maloLive: null, crewLive: null, wishlistLive: null,
    softWallGates: SOFT_WALL_GATES, authProviders: SOFT_WALL_AUTH_PROVIDERS };
}
function emptyPeople(error: string | null = null): PortalPeopleSnapshot { return { ...missingState(error), people: [] }; }

/** A new, unmeasured snapshot for each identity; no global cache contains an admin's data. */
export function emptyAdminReportData(): AdminReportData {
  return { reports: emptyPortalReports(), revenue: emptyPortalRevenue(), breakdown: emptyPortalMaloBreakdown(),
    runtime: { ...emptyRuntime(), configured: false }, profile: { ...emptyProfile(), configured: false },
    softWall: { ...emptySoftWall(), configured: false }, people: { ...emptyPeople(), configured: false }, stock: { configured: false, error: null, lowStock: null } };
}

/** Health needs inventory evidence, not the legacy inbox's zero fallback. @sideEffects Read-only shop_products SELECT. */
export async function fetchAdminStockSnapshot(): Promise<PortalStockSnapshot> {
  const empty = (error: string): PortalStockSnapshot => ({ ...missingState(error), lowStock: null });
  if (!isSupabaseConfigured) return empty('Supabase env missing');
  try {
    const result = await client.from('shop_products').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('inventory', 0).lt('inventory', 8);
    if (result.error) return empty(message(result.error));
    if (count(result.count) == null) return empty('The stock count returned no data.');
    return { ...missingState(), lowStock: count(result.count) };
  } catch (error) { return empty(message(error)); }
}

async function rpcSnapshot<T>(name: string, empty: (configured?: boolean, error?: string | null) => T, parse: (data: unknown) => T): Promise<T> {
  if (!isSupabaseConfigured) return empty(false, 'Supabase env missing');
  try {
    const result = await client.rpc(name);
    if (result.error) return empty(true, message(result.error));
    if (result.data == null) return empty(true, 'The report returned no data.');
    return parse(result.data);
  } catch (error) { return empty(true, message(error)); }
}
/** @purpose Read report measures with missing-data semantics. @sideEffects `get_admin_reports` RPC. */
export function fetchAdminReportSnapshot(): Promise<PortalReports> {
  return rpcSnapshot('get_admin_reports', emptyPortalReports, parseReportsPayload);
}
/** @purpose Read totals and recorded revenue streams. @sideEffects Existing ledger-synchronizing revenue RPC. */
export function fetchAdminRevenueSnapshot(): Promise<PortalRevenue> {
  return rpcSnapshot('get_company_revenue_summary', emptyPortalRevenue, parseRevenueSummary);
}

/**
 * @purpose Read donation origins, retaining bounded fallback provenance.
 * Only a missing legacy RPC permits the fallback; denied reads never become platform totals.
 * @sideEffects `get_admin_malo_breakdown`, or a newest-200 `tips` SELECT when that function is absent.
 */
export async function fetchAdminDonationBreakdown(): Promise<PortalMaloBreakdown> {
  if (!isSupabaseConfigured) return emptyPortalMaloBreakdown(false, 'Supabase env missing');
  try {
    const result = await client.rpc('get_admin_malo_breakdown');
    if (!result.error && result.data && typeof result.data === 'object') return parseBreakdown(bag(result.data));
    if (!isMissingFunction(result.error)) {
      return emptyPortalMaloBreakdown(true, result.error ? message(result.error) : 'The donation report returned no data.');
    }
    const listed = await client.from('tips')
      .select('id, amount_cents, created_at, origin, entry, source_label, reel_id, wishlist_item_id, player_id')
      .order('created_at', { ascending: false }).limit(MALO_FALLBACK_LIMIT);
    if (listed.error) return emptyPortalMaloBreakdown(true, message(listed.error));
    if (!Array.isArray(listed.data)) return emptyPortalMaloBreakdown(true, 'The donation list returned no data.');
    return breakdownFromTips(listed.data.map(bag));
  } catch (error) { return emptyPortalMaloBreakdown(true, message(error)); }
}

/** @purpose Read published and draft product settings. @sideEffects `app_runtime_config` SELECT only. */
export async function fetchAdminRuntimeSnapshot(): Promise<PortalRuntimeSnapshot> {
  if (!isSupabaseConfigured) return emptyRuntime('Supabase env missing');
  try {
    const result = await client.from('app_runtime_config').select('draft, published, published_at').eq('id', 'default').maybeSingle();
    if (result.error) return emptyRuntime(message(result.error));
    if (!result.data) return emptyRuntime('Runtime configuration was not returned.');
    const row = bag(result.data); const draft = bag(row.draft); const published = bag(row.published);
    return { ...missingState(), draft, published, publishedAt: text(row.published_at),
      dirty: row.draft == null || row.published == null ? null : !runtimeConfigsEqual(parseAppRuntimeConfig(draft), parseAppRuntimeConfig(published)) };
  } catch (error) { return emptyRuntime(message(error)); }
}

/** @purpose Read profile settings and claimed-athlete counts. @sideEffects Runtime and count-only profile SELECTs. */
export async function fetchAdminProfileSnapshot(): Promise<PortalProfileSnapshot> {
  if (!isSupabaseConfigured) return emptyProfile('Supabase env missing');
  try {
    const [runtime, claimed, athletes] = await Promise.all([
      client.from('app_runtime_config').select('published, published_at').eq('id', 'default').maybeSingle(),
      client.from('profiles').select('id', { count: 'exact', head: true }).not('player_id', 'is', null),
      client.from('profiles').select('id', { count: 'exact', head: true }).or('role.eq.athlete,roles.cs.{athlete},active_role.eq.athlete'),
    ]);
    const row = bag(runtime.data); const flags = runtime.error ? {} : bag(bag(row.published).profile);
    const errors = [...new Set([runtime.error, claimed.error, athletes.error].filter(Boolean).map(message))];
    return { ...emptyProfile(errors.length ? errors.join('; ') : null),
      claimedAthletes: claimed.error ? null : count(claimed.count), athleteProfiles: athletes.error ? null : count(athletes.count),
      publishedAt: text(row.published_at), showCard: bool(flags.showCard), showCrew: bool(flags.showCrew), showStats: bool(flags.showStats),
      showVault: bool(flags.showVault), actionsOnTop: bool(flags.actionsOnTop), statsFirst: bool(flags.statsFirst) };
  } catch (error) { return emptyProfile(message(error)); }
}

/** @purpose Read sign-in gates and fan counts. @sideEffects Runtime and count-only profile SELECTs. */
export async function fetchAdminSoftWallSnapshot(): Promise<PortalSoftWallSnapshot> {
  if (!isSupabaseConfigured) return emptySoftWall('Supabase env missing');
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [runtime, fans, recent] = await Promise.all([
      client.from('app_runtime_config').select('published, draft, published_at').eq('id', 'default').maybeSingle(),
      client.from('profiles').select('id', { count: 'exact', head: true }).or('role.eq.fan,roles.cs.{fan}'),
      client.from('profiles').select('id', { count: 'exact', head: true }).or('role.eq.fan,roles.cs.{fan}').gte('created_at', weekAgo),
    ]);
    const row = bag(runtime.data); const published = runtime.error ? {} : bag(row.published); const draft = runtime.error ? {} : bag(row.draft);
    const errors = [...new Set([runtime.error, fans.error, recent.error].filter(Boolean).map(message))];
    return { ...emptySoftWall(errors.length ? errors.join('; ') : null),
      fanProfiles: fans.error ? null : count(fans.count), fansLast7d: recent.error ? null : count(recent.count), publishedAt: text(row.published_at),
      operatorConsoleLive: bool(bag(published.layouts).operatorConsole), operatorConsoleDraft: bool(bag(draft.layouts).operatorConsole),
      maloLive: bool(bag(published.buttons).malo), crewLive: bool(bag(published.buttons).crew), wishlistLive: bool(bag(published.layouts).wishlist) };
  } catch (error) { return emptySoftWall(message(error)); }
}

/** @purpose Read the newest 40 people for oversight. @sideEffects Bounded profile SELECT, preserving denied reads. */
export async function fetchAdminPeopleSnapshot(): Promise<PortalPeopleSnapshot> {
  if (!isSupabaseConfigured) return emptyPeople('Supabase env missing');
  try {
    let result = await client.from('profiles')
      .select('id, full_name, username, role, is_admin, roles, created_at, player_id, verification_status, is_verified_athlete')
      .order('created_at', { ascending: false }).limit(40);
    // Old databases lack newer verification columns; permission failures must stay failures.
    if (isMissingColumn(result.error)) {
      result = await client.from('profiles').select('id, full_name, username, role, is_admin, roles, created_at')
        .order('created_at', { ascending: false }).limit(40);
    }
    if (result.error) return emptyPeople(message(result.error));
    if (!Array.isArray(result.data)) return emptyPeople('The people list returned no data.');
    return { ...missingState(), people: result.data.map((value) => {
      const row = bag(value); const roles = Array.isArray(row.roles) ? row.roles : [];
      return { id: String(row.id), full_name: text(row.full_name) ?? 'Unnamed', username: text(row.username), role: text(row.role) ?? 'fan',
        is_verified: row.is_verified_athlete === true || row.verification_status === 'verified', verification_status: text(row.verification_status),
        is_admin: row.is_admin === true || roles.includes('admin') || row.role === 'admin', player_id: text(row.player_id), created_at: text(row.created_at) };
    }) };
  } catch (error) { return emptyPeople(message(error)); }
}

/** Independent results survive one failed read; callers choose only the slices their desk renders. */
export type AdminReportSections = Partial<Record<keyof AdminReportData, boolean>>;
export async function fetchAdminReportData(sections: AdminReportSections = {}): Promise<AdminReportData> {
  const empty = emptyAdminReportData();
  const [reports, revenue, breakdown, runtime, profile, softWall, people, stock] = await Promise.all([
    sections.reports === false ? empty.reports : fetchAdminReportSnapshot(),
    sections.revenue === false ? empty.revenue : fetchAdminRevenueSnapshot(),
    sections.breakdown === false ? empty.breakdown : fetchAdminDonationBreakdown(),
    sections.runtime === false ? empty.runtime : fetchAdminRuntimeSnapshot(),
    sections.profile === false ? empty.profile : fetchAdminProfileSnapshot(),
    sections.softWall === false ? empty.softWall : fetchAdminSoftWallSnapshot(),
    sections.people === false ? empty.people : fetchAdminPeopleSnapshot(),
    sections.stock === false ? empty.stock : fetchAdminStockSnapshot(),
  ]);
  return { reports, revenue, breakdown, runtime, profile, softWall, people, stock };
}
