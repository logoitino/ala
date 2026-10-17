/**
 * Live app configuration ("runtime config") read from `app_runtime_config` and merged over built-in defaults.
 * Defines the shape of every switch the owner can change without a release: tabs, buttons, layouts, theme,
 * profile, highlights, catalog, and on-screen copy. `AppRuntimeContext` loads and distributes it; Expo
 * /admin → Features / Look edits it; "Publish to app" writes it. The defaults here apply until a published
 * row overrides them, so a stale published row can hide a newer default (see STATE.md on copy overrides).
 * @sideEffects Reads (and, from admin screens, writes) `app_runtime_config`.
 */

import { EXCLUSIVE_AURA_GRANT, EXCLUSIVE_MONTHLY_DOLLARS } from '@/data/exclusive';
import { REEL_CATEGORY_PILLS } from '@/data/highlights';
import { FEE_AMOUNT, TIP_AMOUNTS } from '@/data/players';
import { LOCAL_FILTERS } from '@/data/regions';
import { SPONSOR_TIERS } from '@/data/sponsorships';
import { ATHLETE_CLASS_YEARS } from '@/data/teams';
import { DAYLIGHT_THEME } from '@/constants/theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';

export type AppRuntimeTabs = {
  home: boolean;
  beyond: boolean;
  local: boolean;
  activity: boolean;
  spotlight: boolean;
  drip: boolean;
  profile: boolean;
  upload: boolean;
};

export type AppRuntimeButtons = {
  seki: boolean;
  aura: boolean;
  flex: boolean;
  malo: boolean;
  more: boolean;
  subscribe: boolean;
  crew: boolean;
  vault: boolean;
  flashUnlock: boolean;
  suggest: boolean;
};

export type AppRuntimeLayouts = {
  liveMatches: boolean;
  cheerPolls: boolean;
  topBoosters: boolean;
  sponsorshipModal: boolean;
  spotlightModal: boolean;
  homeSearch: boolean;
  localSearch: boolean;
  operatorConsole: boolean;
  parentHq: boolean;
  boosterHq: boolean;
  sponsorHq: boolean;
  slangGuide: boolean;
  receipts: boolean;
  wishlist: boolean;
  leaderboards: boolean;
  /** Hides the uploader switch and the coach-level report. A label already set still shows. */
  coachLevel: boolean;
};

export type AppRuntimeTheme = {
  background: string;
  surface: string;
  jade: string;
  gold: string;
  text: string;
};

export type AppRuntimeProfile = {
  showCard: boolean;
  showCrew: boolean;
  showStats: boolean;
  showVault: boolean;
  actionsOnTop: boolean;
  statsFirst: boolean;
};

export type HighlightRailItem = 'seki' | 'aura' | 'flex' | 'malo' | 'more';

export type AppRuntimeHighlights = {
  /** Protected moderation switch; the Beyond desk changes it through its dependency-aware RPC. */
  beyondGameEnabled: boolean;
  railSide: 'left' | 'right';
  namePlacement: 'top' | 'bottom';
  showSchool: boolean;
  showCaption: boolean;
  railOrder: HighlightRailItem[];
};

export type AppRuntimeCatalogFilter = { id: string; label: string };

export type AppRuntimeCatalogTier = {
  id: string;
  name: string;
  dollars: number;
  auraPoints: number;
  badge: string;
  perks: string;
};

export type AppRuntimeCatalogCategory = { id: string; label: string };

/** Lists and prices the Catalogs desk edits. Missing keys fall back to the shipping constants. */
export type AppRuntimeCatalog = {
  maloAmounts: number[];
  maloFeeDollars: number;
  exclusiveDollars: number;
  exclusiveAura: number;
  classYears: string[];
  localFilters: AppRuntimeCatalogFilter[];
  sponsorTiers: AppRuntimeCatalogTier[];
  reelCategories: AppRuntimeCatalogCategory[];
};

export type AppRuntimeCopy = {
  homeKicker: string;
  homeLede: string;
  homeEmpty: string;
  homeBannerTitle: string;
  homeBannerBody: string;
  localKicker: string;
  localLede: string;
  activityKicker: string;
  activityLede: string;
  localEmpty: string;
  spotlightKicker: string;
  spotlightLede: string;
  spotlightEmpty: string;
  dripKicker: string;
  dripLede: string;
  dripEmpty: string;
  dripAllLabel: string;
  dripApparelLabel: string;
  dripAuraCardsLabel: string;
  dripMerchLabel: string;
  localMatchesLabel: string;
  localPollsLabel: string;
  localBoostersLabel: string;
  slangLine: string;
  profileKicker: string;
  profileLede: string;
  receiptsKicker: string;
  receiptsLede: string;
  operatorLede: string;
  parentLede: string;
  boosterLede: string;
  sponsorLede: string;
};

export type AppRuntimeConfig = {
  tabs: AppRuntimeTabs;
  buttons: AppRuntimeButtons;
  layouts: AppRuntimeLayouts;
  theme: AppRuntimeTheme;
  profile: AppRuntimeProfile;
  highlights: AppRuntimeHighlights;
  copy: AppRuntimeCopy;
  catalog: AppRuntimeCatalog;
};

export type AppRuntimeCopyPath = `copy.${keyof AppRuntimeCopy}`;

export type AppRuntimeFlagPath =
  | `tabs.${keyof AppRuntimeTabs}`
  | `buttons.${keyof AppRuntimeButtons}`
  | `layouts.${keyof AppRuntimeLayouts}`
  | `profile.${keyof AppRuntimeProfile}`;

export type AppRuntimeBundle = {
  draft: AppRuntimeConfig;
  published: AppRuntimeConfig;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type AppFlagGroup = {
  id: 'tabs' | 'buttons' | 'layouts';
  label: string;
  hint: string;
  flags: { path: AppRuntimeFlagPath; label: string; hint: string }[];
};

/** Heavy chrome that stays draft until Publish to app. */
export const APP_FLAG_GROUPS: AppFlagGroup[] = APP_RUNTIME_FLAG_GROUPS.filter(
  (group): group is (typeof APP_RUNTIME_FLAG_GROUPS)[number] & { id: 'tabs' | 'buttons' | 'layouts' } =>
    group.id === 'tabs' || group.id === 'buttons' || group.id === 'layouts',
).map((group) => ({
  id: group.id,
  label: group.label,
  hint: group.hint,
  flags: group.flags.map((flag) => ({
    path: flag.path as AppRuntimeFlagPath,
    label: flag.label,
    hint: flag.hint,
  })),
}));

export const DEFAULT_APP_RUNTIME: AppRuntimeConfig = {
  tabs: { home: true, beyond: true, local: true, activity: true, spotlight: true, drip: false, profile: true, upload: true },
  buttons: {
    seki: true,
    aura: true,
    flex: true,
    malo: true,
    more: true,
    subscribe: true,
    crew: true,
    vault: true,
    flashUnlock: true,
    suggest: true,
  },
  layouts: {
    liveMatches: true,
    cheerPolls: true,
    topBoosters: true,
    sponsorshipModal: true,
    spotlightModal: true,
    homeSearch: true,
    localSearch: true,
    operatorConsole: false,
    parentHq: true,
    boosterHq: true,
    sponsorHq: true,
    slangGuide: true,
    receipts: true,
    wishlist: true,
    leaderboards: true,
    coachLevel: true,
  },
  theme: { ...DAYLIGHT_THEME },
  catalog: {
    maloAmounts: [...TIP_AMOUNTS],
    maloFeeDollars: FEE_AMOUNT,
    exclusiveDollars: EXCLUSIVE_MONTHLY_DOLLARS,
    exclusiveAura: EXCLUSIVE_AURA_GRANT,
    classYears: [...ATHLETE_CLASS_YEARS],
    localFilters: LOCAL_FILTERS.map((row) => ({ id: row.id, label: row.label })),
    sponsorTiers: SPONSOR_TIERS.map((row) => ({
      id: row.id,
      name: row.name,
      dollars: row.dollars,
      auraPoints: row.auraPoints,
      badge: row.badge,
      perks: row.perks,
    })),
    reelCategories: REEL_CATEGORY_PILLS.map((row) => ({ id: row.id, label: row.label })),
  },
  profile: {
    showCard: true,
    showCrew: true,
    showStats: true,
    showVault: true,
    actionsOnTop: false,
    statsFirst: false,
  },
  highlights: {
    beyondGameEnabled: false,
    railSide: 'right',
    namePlacement: 'bottom',
    showSchool: true,
    showCaption: true,
    railOrder: ['seki', 'aura', 'flex', 'malo', 'more'],
  },
  copy: {
    homeKicker: 'Highlights ⚡',
    homeLede: 'Highlights tagged to the athlete on the clip.',
    homeEmpty: 'No Highlights ⚡ yet.',
    homeBannerTitle: '',
    homeBannerBody: '',
    localKicker: 'Friday night',
    localLede: 'Live matches, school polls, and Top Boosters.',
    activityKicker: 'Your account',
    activityLede: 'Donations received, donations made, and highlights that tagged you.',
    localEmpty: 'No live games here',
    spotlightKicker: 'Player of the Week',
    spotlightLede: 'Featured athletes from confirmed Game Day hype — week, month, and year.',
    spotlightEmpty: 'No Spotlight awards yet. Check back after Friday night.',
    dripKicker: 'Marketplace',
    dripLede: 'Booster gear, Aura cards, and sideline merch.',
    dripEmpty: 'Nothing in this rack yet.',
    dripAllLabel: 'All Drip',
    dripApparelLabel: 'Team Apparel',
    dripAuraCardsLabel: 'Custom Aura Cards',
    dripMerchLabel: 'Athlete Merch',
    localMatchesLabel: 'Live Matches',
    localPollsLabel: 'School Polls',
    localBoostersLabel: 'Top Boosters',
    slangLine: 'Donations go to the athlete’s family • Seki = Awesome Play',
    profileKicker: 'Your hub',
    profileLede: 'Trading card, Highlights ⚡, Stats, and Vault.',
    receiptsKicker: 'Your donations',
    receiptsLede: 'Donations you made, with their receipts.',
    operatorLede: 'Claim a game, keep the clock, and call the big play.',
    parentLede: 'Consent, custodial payouts, and confirm that a fan tagged the right jersey.',
    boosterLede: 'Upload a roster and keep jerseys honest for Friday night.',
    sponsorLede: 'Sideline boards and rivalry banners for live Tapua\'i games.',
  },
};

export const THEME_PRESETS: { id: string; label: string; hint: string; theme: AppRuntimeTheme }[] = [
  {
    id: 'daylight',
    label: 'Daylight (default)',
    hint: 'Shipping look — Calm Island: warm light canvas, deep jade. Reset here to leave night mode.',
    theme: { ...DAYLIGHT_THEME },
  },
  {
    id: 'tapuai',
    label: 'Night',
    hint: 'Optional dark canvas — Obsidian / Neon Jade / Electric Gold',
    theme: {
      background: '#0F1416',
      surface: '#1E262B',
      jade: '#00E676',
      gold: '#FFD700',
      text: '#F3FBF7',
    },
  },
  {
    id: 'friday',
    label: 'Friday night',
    hint: 'Warm gold under the lights',
    theme: {
      background: '#120F0A',
      surface: '#241C12',
      jade: '#F5C518',
      gold: '#FFD700',
      text: '#FFF8E7',
    },
  },
  {
    id: 'ice',
    label: 'Ice',
    hint: 'Cyan away kit',
    theme: {
      background: '#0B1218',
      surface: '#15202A',
      jade: '#00E5FF',
      gold: '#E8F4FF',
      text: '#F3FBFF',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    hint: 'Crimson sideline',
    theme: {
      background: '#140A0A',
      surface: '#261414',
      jade: '#FF6B35',
      gold: '#FFD166',
      text: '#FFF4F0',
    },
  },
];

export const HIGHLIGHT_RAIL_ITEMS: { id: HighlightRailItem; label: string }[] = [
  { id: 'seki', label: 'Seki' },
  { id: 'aura', label: 'Aura' },
  { id: 'flex', label: 'Flex' },
  { id: 'malo', label: 'Donate' },
  { id: 'more', label: 'More' },
];

export const COPY_FIELDS: { key: keyof AppRuntimeCopy; label: string; hint: string; multiline?: boolean }[] = [
  { key: 'homeKicker', label: 'Home kicker', hint: 'Small line above the Highlights ⚡ search row' },
  { key: 'homeLede', label: 'Home lede', hint: 'Optional campaign line under the kicker' },
  { key: 'homeEmpty', label: 'Home empty', hint: 'When the All feed has no clips' },
  { key: 'homeBannerTitle', label: 'Home banner title', hint: 'Leave blank to hide the campaign bar' },
  { key: 'homeBannerBody', label: 'Home banner body', hint: 'Shows under the title when the banner is on', multiline: true },
  { key: 'localKicker', label: 'Local kicker', hint: 'Above Local' },
  { key: 'localLede', label: 'Local lede', hint: 'Optional line under Local' },
  { key: 'activityKicker', label: 'Activity kicker', hint: 'Above Activity' },
  { key: 'activityLede', label: 'Activity lede', hint: 'Optional line under Activity' },
  { key: 'localEmpty', label: 'Local empty title', hint: 'No live games in the region' },
  { key: 'spotlightKicker', label: 'Spotlight kicker', hint: 'Above Spotlight' },
  { key: 'spotlightLede', label: 'Spotlight lede', hint: 'Board explanation' },
  { key: 'spotlightEmpty', label: 'Spotlight empty', hint: 'No awards yet' },
  { key: 'dripAllLabel', label: 'Drip chip · All', hint: 'First category chip on Drip' },
  { key: 'dripApparelLabel', label: 'Drip chip · Apparel', hint: 'Team apparel category chip' },
  { key: 'dripAuraCardsLabel', label: 'Drip chip · Aura cards', hint: 'Aura card category chip' },
  { key: 'dripMerchLabel', label: 'Drip chip · Merch', hint: 'Athlete merch category chip' },
  { key: 'localMatchesLabel', label: 'Local chip · Matches', hint: 'Live Matches board chip' },
  { key: 'localPollsLabel', label: 'Local chip · Polls', hint: 'School Polls board chip' },
  { key: 'localBoostersLabel', label: 'Local chip · Boosters', hint: 'Top Boosters board chip' },
  { key: 'dripKicker', label: 'Drip kicker', hint: 'Above Drip' },
  { key: 'dripLede', label: 'Drip lede', hint: 'Optional marketplace line' },
  { key: 'dripEmpty', label: 'Drip empty', hint: 'Empty rack' },
  { key: 'slangLine', label: 'Slang guide', hint: 'Home donations / Seki explainer' },
  { key: 'profileKicker', label: 'Profile kicker', hint: 'Above Profile' },
  { key: 'profileLede', label: 'Profile lede', hint: 'Optional line under Profile' },
  { key: 'receiptsKicker', label: 'Receipts kicker', hint: 'Above Donation History' },
  { key: 'receiptsLede', label: 'Receipts lede', hint: 'Ledger explanation' },
  { key: 'operatorLede', label: 'Operator lede', hint: '/operator' },
  { key: 'parentLede', label: 'Parent lede', hint: '/parent' },
  { key: 'boosterLede', label: 'Booster lede', hint: '/booster' },
  { key: 'sponsorLede', label: 'Sponsor lede', hint: '/sponsor' },
];

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseGroup<T extends Record<string, boolean>>(raw: unknown, fallback: T): T {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const next = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof T)[]) {
    next[key] = asBool(record[String(key)], fallback[key]) as T[keyof T];
  }
  return next;
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(next) ? next.toUpperCase() : fallback;
}

function parseTheme(raw: unknown): AppRuntimeTheme {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fallback = DEFAULT_APP_RUNTIME.theme;
  return {
    background: asHex(record.background, fallback.background),
    surface: asHex(record.surface, fallback.surface),
    jade: asHex(record.jade, fallback.jade),
    gold: asHex(record.gold, fallback.gold),
    text: asHex(record.text, fallback.text),
  };
}

function parseProfile(raw: unknown): AppRuntimeProfile {
  return parseGroup(raw, DEFAULT_APP_RUNTIME.profile);
}

function parseRailOrder(raw: unknown): HighlightRailItem[] {
  const allowed: HighlightRailItem[] = ['seki', 'aura', 'flex', 'malo', 'more'];
  const seen = new Set<HighlightRailItem>();
  const next: HighlightRailItem[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const id = item as HighlightRailItem;
      if (!allowed.includes(id) || seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
  }
  for (const id of allowed) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}

function parseHighlights(raw: unknown): AppRuntimeHighlights {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fallback = DEFAULT_APP_RUNTIME.highlights;
  return {
    beyondGameEnabled: record.beyondGameEnabled === true,
    railSide: record.railSide === 'left' ? 'left' : 'right',
    namePlacement: record.namePlacement === 'top' ? 'top' : 'bottom',
    showSchool: asBool(record.showSchool, fallback.showSchool),
    showCaption: asBool(record.showCaption, fallback.showCaption),
    railOrder: parseRailOrder(record.railOrder),
  };
}

function parseCopy(raw: unknown): AppRuntimeCopy {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fallback = DEFAULT_APP_RUNTIME.copy;
  const next = { ...fallback };
  (Object.keys(fallback) as (keyof AppRuntimeCopy)[]).forEach((key) => {
    const value = record[key];
    next[key] = typeof value === 'string' ? value : fallback[key];
  });
  return next;
}

function asAmountList(raw: unknown, fallback: number[]): number[] {
  const rows = Array.isArray(raw)
    ? raw.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
  const unique = [...new Set(rows.map((item) => Math.round(item * 100) / 100))];
  return unique.length > 0 ? unique.slice(0, 6) : [...fallback];
}

function asFilterList(raw: unknown, fallback: AppRuntimeCatalogFilter[]): AppRuntimeCatalogFilter[] {
  if (!Array.isArray(raw)) return fallback.map((row) => ({ ...row }));
  const next = raw
    .map((item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((row): row is AppRuntimeCatalogFilter => Boolean(row));
  return next.length > 0 ? next.slice(0, 12) : fallback.map((row) => ({ ...row }));
}

function asTierList(raw: unknown, fallback: AppRuntimeCatalogTier[]): AppRuntimeCatalogTier[] {
  if (!Array.isArray(raw)) return fallback.map((row) => ({ ...row }));
  const next = raw
    .map((item, index) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const seed = fallback[index] ?? fallback[0];
      const dollars = Number(row.dollars);
      const auraPoints = Number(row.auraPoints);
      return {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : seed.id,
        name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : seed.name,
        dollars: Number.isFinite(dollars) && dollars > 0 ? dollars : seed.dollars,
        auraPoints: Number.isFinite(auraPoints) && auraPoints >= 0 ? Math.round(auraPoints) : seed.auraPoints,
        badge: typeof row.badge === 'string' && row.badge.trim() ? row.badge.trim() : seed.badge,
        perks: typeof row.perks === 'string' && row.perks.trim() ? row.perks.trim() : seed.perks,
      };
    })
    .slice(0, 6);
  return next.length > 0 ? next : fallback.map((row) => ({ ...row }));
}

function asCategoryList(raw: unknown, fallback: AppRuntimeCatalogCategory[]): AppRuntimeCatalogCategory[] {
  if (!Array.isArray(raw)) return fallback.map((row) => ({ ...row }));
  const next = raw
    .map((item, index) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const seed = fallback[index] ?? fallback[0];
      return {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : seed.id,
        label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : seed.label,
      };
    })
    .slice(0, 8);
  return next.length > 0 ? next : fallback.map((row) => ({ ...row }));
}

function parseCatalog(raw: unknown): AppRuntimeCatalog {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fallback = DEFAULT_APP_RUNTIME.catalog;
  const fee = Number(record.maloFeeDollars);
  const exclusive = Number(record.exclusiveDollars);
  const aura = Number(record.exclusiveAura);
  const years = Array.isArray(record.classYears)
    ? record.classYears.map((item) => String(item).replace(/^'+/, '').trim()).filter(Boolean)
    : [];
  return {
    maloAmounts: asAmountList(record.maloAmounts, fallback.maloAmounts),
    maloFeeDollars: Number.isFinite(fee) && fee >= 0 ? fee : fallback.maloFeeDollars,
    exclusiveDollars: Number.isFinite(exclusive) && exclusive > 0 ? exclusive : fallback.exclusiveDollars,
    exclusiveAura: Number.isFinite(aura) && aura >= 0 ? Math.round(aura) : fallback.exclusiveAura,
    classYears: years.length > 0 ? years.slice(0, 8) : [...fallback.classYears],
    localFilters: asFilterList(record.localFilters, fallback.localFilters),
    sponsorTiers: asTierList(record.sponsorTiers, fallback.sponsorTiers),
    reelCategories: asCategoryList(record.reelCategories, fallback.reelCategories),
  };
}

/**
 * @purpose Merge a stored jsonb blob onto the default chrome map so missing keys stay on.
 */
export function parseAppRuntimeConfig(raw: unknown): AppRuntimeConfig {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    tabs: parseGroup(record.tabs, DEFAULT_APP_RUNTIME.tabs),
    buttons: parseGroup(record.buttons, DEFAULT_APP_RUNTIME.buttons),
    layouts: parseGroup(record.layouts, DEFAULT_APP_RUNTIME.layouts),
    theme: parseTheme(record.theme),
    profile: parseProfile(record.profile),
    highlights: parseHighlights(record.highlights),
    copy: parseCopy(record.copy),
    catalog: parseCatalog(record.catalog),
  };
}

export function cloneAppRuntime(config: AppRuntimeConfig): AppRuntimeConfig {
  return {
    tabs: { ...config.tabs },
    buttons: { ...config.buttons },
    layouts: { ...config.layouts },
    theme: { ...config.theme },
    profile: { ...config.profile },
    highlights: { ...config.highlights, railOrder: [...config.highlights.railOrder] },
    copy: { ...config.copy },
    catalog: {
      ...config.catalog,
      maloAmounts: [...config.catalog.maloAmounts],
      classYears: [...config.catalog.classYears],
      localFilters: config.catalog.localFilters.map((row) => ({ ...row })),
      sponsorTiers: config.catalog.sponsorTiers.map((row) => ({ ...row })),
      reelCategories: config.catalog.reelCategories.map((row) => ({ ...row })),
    },
  };
}

export function runtimeConfigsEqual(left: AppRuntimeConfig, right: AppRuntimeConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getRuntimeFlag(config: AppRuntimeConfig, path: AppRuntimeFlagPath): boolean {
  const [group, key] = path.split('.') as [keyof AppRuntimeConfig, string];
  const bag = config[group] as Record<string, boolean>;
  return bag[key] !== false;
}

export function setRuntimeFlag(config: AppRuntimeConfig, path: AppRuntimeFlagPath, value: boolean): AppRuntimeConfig {
  const next = cloneAppRuntime(config);
  const [group, key] = path.split('.') as [keyof AppRuntimeConfig, string];
  (next[group] as Record<string, boolean>)[key] = value;
  return next;
}

export function diffRuntimeFlags(draft: AppRuntimeConfig, published: AppRuntimeConfig): { path: AppRuntimeFlagPath; label: string; from: boolean; to: boolean }[] {
  const rows: { path: AppRuntimeFlagPath; label: string; from: boolean; to: boolean }[] = [];
  for (const group of APP_FLAG_GROUPS) {
    for (const flag of group.flags) {
      const from = getRuntimeFlag(published, flag.path);
      const to = getRuntimeFlag(draft, flag.path);
      if (from !== to) rows.push({ path: flag.path, label: flag.label, from, to });
    }
  }
  return rows;
}

/**
 * @purpose Count unpublished flag + look diffs for the Publish to app badge.
 */
export function countRuntimeChanges(draft: AppRuntimeConfig, published: AppRuntimeConfig): number {
  let n = diffRuntimeFlags(draft, published).length;
  (Object.keys(draft.theme) as (keyof AppRuntimeTheme)[]).forEach((key) => {
    if (draft.theme[key] !== published.theme[key]) n += 1;
  });
  (Object.keys(draft.profile) as (keyof AppRuntimeProfile)[]).forEach((key) => {
    if (draft.profile[key] !== published.profile[key]) n += 1;
  });
  if (draft.highlights.railSide !== published.highlights.railSide) n += 1;
  if (draft.highlights.namePlacement !== published.highlights.namePlacement) n += 1;
  if (draft.highlights.showSchool !== published.highlights.showSchool) n += 1;
  if (draft.highlights.showCaption !== published.highlights.showCaption) n += 1;
  if (JSON.stringify(draft.highlights.railOrder) !== JSON.stringify(published.highlights.railOrder)) n += 1;
  (Object.keys(draft.copy) as (keyof AppRuntimeCopy)[]).forEach((key) => {
    if (draft.copy[key] !== published.copy[key]) n += 1;
  });
  if (JSON.stringify(draft.catalog) !== JSON.stringify(published.catalog)) n += 1;
  return n;
}

export type RuntimePatchPath = AppRuntimeFlagPath | AppRuntimeCopyPath | `theme.${keyof AppRuntimeTheme}`;

/**
 * @purpose Apply one typed chrome path from Engineer Lab or a triaged suggestion.
 * @returns Next draft, or the original config when the path is unknown.
 */
export function applyRuntimePath(config: AppRuntimeConfig, path: string, value: unknown): AppRuntimeConfig {
  const next = cloneAppRuntime(config);
  const [group, key] = path.split('.') as [string, string];
  if (!group || !key) return next;
  if (group === 'tabs' || group === 'buttons' || group === 'layouts') {
    const bag = next[group] as Record<string, boolean>;
    if (!(key in bag)) return next;
    bag[key] = value === true || value === 'true' || value === 'on';
    return next;
  }
  if (group === 'theme') {
    const bag = next.theme as Record<string, string>;
    if (!(key in bag) || typeof value !== 'string') return next;
    bag[key] = asHex(value, bag[key]);
    return next;
  }
  if (group === 'copy') {
    const bag = next.copy as Record<string, string>;
    if (!(key in bag)) return next;
    bag[key] = typeof value === 'string' ? value : String(value ?? '');
    return next;
  }
  return next;
}

const RUNTIME_ROOT_KEYS = ['tabs', 'buttons', 'layouts', 'theme', 'profile', 'highlights', 'copy', 'catalog'] as const;

function assertKnownObjectKeys(record: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new Error(`Unknown key ${label}.${key}`);
  }
}

/**
 * @purpose Parse Engineer Lab JSON onto the chrome map. Unknown keys and invalid hex are rejected.
 */
export function parseLabRuntimeJson(raw: string): AppRuntimeConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON is invalid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Root must be an object.');
  }
  const record = parsed as Record<string, unknown>;
  assertKnownObjectKeys(record, [...RUNTIME_ROOT_KEYS], 'runtime');
  const defaults = DEFAULT_APP_RUNTIME;
  for (const group of ['tabs', 'buttons', 'layouts', 'profile'] as const) {
    if (record[group] == null) continue;
    if (typeof record[group] !== 'object' || Array.isArray(record[group])) {
      throw new Error(`${group} must be an object.`);
    }
    assertKnownObjectKeys(record[group] as Record<string, unknown>, Object.keys(defaults[group]), group);
  }
  if (record.theme != null) {
    if (typeof record.theme !== 'object' || Array.isArray(record.theme)) {
      throw new Error('theme must be an object.');
    }
    const theme = record.theme as Record<string, unknown>;
    assertKnownObjectKeys(theme, Object.keys(defaults.theme), 'theme');
    for (const [key, value] of Object.entries(theme)) {
      if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
        throw new Error(`Invalid hex for theme.${key}`);
      }
    }
  }
  if (record.copy != null) {
    if (typeof record.copy !== 'object' || Array.isArray(record.copy)) {
      throw new Error('copy must be an object.');
    }
    assertKnownObjectKeys(record.copy as Record<string, unknown>, Object.keys(defaults.copy), 'copy');
  }
  if (record.highlights != null) {
    if (typeof record.highlights !== 'object' || Array.isArray(record.highlights)) {
      throw new Error('highlights must be an object.');
    }
    assertKnownObjectKeys(record.highlights as Record<string, unknown>, Object.keys(defaults.highlights), 'highlights');
  }
  if (record.catalog != null) {
    if (typeof record.catalog !== 'object' || Array.isArray(record.catalog)) {
      throw new Error('catalog must be an object.');
    }
    assertKnownObjectKeys(record.catalog as Record<string, unknown>, Object.keys(defaults.catalog), 'catalog');
  }
  return parseAppRuntimeConfig(record);
}

function inferRuntimePathValue(path: string, body: string): unknown {
  if (path.startsWith('copy.') || path.startsWith('theme.')) return body;
  const token = body.trim().toLowerCase();
  if (token === 'off' || token === 'false' || token === '0') return false;
  return true;
}

/**
 * @purpose Patch a triaged suggestion onto the draft. Unknown paths become a Home campaign banner for marketing.
 */
export function applyFeedbackToDraft(
  config: AppRuntimeConfig,
  input: { body: string; runtime_path?: string },
): AppRuntimeConfig {
  const path = (input.runtime_path ?? '').trim();
  if (path) {
    const next = applyRuntimePath(config, path, inferRuntimePathValue(path, input.body));
    if (!runtimeConfigsEqual(next, config)) return next;
  }
  return {
    ...cloneAppRuntime(config),
    copy: {
      ...config.copy,
      homeBannerTitle: config.copy.homeBannerTitle.trim() || 'Fan suggestion',
      homeBannerBody: input.body,
    },
  };
}

export function moveHighlightRailItem(order: HighlightRailItem[], id: HighlightRailItem, dir: -1 | 1): HighlightRailItem[] {
  const index = order.indexOf(id);
  const nextIndex = index + dir;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

const TAB_HREF: Record<keyof AppRuntimeTabs, string> = {
  home: '/',
  beyond: '/beyond',
  local: '/local',
  activity: '/activity',
  spotlight: '/spotlight',
  drip: '/drip',
  profile: '/profile',
  upload: '/',
};

/**
 * @purpose First live fan-bar destination when a published tab is turned off.
 */
export function firstEnabledFanHref(config: AppRuntimeConfig): string {
  // Beyond and Local open from the Highlights pill row now; the Beyond page stays a valid fallback. Drip is a Profile link.
  const order: (keyof AppRuntimeTabs)[] = ['home', 'beyond', 'activity', 'spotlight', 'profile'];
  const hit = order.find((key) => config.tabs[key]);
  return hit ? TAB_HREF[hit] : '/profile';
}

function parseBundle(raw: Record<string, unknown> | null): AppRuntimeBundle {
  return {
    draft: parseAppRuntimeConfig(raw?.draft),
    published: parseAppRuntimeConfig(raw?.published),
    publishedAt: typeof raw?.published_at === 'string' ? raw.published_at : null,
    updatedAt: typeof raw?.updated_at === 'string' ? raw.updated_at : null,
  };
}

/**
 * @purpose Load draft + published chrome for the admin Features desk.
 * @sideEffects `app_runtime_config` SELECT.
 */
export async function fetchAppRuntimeBundle(): Promise<AppRuntimeBundle> {
  const empty: AppRuntimeBundle = {
    draft: cloneAppRuntime(DEFAULT_APP_RUNTIME),
    published: cloneAppRuntime(DEFAULT_APP_RUNTIME),
    publishedAt: null,
    updatedAt: null,
  };
  if (!isSupabaseConfigured) return empty;
  const { data, error } = await supabase.from('app_runtime_config').select('draft, published, published_at, updated_at').eq('id', 'default').maybeSingle();
  if (error || !data) return empty;
  return parseBundle(data as Record<string, unknown>);
}

/**
 * @purpose Write the Features draft. Fans still see `published` until Publish to app.
 * @sideEffects `patch_app_runtime_draft` RPC; table UPDATE fallback.
 */
export async function saveAppRuntimeDraft(draft: AppRuntimeConfig): Promise<AppRuntimeBundle> {
  if (!isSupabaseConfigured) {
    return { draft, published: draft, publishedAt: null, updatedAt: new Date().toISOString() };
  }
  const { data, error } = await supabase.rpc('patch_app_runtime_draft', { next_draft: draft });
  if (!error && data && typeof data === 'object') return parseBundle(data as Record<string, unknown>);
  const { data: updated, error: updateError } = await supabase
    .from('app_runtime_config')
    .update({ draft, updated_at: new Date().toISOString() })
    .eq('id', 'default')
    .select('draft, published, published_at, updated_at')
    .single();
  if (updateError) throw new Error(error?.message || updateError.message);
  return parseBundle(updated as Record<string, unknown>);
}

/**
 * @purpose Copy draft onto published so the fan app chrome updates.
 * @sideEffects `publish_app_runtime` RPC; table UPDATE fallback.
 */
export async function publishAppRuntime(): Promise<AppRuntimeBundle> {
  if (!isSupabaseConfigured) {
    const draft = cloneAppRuntime(DEFAULT_APP_RUNTIME);
    return { draft, published: draft, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  const { data, error } = await supabase.rpc('publish_app_runtime');
  if (!error && data && typeof data === 'object') return parseBundle(data as Record<string, unknown>);
  const current = await fetchAppRuntimeBundle();
  const { data: updated, error: updateError } = await supabase
    .from('app_runtime_config')
    .update({
      published: current.draft,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
    .select('draft, published, published_at, updated_at')
    .single();
  if (updateError) throw new Error(error?.message || updateError.message);
  return parseBundle(updated as Record<string, unknown>);
}

/**
 * @purpose Throw away unpublished chrome and restore the live map.
 */
export async function discardAppRuntimeDraft(): Promise<AppRuntimeBundle> {
  const current = await fetchAppRuntimeBundle();
  return saveAppRuntimeDraft(current.published);
}
