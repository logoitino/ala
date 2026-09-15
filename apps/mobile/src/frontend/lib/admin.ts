import { parseSpotlightAward, utcWeekStart } from '@/lib/spotlight';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Player, ReelWithPlayer, SpotlightAward } from '@/types/database';

export type AdminNavHref =
  | '/admin'
  | '/admin/studio'
  | '/admin/publish'
  | '/admin/features'
  | '/admin/look'
  | '/admin/catalog'
  | '/admin/qa'
  | '/admin/lab'
  | '/admin/feedback'
  | '/admin/coverage'
  | '/admin/spotlight'
  | '/admin/moderation'
  | '/admin/athletes'
  | '/admin/schools'
  | '/admin/games'
  | '/admin/sports'
  | '/admin/highlights'
  | '/admin/people'
  | '/admin/drip'
  | '/admin/wishlist'
  | '/admin/boosters'
  | '/admin/money'
  | '/admin/polls'
  | '/admin/reports';

export type AdminNavItem = {
  href: AdminNavHref;
  label: string;
  hint: string;
};

export type AdminNavGroupId = 'operations' | 'content' | 'commerce' | 'audience' | 'growth' | 'system';

export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  items: AdminNavItem[];
};

/** Sidebar groups for the production control plane (`/admin/*`). Home (`/admin`) is pinned outside these groups. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/admin/games', label: 'Live games', hint: 'Local match board' },
      { href: '/admin/sports', label: 'Sports', hint: 'Scoring, periods, stats per sport' },
      { href: '/admin/polls', label: 'Polls', hint: 'School cheer matchups' },
      { href: '/admin/boosters', label: 'Boosters', hint: 'Local sponsorships' },
      { href: '/admin/publish', label: 'Publish', hint: 'Go-live queue' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { href: '/admin/highlights', label: 'Highlights', hint: 'Vault, remove, restore' },
      { href: '/admin/spotlight', label: 'Spotlight', hint: 'Auto Player of the Week' },
      { href: '/admin/moderation', label: 'Moderation', hint: 'Flags and takedowns' },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: [
      { href: '/admin/drip', label: 'Drip', hint: 'Marketplace catalog' },
      { href: '/admin/wishlist', label: 'Locker Room', hint: 'Gear goals fans fund' },
      { href: '/admin/money', label: 'Money', hint: 'Revenue, Mālo, disbursements' },
    ],
  },
  {
    id: 'audience',
    label: 'Audience',
    items: [
      { href: '/admin/athletes', label: 'Athletes', hint: 'Roster that fans tag' },
      { href: '/admin/schools', label: 'Schools', hint: 'HS + NCAA catalog' },
      { href: '/admin/people', label: 'People', hint: 'Soft-Wall fans, verify, admin' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    items: [
      { href: '/admin/reports', label: 'Reports', hint: 'Tab time, taps, issues, money' },
      { href: '/admin/feedback', label: 'Feedback', hint: 'Fan suggestions to ship' },
      { href: '/admin/coverage', label: 'Coverage', hint: 'Every fan control + Soft-Wall' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/admin/features', label: 'Features', hint: 'Tabs, Soft-Wall, boards' },
      { href: '/admin/look', label: 'Look', hint: 'Daylight colors, copy, profile, Highlights rail' },
      { href: '/admin/catalog', label: 'Catalogs', hint: 'Mālo, exclusive, chips, tiers' },
      { href: '/admin/studio', label: 'Studio', hint: 'Preview roles and surfaces' },
    ],
  },
];

export const ADMIN_HOME: AdminNavItem = { href: '/admin', label: 'Home', hint: 'Dashboard and inbox' };

export const ADMIN_NAV: AdminNavItem[] = [ADMIN_HOME, ...ADMIN_NAV_GROUPS.flatMap((group) => group.items)];

export type AdminLens = 'marketing' | 'owner' | 'engineer' | 'all';

export const ADMIN_LENS_KEY = 'tapuai.adminLens';

export const ADMIN_LENSES: { id: AdminLens; label: string; hint: string }[] = [
  { id: 'all', label: 'All desks', hint: 'Every tool' },
  { id: 'marketing', label: 'Marketing', hint: 'Look, copy, campaign chrome' },
  { id: 'owner', label: 'Owner', hint: 'Numbers, people, Spotlight' },
  { id: 'engineer', label: 'Engineer', hint: 'Flags, catalogs, feedback' },
];

const LENS_HREFS: Record<Exclude<AdminLens, 'all'>, AdminNavHref[]> = {
  marketing: [
    '/admin/look',
    '/admin/features',
    '/admin/catalog',
    '/admin/publish',
    '/admin/spotlight',
    '/admin/drip',
    '/admin/wishlist',
    '/admin/boosters',
    '/admin/polls',
    '/admin/feedback',
    '/admin/coverage',
  ],
  owner: [
    '/admin/money',
    '/admin/catalog',
    '/admin/wishlist',
    '/admin/reports',
    '/admin/people',
    '/admin/spotlight',
    '/admin/coverage',
    '/admin/athletes',
    '/admin/sports',
  ],
  engineer: [
    '/admin/features',
    '/admin/catalog',
    '/admin/publish',
    '/admin/feedback',
    '/admin/moderation',
    '/admin/highlights',
    '/admin/coverage',
    '/admin/sports',
    '/admin/reports',
  ],
};

/**
 * @purpose Filter sidebar groups for Marketing / Owner / Engineer without hiding All desks.
 */
export function navGroupsForLens(lens: AdminLens): AdminNavGroup[] {
  if (lens === 'all') return ADMIN_NAV_GROUPS;
  const allowed = new Set(LENS_HREFS[lens]);
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.href)),
  })).filter((group) => group.items.length > 0);
}

export function overviewLedeForLens(lens: AdminLens): string {
  if (lens === 'marketing') return 'Look, copy, and campaign chrome. Draft until Publish to app.';
  if (lens === 'owner') return 'Gross, net, payouts, health, and who needs a decision.';
  if (lens === 'engineer') return 'Flags, catalogs, coverage, and fan suggestions waiting to become a patch.';
  return 'Home for the control plane. Inbox first, then every desk that ships the fan app.';
}

const FAN_HREF_BY_DESK: Partial<Record<AdminNavHref, string>> = {
  '/admin/highlights': '/',
  '/admin/features': '/',
  '/admin/look': '/',
  '/admin/catalog': '/',
  '/admin/games': '/local',
  '/admin/sports': '/operator',
  '/admin/polls': '/local',
  '/admin/boosters': '/local',
  '/admin/publish': '/local',
  '/admin/spotlight': '/spotlight',
  '/admin/drip': '/drip',
  '/admin/wishlist': '/profile',
  '/admin/money': '/receipts',
  '/admin/athletes': '/profile',
  '/admin/moderation': '/',
  '/admin/feedback': '/',
  '/admin/lab': '/',
  '/admin/schools': '/local',
  '/admin/reports': '/',
  '/admin/people': '/profile',
  '/admin/studio': '/',
  '/admin/coverage': '/',
  '/admin/qa': '/',
};

/**
 * @purpose Resolve sidebar group + fan surface for the current `/admin` path so Back / Home / Open in app always have a target.
 */
export function adminTrailForPath(pathname: string): {
  isHome: boolean;
  group: AdminNavGroup | null;
  desk: AdminNavItem;
  fanHref: string | null;
} {
  const path = pathname.replace(/\/$/, '') || '/admin';
  const isHome = path === '/admin';
  const desk = ADMIN_NAV.find((item) => isAdminNavActive(item.href, path)) ?? ADMIN_HOME;
  const group = ADMIN_NAV_GROUPS.find((item) => item.items.some((entry) => entry.href === desk.href)) ?? null;
  return {
    isHome,
    group,
    desk,
    fanHref: FAN_HREF_BY_DESK[desk.href] ?? null,
  };
}

export type AdminProductionSurface = {
  href: string;
  label: string;
  hint: string;
};

/** Fan + operator routes Studio / QA open to verify what the portal just published. */
export const ADMIN_PRODUCTION_SURFACES: AdminProductionSurface[] = [
  { href: '/', label: 'Home', hint: 'Highlights ⚡ feed fans actually watch' },
  { href: '/local', label: 'Local', hint: 'Live matches, polls, Top Boosters' },
  { href: '/spotlight', label: 'Spotlight', hint: 'Player of the Week board' },
  { href: '/drip', label: 'Drip', hint: 'Marketplace catalog' },
  { href: '/profile', label: 'Profile', hint: 'Trading card + Vault' },
  { href: '/operator', label: 'Operator console', hint: 'Sideline scorekeeper (preview as Operator)' },
  { href: '/parent', label: 'Parent HQ', hint: 'Guardian surface (preview as Parent)' },
  { href: '/booster', label: 'Booster HQ', hint: 'Local sponsorships (preview as Booster)' },
  { href: '/sponsor', label: 'Sponsor HQ', hint: 'Brand surface (preview as Sponsor)' },
];

/**
 * @purpose Highlight the matching sidebar item for the current `/admin` path.
 */
export function isAdminNavActive(href: AdminNavHref, pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  if (href === '/admin') return path === '/admin';
  return path === href || path.startsWith(`${href}/`);
}

export type AdminPlatformMetrics = {
  highlightCount: number;
  engagementCount: number;
  maloCents: number;
  openFlags: number;
  telemetryEvents24h: number;
};

export type AdminFlagRow = {
  id: string;
  kind: 'highlight' | 'telemetry';
  title: string;
  subtitle: string;
  reportCount: number;
  openedAt: string;
};

export type PublishSpotlightInput = {
  playerId: string;
  headline: string;
  periodKind: 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
};

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function playerLabel(players: unknown): { name: string; school: string } {
  const row = Array.isArray(players) ? players[0] : players;
  if (!row || typeof row !== 'object') return { name: 'Highlight', school: '' };
  const record = row as Record<string, unknown>;
  return {
    name: asText(record.name, 'Highlight'),
    school: asText(record.school_name),
  };
}

/**
 * @purpose Monday–Sunday UTC window for a new Player of the Week form.
 */
export function defaultSpotlightWindow(kind: 'week' | 'month' | 'year' = 'week'): { start: string; end: string } {
  const now = new Date();
  if (kind === 'year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31)).toISOString().slice(0, 10);
    return { start, end };
  }
  if (kind === 'month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  const start = utcWeekStart();
  const monday = new Date(`${start}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 6);
  return { start, end: monday.toISOString().slice(0, 10) };
}

/**
 * @purpose Load Spotlight rows for the admin publisher (newest first).
 * @sideEffects `spotlight_awards` SELECT.
 */
export async function fetchAdminSpotlightAwards(): Promise<SpotlightAward[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('spotlight_awards')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(12);
  if (error || !Array.isArray(data)) return [];
  return data.map(parseSpotlightAward).filter((row): row is SpotlightAward => Boolean(row));
}

/**
 * @purpose Publish Player of the Week / Month from the admin form.
 * @sideEffects `publish_spotlight_award` RPC; `spotlight_awards` INSERT fallback.
 */
export async function publishSpotlightAward(input: PublishSpotlightInput): Promise<SpotlightAward> {
  const headline = input.headline.trim();
  if (!input.playerId) throw new Error('Select an athlete.');
  if (!headline) throw new Error('Add a performance headline.');
  if (!input.startDate || !input.endDate) throw new Error('Pick start and end dates.');
  if (input.endDate < input.startDate) throw new Error('End date must be on or after start date.');
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('publish_spotlight_award', {
    target_player_id: input.playerId,
    award_headline: headline,
    period_kind: input.periodKind,
    window_start: input.startDate,
    window_end: input.endDate,
  });
  if (!error && data) {
    const parsed = parseSpotlightAward({
      ...(typeof data === 'object' && data ? data : {}),
      player_id: input.playerId,
      period_kind: input.periodKind,
      period_start: input.startDate,
      headline,
    });
    if (parsed) return parsed;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('spotlight_awards')
    .insert({
      award_type: input.periodKind,
      headline,
      start_date: input.startDate,
      end_date: input.endDate,
      level: 'school',
    })
    .select('*')
    .single();
  if (insertError) throw new Error(error?.message || insertError.message);
  const parsed = parseSpotlightAward(inserted);
  if (!parsed) throw new Error('Could not publish this Spotlight award.');
  return parsed;
}

/**
 * @purpose Open Highlight flags for the moderation table, optionally with recent telemetry incidents.
 * @param withTelemetry Include stalls / reconnects. Moderation leaves these to QA, which owns the 24h table.
 * @sideEffects `reels` SELECT (`is_flagged`); `telemetry_logs` SELECT when `withTelemetry`.
 */
export async function fetchAdminFlags(withTelemetry = false): Promise<AdminFlagRow[]> {
  if (!isSupabaseConfigured) return [];
  const rows: AdminFlagRow[] = [];

  const flaggedLive = await supabase
    .from('reels')
    .select('id, title, created_at, reported_by, is_removed, players (name, school_name)')
    .eq('is_flagged', true)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(40);

  const flagged = flaggedLive.error
    ? await supabase
        .from('reels')
        .select('id, title, created_at, reported_by, players (name, school_name)')
        .eq('is_flagged', true)
        .order('created_at', { ascending: false })
        .limit(40)
    : flaggedLive;

  if (!flagged.error && Array.isArray(flagged.data)) {
    for (const row of flagged.data) {
      const record = row as Record<string, unknown>;
      if (record.is_removed === true) continue;
      const athlete = playerLabel(record.players);
      const reported = Array.isArray(record.reported_by) ? record.reported_by.length : 0;
      rows.push({
        id: asText(record.id),
        kind: 'highlight',
        title: asText(record.title, athlete.name),
        subtitle: [athlete.name, athlete.school].filter(Boolean).join(' · ') || 'User flag',
        reportCount: Math.max(1, reported),
        openedAt: asText(record.created_at),
      });
    }
  }

  if (!withTelemetry) return rows;

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const telemetry = await supabase
    .from('telemetry_logs')
    .select('id, event_type, video_id, channel, created_at')
    .in('event_type', ['video_stall', 'socket_reconnect'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!telemetry.error && Array.isArray(telemetry.data)) {
    for (const row of telemetry.data) {
      const event = asText(row.event_type, 'incident');
      rows.push({
        id: `tel:${asText(row.id)}`,
        kind: 'telemetry',
        title: event === 'video_stall' ? 'Video stall' : 'Realtime reconnect',
        subtitle: asText(row.video_id) || asText(row.channel) || 'Bug report',
        reportCount: 1,
        openedAt: asText(row.created_at),
      });
    }
  }

  return rows;
}

/**
 * @purpose Dismiss a Highlight flag or take the clip off Highlights ⚡.
 * @param reelId `reels.id`.
 * @param action `dismiss` clears `is_flagged`; `remove` sets `is_removed`.
 * @sideEffects `moderate_flagged_reel` RPC; `reels` UPDATE fallback.
 */
export async function moderateFlaggedReel(reelId: string, action: 'dismiss' | 'remove'): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('moderate_flagged_reel', {
    target_reel_id: reelId,
    moderation_action: action,
  });
  if (!error) return;
  const patch = action === 'remove' ? { is_removed: true, is_flagged: false } : { is_flagged: false };
  const { error: updateError } = await supabase.from('reels').update(patch).eq('id', reelId);
  if (updateError) throw new Error(error.message || updateError.message);
}

/**
 * @purpose Dismiss a telemetry incident row from the moderation table.
 * @sideEffects `telemetry_logs` DELETE (authenticated).
 */
export async function dismissTelemetryIncident(logId: string): Promise<void> {
  if (!isSupabaseConfigured || !logId) return;
  await supabase.from('telemetry_logs').delete().eq('id', logId);
}

/**
 * @purpose Platform totals for Telemetry cards (Highlights, engagement, Mālo).
 * @sideEffects `get_admin_platform_metrics` RPC; table COUNT/SUM fallback.
 */
export async function fetchAdminPlatformMetrics(): Promise<AdminPlatformMetrics> {
  const empty: AdminPlatformMetrics = {
    highlightCount: 0,
    engagementCount: 0,
    maloCents: 0,
    openFlags: 0,
    telemetryEvents24h: 0,
  };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase.rpc('get_admin_platform_metrics');
  if (!error && data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    return {
      highlightCount: asInt(row.highlight_count),
      engagementCount: asInt(row.engagement_count),
      maloCents: asInt(row.malo_cents),
      openFlags: asInt(row.open_flags),
      telemetryEvents24h: asInt(row.telemetry_events_24h),
    };
  }

  const [reels, tips, telemetry] = await Promise.all([
    supabase.from('reels').select('seki_count, aura_count, flex_count, total_tips_cents, is_flagged, is_removed'),
    supabase.from('tips').select('amount_cents'),
    supabase
      .from('telemetry_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3_600_000).toISOString()),
  ]);

  const clipRows = Array.isArray(reels.data) ? reels.data : [];
  const live = clipRows.filter((row) => (row as ReelWithPlayer).is_removed !== true);
  const highlightCount = live.length;
  const engagementCount = live.reduce(
    (sum, row) =>
      sum +
      asInt((row as { seki_count?: number }).seki_count) +
      asInt((row as { aura_count?: number }).aura_count) +
      asInt((row as { flex_count?: number }).flex_count),
    0,
  );
  const maloCents = Array.isArray(tips.data)
    ? tips.data.reduce((sum, row) => sum + asInt(row.amount_cents), 0)
    : 0;
  const openFlags = live.filter((row) => (row as { is_flagged?: boolean }).is_flagged === true).length;

  return {
    highlightCount,
    engagementCount,
    maloCents,
    openFlags,
    telemetryEvents24h: telemetry.count ?? 0,
  };
}

/**
 * @purpose Filter the roster for the Spotlight athlete picker.
 */
export function filterAdminAthletes(players: Player[], query: string): Player[] {
  const needle = query.trim().toLowerCase();
  const sorted = [...players].sort((left, right) => left.name.localeCompare(right.name));
  if (!needle) return sorted.slice(0, 12);
  return sorted
    .filter((player) => `${player.name} ${player.school_name}`.toLowerCase().includes(needle))
    .slice(0, 12);
}

export type AdminTelemetryRow = {
  id: string;
  eventType: string;
  title: string;
  subtitle: string;
  durationMs: number | null;
  createdAt: string;
};

export type AdminTelemetryDigest = {
  stalls: number;
  reconnects: number;
  firstFrames: number;
  checkouts: number;
  avgCheckoutMs: number;
  recent: AdminTelemetryRow[];
};

function telemetryTitle(eventType: string): string {
  if (eventType === 'video_stall') return 'Video stall';
  if (eventType === 'socket_reconnect') return 'Realtime reconnect';
  if (eventType === 'video_first_frame') return 'Time to first frame';
  if (eventType === 'checkout_latency') return 'Mālo checkout';
  if (eventType === 'tab_dwell') return 'Tab time';
  if (eventType === 'surface_scroll') return 'Scroll depth';
  if (eventType === 'feature_tap') return 'Feature tap';
  if (eventType === 'ui_issue') return 'Control issue';
  return eventType.replace(/_/g, ' ');
}

/**
 * @purpose 24h performance digest for the QA polish desk.
 * @sideEffects `telemetry_logs` SELECT (authenticated / demo).
 */
export async function fetchAdminTelemetryDigest(): Promise<AdminTelemetryDigest> {
  const empty: AdminTelemetryDigest = {
    stalls: 0,
    reconnects: 0,
    firstFrames: 0,
    checkouts: 0,
    avgCheckoutMs: 0,
    recent: [],
  };
  if (!isSupabaseConfigured) return empty;

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('telemetry_logs')
    .select('id, event_type, video_id, channel, step, duration_ms, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !Array.isArray(data)) return empty;

  let stalls = 0;
  let reconnects = 0;
  let firstFrames = 0;
  let checkouts = 0;
  let checkoutMs = 0;
  const recent: AdminTelemetryRow[] = [];

  for (const row of data) {
    const eventType = asText(row.event_type, 'event');
    const durationMs = row.duration_ms == null ? null : asInt(row.duration_ms);
    if (eventType === 'video_stall') stalls += 1;
    else if (eventType === 'socket_reconnect') reconnects += 1;
    else if (eventType === 'video_first_frame') firstFrames += 1;
    else if (eventType === 'checkout_latency') {
      checkouts += 1;
      checkoutMs += durationMs ?? 0;
    }
    recent.push({
      id: asText(row.id),
      eventType,
      title: telemetryTitle(eventType),
      subtitle: asText(row.video_id) || asText(row.channel) || asText(row.step) || 'Client event',
      durationMs,
      createdAt: asText(row.created_at),
    });
  }

  return {
    stalls,
    reconnects,
    firstFrames,
    checkouts,
    avgCheckoutMs: checkouts > 0 ? Math.round(checkoutMs / checkouts) : 0,
    recent,
  };
}

export type AdminReportSection = Record<string, number>;

export type AdminReportLeader = {
  label: string;
  value: number;
};

export type AdminReportLeaders = {
  malo: AdminReportLeader[];
  hype: AdminReportLeader[];
  schools: AdminReportLeader[];
};

export type AdminReports = {
  generatedAt: string | null;
  engagement: AdminReportSection;
  money: AdminReportSection;
  content: AdminReportSection;
  audience: AdminReportSection;
  live: AdminReportSection;
  reliability: AdminReportSection;
  usage: AdminReportSection;
  tabs: AdminReportLeader[];
  features: AdminReportLeader[];
  issues: AdminReportLeader[];
  scroll: AdminReportLeader[];
  leaders: AdminReportLeaders;
  series: AdminReportSeries;
};

export type AdminReportPoint = {
  day: string;
  value: number;
};

export type AdminReportSeries = {
  clips: AdminReportPoint[];
  malo: AdminReportPoint[];
  stalls: AdminReportPoint[];
  dwell: AdminReportPoint[];
};

export type AdminHealthStatus = 'ok' | 'warn' | 'fail';

export type AdminHealthCheck = {
  id: string;
  label: string;
  category: string;
  status: AdminHealthStatus;
  detail: string;
  href?: AdminNavHref;
};

function asSection(raw: unknown): AdminReportSection {
  if (!raw || typeof raw !== 'object') return {};
  const next: AdminReportSection = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    next[key] = asInt(value);
  }
  return next;
}

function asLeaders(raw: unknown): AdminReportLeader[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const label = asText(item.label);
      if (!label) return null;
      return { label, value: asInt(item.value) };
    })
    .filter((row): row is AdminReportLeader => row !== null);
}

function parseLeaders(raw: unknown): AdminReportLeaders {
  const bag = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    malo: asLeaders(bag.malo),
    hype: asLeaders(bag.hype),
    schools: asLeaders(bag.schools),
  };
}

function parseSeries(raw: unknown): AdminReportSeries {
  const bag = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    clips: asLeaders(bag.clips).map((row) => ({ day: row.label, value: row.value })),
    malo: asLeaders(bag.malo).map((row) => ({ day: row.label, value: row.value })),
    stalls: asLeaders(bag.stalls).map((row) => ({ day: row.label, value: row.value })),
    dwell: asLeaders(bag.dwell).map((row) => ({ day: row.label, value: row.value })),
  };
}

const EMPTY_REPORTS: AdminReports = {
  generatedAt: null,
  engagement: {},
  money: {},
  content: {},
  audience: {},
  live: {},
  reliability: {},
  usage: {},
  tabs: [],
  features: [],
  issues: [],
  scroll: [],
  leaders: { malo: [], hype: [], schools: [] },
  series: { clips: [], malo: [], stalls: [], dwell: [] },
};

/**
 * @purpose Platform reports for usage, Mālo, content mix, audience, live ops, reliability, and leaders.
 * @sideEffects `get_admin_reports` RPC.
 */
export async function fetchAdminReports(): Promise<AdminReports> {
  if (!isSupabaseConfigured) return EMPTY_REPORTS;
  const { data, error } = await supabase.rpc('get_admin_reports');
  if (error || !data || typeof data !== 'object') return EMPTY_REPORTS;
  const row = data as Record<string, unknown>;
  return {
    generatedAt: asText(row.generated_at) || null,
    engagement: asSection(row.engagement),
    money: asSection(row.money),
    content: asSection(row.content),
    audience: asSection(row.audience),
    live: asSection(row.live),
    reliability: asSection(row.reliability),
    usage: asSection(row.usage),
    tabs: asLeaders(row.tabs),
    features: asLeaders(row.features),
    issues: asLeaders(row.issues),
    scroll: asLeaders(row.scroll),
    leaders: parseLeaders(row.leaders),
    series: parseSeries(row.series),
  };
}

function band(value: number, warnAt: number, failAt: number): AdminHealthStatus {
  if (value >= failAt) return 'fail';
  if (value >= warnAt) return 'warn';
  return 'ok';
}

/**
 * @purpose Pass / warn / fail checks across feed, money, content, live ops, usage, and shipping.
 */
export function buildAdminHealth(
  reports: AdminReports,
  extras: { dirty: boolean; pendingCount: number; lowStock: number },
): AdminHealthCheck[] {
  const stalls = reports.reliability.stalls_24h ?? 0;
  const reconnects = reports.reliability.reconnects_24h ?? 0;
  const checkout = reports.reliability.avg_checkout_ms_24h ?? 0;
  const flags = reports.content.flagged ?? 0;
  const payouts = reports.money.queued_payouts ?? 0;
  const verify = reports.audience.pending_verify ?? 0;
  const liveGames = reports.live.live_games ?? 0;
  const drip = reports.live.drip_skus ?? 0;
  const clips24 = reports.engagement.clips_24h ?? 0;
  const spotlight = reports.content.spotlight_live ?? 0;
  const sessions = reports.usage.sessions_24h ?? 0;
  const issues = reports.usage.issues_24h ?? 0;

  const checks: AdminHealthCheck[] = [
    {
      id: 'stalls',
      label: 'Video stalls',
      category: 'Reliability',
      status: band(stalls, 1, 5),
      detail: stalls === 0 ? 'No stalls in 24h.' : `${stalls} stall${stalls === 1 ? '' : 's'} in 24h.`,
      href: '/admin/qa',
    },
    {
      id: 'reconnects',
      label: 'Realtime reconnects',
      category: 'Reliability',
      status: band(reconnects, 1, 10),
      detail: reconnects === 0 ? 'Sockets are quiet.' : `${reconnects} reconnect${reconnects === 1 ? '' : 's'} in 24h.`,
      href: '/admin/qa',
    },
    {
      id: 'checkout',
      label: 'Mālo checkout',
      category: 'Money',
      status: checkout >= 8000 ? 'fail' : checkout >= 3000 ? 'warn' : 'ok',
      detail: checkout === 0 ? 'No checkout samples in 24h.' : `Avg ${checkout} ms in 24h.`,
      href: '/admin/money',
    },
    {
      id: 'flags',
      label: 'Open flags',
      category: 'Content',
      status: band(flags, 1, 8),
      detail: flags === 0 ? 'Moderation queue is clear.' : `${flags} flagged clip${flags === 1 ? '' : 's'}.`,
      href: '/admin/moderation',
    },
    {
      id: 'payouts',
      label: 'Queued payouts',
      category: 'Money',
      status: payouts > 0 ? 'warn' : 'ok',
      detail: payouts === 0 ? 'No disbursements waiting.' : `${payouts} queued for mark-paid.`,
      href: '/admin/money',
    },
    {
      id: 'verify',
      label: 'Verify queue',
      category: 'Audience',
      status: verify > 0 ? 'warn' : 'ok',
      detail: verify === 0 ? 'No pending athlete verifies.' : `${verify} waiting on People.`,
      href: '/admin/people',
    },
    {
      id: 'live',
      label: 'Live board',
      category: 'Live ops',
      status: liveGames === 0 ? 'warn' : 'ok',
      detail: liveGames === 0 ? 'No live games on Local.' : `${liveGames} match${liveGames === 1 ? '' : 'es'} live.`,
      href: '/admin/games',
    },
    {
      id: 'drip',
      label: 'Drip rack',
      category: 'Live ops',
      status: drip === 0 || extras.lowStock > 0 ? 'warn' : 'ok',
      detail:
        drip === 0
          ? 'No active Drip SKUs.'
          : extras.lowStock > 0
            ? `${extras.lowStock} low-stock item${extras.lowStock === 1 ? '' : 's'}.`
            : `${drip} SKUs on the rack.`,
      href: '/admin/drip',
    },
    {
      id: 'uploads',
      label: 'Uploads (24h)',
      category: 'Engagement',
      status: clips24 === 0 ? 'warn' : 'ok',
      detail: clips24 === 0 ? 'No new clips in 24h.' : `${clips24} clip${clips24 === 1 ? '' : 's'} uploaded.`,
      href: '/admin/highlights',
    },
    {
      id: 'spotlight',
      label: 'Spotlight window',
      category: 'Content',
      status: spotlight === 0 ? 'warn' : 'ok',
      detail: spotlight === 0 ? 'No live Player of the Week.' : `${spotlight} award${spotlight === 1 ? '' : 's'} in window.`,
      href: '/admin/spotlight',
    },
    {
      id: 'chrome',
      label: 'Unpublished look',
      category: 'Ship',
      status: extras.dirty ? 'warn' : 'ok',
      detail: extras.dirty
        ? `${extras.pendingCount} draft change${extras.pendingCount === 1 ? '' : 's'} wait on Publish to app.`
        : 'Fan chrome matches the last publish.',
      href: '/admin/features',
    },
    {
      id: 'sessions',
      label: 'Tab sessions',
      category: 'Usage',
      status: sessions === 0 ? 'warn' : 'ok',
      detail: sessions === 0 ? 'No tab dwell in 24h yet.' : `${sessions} session${sessions === 1 ? '' : 's'} in 24h.`,
      href: '/admin/reports',
    },
    {
      id: 'ui-issues',
      label: 'Control issues',
      category: 'Usage',
      status: band(issues, 3, 12),
      detail:
        issues === 0
          ? 'No failed controls in 24h.'
          : `${issues} issue${issues === 1 ? '' : 's'} on buttons and tabs in 24h.`,
      href: '/admin/feedback',
    },
  ];
  return checks;
}
