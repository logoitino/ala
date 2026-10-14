/**
 * Data and navigation helpers for Expo /admin: main reports, complete desk trails, and editor groups each lens
 * (Marketing / Owner / Engineer / All) shows, plus the admin reads and actions behind the desks (Spotlight awards,
 * flagged-clip moderation, platform metrics, telemetry digest, reports and health checks).
 * Editing groups exclude the legacy Reports dashboard so top-level reporting has one navigation owner.
 * @sideEffects Reads and writes through the shared Supabase client; admin role enforced by RLS.
 */

import { athleteOrGuardianReported, queueReasonLabel } from '@/data/contentRights';
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
  | '/admin/support'
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
  | '/admin/books'
  | '/admin/polls'
  | '/admin/reports'
  | '/admin/trends'
  | '/admin/audience'
  | '/admin/revenue'
  | '/admin/health'
  | '/admin/product'
  | '/admin/analytics'
  | '/admin/departments'
  | '/admin/product/features'
  | '/admin/product/profile'
  | '/admin/product/sign-in'
  | '/admin/product/people'
  | '/admin/product/coverage';

export type AdminNavItem = {
  href: AdminNavHref;
  label: string;
  hint: string;
  /** Search terms retain the old editor names after their menu entries are merged. */
  searchTerms?: string;
  members?: AdminNavItem[];
};

export type AdminNavGroupId = 'operations' | 'content' | 'commerce' | 'audience' | 'growth' | 'system' | 'reports';

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
      { href: '/admin/publish', label: 'Publish queue', hint: 'Content readiness and go-live queue' },
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
      { href: '/admin/wishlist', label: 'Locker Room', hint: 'Gear goals fans donate to' },
      { href: '/admin/money', label: 'Payouts', hint: 'Queue and review disbursements', searchTerms: 'Money' },
      { href: '/admin/books', label: 'Finance & Books', hint: 'Accounting, taxes, reconciliation and QuickBooks export', searchTerms: 'Books bookkeeping accounting tax QuickBooks reconcile' },
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
      { href: '/admin/feedback', label: 'Feedback', hint: 'Fan suggestions to ship' },
      { href: '/admin/coverage', label: 'Coverage', hint: 'Every fan control + Soft-Wall' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/admin/support', label: 'Engineering Support', hint: 'Issues, team flow, change history and recovery', searchTerms: 'Support security cybersecurity sensors errors audit backup versions' },
      { href: '/admin/features', label: 'Features', hint: 'Tabs, Soft-Wall, boards' },
      { href: '/admin/look', label: 'Look', hint: 'Daylight colors, copy, profile, Highlights rail' },
      { href: '/admin/catalog', label: 'Catalogs', hint: 'Donations, exclusive, chips, tiers' },
      { href: '/admin/studio', label: 'Studio', hint: 'Preview roles and surfaces' },
    ],
  },
];

export const ADMIN_HOME: AdminNavItem = { href: '/admin', label: 'Home', hint: 'Dashboard and inbox' };

export const ADMIN_NAV: AdminNavItem[] = [ADMIN_HOME, ...ADMIN_NAV_GROUPS.flatMap((group) => group.items)];

/** Reports use distinct paths so existing Money, People and Features editors retain their actions. */
export const ADMIN_REPORT_NAV: AdminNavItem[] = [
  ADMIN_HOME,
  { href: '/admin/trends', label: 'Trends', hint: 'Recorded changes over the last seven days' },
  { href: '/admin/audience', label: 'Audience', hint: 'Profiles, athletes, schools and clips' },
  { href: '/admin/revenue', label: 'Revenue', hint: 'Donations and recorded ledger rows' },
  { href: '/admin/health', label: 'Health', hint: 'Operational checks, attention and issues' },
  { href: '/admin/product', label: 'Product', hint: 'Published product status' },
];

export const ADMIN_REPORT_UTILITIES: AdminNavItem[] = [
  { href: '/admin/analytics', label: 'Analytics', hint: 'Dashboards and every measured source' },
  { href: '/admin/departments', label: 'Departments', hint: 'Billing, Marketing, Support, API and IT' },
];

export const ADMIN_PRODUCT_NAV: AdminNavItem[] = [
  { href: '/admin/product', label: 'Overview', hint: 'Published menu status' },
  { href: '/admin/product/features', label: 'Features', hint: 'Published features and draft status' },
  { href: '/admin/product/profile', label: 'Profile', hint: 'Profile hierarchy and chrome' },
  { href: '/admin/product/sign-in', label: 'Sign-in', hint: 'Browse-first gates and providers' },
  { href: '/admin/product/people', label: 'People', hint: 'Recent profiles' },
  { href: '/admin/product/coverage', label: 'Control map', hint: 'Every fan control, source and owner' },
];

/** QA and Lab have one place in the Tools group and in search. */
export const ADMIN_TOOL_UTILITIES: AdminNavItem[] = [
  { href: '/admin/qa', label: 'QA', hint: 'Telemetry and offline queue controls' },
  { href: '/admin/lab', label: 'Lab', hint: 'Validated runtime drafts' },
];

/** Related editors share navigation; original route labels and draft owners stay intact. */
export const ADMIN_WORKSPACES = [
  { label: 'App setup', hint: 'Features, Look, Catalogs and validated JSON drafts', items: [
    ...ADMIN_NAV_GROUPS.flatMap(group => group.items).filter(item => ['/admin/features', '/admin/look', '/admin/catalog'].includes(item.href)),
    ADMIN_TOOL_UTILITIES.find(item => item.href === '/admin/lab')!,
  ] },
  { label: 'Highlights & review', hint: 'Clip editing, Vault, flags and takedowns', items:
    ADMIN_NAV_GROUPS.flatMap(group => group.items).filter(item => ['/admin/highlights', '/admin/moderation'].includes(item.href)) },
];

export function adminWorkspaceForPath(pathname: string) {
  return ADMIN_WORKSPACES.find(workspace => workspace.items.some(item => isAdminNavActive(item.href, pathname))) ?? null;
}

/** Studio and device repair are utilities; Lab is part of App setup. */
export const ADMIN_MANAGE_UTILITIES = [ADMIN_TOOL_UTILITIES[0], ADMIN_NAV_GROUPS.flatMap(group => group.items).find(item => item.href === '/admin/studio')!];

/** Keep saved Reports links resolvable while the route opens the canonical Analytics view. */
const ADMIN_LEGACY_REPORT_DESK: AdminNavItem = { href: '/admin/reports', label: 'Reports', hint: 'Opens Analytics' };

/** Resolve every route independently of a lens or whether its link is currently expanded. */
export const ADMIN_DESK_DIRECTORY: AdminNavItem[] = [
  ...ADMIN_NAV, ADMIN_LEGACY_REPORT_DESK, ...ADMIN_TOOL_UTILITIES, ...ADMIN_REPORT_NAV.slice(1), ...ADMIN_REPORT_UTILITIES,
  ...ADMIN_PRODUCT_NAV.slice(1),
];

const ADMIN_REPORT_GROUP: AdminNavGroup = {
  id: 'reports', label: 'Reports',
  items: [ADMIN_LEGACY_REPORT_DESK, ...ADMIN_REPORT_NAV.slice(1), ...ADMIN_REPORT_UTILITIES, ...ADMIN_PRODUCT_NAV.slice(1)],
};

export type AdminLens = 'marketing' | 'owner' | 'engineer' | 'finance' | 'all';

export const ADMIN_LENS_KEY = 'tapuai.adminLens';

export const ADMIN_LENSES: { id: AdminLens; label: string; hint: string }[] = [
  { id: 'all', label: 'All desks', hint: 'Every tool' },
  { id: 'marketing', label: 'Marketing', hint: 'Look, copy, campaign chrome' },
  { id: 'owner', label: 'Owner', hint: 'Numbers, people, Spotlight' },
  { id: 'engineer', label: 'Engineer', hint: 'Flags, catalogs, feedback' },
  // BOOKS-02: the CFO's teams (accounting, tax, treasury) see only the money desks.
  { id: 'finance', label: 'Finance', hint: 'Books, payouts, prices and money desks' },
];

const LENS_HREFS: Record<Exclude<AdminLens, 'all'>, AdminNavHref[]> = {
  marketing: [
    '/admin/lab',
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
    '/admin/support',
    '/admin/lab',
    '/admin/money',
    '/admin/books',
    '/admin/catalog',
    '/admin/wishlist',
    '/admin/people',
    '/admin/spotlight',
    '/admin/coverage',
    '/admin/athletes',
    '/admin/sports',
  ],
  finance: [
    '/admin/support',
    '/admin/books',
    '/admin/money',
    '/admin/boosters',
    '/admin/drip',
    '/admin/wishlist',
    '/admin/catalog',
  ],
  engineer: [
    '/admin/support',
    '/admin/lab',
    '/admin/features',
    '/admin/catalog',
    '/admin/publish',
    '/admin/feedback',
    '/admin/moderation',
    '/admin/highlights',
    '/admin/coverage',
    '/admin/sports',
  ],
};

/**
 * @purpose Filter sidebar groups for Marketing / Owner / Engineer without hiding All desks.
 */
export function navGroupsForLens(lens: AdminLens): AdminNavGroup[] {
  const allowed = lens === 'all' ? null : new Set(LENS_HREFS[lens]);
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(item => !['/admin/coverage', '/admin/studio'].includes(item.href))
      .filter(item => !allowed || allowed.has(item.href))
      .flatMap(item => {
        const workspace = adminWorkspaceForPath(item.href);
        if (!workspace) return [item];
        const members = workspace.items.filter(member => !allowed || allowed.has(member.href));
        if (item.href !== members[0]?.href) return [];
        return [{ ...item, label: workspace.label, hint: workspace.hint, members, searchTerms: members.map(member => `${member.label} ${member.hint}`).join(' ') }];
      }),
  })).filter((group) => group.items.length > 0);
}

/** Editors retain decision context, while these reports own full-period analysis. */
export function adminAnalysisForPath(pathname: string): AdminNavItem[] {
  const path = adminTrailForPath(pathname).desk.href;
  const report = (href: AdminNavHref, label: string): AdminNavItem => ({ href, label, hint: '' });
  if (['/admin/money', '/admin/drip', '/admin/wishlist', '/admin/boosters'].includes(path)) return [report('/admin/revenue', 'Revenue report'), report('/admin/books', 'Finance & Books')];
  if (path === '/admin/books') return [report('/admin/revenue', 'Revenue report')];
  if (['/admin/athletes', '/admin/schools', '/admin/people'].includes(path)) return [report('/admin/audience', 'Audience report'), report('/admin/product/people', 'Account analysis')];
  if (['/admin/features', '/admin/look', '/admin/catalog', '/admin/lab'].includes(path)) return [report('/admin/product', 'Published product'), report('/admin/product/coverage', 'Control map')];
  if (['/admin/qa', '/admin/feedback', '/admin/moderation', '/admin/support'].includes(path)) return [report('/admin/health', 'Health report')];
  if (['/admin/games', '/admin/sports', '/admin/polls', '/admin/publish', '/admin/highlights', '/admin/spotlight'].includes(path)) return [report('/admin/analytics', 'Full analytics')];
  return [];
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
  '/admin/books': '/receipts',
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
  '/admin/support': '/',
  '/admin/trends': '/',
  '/admin/audience': '/profile',
  '/admin/revenue': '/receipts',
  '/admin/health': '/',
  '/admin/product': '/',
  '/admin/analytics': '/',
  '/admin/departments': '/',
  '/admin/product/features': '/',
  '/admin/product/profile': '/profile',
  '/admin/product/sign-in': '/',
  '/admin/product/people': '/profile',
};

/**
 * @purpose Resolve the most specific report or tool, including QA/Lab and Product child reports, for Back / Home / Open in app.
 */
export function adminTrailForPath(pathname: string): {
  isHome: boolean;
  group: AdminNavGroup | null;
  desk: AdminNavItem;
  fanHref: string | null;
} {
  const path = pathname.replace(/\/$/, '') || '/admin';
  const isHome = path === '/admin';
  // Parent reports match their children; the longest match retains the child's name and fan target.
  const desk = ADMIN_DESK_DIRECTORY.reduce<AdminNavItem | null>((best, item) =>
    isAdminNavActive(item.href, path) && (!best || item.href.length > best.href.length) ? item : best, null) ?? ADMIN_HOME;
  const group = [...ADMIN_NAV_GROUPS, ADMIN_REPORT_GROUP].find((item) => item.items.some((entry) => entry.href === desk.href))
    ?? (ADMIN_TOOL_UTILITIES.some((item) => item.href === desk.href) ? ADMIN_NAV_GROUPS.find((item) => item.id === 'system') : null)
    ?? null;
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
  /** Stored report label. Telemetry rows use "Bug report". */
  reasonLabel: string;
  /** Telemetry is `na` because a stall is not an athlete or guardian report. */
  athleteOrGuardian: 'yes' | 'no' | 'unchecked' | 'na';
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

type HighlightFlagDraft = {
  id: string;
  title: string;
  subtitle: string;
  reportCount: number;
  openedAt: string;
  playerId: string;
};

/**
 * `reel_reports` is in schema.sql and not in the generated `Database` type, so only this read
 * uses a narrow view of the same client.
 */
type ReelReportClient = {
  from: (relation: 'reel_reports') => {
    select: (columns: 'reel_id, reason, reporter_id') => {
      in: (column: 'reel_id', values: string[]) => PromiseLike<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    };
  };
};

const reelReports = supabase as unknown as ReelReportClient;

/** Same guardian link `report_reel` uses. Not in the generated Database type. */
type CustodialReportClient = {
  from: (relation: 'custodial_accounts') => {
    select: (columns: 'player_id, guardian_id') => {
      in: (column: 'player_id', values: string[]) => PromiseLike<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    };
  };
};

const custodialReports = supabase as unknown as CustodialReportClient;

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function highlightFlagRow(
  draft: HighlightFlagDraft,
  reasonLabel: string,
  athleteOrGuardian: AdminFlagRow['athleteOrGuardian'],
): AdminFlagRow {
  return {
    id: draft.id,
    kind: 'highlight',
    title: draft.title,
    subtitle: draft.subtitle,
    reportCount: draft.reportCount,
    openedAt: draft.openedAt,
    reasonLabel,
    athleteOrGuardian,
  };
}

function groupReportsByReel(data: unknown): Map<string, { reasons: string[]; reporterIds: string[] }> {
  const grouped = new Map<string, { reasons: string[]; reporterIds: string[] }>();
  if (!Array.isArray(data)) return grouped;
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const reelId = asText(record.reel_id);
    if (!reelId) continue;
    const bucket = grouped.get(reelId) ?? { reasons: [], reporterIds: [] };
    const reason = asText(record.reason);
    if (reason) bucket.reasons.push(reason);
    const reporterId = asText(record.reporter_id);
    if (reporterId) bucket.reporterIds.push(reporterId);
    grouped.set(reelId, bucket);
  }
  return grouped;
}

/**
 * @purpose Attach the stored reason and the athlete-or-guardian flag without dropping the queue.
 * @param drafts Flagged clips already loaded from `reels`.
 * @sideEffects `reel_reports` SELECT; `profiles`, `players`, and `custodial_accounts` SELECT when those ids exist.
 */
async function withReportQueue(drafts: HighlightFlagDraft[]): Promise<AdminFlagRow[]> {
  const reelIds = uniqueIds(drafts.map((draft) => draft.id));
  if (reelIds.length === 0) {
    return drafts.map((draft) => highlightFlagRow(draft, queueReasonLabel([]), 'unchecked'));
  }

  const reports = await reelReports
    .from('reel_reports')
    .select('reel_id, reason, reporter_id')
    .in('reel_id', reelIds);
  if (reports.error) {
    return drafts.map((draft) => highlightFlagRow(draft, queueReasonLabel(null), 'unchecked'));
  }

  const grouped = groupReportsByReel(reports.data);
  const reporterIds = uniqueIds([...grouped.values()].flatMap((bucket) => bucket.reporterIds));
  const playerIds = uniqueIds(drafts.map((draft) => draft.playerId));
  const [profileRead, playerRead, custodialRead] = await Promise.all([
    reporterIds.length > 0
      ? supabase.from('profiles').select('id, user_id, player_id').in('user_id', reporterIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string | null; player_id?: string | null }[], error: null }),
    playerIds.length > 0
      ? supabase.from('players').select('id, guardian_id').in('id', playerIds)
      : Promise.resolve({ data: [] as { id: string; guardian_id?: string | null }[], error: null }),
    playerIds.length > 0
      ? custodialReports.from('custodial_accounts').select('player_id, guardian_id').in('player_id', playerIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const identityReadable = !profileRead.error && !playerRead.error && !custodialRead.error;
  const profiles = Array.isArray(profileRead.data)
    ? profileRead.data.map((row) => ({
        id: asText(row.id),
        userId: asText(row.user_id),
        playerId: asText(row.player_id),
      }))
    : [];
  const guardians = [
    ...(Array.isArray(playerRead.data)
      ? playerRead.data.map((row) => ({
          playerId: asText(row.id),
          guardianId: asText(row.guardian_id),
        }))
      : []),
    ...(Array.isArray(custodialRead.data)
      ? custodialRead.data.map((row) => {
          const record = row as Record<string, unknown>;
          return { playerId: asText(record.player_id), guardianId: asText(record.guardian_id) };
        })
      : []),
  ];

  return drafts.map((draft) => {
    const bucket = grouped.get(draft.id) ?? { reasons: [], reporterIds: [] };
    const reporters = profiles.filter((profile) => bucket.reporterIds.includes(profile.userId));
    return highlightFlagRow(
      draft,
      queueReasonLabel(bucket.reasons),
      athleteOrGuardianReported({
        readable: identityReadable,
        reelPlayerId: draft.playerId || null,
        reporterPlayerIds: reporters.map((profile) => profile.playerId),
        reporterProfileIds: reporters.map((profile) => profile.id),
        guardianProfileIds: guardians
          .filter((link) => link.playerId === draft.playerId)
          .map((link) => link.guardianId),
      }),
    );
  });
}

/**
 * @purpose Open Highlight flags for the moderation table, optionally with recent telemetry incidents.
 * @param withTelemetry Include stalls / reconnects. Moderation leaves these to QA, which owns the 24h table.
 * @sideEffects `reels` SELECT (`is_flagged`, `player_id`); `reel_reports`, `profiles`, `players`, and `custodial_accounts` SELECT for the queue columns; `telemetry_logs` SELECT when `withTelemetry`.
 */
export async function fetchAdminFlags(withTelemetry = false): Promise<AdminFlagRow[]> {
  if (!isSupabaseConfigured) return [];
  const rows: AdminFlagRow[] = [];

  const flaggedLive = await supabase
    .from('reels')
    .select('id, title, created_at, reported_by, player_id, is_removed, players (name, school_name)')
    .eq('is_flagged', true)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(40);

  const flagged = flaggedLive.error
    ? await supabase
        .from('reels')
        .select('id, title, created_at, reported_by, player_id, players (name, school_name)')
        .eq('is_flagged', true)
        .order('created_at', { ascending: false })
        .limit(40)
    : flaggedLive;

  const drafts: HighlightFlagDraft[] = [];
  if (!flagged.error && Array.isArray(flagged.data)) {
    for (const row of flagged.data) {
      const record = row as Record<string, unknown>;
      if (record.is_removed === true) continue;
      const athlete = playerLabel(record.players);
      const reported = Array.isArray(record.reported_by) ? record.reported_by.length : 0;
      drafts.push({
        id: asText(record.id),
        title: asText(record.title, athlete.name),
        subtitle: [athlete.name, athlete.school].filter(Boolean).join(' · ') || 'User flag',
        reportCount: Math.max(1, reported),
        openedAt: asText(record.created_at),
        playerId: asText(record.player_id),
      });
    }
  }
  if (drafts.length > 0) rows.push(...(await withReportQueue(drafts)));

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
        reasonLabel: 'Bug report',
        athleteOrGuardian: 'na',
      });
    }
  }

  return rows;
}

/**
 * @purpose Dismiss a Highlight flag or take the clip off Highlights ⚡.
 * @param reelId `reels.id`.
 * @param action `dismiss` clears `is_flagged`; `remove` sets `is_removed`.
 * @sideEffects `moderate_flagged_reel` RPC (admin-only; SECURITY DEFINER).
 */
export async function moderateFlaggedReel(reelId: string, action: 'dismiss' | 'remove'): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('moderate_flagged_reel', {
    target_reel_id: reelId,
    moderation_action: action,
  });
  // 2026-09 audit (reels RLS tightening): `is_flagged` / `is_removed` are no longer in the
  // raw-UPDATE column grant on `reels` (see schema.sql) — this RPC is already admin-gated and is
  // the only path left, so a failed call is a real failure, not something to paper over with a
  // client UPDATE that would now just get rejected anyway.
  if (error) throw new Error(error.message);
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
  error?: string | null;
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
  if (eventType === 'checkout_latency') return 'Donation checkout';
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
  if (!isSupabaseConfigured) return { ...empty, error: 'Supabase is not configured.' };

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('telemetry_logs')
    .select('id, event_type, video_id, channel, step, duration_ms, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !Array.isArray(data)) return { ...empty, error: error?.message ?? 'The incident list returned no data.' };

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
    error: null,
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
