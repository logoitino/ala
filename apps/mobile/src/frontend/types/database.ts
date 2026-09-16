import type { SchoolTeam } from '@/data/teams';
import type {
  SpotlightAward as SharedSpotlightAward,
  SpotlightPeriodKind,
  UserRole,
} from '@tapuai/shared-types';

export type {
  ActionStats,
  CastCheerVoteRpc,
  FanTipHistoryRpc,
  GetAuraTierRpc,
  SharedSchoolTeam,
  SpotlightPeriodKind,
  TapuaiRpcMap,
  UserRole,
} from '@tapuai/shared-types';

export type Profile = {
  id: string;
  user_id: string | null;
  role: UserRole;
  full_name: string;
  username?: string | null;
  is_verified: boolean;
  /** `unverified` | `pending` | `verified`. Claiming a school does not set verified. */
  verification_status?: 'unverified' | 'pending' | 'verified' | string | null;
  spirit_points: number;
  aura_points?: number;
  current_tier?: number | null;
  /** Dual capability, e.g. `['fan', 'athlete']`. Falls back to `[role]` when omitted. */
  roles?: UserRole[] | string[] | null;
  /** True when `role` / `roles` include admin. Synced by `add_user_role('admin')`. */
  is_admin?: boolean;
  /** Fan View vs Athlete Management View for dual accounts. */
  active_role?: 'fan' | 'athlete' | string | null;
  stripe_connect_id?: string | null;
  stripe_onboarding_complete?: boolean;
  payouts_enabled?: boolean;
  /** ISO time the current Terms / NIL / minor-safety version was acknowledged. */
  legal_terms_accepted_at?: string | null;
  legal_terms_version?: string | null;
  school_id?: string | null;
  athlete_division?: string | null;
  athlete_sport?: string | null;
  athlete_jersey?: string | null;
  athlete_position?: string | null;
  athlete_class_year?: string | null;
  /** Hydrated `schools_and_teams` row for the trading card. */
  team?: SchoolTeam | null;
  /** Claimed `players.id` for That's me auto-confirm. */
  player_id?: string | null;
  /** Public Storage URL from the `avatars` bucket. Incremental: `supabase/media_upload.sql`. */
  avatar_url?: string | null;
  created_at?: string;
};

export type Player = {
  id: string;
  name: string;
  jersey_number: number;
  position: string;
  height: string;
  school_name: string;
  backer_count: number;
  view_count?: number;
  aura_count?: number;
  aura_points?: number;
  flex_count?: number;
  seki_count?: number;
  team?: string | null;
  /** Combine / measurables for Stats 📊. Incremental: `supabase/athlete_stats.sql`. */
  weight?: string | null;
  forty_yard?: string | null;
  vertical_jump?: string | null;
  team_name?: string | null;
  guardian_id?: string | null;
  parental_consent_approved?: boolean;
  /** Master Vault lock. `true` (default) = fans must subscribe to watch Vault clips. */
  vault_locked?: boolean | null;
};

export type ReelTagStatus = 'pending' | 'confirmed' | 'rejected';

export type SpotlightAwardRow = {
  id: string;
  athlete_id?: string | null;
  award_type: string;
  level: string;
  school_id?: string | null;
  district_region?: string | null;
  headline: string;
  highlight_reel_id?: string | null;
  start_date: string;
  end_date: string;
  source?: 'auto' | 'manual' | string;
  locked?: boolean;
  created_at?: string;
};

/** Normalized payload from `get_active_spotlight_award` (plus hydrated player / clip URL). */
export type SpotlightAward = SharedSpotlightAward & {
  player?: Player | null;
};

/** Row from `get_pending_player_tags` — fan clip waiting on That's me / That's our player. */
export type PendingPlayerTag = {
  id: string;
  title: string;
  video_url: string | null;
  player_id: string;
  player_name: string;
  school_name: string;
  created_at: string;
  seki_count: number;
  aura_count: number;
  flex_count: number;
  uploader_name?: string | null;
};

export type SpotlightStanding = {
  rank: number;
  player_id: string;
  name: string;
  school_name: string;
  hype: number;
  seki: number;
  aura: number;
  flex: number;
  reel_id?: string | null;
  title?: string | null;
  shot_by?: string | null;
};

export type SpotlightStandings = {
  period_kind: SpotlightPeriodKind;
  start_date: string;
  end_date: string;
  leaders: SpotlightStanding[];
};

export type GameStatus = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Halftime' | 'Final';

export type Game = {
  id: string;
  home_team: string;
  away_team: string;
  home_school: string;
  away_school: string;
  home_score: number;
  away_score: number;
  quarter?: string | null;
  status: string;
  venue: string;
  /** Playbook key into `sport_configs.sport`. Drives operator buttons and period chips. */
  sport?: string | null;
  is_active: boolean;
  clock?: string | null;
  claimed_by?: string | null;
  is_clock_running?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type GameEvent = {
  id: string;
  player_id?: string | null;
  game_id?: string | null;
  event_type: string;
  description: string;
  created_at?: string;
};

export type GameEventWithPlayer = GameEvent & {
  players: Player | Player[] | null;
};

export type TipLedgerEntry = {
  id: string;
  player_id: string;
  amount_cents: number;
  created_at: string;
  fan_id?: string | null;
  reel_id?: string | null;
  aura_points?: number;
};

/** Row from `get_fan_tip_history` (Mālo receipts for the signed-in fan). */
export type FanTipReceipt = {
  id: string;
  player_id: string;
  reel_id: string | null;
  amount_cents: number;
  aura_points: number;
  created_at: string;
  athlete_name: string;
  school_name: string;
};

export type OperatorCheckin = {
  id: string;
  gig_id: string | null;
  latitude: number | null;
  longitude: number | null;
  checked_in_at: string;
};

export type OperatorGig = {
  id: string;
  game_id: string | null;
  title: string;
  venue: string;
  starts_at: string;
  status: string;
};

export type SponsorAd = {
  id: string;
  title: string;
  placement: string;
  rivalry: string | null;
  is_active: boolean;
};

export type SponsorshipTierId = 'silver' | 'gold' | 'platinum';

/** Local business booster row (`public.sponsorships`). */
export type Sponsorship = {
  id: string;
  sponsor_user_id?: string | null;
  business_name: string;
  logo_url: string;
  school_team: string;
  tier: SponsorshipTierId | string;
  amount_cents: number;
  aura_points: number;
  billing_interval?: string;
  status?: string;
  created_at?: string;
};

export type VerificationRequest = {
  id: string;
  player_id: string | null;
  full_name: string;
  status: string;
  notes: string | null;
  requester_user_id?: string | null;
  school_id?: string | null;
  team_code?: string | null;
  created_at?: string;
};

export type Disbursement = {
  id: string;
  player_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
};

/** Client performance row (`public.telemetry_logs`). */
export type TelemetryLog = {
  id: string;
  event_type: string;
  video_id?: string | null;
  channel?: string | null;
  step?: string | null;
  duration_ms?: number | null;
  attempts?: number | null;
  payload?: Record<string, unknown>;
  created_at?: string;
};

export type CheerPoll = {
  id?: string;
  slug: string;
  home_label: string;
  away_label: string;
  home_votes: number;
  away_votes: number;
  is_active?: boolean;
  updated_at?: string;
};

/** Drip marketplace row (`public.shop_products`). Admin portal writes; fan Drip tab reads. */
export type ShopProduct = {
  id: string;
  name: string;
  category: 'apparel' | 'aura_cards' | 'merch' | string;
  price_cents: number;
  blurb: string;
  has_sizes: boolean;
  inventory: number;
  icon: 'shirt' | 'sparkles' | 'basketball' | string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
};

/** Paid Drip row (`public.shop_orders`) — merch volume for the Money desk. */
export type ShopOrder = {
  id: string;
  product_id: string | null;
  buyer_id: string | null;
  amount_cents: number;
  qty: number;
  created_at: string;
};

/** One sport playbook (`public.sport_configs`). JSON columns mirror `apps/mobile/src/frontend/data/sports.ts`. */
export type SportConfigRow = {
  id: string;
  sport: string;
  emoji: string;
  period_label: string;
  periods: unknown;
  uses_clock: boolean;
  clock_seconds: number;
  scoring: unknown;
  callouts: unknown;
  stat_fields: unknown;
  measurables: unknown;
  positions: unknown;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

/** Crowd-funded gear on the athlete Stats tab (`public.wishlist_items`). */
export type WishlistItem = {
  id: string;
  player_id: string | null;
  title: string;
  photo_url: string;
  /** External retailer link for 🎁 Gift Item Directly. */
  buy_url: string;
  target_amount_cents: number;
  current_amount_cents: number;
  is_equipped: boolean;
  equipped_at?: string | null;
  /** True once the +500 Aura equip bonus has been paid, so it never double-awards. */
  aura_awarded?: boolean;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

/** Fan suggestion / bug / look note (`public.app_feedback`). */
export type AppFeedbackRow = {
  id: string;
  author_id: string | null;
  body: string;
  kind: 'suggestion' | 'bug' | 'look' | 'other' | string;
  surface: 'home' | 'local' | 'spotlight' | 'drip' | 'profile' | 'other' | string;
  status: 'new' | 'reviewing' | 'planned' | 'shipping' | 'shipped' | 'declined' | string;
  runtime_path: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

/** Company ledger row (`public.company_revenue_logs`). */
export type CompanyRevenueLogRow = {
  id: string;
  transaction_type: string;
  source?: 'malo' | 'booster' | 'vault' | 'merch' | string;
  source_id?: string | null;
  label?: string;
  payee_kind?: 'athlete' | 'operator' | 'none' | string;
  player_id?: string | null;
  recipient_id?: string | null;
  gross_cents?: number;
  platform_cents?: number;
  payout_cents?: number;
  gross_amount: number;
  platform_cut_amount: number;
  payout_amount: number;
  created_at?: string;
};

export type AthleteSubscription = {
  id: string;
  subscriber_id: string;
  athlete_id: string;
  status: 'active' | 'canceled' | 'expired' | string;
  created_at: string;
};

export type SubscriberRequest = {
  id: string;
  subscriber_id: string;
  athlete_id: string;
  body: string;
  created_at: string;
};

export type Reel = {
  id: string;
  video_url: string;
  title: string;
  player_id: string | null;
  game_id: string | null;
  created_at: string;
  seki_count?: number;
  aura_count?: number;
  flex_count?: number;
  total_tips_cents?: number;
  is_exclusive?: boolean;
  /** Fan-first Open Vault. Default false = free public feed. Synced with `is_exclusive`. */
  is_vault_only?: boolean;
  is_flagged?: boolean;
  reported_by?: string[] | null;
  /** Admin takedown (`moderate_flagged_reel` remove). Hidden from Highlights ⚡. */
  is_removed?: boolean;
  /** Game Play / Train Like Me / Serve Like Me. Default `game_play`. */
  category?: 'game_play' | 'train_like_me' | 'serve_like_me';
  /** Vault clip is playable until this instant (`set_reel_flash_unlock`). */
  flash_unlock_until?: string | null;
  /** Fan who uploaded. Null on older clips. */
  uploaded_by?: string | null;
  /** pending until the tagged athlete / parent / operator / admin confirms. */
  tag_status?: ReelTagStatus | string | null;
  tag_confirmed_at?: string | null;
  tag_confirmed_by?: string | null;
};

/** Fan → athlete Crew follow (`public.crew_follows`). */
export type CrewFollow = {
  follower_id: string;
  athlete_id: string;
  created_at: string;
};

/** Queued Crew push payload (`public.crew_push_queue`). */
export type CrewPushQueue = {
  id: string;
  recipient_id: string;
  athlete_id?: string | null;
  reel_id?: string | null;
  kind: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  created_at: string;
};

export type ReelWithPlayer = Reel & {
  players: Player | Player[] | null;
};

/** Fan bookmark row (`public.saved_reels`). */
export type SavedReel = {
  user_id: string;
  reel_id: string;
  created_at: string;
};

/** One Seki / Aura / Flex per fan per clip (`public.reel_hype_votes`). */
export type ReelHypeVote = {
  user_id: string;
  reel_id: string;
  kind: 'seki' | 'aura' | 'flex';
  created_at: string;
};

/** Row from `public.schools_and_teams` (HS + NCAA catalog). */
export type SchoolAndTeam = {
  id: string;
  name: string;
  mascot: string;
  level: 'high_school' | 'college' | string;
  division: string;
  region: string;
  city?: string | null;
  team_code?: string | null;
  created_at?: string;
};

export type AthleteCareerStat = {
  player_id: string;
  sport: string;
  games_played: number;
  scoring_value: number;
  volume_value: number;
  mvp_badges: number;
  updated_at?: string;
};

export type AthleteGameLog = {
  id: string;
  player_id: string;
  played_on: string;
  opponent_school: string;
  stat_line: string;
  scoring_value: number;
  volume_value: number;
  created_at?: string;
};

export type LocalSearchKind = 'all' | 'athlete' | 'school' | 'booster';

/** Row from `search_local_entities(search_query, entity_kind)`. */
export type LocalSearchHit = {
  entity_type: Exclude<LocalSearchKind, 'all'>;
  entity_id: string;
  title: string;
  subtitle: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & Pick<Profile, 'full_name'>>;
      players: Table<Player, Partial<Player> & Pick<Player, 'name'>>;
      games: Table<Game, Partial<Game> & Pick<Game, 'home_team' | 'away_team'>>;
      game_events: {
        Row: GameEvent;
        Insert: Partial<Pick<GameEvent, 'player_id' | 'game_id'>> &
          Pick<GameEvent, 'event_type' | 'description'>;
        Update: Partial<GameEvent>;
        Relationships: [
          {
            foreignKeyName: 'game_events_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      tips: Table<TipLedgerEntry>;
      operator_gigs: Table<OperatorGig>;
      operator_checkins: Table<OperatorCheckin>;
      sponsor_ads: Table<SponsorAd>;
      sponsorships: Table<
        Sponsorship,
        Pick<Sponsorship, 'business_name' | 'amount_cents'> & Partial<Sponsorship>
      >;
      verification_requests: Table<VerificationRequest>;
      disbursements: Table<Disbursement>;
      telemetry_logs: Table<
        TelemetryLog,
        Pick<TelemetryLog, 'event_type'> & Partial<TelemetryLog>
      >;
      reels: {
        Row: Reel;
        Insert: Pick<Reel, 'video_url'> &
          Partial<Pick<Reel, 'title' | 'player_id' | 'game_id' | 'seki_count' | 'aura_count' | 'flex_count' | 'total_tips_cents' | 'is_exclusive' | 'is_vault_only' | 'category' | 'flash_unlock_until'>>;
        Update: Partial<Reel>;
        Relationships: [
          {
            foreignKeyName: 'reels_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reels_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
      cheer_polls: Table<CheerPoll>;
      subscriptions: Table<
        AthleteSubscription,
        Pick<AthleteSubscription, 'subscriber_id' | 'athlete_id'> & Partial<AthleteSubscription>
      >;
      subscriber_requests: Table<
        SubscriberRequest,
        Pick<SubscriberRequest, 'subscriber_id' | 'athlete_id' | 'body'> & Partial<SubscriberRequest>
      >;
      saved_reels: Table<SavedReel, Pick<SavedReel, 'user_id' | 'reel_id'> & Partial<SavedReel>>;
      reel_hype_votes: Table<
        ReelHypeVote,
        Pick<ReelHypeVote, 'user_id' | 'reel_id' | 'kind'> & Partial<ReelHypeVote>
      >;
      crew_follows: Table<CrewFollow, Pick<CrewFollow, 'follower_id' | 'athlete_id'> & Partial<CrewFollow>>;
      crew_push_queue: Table<
        CrewPushQueue,
        Pick<CrewPushQueue, 'recipient_id'> & Partial<CrewPushQueue>
      >;
      schools_and_teams: Table<
        SchoolAndTeam,
        Pick<SchoolAndTeam, 'name' | 'level' | 'division' | 'region'> & Partial<SchoolAndTeam>
      >;
      athlete_career_stats: Table<
        AthleteCareerStat,
        Pick<AthleteCareerStat, 'player_id'> & Partial<AthleteCareerStat>
      >;
      athlete_game_logs: Table<
        AthleteGameLog,
        Pick<AthleteGameLog, 'player_id' | 'played_on'> & Partial<AthleteGameLog>
      >;
      spotlight_awards: Table<
        SpotlightAwardRow,
        Pick<SpotlightAwardRow, 'award_type' | 'headline' | 'start_date' | 'end_date'> &
          Partial<SpotlightAwardRow>
      >;
      shop_products: Table<
        ShopProduct,
        Pick<ShopProduct, 'id' | 'name' | 'category'> & Partial<ShopProduct>
      >;
      shop_orders: Table<
        ShopOrder,
        Pick<ShopOrder, 'amount_cents'> & Partial<ShopOrder>
      >;
      company_revenue_logs: Table<
        CompanyRevenueLogRow,
        Pick<CompanyRevenueLogRow, 'transaction_type' | 'gross_amount' | 'platform_cut_amount' | 'payout_amount'> &
          Partial<CompanyRevenueLogRow>
      >;
      app_feedback: Table<
        AppFeedbackRow,
        Pick<AppFeedbackRow, 'body'> & Partial<AppFeedbackRow>
      >;
      wishlist_items: Table<
        WishlistItem,
        Pick<WishlistItem, 'title'> & Partial<WishlistItem>
      >;
      sport_configs: Table<
        SportConfigRow,
        Pick<SportConfigRow, 'sport'> & Partial<SportConfigRow>
      >;
      app_runtime_config: {
        Row: {
          id: string;
          draft: Record<string, unknown>;
          published: Record<string, unknown>;
          published_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          draft?: Record<string, unknown>;
          published?: Record<string, unknown>;
          published_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          draft: Record<string, unknown>;
          published: Record<string, unknown>;
          published_at: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_backer_count: {
        Args: { target_player_id: string };
        Returns: number;
      };
      add_user_aura: {
        Args: { target_user_id: string; points_to_add: number };
        Returns: {
          aura_points: number;
          player_aura_points: number | null;
          profile_aura_points: number | null;
          points_added: number;
        };
      };
      add_user_role: {
        Args: { new_role: string };
        Returns: string[];
      };
      redeem_team_code: {
        Args: { raw_code: string };
        Returns: Record<string, unknown>;
      };
      request_athlete_verification: {
        Args: { request_notes?: string | null };
        Returns: Record<string, unknown>;
      };
      athlete_is_varsity_verified: {
        Args: { target_player_id: string };
        Returns: boolean;
      };
      get_aura_tier: {
        Args: { points: number };
        Returns: {
          tier: number;
          title: string;
          min_points: number;
          color: string;
        };
      };
      increment_player_hype: {
        Args: { target_player_id: string; hype_kind: string };
        Returns: {
          view_count: number;
          aura_count: number;
          flex_count: number;
          seki_count: number;
        };
      };
      increment_reel_hype: {
        Args: { target_reel_id: string; hype_kind: string };
        Returns: {
          seki_count: number;
          aura_count: number;
          flex_count: number;
          total_tips_cents: number;
          applied?: boolean;
        };
      };
      increment_reel_tips: {
        Args: { target_reel_id: string; add_cents: number };
        Returns: number;
      };
      get_fan_tip_history: {
        Args: { fan_user_id: string };
        Returns: FanTipReceipt[];
      };
      search_local_entities: {
        Args: { search_query: string; entity_kind?: string };
        Returns: LocalSearchHit[];
      };
      search_schools_and_teams: {
        Args: { search_query: string };
        Returns: SchoolAndTeam[];
      };
      update_game_score: {
        Args: {
          target_game_id: string;
          home_delta?: number;
          away_delta?: number;
          set_clock_running?: boolean | null;
          set_clock?: string | null;
        };
        Returns: {
          id: string;
          home_score: number;
          away_score: number;
          clock: string;
          is_clock_running: boolean;
          claimed_by: string | null;
          quarter: string | null;
          status: string;
        };
      };
      cast_cheer_vote: {
        Args: {
          poll_slug: string;
          side: string;
          previous_side?: string | null;
          home_name?: string;
          away_name?: string;
        };
        Returns: {
          home_votes: number;
          away_votes: number;
        };
      };
      report_reel: {
        Args: { target_reel_id: string };
        Returns: {
          id: string;
          is_flagged: boolean;
          reported_by: string[];
        };
      };
      publish_spotlight_award: {
        Args: {
          target_player_id: string;
          award_headline: string;
          period_kind: string;
          window_start: string;
          window_end: string;
        };
        Returns: {
          id: string;
          athlete_id?: string | null;
          player_id: string;
          headline: string;
          highlight_reel_id?: string | null;
          start_date: string;
          end_date: string;
          award_type: string;
        };
      };
      moderate_flagged_reel: {
        Args: { target_reel_id: string; moderation_action: string };
        Returns: {
          id: string;
          is_flagged: boolean;
          is_removed: boolean;
        };
      };
      get_admin_platform_metrics: {
        Args: Record<string, never>;
        Returns: {
          highlight_count: number;
          engagement_count: number;
          malo_cents: number;
          open_flags: number;
          telemetry_events_24h: number;
        };
      };
      patch_app_runtime_draft: {
        Args: { next_draft: Record<string, unknown> };
        Returns: Record<string, unknown>;
      };
      publish_app_runtime: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_admin_reports: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_company_revenue_summary: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      submit_app_feedback: {
        Args: { p_body: string; p_kind?: string; p_surface?: string };
        Returns: AppFeedbackRow;
      };
      get_app_feedback: {
        Args: Record<string, never>;
        Returns: AppFeedbackRow[];
      };
      triage_app_feedback: {
        Args: {
          target_id: string;
          next_status: string;
          next_note?: string;
          next_runtime_path?: string;
        };
        Returns: AppFeedbackRow;
      };
      get_sport_configs: {
        Args: Record<string, never>;
        Returns: SportConfigRow[];
      };
      upsert_sport_config: {
        Args: { payload: Record<string, unknown> };
        Returns: SportConfigRow;
      };
      delete_sport_config: {
        Args: { target_id: string };
        Returns: boolean;
      };
      get_wishlist_items: {
        Args: { target_player_id: string };
        Returns: WishlistItem[];
      };
      chip_in_wishlist_item: {
        Args: { item_id: string; amount_cents: number };
        Returns: Record<string, unknown>;
      };
      toggle_reel_vault_status: {
        Args: { target_reel_id: string };
        Returns: boolean;
      };
      set_player_vault_locked: {
        Args: { target_player_id: string; is_locked: boolean };
        Returns: boolean;
      };
      get_crew_graph: {
        Args: { target_athlete_id: string };
        Returns: {
          crew_count: number;
          squad_count: number;
          following: boolean;
          mutual: boolean;
        };
      };
      toggle_crew_follow: {
        Args: { target_athlete_id: string; should_join: boolean };
        Returns: {
          crew_count: number;
          squad_count: number;
          following: boolean;
          mutual: boolean;
        };
      };
      set_reel_flash_unlock: {
        Args: { target_reel_id: string };
        Returns: {
          flash_unlock_until: string;
          notified_count: number;
        };
      };
      get_active_spotlight_award: {
        Args: { viewer_user_id?: string | null };
        Returns: SpotlightAward | null;
      };
      confirm_reel_player_tag: {
        Args: { target_reel_id: string; tag_action: string };
        Returns: {
          id: string;
          player_id: string | null;
          tag_status: string;
          tag_confirmed_at?: string | null;
        };
      };
      get_pending_player_tags: {
        Args: Record<string, never>;
        Returns: PendingPlayerTag[];
      };
      get_spotlight_standings: {
        Args: { period_kind?: string };
        Returns: SpotlightStandings;
      };
      sync_spotlight_period: {
        Args: { period_kind?: string };
        Returns: Record<string, unknown>;
      };
      sync_live_spotlight_awards: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      unlock_spotlight_period: {
        Args: { period_kind: string };
        Returns: Record<string, unknown>;
      };
      can_confirm_player_tag: {
        Args: { target_player_id: string };
        Returns: boolean;
      };
      spotlight_normalize_kind: {
        Args: { period_kind: string };
        Returns: string;
      };
      spotlight_window: {
        Args: { period_kind: string; as_of?: string };
        Returns: { window_start: string; window_end: string }[];
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      upsert_cheer_poll: {
        Args: {
          poll_slug: string;
          home_name: string;
          away_name: string;
          make_active?: boolean;
        };
        Returns: {
          slug: string;
          home_label: string;
          away_label: string;
          home_votes: number;
          away_votes: number;
          is_active: boolean;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
