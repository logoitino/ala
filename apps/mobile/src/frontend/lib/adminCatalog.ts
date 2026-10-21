/**
 * Data layer for the Expo /admin catalog desks: schools, athletes, games, highlights, people, verification,
 * boosters, payouts, the publish desk, the operations inbox and polls. Screens under components/Admin call these
 * instead of Supabase directly. Also holds money-input helpers (`centsFromDollarsInput`, `dollarsInputFromCents`).
 * Drip products, wishlist gear and `slugify` live in `adminShop.ts` (R4-03) and are re-exported below.
 * Admin-only: every write assumes the caller's role is admin and relies on RLS to enforce it.
 * @sideEffects Reads and writes many tables via the shared Supabase client.
 */

import { fetchAdminSpotlightAwards } from '@/lib/admin';
import { fetchAdminShopProducts, slugify } from '@/lib/adminShop';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  CheerPoll,
  Disbursement,
  Game,
  Player,
  ShopProduct,
  Sponsorship,
  SpotlightAward,
  
  UserRole,
  VerificationRequest,
} from '@/types/database';
import type { SchoolTeam } from '@/data/teams';

// Drip / wishlist racks moved to adminShop.ts (R4-03); desks, hooks and jest mocks keep importing them from here.
export {
  fetchAdminShopProducts, fetchAdminWishlist, fetchLiveDripItems, setWishlistItemActive, slugify, upsertShopProduct,
  upsertWishlistItem,
} from '@/lib/adminShop';
export type { AdminWishlistRow } from '@/lib/adminShop';

export type AdminHighlightRow = {
  id: string;
  title: string;
  athleteName: string;
  school: string;
  playerId: string | null;
  category: 'game_play' | 'train_like_me' | 'serve_like_me';
  seki: number;
  aura: number;
  flex: number;
  maloCents: number;
  is_flagged: boolean;
  is_removed: boolean;
  is_vault_only: boolean;
  tag_status?: 'pending' | 'confirmed' | 'rejected' | string;
  created_at: string;
};

export type AdminOpsItem = {
  href:
    | '/admin/moderation'
    | '/admin/people'
    | '/admin/games'
    | '/admin/drip'
    | '/admin/money'
    | '/admin/publish'
    | '/admin/qa'
    | '/admin/spotlight'
    | '/admin/feedback';
  label: string;
  hint: string;
  count: number;
};

export type AdminOpsInbox = {
  flags: number;
  pendingVerify: number;
  pendingTags: number;
  liveGames: number;
  parkedGames: number;
  hiddenDrip: number;
  lowStock: number;
  queuedPayouts: number;
  newFeedback: number;
  items: AdminOpsItem[];
};

/**
 * @purpose Parse a `$54` / `54.00` admin field into Stripe cents.
 */
export function centsFromDollarsInput(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

/**
 * @purpose Format cents as a dollars field (`54.00`).
 */
export function dollarsInputFromCents(cents: number): string {
  return (Math.max(0, asInt(cents)) / 100).toFixed(2);
}

export type AdminPerson = {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string | null;
  is_fan: boolean;
  /** Compliance freeze switch (LEGAL_BRIEFING.md §8 item 5). Flip via `setMaloFreeze`. */
  malo_frozen: boolean;
  /** Dual capability, e.g. `['fan', 'parent']`. Used to find guardian candidates for `adminSetPlayerGuardian`. */
  roles: string[];
};

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function throwIf(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}


/**
 * @purpose Load the HS + NCAA catalog for the Schools tool.
 * @sideEffects `schools_and_teams` SELECT.
 */
export async function fetchAdminSchools(): Promise<SchoolTeam[]> {
  if (!isSupabaseConfigured) return [];
  const primary = await supabase
    .from('schools_and_teams')
    .select('id, name, mascot, level, division, region, city, malo_frozen')
    .order('name', { ascending: true });
  // Fallback for a hosted DB that hasn't picked up the `malo_frozen` column yet.
  const { data, error } = primary.error
    ? await supabase
        .from('schools_and_teams')
        .select('id, name, mascot, level, division, region, city')
        .order('name', { ascending: true })
    : primary;
  throwIf(error, 'Could not load schools.');
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: asText(record.id),
      name: asText(record.name),
      mascot: asText(record.mascot),
      level: record.level === 'college' ? 'college' : 'high_school',
      division: asText(record.division, record.level === 'college' ? 'NCAA D1' : 'High School'),
      region: asText(record.region, record.level === 'college' ? 'Big 12' : 'UT'),
      city: asText(record.city) || null,
      malo_frozen: asBool(record.malo_frozen),
    } as SchoolTeam;
  });
}

/**
 * @purpose Add or edit a school so athlete onboarding and Local search pick it up.
 * @sideEffects `schools_and_teams` UPSERT.
 */
export async function upsertSchool(input: Partial<SchoolTeam> & { name: string }): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const name = input.name.trim();
  if (!name) throw new Error('Add a school name.');
  const level = input.level === 'college' ? 'college' : 'high_school';
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    name,
    mascot: (input.mascot ?? '').trim(),
    level,
    division: (input.division ?? (level === 'college' ? 'NCAA D1' : 'High School')).trim(),
    region: (input.region ?? (level === 'college' ? 'Big 12' : 'UT')).trim(),
    city: (input.city ?? '').trim(),
  };
  const { error } = input.id
    ? await supabase.from('schools_and_teams').update(payload).eq('id', input.id)
    : await supabase.from('schools_and_teams').insert(payload);
  throwIf(error, 'Could not save this school.');
}

/**
 * @purpose Create or update a roster athlete fans tag on Highlights ⚡ and Mālo.
 * @sideEffects `players` INSERT or UPDATE.
 */
export async function upsertAthlete(input: Partial<Player> & { name: string }): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const name = input.name.trim();
  if (!name) throw new Error('Add an athlete name.');
  const payload = {
    name,
    jersey_number: Math.max(0, asInt(input.jersey_number)),
    position: (input.position ?? '').trim(),
    height: (input.height ?? '').trim(),
    school_name: (input.school_name ?? '').trim(),
    team: (input.team ?? input.school_name ?? '').trim() || null,
    weight: (input.weight ?? '').trim(),
    forty_yard: (input.forty_yard ?? '').trim(),
    vertical_jump: (input.vertical_jump ?? '').trim(),
  };
  const { error } = input.id
    ? await supabase.from('players').update(payload).eq('id', input.id)
    : await supabase.from('players').insert(payload);
  throwIf(error, 'Could not save this athlete.');
}

/**
 * @purpose Load live + parked matches for the Games tool.
 * @sideEffects `games` SELECT.
 */
export async function fetchAdminGames(): Promise<Game[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false }).limit(40);
  throwIf(error, 'Could not load games.');
  return (Array.isArray(data) ? data : []) as Game[];
}

/**
 * @purpose Push a match onto Local Live Matches (and operator consoles).
 * @sideEffects `games` INSERT or UPDATE.
 */
export async function upsertGame(input: Partial<Game> & { home_team: string; away_team: string }): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const home = input.home_team.trim();
  const away = input.away_team.trim();
  if (!home || !away) throw new Error('Add both team names.');
  const payload = {
    home_team: home,
    away_team: away,
    home_school: (input.home_school ?? home).trim(),
    away_school: (input.away_school ?? away).trim(),
    venue: (input.venue ?? '').trim(),
    quarter: (input.quarter ?? 'Q1').trim() || 'Q1',
    sport: (input.sport ?? 'Football').trim() || 'Football',
    status: (input.status ?? 'live').trim() || 'live',
    home_score: Math.max(0, asInt(input.home_score)),
    away_score: Math.max(0, asInt(input.away_score)),
    clock: (input.clock ?? '12:00').trim() || '12:00',
    is_active: input.is_active !== false,
  };
  const { error } = input.id
    ? await supabase.from('games').update(payload).eq('id', input.id)
    : await supabase.from('games').insert(payload);
  throwIf(error, 'Could not save this game.');
}

/**
 * @purpose Load Highlights ⚡ including removed clips so admins can restore them.
 * @sideEffects `reels` SELECT.
 */
export async function fetchAdminHighlights(): Promise<AdminHighlightRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reels')
    .select(
      'id, title, created_at, player_id, category, seki_count, aura_count, flex_count, total_tips_cents, is_flagged, is_removed, is_vault_only, is_exclusive, tag_status, players (name, school_name)',
    )
    .order('created_at', { ascending: false })
    .limit(80);
  throwIf(error, 'Could not load Highlights.');
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const record = row as Record<string, unknown>;
    const rawPlayer = record.players;
    const player = (Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer) as Record<string, unknown> | null;
    const categoryRaw = asText(record.category, 'game_play');
    const category =
      categoryRaw === 'train_like_me' || categoryRaw === 'serve_like_me' ? categoryRaw : 'game_play';
    return {
      id: asText(record.id),
      title: asText(record.title, 'Untitled clip'),
      athleteName: asText(player?.name, 'Untagged'),
      school: asText(player?.school_name),
      playerId: asText(record.player_id) || null,
      category,
      seki: asInt(record.seki_count),
      aura: asInt(record.aura_count),
      flex: asInt(record.flex_count),
      maloCents: asInt(record.total_tips_cents),
      is_flagged: asBool(record.is_flagged),
      is_removed: asBool(record.is_removed),
      is_vault_only: asBool(record.is_vault_only ?? record.is_exclusive),
      tag_status: asText(record.tag_status, 'confirmed'),
      created_at: asText(record.created_at),
    };
  });
}

/**
 * @purpose Retitle or retag a Highlight so Home / Profile captions update.
 * @sideEffects `reels` UPDATE (`title` / `category`).
 */
export async function patchHighlight(
  reelId: string,
  patch: { title?: string; category?: 'game_play' | 'train_like_me' | 'serve_like_me' },
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const body: { title?: string; category?: 'game_play' | 'train_like_me' | 'serve_like_me' } = {};
  if (typeof patch.title === 'string') {
    const title = patch.title.trim();
    if (!title) throw new Error('Add a caption.');
    body.title = title;
  }
  if (patch.category) body.category = patch.category;
  if (Object.keys(body).length === 0) return;
  const { error } = await supabase.from('reels').update(body).eq('id', reelId);
  throwIf(error, 'Could not update this Highlight.');
}

/**
 * @purpose Take a clip off Highlights ⚡ or put it back for fans.
 * @sideEffects `moderate_flagged_reel` RPC (admin-only; SECURITY DEFINER) — `remove` / `restore`.
 */
export async function setHighlightRemoved(reelId: string, removed: boolean): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  // 2026-09 audit (reels RLS tightening): `is_removed` / `is_flagged` are no longer in the
  // raw-UPDATE column grant on `reels` — this desk now goes through the same admin-gated RPC as
  // the Moderation queue (`moderate_flagged_reel`), which already supports `remove` and now also
  // `restore` (see schema.sql).
  const { error } = await supabase.rpc('moderate_flagged_reel', {
    target_reel_id: reelId,
    moderation_action: removed ? 'remove' : 'restore',
  });
  throwIf(error, 'Could not update this Highlight.');
}

function profileLooksVerified(row: Record<string, unknown>): boolean {
  return (
    asBool(row.is_verified) ||
    asBool(row.is_verified_athlete) ||
    asText(row.verification_status) === 'verified'
  );
}

/**
 * @purpose Load accounts for verify / admin-grant.
 * @sideEffects `profiles` SELECT. Live projects may have `is_verified_athlete` instead of `is_verified`.
 */
export async function fetchAdminPeople(): Promise<AdminPerson[]> {
  if (!isSupabaseConfigured) return [];
  const selects = [
    'id, full_name, username, role, is_verified, is_verified_athlete, verification_status, is_admin, roles, created_at, malo_frozen',
    'id, full_name, username, role, is_verified_athlete, verification_status, is_admin, roles, created_at, malo_frozen',
    'id, full_name, username, role, is_verified, is_admin, roles, created_at, malo_frozen',
    'id, full_name, username, role, is_admin, roles, created_at, malo_frozen',
    // Fallback for a hosted DB that hasn't picked up the `malo_frozen` column yet.
    'id, full_name, username, role, is_verified, is_verified_athlete, verification_status, is_admin, roles, created_at',
    'id, full_name, username, role, is_admin, roles, created_at',
  ];
  let data: unknown[] | null = null;
  let lastError: string | null = null;
  for (const columns of selects) {
    const result = await supabase
      .from('profiles')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(80);
    if (!result.error && Array.isArray(result.data)) {
      data = result.data;
      break;
    }
    lastError = result.error?.message ?? lastError;
  }
  if (!data) throwIf({ message: lastError ?? 'Could not load people.' }, 'Could not load people.');
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const roles = Array.isArray(record.roles) ? record.roles.map(String) : [];
    const isFan = record.role === 'fan' || roles.includes('fan');
    return {
      id: asText(record.id),
      full_name: asText(record.full_name, 'Unnamed'),
      username: asText(record.username) || null,
      role: asText(record.role, 'fan'),
      is_verified: profileLooksVerified(record),
      is_admin: asBool(record.is_admin) || roles.includes('admin') || record.role === 'admin',
      created_at: typeof record.created_at === 'string' ? record.created_at : null,
      is_fan: isFan,
      malo_frozen: asBool(record.malo_frozen),
      roles,
    };
  });
}

/**
 * @purpose Freeze or unfreeze Mālo/exclusive checkout for one athlete's profile or one school.
 * Compliance kill switch (LEGAL_BRIEFING.md §8 item 5) — admin-only, routed through the
 * `set_malo_freeze` RPC so no raw table UPDATE grant is needed for this feature.
 * @sideEffects `set_malo_freeze` RPC → `profiles.malo_frozen` or `schools_and_teams.malo_frozen`.
 */
export async function setMaloFreeze(
  targetType: 'athlete' | 'school',
  targetId: string,
  frozen: boolean,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!targetId) throw new Error('Missing id.');
  const { error } = await supabase.rpc('set_malo_freeze', {
    target_type: targetType,
    target_id: targetId,
    frozen,
  });
  throwIf(error, 'Could not update the donation freeze.');
}

/**
 * @purpose Link (or unlink, passing `guardianId: null`) an athlete's parent/guardian profile. This is
 * now the *only* way `players.guardian_id` can be set — a 2026-09 security fix closed the hole where
 * any `parent`-role account could self-assign as guardian of any athlete with zero verification, and
 * RLS now rejects every other write path. Routed through the narrow `admin_set_player_guardian`
 * SECURITY DEFINER RPC (admin-only, checked internally) so no raw `guardian_id` UPDATE grant is
 * needed. This is an interim manual admin tool to unblock the Parent screen, not the eventual
 * self-service linking mechanism — see docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md §1, still open.
 * @sideEffects `admin_set_player_guardian` RPC → `players.guardian_id`; also resets
 * `parental_consent_approved` to false and clears `guardian_consent_at` on that row.
 */
export async function adminSetPlayerGuardian(
  playerId: string,
  guardianId: string | null,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!playerId) throw new Error('Missing player id.');
  const { error } = await supabase.rpc('admin_set_player_guardian', {
    target_player_id: playerId,
    new_guardian_id: guardianId,
  });
  throwIf(error, 'Could not update this athlete’s guardian.');
}

/**
 * @purpose Verify a person or grant / revoke admin access on the production app.
 * @sideEffects `profiles` UPDATE (`is_verified` / `verification_status` / `is_admin` / `roles`).
 */
export async function patchAdminPerson(
  id: string,
  patch: { is_verified?: boolean; is_admin?: boolean; role?: UserRole },
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const body: {
    is_verified?: boolean;
    verification_status?: 'unverified' | 'verified';
    is_admin?: boolean;
    role?: UserRole;
    roles?: string[];
  } = {};
  if (typeof patch.is_verified === 'boolean') {
    body.is_verified = patch.is_verified;
    body.verification_status = patch.is_verified ? 'verified' : 'unverified';
  }
  if (patch.role) body.role = patch.role;

  if (typeof patch.is_admin === 'boolean') {
    body.is_admin = patch.is_admin;
    const { data: row, error: readError } = await supabase
      .from('profiles')
      .select('roles, role')
      .eq('id', id)
      .maybeSingle();
    throwIf(readError, 'Could not load this person.');
    const roles = Array.isArray(row?.roles) ? row.roles.map(String).filter(Boolean) : [];
    if (patch.is_admin) {
      if (!roles.includes('admin')) roles.push('admin');
      body.roles = roles.length > 0 ? roles : ['admin'];
      if (!body.role && row?.role !== 'admin') {
        // Keep their fan/athlete role as primary; admin is a capability on `roles` + `is_admin`.
      }
    } else {
      body.roles = roles.filter((item) => item !== 'admin');
      if (body.roles.length === 0) body.roles = [asText(row?.role, 'fan') === 'admin' ? 'fan' : asText(row?.role, 'fan')];
    }
  }

  if (Object.keys(body).length === 0) return;
  const attempts: Record<string, unknown>[] = [body];
  if (typeof patch.is_verified === 'boolean') {
    const withoutCanonical = { ...body };
    delete withoutCanonical.is_verified;
    attempts.push({ ...withoutCanonical, is_verified_athlete: patch.is_verified });
    attempts.push(withoutCanonical);
  }
  let lastError: { message?: string } | null = null;
  for (const next of attempts) {
    const { error } = await supabase.from('profiles').update(next as never).eq('id', id);
    if (!error) return;
    lastError = error;
    if (!String(error.message ?? '').includes('does not exist')) break;
  }
  throwIf(lastError, 'Could not update this person.');
}

/**
 * @purpose Pending athlete verification queue.
 * @sideEffects `verification_requests` SELECT.
 */
export async function fetchVerificationQueue(): Promise<VerificationRequest[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('status', 'pending')
    .order('id', { ascending: false })
    .limit(40);
  throwIf(error, 'Could not load verification requests.');
  if (!Array.isArray(data)) return [];
  return data as VerificationRequest[];
}

/**
 * @purpose Approve or reject a verification request. Only the requesting account is stamped —
 *   never "every profile with this name" (the old name stamp could verify strangers).
 * @sideEffects `admin_decide_verification` RPC (request + requester profile + roster link);
 *   on approve, `admin_approve_player_consent` for the linked `players` row.
 */
export async function setVerificationStatus(
  id: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const approve = status === 'approved';
  const { error } = await supabase.rpc('admin_decide_verification', {
    request_id: id,
    approve,
    note: note?.trim() || null,
  });
  throwIf(error, 'Could not update this request.');
  if (!approve) return;

  const { data } = await supabase.from('verification_requests').select('player_id').eq('id', id).maybeSingle();
  if (data?.player_id) {
    // 2026-09 audit item 2: consent columns are only writable through this admin-only RPC.
    const { error: playerError } = await supabase.rpc('admin_approve_player_consent', {
      target_player_id: data.player_id,
    });
    throwIf(playerError, 'Verified the request, but could not update the player row.');
  }
}

/**
 * @purpose Load booster rows for Local Top Boosters.
 * @sideEffects `sponsorships` SELECT.
 */
export async function fetchAdminBoosters(): Promise<Sponsorship[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sponsorships')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);
  throwIf(error, 'Could not load boosters.');
  return (Array.isArray(data) ? data : []) as Sponsorship[];
}

/**
 * @purpose Create or edit a booster so Local Top Boosters updates.
 * @sideEffects `sponsorships` INSERT or UPDATE.
 */
export async function upsertBooster(
  input: Partial<Sponsorship> & { business_name: string; amount_cents: number },
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const name = input.business_name.trim();
  if (!name) throw new Error('Add a business name.');
  const payload = {
    business_name: name,
    school_team: (input.school_team ?? '').trim(),
    logo_url: (input.logo_url ?? '').trim(),
    tier: input.tier === 'gold' || input.tier === 'platinum' ? input.tier : 'silver',
    amount_cents: Math.max(0, asInt(input.amount_cents)),
    aura_points: Math.max(0, asInt(input.aura_points)),
    billing_interval: input.billing_interval || 'month',
    status: (input.status ?? 'active').trim() || 'active',
  };
  const { error } = input.id
    ? await supabase.from('sponsorships').update(payload).eq('id', input.id)
    : await supabase.from('sponsorships').insert(payload);
  throwIf(error, 'Could not save this booster.');
}

export type MaloOriginBar = { label: string; cents: number; count: number };

/**
 * @purpose Disbursement queue for athlete payouts.
 * @sideEffects `disbursements` SELECT.
 */
export async function fetchAdminDisbursements(): Promise<Disbursement[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('disbursements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error || !Array.isArray(data)) return [];
  return data as Disbursement[];
}

/**
 * @purpose Queue a custodial payout against an athlete (demo $50 path).
 * @sideEffects `disbursements` INSERT.
 */
export async function queueDisbursement(playerId: string, amountCents = 5000): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!playerId) throw new Error('Select an athlete.');
  const { error } = await supabase.from('disbursements').insert({
    player_id: playerId,
    amount_cents: Math.max(100, asInt(amountCents)),
    status: 'queued',
  });
  throwIf(error, 'Could not queue this disbursement.');
}

/**
 * @purpose Mark a queued payout paid or failed.
 * @sideEffects `disbursements` UPDATE.
 */
export async function setDisbursementStatus(id: string, status: 'queued' | 'paid' | 'failed'): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('disbursements').update({ status }).eq('id', id);
  throwIf(error, 'Could not update this disbursement.');
}

export type AdminPublishDesk = {
  liveGames: Game[];
  parkedGames: Game[];
  restoreClips: AdminHighlightRow[];
  vaultClips: AdminHighlightRow[];
  flaggedClips: AdminHighlightRow[];
  hiddenDrip: ShopProduct[];
  inactivePolls: CheerPoll[];
  activePolls: CheerPoll[];
  currentSpotlight: SpotlightAward | null;
};

/**
 * @purpose Go-live queue: parked matches, hidden Drip, inactive polls, vault/removed clips, current Spotlight.
 * @sideEffects Parallel SELECTs already used by the individual desks.
 */
export async function fetchAdminPublishDesk(): Promise<AdminPublishDesk> {
  const empty: AdminPublishDesk = {
    liveGames: [],
    parkedGames: [],
    restoreClips: [],
    vaultClips: [],
    flaggedClips: [],
    hiddenDrip: [],
    inactivePolls: [],
    activePolls: [],
    currentSpotlight: null,
  };
  if (!isSupabaseConfigured) return empty;

  const [games, clips, drip, polls, awards] = await Promise.all([
    fetchAdminGames(),
    fetchAdminHighlights(),
    fetchAdminShopProducts(),
    fetchAdminPolls(),
    fetchAdminSpotlightAwards(),
  ]);

  const currentSpotlight = awards.find((row) => row.is_active !== false) ?? awards[0] ?? null;

  return {
    liveGames: games.filter((game) => game.is_active !== false),
    parkedGames: games.filter((game) => game.is_active === false),
    restoreClips: clips.filter((row) => row.is_removed),
    vaultClips: clips.filter((row) => row.is_vault_only && !row.is_removed).slice(0, 8),
    flaggedClips: clips.filter((row) => row.is_flagged && !row.is_removed),
    hiddenDrip: drip.filter((row) => row.is_active === false),
    inactivePolls: polls.filter((row) => row.is_active === false),
    activePolls: polls.filter((row) => row.is_active !== false),
    currentSpotlight,
  };
}

/**
 * @purpose Load school cheer polls for the Polls tool.
 * @sideEffects `cheer_polls` SELECT.
 */
export async function fetchAdminPolls(): Promise<CheerPoll[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('cheer_polls').select('*').order('updated_at', { ascending: false });
  throwIf(error, 'Could not load polls.');
  return (Array.isArray(data) ? data : []) as CheerPoll[];
}

/**
 * @purpose Publish a School Poll so Local shows the matchup and labels.
 * @sideEffects `upsert_cheer_poll` RPC; `cheer_polls` UPSERT fallback.
 */
export async function upsertAdminPoll(input: {
  slug: string;
  home_label: string;
  away_label: string;
  is_active?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const slug = slugify(input.slug);
  if (!slug) throw new Error('Add a poll slug.');
  const { error } = await supabase.rpc('upsert_cheer_poll', {
    poll_slug: slug,
    home_name: input.home_label.trim() || 'Home',
    away_name: input.away_label.trim() || 'Away',
    make_active: input.is_active !== false,
  });
  if (!error) return;
  const { error: upsertError } = await supabase.from('cheer_polls').upsert(
    {
      slug,
      home_label: input.home_label.trim() || 'Home',
      away_label: input.away_label.trim() || 'Away',
      is_active: input.is_active !== false,
    },
    { onConflict: 'slug' },
  );
  throwIf(upsertError, error.message || 'Could not save this poll.');
}

/**
 * @purpose Zero the vote bars on a School Poll without deleting it.
 * @sideEffects `cheer_polls` UPDATE.
 */
export async function resetAdminPollVotes(slug: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('cheer_polls')
    .update({ home_votes: 0, away_votes: 0, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  throwIf(error, 'Could not reset this poll.');
}

export type AdminPollCard = { slug: string; homeLabel: string; awayLabel: string };

/**
 * @purpose Active School Polls for Local. Empty means the fan hub should keep its game-derived fallback.
 * @sideEffects `cheer_polls` SELECT.
 */
export async function fetchActiveCheerPollCards(): Promise<AdminPollCard[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('cheer_polls')
    .select('slug, home_label, away_label, is_active')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => ({
      slug: asText(row.slug),
      homeLabel: asText(row.home_label, 'Home'),
      awayLabel: asText(row.away_label, 'Away'),
    }))
    .filter((row) => row.slug);
}
