/**
 * Expo /admin navigation: main reports, Product sub-reports, editor groups per lens (Marketing / Owner /
 * Engineer / Finance / All), workspaces, the desk directory, Back / Home trails and fan-surface links
 * (split out of lib/admin.ts for R4-03; behaviour unchanged). Pure data and path helpers, no Supabase.
 * Editing groups exclude the legacy Reports dashboard so top-level reporting has one navigation owner.
 * The quiz desk is labelled Trivia (2026-10-15); its route and search terms keep the old Sport Pop Quiz name working.
 * `lib/admin.ts` re-exports everything here, so desks and test mocks keep importing `@/lib/admin`.
 */

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
  | '/admin/sport-quiz'
  | '/admin/fan-zone'
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
      // Trivia (2026-10-15): the desk keeps its saved /admin/sport-quiz address; search still finds the old name.
      { href: '/admin/sport-quiz', label: 'Trivia', hint: 'Questions, Life Playbook, groups and switches', searchTerms: 'trivia quiz questions Life Playbook Sport Pop Quiz drafts review chapters' },
      { href: '/admin/fan-zone', label: 'Fan Zone', hint: 'Testing campaigns, private entry review, free ballots and tracked removal' },
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
    '/admin/sport-quiz',
    '/admin/fan-zone',
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
    '/admin/sport-quiz',
    '/admin/fan-zone',
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
    '/admin/sport-quiz',
    '/admin/fan-zone',
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
  if (['/admin/fan-zone', '/admin/sport-quiz', '/admin/games', '/admin/sports', '/admin/polls', '/admin/publish', '/admin/highlights', '/admin/spotlight'].includes(path)) return [report('/admin/analytics', 'Full analytics')];
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
  '/admin/sport-quiz': '/sport-quiz',
  '/admin/fan-zone': '/fan-zone',
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
