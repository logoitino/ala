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

/** `get_aura_tier(points)` JSON payload. */
export type GetAuraTierRpc = {
  tier: number;
  title: string;
  min_points: number;
  color: string;
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
  get_aura_tier: {
    Args: { points: number };
    Returns: GetAuraTierRpc;
  };
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
export type SoftWallKind = 'malo' | 'crew' | 'wishlist';

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
 * Guests browse Highlights / cards / wishlist view; these three actions require auth then resume.
 */
export const SOFT_WALL_GATES: SoftWallGate[] = [
  {
    id: 'malo',
    label: 'Mālo Soft Wall',
    hint: 'Tip / Drop Mālo — Apple, Google, or Magic Link, then PaymentSheet resumes',
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
    label: 'Chip In Soft Wall',
    hint: 'Locker Room Chip In — resume Mālo chip toward gear after sign-in',
    fanSurface: 'Profile · Stats · Locker Room',
    adminDesk: '/admin/wishlist',
    flagPath: 'layouts.wishlist',
    telemetry: 'soft_wall.wishlist',
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

/** Keys stored on `app_runtime_config.{draft,published}.profile`. */
export type ProfileChromeFlagId =
  | 'showCard'
  | 'showCrew'
  | 'showStats'
  | 'showVault'
  | 'actionsOnTop'
  | 'statsFirst';

/** Look · Profile chrome flags — hamburger / hero / collage hierarchy. */
export type ProfileChromeFlag = {
  id: ProfileChromeFlagId;
  path: `profile.${ProfileChromeFlagId}`;
  label: string;
  hint: string;
  /** Fan surface that disappears when the flag is Off. */
  fanSurface: string;
  /** Expo desk that drafts the flag (Look Profile pane). */
  adminDesk: string;
  /** Missing jsonb keys fall back to this (matches `DEFAULT_APP_RUNTIME.profile`). */
  defaultOn: boolean;
};

/**
 * @purpose Shared Profile chrome map for Expo Look / Coverage + Next admin portal Profile desk.
 * showCard gates Flip Aura card in the hamburger; hero avatar always shows.
 * Persistence is `app_runtime_config`, not a separate `app_feature_flags` table.
 */
export const PROFILE_CHROME_FLAGS: ProfileChromeFlag[] = [
  {
    id: 'showCard',
    path: 'profile.showCard',
    label: 'Flip Aura card',
    hint: 'Hamburger + Flip control open AuraTradingCard — not the default hero',
    fanSurface: 'Profile · ProfileMenuSheet · Flip Aura card',
    adminDesk: '/admin/look',
    defaultOn: true,
  },
  {
    id: 'showCrew',
    path: 'profile.showCrew',
    label: 'Crew · Squad strip',
    hint: 'Slim Crew · N | Squad · N row under the avatar hero',
    fanSurface: 'Profile · AthleteProfileView',
    adminDesk: '/admin/look',
    defaultOn: true,
  },
  {
    id: 'showStats',
    path: 'profile.showStats',
    label: 'Stats tab',
    hint: 'Stats 📊 pill under Highlights collage + roster',
    fanSurface: 'Profile · FilterPills',
    adminDesk: '/admin/look',
    defaultOn: true,
  },
  {
    id: 'showVault',
    path: 'profile.showVault',
    label: 'Vault tab',
    hint: 'Vault 🔒 pill (also needs Features buttons.vault)',
    fanSurface: 'Profile · FilterPills',
    adminDesk: '/admin/look',
    defaultOn: true,
  },
  {
    id: 'actionsOnTop',
    path: 'profile.actionsOnTop',
    label: 'Actions on top',
    hint: 'Drop Mālo / Subscribe sit above Highlights when On',
    fanSurface: 'Profile · actions row',
    adminDesk: '/admin/look',
    defaultOn: false,
  },
  {
    id: 'statsFirst',
    path: 'profile.statsFirst',
    label: 'Open on Stats',
    hint: 'Land on Stats instead of Highlights collage (default Off keeps collage first)',
    fanSurface: 'Profile · default tab',
    adminDesk: '/admin/look',
    defaultOn: false,
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
