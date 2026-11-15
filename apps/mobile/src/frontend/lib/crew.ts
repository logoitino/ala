/**
 * The Crew: follow an athlete, see Crew and Squad counts, and whether the follow is mutual ("Teammates").
 * Crew alerts (DATA-01-F2): the queue `set_reel_flash_unlock` fills is read on Activity and cleared by the fan.
 * @sideEffects `get_crew_graph` and `toggle_crew_follow` RPCs; `crew_push_queue` SELECT (own rows); `clear_my_crew_alerts` RPC.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FLASH_UNLOCK_HOURS } from '@/data/exclusive';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isMissingFunction } from '@/lib/dbErrors';
import { untypedRpc } from '@/lib/rpc';

export type CrewGraph = {
  crew_count: number;
  squad_count: number;
  following: boolean;
  mutual: boolean;
};

export type FlashUnlockResult = {
  flash_unlock_until: string;
  notified_count: number;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function followKey(athleteId: string, userId?: string | null): string {
  return userId ? `tapuai.crewFollow.${userId}.${athleteId}` : `tapuai.crewFollow.guest.${athleteId}`;
}

function emptyGraph(): CrewGraph {
  return { crew_count: 0, squad_count: 0, following: false, mutual: false };
}

function parseGraph(raw: unknown): CrewGraph | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const crew = Number(row.crew_count);
  const squad = Number(row.squad_count);
  return {
    crew_count: Number.isFinite(crew) ? Math.max(0, Math.round(crew)) : 0,
    squad_count: Number.isFinite(squad) ? Math.max(0, Math.round(squad)) : 0,
    following: Boolean(row.following),
    mutual: Boolean(row.mutual),
  };
}

/**
 * @purpose Load The Crew ⚡ / Your Squad 🛡️ counts plus whether this fan follows the athlete (and if it is mutual / Teammates).
 * @param athleteId Target `players.id`.
 * @param userId Signed-in `auth.uid()` when known.
 * @returns Graph counts. Missing table/RPC falls back to local follow flags.
 * @sideEffects `get_crew_graph` RPC; `crew_follows` SELECT fallback; AsyncStorage `tapuai.crewFollow.*`.
 */
export async function fetchCrewGraph(athleteId: string, userId?: string | null): Promise<CrewGraph> {
  const localFollow = (await AsyncStorage.getItem(followKey(athleteId, userId))) === '1';
  const fallback: CrewGraph = {
    ...emptyGraph(),
    following: localFollow,
    crew_count: localFollow ? 1 : 0,
  };
  if (!isSupabaseConfigured || !isUuid(athleteId)) return fallback;

  const { data, error } = await supabase.rpc('get_crew_graph', { target_athlete_id: athleteId });
  const parsed = parseGraph(data);
  if (!error && parsed) {
    await AsyncStorage.setItem(followKey(athleteId, userId), parsed.following ? '1' : '0');
    return parsed;
  }

  if (!userId) return fallback;

  const mine = await supabase
    .from('crew_follows')
    .select('athlete_id')
    .eq('follower_id', userId)
    .eq('athlete_id', athleteId)
    .maybeSingle();
  if (mine.error) return fallback;

  const crew = await supabase.from('crew_follows').select('follower_id', { count: 'exact', head: true }).eq('athlete_id', athleteId);
  const following = Boolean(mine.data);
  await AsyncStorage.setItem(followKey(athleteId, userId), following ? '1' : '0');
  return {
    crew_count: crew.count ?? (following ? 1 : 0),
    squad_count: 0,
    following,
    mutual: false,
  };
}

/**
 * @purpose Join or leave an athlete’s Crew.
 * @param athleteId Target `players.id`.
 * @param userId Signed-in `auth.uid()`.
 * @param join True to follow, false to leave.
 * @returns Updated graph after the write.
 * @sideEffects `toggle_crew_follow` RPC; `crew_follows` insert/delete fallback; AsyncStorage flag.
 */
export async function setCrewFollow(
  athleteId: string,
  userId: string,
  join: boolean,
): Promise<CrewGraph> {
  await AsyncStorage.setItem(followKey(athleteId, userId), join ? '1' : '0');
  if (!isSupabaseConfigured || !isUuid(athleteId)) {
    return { crew_count: join ? 1 : 0, squad_count: 0, following: join, mutual: false };
  }

  const { data, error } = await supabase.rpc('toggle_crew_follow', {
    target_athlete_id: athleteId,
    should_join: join,
  });
  const parsed = parseGraph(data);
  if (!error && parsed) {
    await AsyncStorage.setItem(followKey(athleteId, userId), parsed.following ? '1' : '0');
    return parsed;
  }

  if (join) {
    const { error: insertError } = await supabase.from('crew_follows').insert({
      follower_id: userId,
      athlete_id: athleteId,
    });
    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      throw insertError;
    }
  } else {
    const { error: deleteError } = await supabase
      .from('crew_follows')
      .delete()
      .eq('follower_id', userId)
      .eq('athlete_id', athleteId);
    if (deleteError) throw deleteError;
  }

  return fetchCrewGraph(athleteId, userId);
}

/**
 * @purpose Athlete ids this fan follows (Your Squad 🛡️) for the Home / For You mix.
 * @param userId Signed-in `auth.uid()`.
 * @returns `players.id` list. Empty for guests.
 * @sideEffects `crew_follows` SELECT.
 */
export async function fetchSquadAthleteIds(userId?: string | null): Promise<string[]> {
  if (!userId || !isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('crew_follows').select('athlete_id').eq('follower_id', userId);
  if (error || !data) return [];
  return data.map((row) => row.athlete_id).filter(Boolean);
}

export type CrewShortcut = { id: string; name: string };

/**
 * @purpose Left-rail Crew shortcuts for Expo web desktop (WEB-DESKTOP-01): followed athletes with display names.
 * @param userId Signed-in `auth.uid()`.
 * @param limit Max shortcuts (default 5).
 * @returns Named athlete rows; empty for guests / missing data. Never invents athletes.
 * @sideEffects `crew_follows` + `players` SELECT.
 */
export async function fetchCrewShortcuts(
  userId?: string | null,
  limit = 5,
): Promise<CrewShortcut[]> {
  const ids = await fetchSquadAthleteIds(userId);
  if (ids.length === 0) return [];
  const slice = ids.slice(0, Math.max(1, Math.min(limit, 8)));
  if (!isSupabaseConfigured) {
    return slice.map((id) => ({ id, name: 'Athlete' }));
  }
  const { data, error } = await supabase.from('players').select('id, name').in('id', slice);
  if (error || !Array.isArray(data)) {
    return slice.map((id) => ({ id, name: 'Athlete' }));
  }
  const byId = new Map(
    data.map((row) => {
      const id = String((row as { id?: string }).id ?? '');
      const name = String((row as { name?: string | null }).name ?? '').trim() || 'Athlete';
      return [id, name] as const;
    }),
  );
  return slice.map((id) => ({ id, name: byId.get(id) ?? 'Athlete' }));
}

function plusHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/**
 * @purpose Open a Vault clip for `FLASH_UNLOCK_HOURS` and queue a Crew push payload per follower.
 * @param reelId Vault `reels.id`.
 * @returns `flash_unlock_until` plus how many Crew rows were queued.
 * @sideEffects `set_reel_flash_unlock` RPC; `reels.flash_unlock_until` UPDATE fallback; RPC inserts `crew_push_queue`.
 */
export async function setReelFlashUnlock(reelId: string): Promise<FlashUnlockResult> {
  const fallbackUntil = plusHoursIso(FLASH_UNLOCK_HOURS);
  if (!isSupabaseConfigured || !isUuid(reelId)) {
    return { flash_unlock_until: fallbackUntil, notified_count: 0 };
  }

  const { data, error } = await supabase.rpc('set_reel_flash_unlock', { target_reel_id: reelId });
  if (!error && data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    const until =
      typeof row.flash_unlock_until === 'string' && row.flash_unlock_until.trim()
        ? row.flash_unlock_until
        : fallbackUntil;
    const notified = Number(row.notified_count);
    return {
      flash_unlock_until: until,
      notified_count: Number.isFinite(notified) ? Math.max(0, Math.round(notified)) : 0,
    };
  }

  const { error: updateError } = await supabase
    .from('reels')
    .update({ flash_unlock_until: fallbackUntil })
    .eq('id', reelId);
  if (updateError) throw updateError;
  return { flash_unlock_until: fallbackUntil, notified_count: 0 };
}

export type CrewAlert = { id: string; title: string; body: string; reelId: string | null; athleteId: string | null; createdAt: string };

/**
 * @purpose The signed-in fan's Crew alerts (Flash unlocks from athletes they follow), newest first.
 *   RLS returns only the caller's rows; a guest or a missing table returns an empty list.
 * @sideEffects `crew_push_queue` SELECT.
 */
export async function fetchMyCrewAlerts(limit = 20): Promise<CrewAlert[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('crew_push_queue').select('id, title, body, reel_id, athlete_id, created_at').order('created_at', { ascending: false }).limit(limit);
  if (error || !Array.isArray(data)) return [];
  return (data as { id: string; title: string | null; body: string | null; reel_id: string | null; athlete_id: string | null; created_at: string }[]).map((row) => ({
    id: row.id, title: row.title ?? '', body: row.body ?? '', reelId: row.reel_id, athleteId: row.athlete_id, createdAt: row.created_at,
  }));
}

/**
 * @purpose Clear every Crew alert for the signed-in fan, so the queue never grows without end.
 * @returns How many alerts were cleared.
 * @sideEffects `clear_my_crew_alerts` RPC.
 */
export async function clearMyCrewAlerts(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { data, error } = await untypedRpc<number | null>('clear_my_crew_alerts');
  if (error) throw new Error(isMissingFunction(error) ? 'Clearing alerts is not switched on yet.' : error.message || 'Could not clear alerts.');
  return Number(data) || 0;
}
