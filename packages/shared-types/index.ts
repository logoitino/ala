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
