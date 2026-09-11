export type UserRole =
  | 'guest'
  | 'fan'
  | 'athlete'
  | 'parent'
  | 'operator'
  | 'booster'
  | 'sponsor'
  | 'admin';

export type Profile = {
  id: string;
  user_id: string | null;
  role: UserRole;
  full_name: string;
  is_verified: boolean;
  spirit_points: number;
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
  team?: string | null;
  guardian_id?: string | null;
  parental_consent_approved?: boolean;
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
  is_active: boolean;
  clock?: string | null;
  updated_at?: string;
};

export type GameEvent = {
  id: string;
  player_id: string;
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

export type VerificationRequest = {
  id: string;
  player_id: string | null;
  full_name: string;
  status: string;
  notes: string | null;
};

export type Disbursement = {
  id: string;
  player_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
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
        Insert: Pick<GameEvent, 'player_id' | 'event_type' | 'description'> &
          Partial<Pick<GameEvent, 'game_id'>>;
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
      verification_requests: Table<VerificationRequest>;
      disbursements: Table<Disbursement>;
    };
    Views: Record<string, never>;
    Functions: {
      increment_backer_count: {
        Args: { target_player_id: string };
        Returns: number;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
