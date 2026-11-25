/**
 * @purpose Cross-app TypeScript contracts for Tapua'i (mobile Expo + admin portal).
 * Keep this package free of React Native / Next imports so both apps can share it.
 */

export type UserRole =
  | 'guest'
  | 'fan'
  | 'athlete'
  | 'parent'
  | 'operator'
  | 'booster'
  | 'sponsor'
  | 'admin';

/** Minimal school/team identity hydrated onto profiles (full catalog lives in mobile). */
export type SharedSchoolTeam = {
  id: string;
  school_name: string;
  mascot?: string | null;
  division?: string | null;
  region?: string | null;
};

export type Profile = {
  id: string;
  user_id: string | null;
  role: UserRole;
  full_name: string;
  username?: string | null;
  is_verified: boolean;
  verification_status?: 'unverified' | 'pending' | 'verified' | string | null;
  spirit_points: number;
  aura_points?: number;
  current_tier?: number | null;
  roles?: UserRole[] | string[] | null;
  is_admin?: boolean;
  active_role?: 'fan' | 'athlete' | string | null;
  stripe_connect_id?: string | null;
  stripe_onboarding_complete?: boolean;
  payouts_enabled?: boolean;
  school_id?: string | null;
  athlete_division?: string | null;
  athlete_sport?: string | null;
  athlete_jersey?: string | null;
  athlete_position?: string | null;
  athlete_class_year?: string | null;
  team?: SharedSchoolTeam | null;
  player_id?: string | null;
  /** COPPA gate: self-attested "13 years of age or older" checkbox. Null = not yet confirmed
   * (pre-existing accounts included) — never used to retroactively block an existing session. */
  age_confirmed_13_plus?: boolean | null;
  created_at?: string;
};

/** Seki / Aura / Flex counters used on reels and Local play cards. */
export type ActionStats = {
  seki_count: number;
  aura_count: number;
  flex_count: number;
  aura_points?: number;
};

export type SpotlightPeriodKind = 'week' | 'month' | 'year';

export type SpotlightAward = {
  id: string;
  player_id: string;
  reel_id?: string | null;
  period_kind: SpotlightPeriodKind;
  period_start: string;
  school_name: string;
  headline: string;
  title: string;
  is_active?: boolean;
  video_url?: string | null;
  shot_by?: string | null;
};

/** `cast_cheer_vote` return payload. */
export type CastCheerVoteRpc = {
  home_votes: number;
  away_votes: number;
};

/** Row from `get_fan_tip_history`. */
export type FanTipHistoryRpc = {
  id: string;
  player_id: string;
  reel_id: string | null;
  amount_cents: number;
  aura_points: number;
  created_at: string;
  athlete_name: string;
  school_name: string;
};

export type TapuaiRpcMap = {
  cast_cheer_vote: {
    Args: {
      poll_slug: string;
      side: string;
      previous_side?: string | null;
      home_name?: string;
      away_name?: string;
    };
    Returns: CastCheerVoteRpc;
  };
  get_fan_tip_history: {
    Args: Record<string, never>;
    Returns: FanTipHistoryRpc[];
  };
};

/** Soft-Wall auth gate kinds (browse-first guests; signed-in fans skip the wall). */
export type SoftWallKind = 'malo' | 'crew' | 'wishlist' | 'exclusive' | 'browse';

export type SoftWallGate = {
  id: SoftWallKind;
  label: string;
  hint: string;
  /** Fan surface where the gated action lives. */
  fanSurface: string;
  /** Expo admin desk that owns the related feature flag / money. */
  adminDesk: string;
  /** Optional `app_runtime_config` flag path that can pause the underlying control. */
  flagPath?: string;
  /** Telemetry feature id when the Soft Wall opens. */
  telemetry: string;
};

/**
 * @purpose Shared Soft-Wall oversight map for Expo Coverage + Next admin portal.
 * Guests receive only the bounded Highlights preview; full browsing and these actions require an account.
 */
export const SOFT_WALL_GATES: SoftWallGate[] = [
  { id: 'browse', label: 'Account-required browsing', hint: 'Three guest Highlights only; profiles, search, rosters and other sections require a registered account on web and phone.', fanSurface: 'All app routes except preview and auth completion', adminDesk: '/admin/features', telemetry: 'soft_wall.browse' },
  {
    id: 'malo',
    label: 'Give Soft Wall',
    hint: 'Give — Apple, Google, or Magic Link, then PaymentSheet resumes',
    fanSurface: 'Home · Profile · Spotlight · Reel pager',
    adminDesk: '/admin/money',
    flagPath: 'buttons.malo',
    telemetry: 'soft_wall.malo',
  },
  {
    id: 'crew',
    label: 'Join Crew Soft Wall',
    hint: 'Crew toggle on athlete profile (slim Crew · Squad strip) — resume join after sign-in',
    fanSurface: 'Athlete profile · slim Crew strip',
    adminDesk: '/admin/features',
    flagPath: 'buttons.crew',
    telemetry: 'soft_wall.crew',
  },
  {
    id: 'wishlist',
    label: 'Gear goal Soft Wall',
    hint: 'Locker Room gear goal — resume the gear-goal gift after sign-in',
    fanSurface: 'Profile · Stats · Locker Room',
    adminDesk: '/admin/wishlist',
    flagPath: 'layouts.wishlist',
    telemetry: 'soft_wall.wishlist',
  },
  {
    id: 'exclusive',
    label: 'Vault Soft Wall',
    hint: 'Vault unlock / Subscribe — Apple, Google, or Magic Link, then PaymentSheet resumes',
    fanSurface: 'Highlights Vault · Profile Subscribe · athlete sheet',
    adminDesk: '/admin/features',
    flagPath: 'buttons.subscribe',
    telemetry: 'soft_wall.exclusive',
  },
];

/** Auth providers shown on SoftWallModal (Supabase Dashboard must enable each). */
export const SOFT_WALL_AUTH_PROVIDERS = [
  { id: 'password', label: 'Sign in with email & password', redirect: 'email/password' },
  { id: 'demo', label: 'Continue as Demo Fan', redirect: 'demo@tapuai.app' },
  { id: 'apple', label: 'Continue with Apple', redirect: 'alasports://auth/callback' },
  { id: 'google', label: 'Continue with Google', redirect: 'alasports://auth/callback' },
  { id: 'magic_link', label: 'Send Magic Link Email', redirect: 'alasports://auth/callback' },
] as const;

export type SoftWallAuthProviderId = (typeof SOFT_WALL_AUTH_PROVIDERS)[number]['id'];

/** Snapshot used by Next admin portal + Expo Overview Soft-Wall strip. */
export type SoftWallOversight = {
  configured: boolean;
  fanProfiles: number;
  fansLast7d: number;
  operatorConsoleLive: boolean;
  operatorConsoleDraft: boolean | null;
  maloLive: boolean;
  crewLive: boolean;
  wishlistLive: boolean;
  publishedAt: string | null;
  softWallGates: SoftWallGate[];
  authProviders: typeof SOFT_WALL_AUTH_PROVIDERS;
};

/** Look · Profile chrome flags — hamburger / hero / collage hierarchy. */
export type ProfileChromeFlag = {
  id: string;
  path: string;
  label: string;
  hint: string;
  /** Fan surface that disappears when the flag is Off. */
  fanSurface: string;
  /** Expo desk that drafts the flag (Look Profile pane). */
  adminDesk: string;
};

/**
 * @purpose Shared Profile chrome map for Expo Look / Coverage + Next admin portal Profile desk.
 * showCard gates Flip Aura card in the hamburger; hero avatar always shows.
 */
export const PROFILE_CHROME_FLAGS: ProfileChromeFlag[] = [
  {
    id: 'showCard',
    path: 'profile.showCard',
    label: 'Flip Aura card',
    hint: 'Hamburger + Flip control open AuraTradingCard — not the default hero',
    fanSurface: 'Profile · ProfileMenuSheet · Flip Aura card',
    adminDesk: '/admin/look',
  },
  {
    id: 'showCrew',
    path: 'profile.showCrew',
    label: 'Crew · Squad strip',
    hint: 'Slim Crew · N | Squad · N row under the avatar hero',
    fanSurface: 'Profile · AthleteProfileView',
    adminDesk: '/admin/look',
  },
  {
    id: 'showStats',
    path: 'profile.showStats',
    label: 'Stats tab',
    hint: 'Stats 📊 pill under Highlights collage + roster',
    fanSurface: 'Profile · FilterPills',
    adminDesk: '/admin/look',
  },
  {
    id: 'showVault',
    path: 'profile.showVault',
    label: 'Vault tab',
    hint: 'Vault 🔒 pill (also needs Features buttons.vault)',
    fanSurface: 'Profile · FilterPills',
    adminDesk: '/admin/look',
  },
  {
    id: 'actionsOnTop',
    path: 'profile.actionsOnTop',
    label: 'Actions on top',
    hint: 'Off (shipping): Give / Purchase under Crew. On: park them under Highlights / Stats / Vault',
    fanSurface: 'Profile · actions row',
    adminDesk: '/admin/look',
  },
  {
    id: 'statsFirst',
    path: 'profile.statsFirst',
    label: 'Open on Stats',
    hint: 'Land on Stats instead of Highlights collage (default Off keeps collage first)',
    fanSurface: 'Profile · default tab',
    adminDesk: '/admin/look',
  },
];

/** Snapshot used by Next admin portal Profile oversight desk. */
export type ProfileOversight = {
  configured: boolean;
  claimedAthletes: number;
  athleteProfiles: number;
  publishedAt: string | null;
  showCard: boolean;
  showCrew: boolean;
  showStats: boolean;
  showVault: boolean;
  actionsOnTop: boolean;
  statsFirst: boolean;
  chromeFlags: ProfileChromeFlag[];
};

export type AppRuntimeFlagRow = {
  path: string;
  label: string;
  hint: string;
  /** Money controls must stay OFF when an older published row omits their authority. */
  defaultValue?: boolean;
};

export type AppRuntimeFlagGroup = {
  id: 'tabs' | 'buttons' | 'layouts' | 'profile';
  label: string;
  hint: string;
  flags: AppRuntimeFlagRow[];
};

/** Read-only status, never server authority: absent money controls use their catalog OFF default. */
export function readPublishedRuntimeFlag(published: Record<string, unknown>, flag: Pick<AppRuntimeFlagRow, 'path' | 'defaultValue'>): boolean {
  const fallback = flag.defaultValue ?? true;
  const [root, key] = flag.path.split('.');
  if (!root || !key) return fallback;
  const group = published[root];
  if (!group || typeof group !== 'object' || Array.isArray(group)) return fallback;
  const value = (group as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * @purpose One flag catalog for Expo Features / Look and the Next Features desk — same paths Expo `parseAppRuntimeConfig` reads.
 */
export const APP_RUNTIME_FLAG_GROUPS: AppRuntimeFlagGroup[] = [
  {
    id: 'tabs',
    label: 'Fan bar',
    hint: 'Hide a tab for a campaign. Draft until you hit Publish to app.',
    flags: [
      { path: 'tabs.home', label: 'Home', hint: 'Highlights ⚡ feed' },
      { path: 'tabs.beyond', label: 'Beyond the Game', hint: 'Workouts, service, learning and stories' },
      { path: 'tabs.local', label: 'Local', hint: 'Home pill: matches, polls, boosters' },
      { path: 'tabs.activity', label: 'Activity', hint: 'Gifts received / made, pending tags' },
      { path: 'tabs.spotlight', label: 'Spotlight', hint: 'Player of the Week board' },
      { path: 'tabs.drip', label: 'Drip', hint: 'Marketplace reached from Profile' },
      { path: 'tabs.profile', label: 'Profile', hint: 'Athlete sheet + hamburger hub' },
      { path: 'tabs.upload', label: 'Upload +', hint: 'Center plus on the fan bar' },
    ],
  },
  {
    id: 'buttons',
    label: 'Hype and support',
    hint: 'Kill a rail or checkout without shipping a new binary.',
    flags: [
      { path: 'buttons.seki', label: 'Seki', hint: '🤙 on Highlights ⚡' },
      { path: 'buttons.aura', label: 'Aura', hint: '⚡ on Highlights ⚡' },
      { path: 'buttons.flex', label: 'Flex', hint: '💪 on Highlights ⚡' },
      { path: 'buttons.malo', label: 'Give', hint: 'Give rail and Profile Give' },
      { path: 'buttons.MONETIZATION_TIPS_ENABLED', label: "Tip Tapua'i (optional) and fee coverage", hint: 'Default OFF. Optional tips and processing-fee coverage only; gift platform share stays zero after MONEY-TIPS-01. Draft until Publish.', defaultValue: false },
      { path: 'buttons.more', label: 'More sheet', hint: 'Share / Save / Report' },
      { path: 'buttons.subscribe', label: 'Purchase', hint: 'One-time Exclusive on the Vault (price on Catalogs)' },
      { path: 'buttons.crew', label: 'Join Crew', hint: 'The Crew ⚡' },
      { path: 'buttons.vault', label: 'Vault', hint: 'Lock / Open Vault' },
      { path: 'buttons.flashUnlock', label: 'Flash Unlock', hint: '2-hour Vault unlock' },
      { path: 'buttons.suggest', label: 'Suggestions', hint: 'Profile + Highlights ⋯ feedback' },
    ],
  },
  {
    id: 'layouts',
    label: 'Boards and portals',
    hint: 'Park a Local board or a role HQ without deleting data.',
    flags: [
      { path: 'layouts.liveMatches', label: 'Live Matches', hint: 'Local match list' },
      { path: 'layouts.cheerPolls', label: 'School Polls', hint: 'Cheer matchups' },
      { path: 'layouts.topBoosters', label: 'Top Boosters', hint: 'Local sponsorship rail' },
      { path: 'layouts.sponsorshipModal', label: 'Sponsorship checkout', hint: 'Booster PaymentSheet' },
      { path: 'layouts.spotlightModal', label: 'Player of the Week modal', hint: 'Home launch Spotlight' },
      { path: 'layouts.homeSearch', label: 'Home search', hint: 'Highlights ⚡ clip search' },
      { path: 'layouts.localSearch', label: 'Local Explore', hint: 'Players, schools, sponsors' },
      { path: 'layouts.slangGuide', label: 'Slang guide', hint: 'Gifts / Seki explainer on Home' },
      { path: 'layouts.receipts', label: 'Receipts', hint: 'Profile Gift History & Receipts' },
      { path: 'layouts.wishlist', label: 'Locker Room Wishlist', hint: 'Gear-goal gifts on Stats 📊' },
      { path: 'layouts.leaderboards', label: 'Leaderboards', hint: 'Spotlight Boards — hype and views, never gifts' },
      { path: 'layouts.coachLevel', label: 'Coach-level label', hint: 'Uploader switch and the Risky without a coach report. Labels already set stay visible.' },
      { path: 'layouts.telemetrySmoothness', label: 'Smoothness telemetry', hint: 'Cold-start + screen-mount timing into telemetry_logs. Turn on only after applying 20261020173000.' },
      {
        path: 'layouts.operatorConsole',
        label: 'Operator console',
        hint: 'Paused at launch — Features on + Publish to open /operator',
      },
      { path: 'layouts.parentHq', label: 'Parent HQ', hint: '/parent' },
      { path: 'layouts.boosterHq', label: 'Booster HQ', hint: '/booster' },
      { path: 'layouts.sponsorHq', label: 'Sponsor HQ', hint: '/sponsor' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile chrome',
    hint: 'Same switches as Expo Look · Profile. Draft until Publish to app.',
    flags: PROFILE_CHROME_FLAGS.map((flag) => ({
      path: flag.path,
      label: flag.label,
      hint: flag.hint,
    })),
  },
];
export * from './timedSportQuiz';
export * from './triviaPlayTogether';
export * from './lifePlaybook';
export * from './freshQuestions';

export { GUEST_PREVIEW_HIGHLIGHTS, guestRouteNeedsAccount, hasAccountSession, type GuestHighlightPreview } from './guestAccess';
