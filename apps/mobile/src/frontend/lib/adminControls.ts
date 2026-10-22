/**
 * Admin controls for data that used to have no writer or no admin screen (DATA-01 findings F1, F3, F4):
 * athlete career stats and game logs, operator check-ins with a retention purge, school branding and
 * school staff confirmers, verification revoke and custodial terms. Every call goes through an
 * admin-guarded RPC; a missing RPC (migration not applied yet) is reported as "not switched on".
 * @sideEffects RPCs `admin_upsert_athlete_career_stats`, `admin_add_athlete_game_log`,
 *   `admin_remove_athlete_game_log`, `admin_list_operator_checkins`, `admin_purge_operator_checkins`,
 *   `admin_list_school_confirmers`, `admin_add_school_confirmer`, `admin_revoke_school_confirmer`,
 *   `admin_set_school_branding`, `admin_revoke_verification`, `admin_set_custodial_terms`.
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { mapGameLogs, type AthleteGameLogRow } from '@/data/athleteStats';
import type { AthleteGameLog } from '@/types/database';
import { isMissingColumn } from '@/lib/dbErrors';
import { callRpc, NOT_SWITCHED_ON } from '@/lib/rpc';

export { NOT_SWITCHED_ON };

const call = callRpc;

export type CareerStatsInput = { playerId: string; sport: string; gamesPlayed: number; scoringValue: number; volumeValue: number; mvpBadges: number };

/** @purpose Create or replace an athlete's career stat line (F1). */
export async function saveCareerStats(input: CareerStatsInput): Promise<void> {
  await call('admin_upsert_athlete_career_stats', {
    p_player_id: input.playerId, p_sport: input.sport, p_games_played: input.gamesPlayed,
    p_scoring_value: input.scoringValue, p_volume_value: input.volumeValue, p_mvp_badges: input.mvpBadges,
  });
}

export type GameLogInput = { playerId: string; sport?: string; playedOn: string; opponent: string; statLine: string; scoringValue: number; volumeValue: number };

/** @purpose Add one game line to an athlete's log (F1). */
export async function addGameLog(input: GameLogInput): Promise<string> {
  return String(await call('admin_add_athlete_game_log', {
    p_player_id: input.playerId, p_played_on: input.playedOn, p_opponent_school: input.opponent,
    p_stat_line: input.statLine, p_scoring_value: input.scoringValue, p_volume_value: input.volumeValue,
    ...(input.sport ? { p_sport: input.sport } : {}),
  }));
}

/** @purpose Remove a mistaken game line (F1). */
export async function removeGameLog(logId: string): Promise<void> {
  await call('admin_remove_athlete_game_log', { p_log_id: logId });
}

export type OperatorCheckin = { id: string; gigId: string | null; checkedInAt: string; latitudeApprox: number | null; longitudeApprox: number | null };

/** @purpose Recent operator check-ins with location rounded to about 1 km (F3). */
export async function fetchOperatorCheckins(limit = 50): Promise<OperatorCheckin[]> {
  const rows = await call<Record<string, unknown>[] | null>('admin_list_operator_checkins', { p_limit: limit });
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    gigId: row.gig_id ? String(row.gig_id) : null,
    checkedInAt: String(row.checked_in_at ?? ''),
    latitudeApprox: row.latitude_approx == null ? null : Number(row.latitude_approx),
    longitudeApprox: row.longitude_approx == null ? null : Number(row.longitude_approx),
  }));
}

/** @purpose Delete check-ins older than `days` (at least 7); returns how many were removed (F3). */
export async function purgeOperatorCheckins(days = 90): Promise<number> {
  return Number(await call('admin_purge_operator_checkins', { p_older_than_days: days })) || 0;
}

export type SchoolConfirmer = { id: string; fullName: string; email: string; staffRole: string; sport: string | null; active: boolean; expiresAt: string; lastUsedAt: string | null };

/** @purpose A school's staff confirmers, without their link tokens (F4). */
export async function fetchSchoolConfirmers(schoolId: string): Promise<SchoolConfirmer[]> {
  const rows = await call<Record<string, unknown>[] | null>('admin_list_school_confirmers', { target_school_id: schoolId });
  return (rows ?? []).map((row) => ({
    id: String(row.id), fullName: String(row.full_name ?? ''), email: String(row.email ?? ''), staffRole: String(row.staff_role ?? ''),
    sport: row.sport ? String(row.sport) : null, active: Boolean(row.active), expiresAt: String(row.expires_at ?? ''), lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
  }));
}

/**
 * @purpose Add a staff confirmer and return their one-time link. The token is stored hashed; this is the
 *   only time the link exists, so the desk shows it once for the admin to send to the school email (F4).
 */
export async function addSchoolConfirmer(input: { schoolId: string; name: string; email: string; role: 'athletic_director' | 'coach'; sport?: string | null }): Promise<{ id: string; link: string }> {
  const data = await call<Record<string, unknown> | string>('admin_add_school_confirmer', {
    target_school_id: input.schoolId, confirmer_name: input.name, confirmer_email: input.email, confirmer_role: input.role, confirmer_sport: input.sport || null,
  });
  const row = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>;
  return { id: String(row.id ?? ''), link: String(row.link ?? '') };
}

/** @purpose Revoke a confirmer's link (F4). */
export async function revokeSchoolConfirmer(confirmerId: string): Promise<void> {
  await call('admin_revoke_school_confirmer', { confirmer_id: confirmerId });
}

/** @purpose Set a school's crest URL (https) and colours (#RRGGBB) (F4). */
export async function setSchoolBranding(input: { schoolId: string; logoUrl: string | null; colorPrimary: string | null; colorSecondary: string | null }): Promise<void> {
  await call('admin_set_school_branding', {
    target_school_id: input.schoolId, new_logo_url: input.logoUrl || null, new_color_primary: input.colorPrimary || null, new_color_secondary: input.colorSecondary || null,
  });
}

/** @purpose Revoke a profile's verification with a note, through the verification ladder (F4). */
export async function revokeVerification(profileId: string, note: string): Promise<void> {
  await call('admin_revoke_verification', { target_profile_id: profileId, note: note || null });
}

/** @purpose Set the handover age or correct the birth date on an athlete's custodial record (F4). */
export async function setCustodialTerms(input: { playerId: string; handoverAge: number | null; birthDate: string | null }): Promise<void> {
  await call('admin_set_custodial_terms', { target_player_id: input.playerId, new_handover_age: input.handoverAge, corrected_birth_date: input.birthDate || null });
}

export type AthleteRecords = {
  career: { sport: string; gamesPlayed: number; scoringValue: number; volumeValue: number; mvpBadges: number } | null;
  logs: AthleteGameLogRow[];
  /** Bounded original legacy rows awaiting an explicit admin sport classification. */
  unassignedLogs?: AthleteGameLogRow[];
};

/**
 * @purpose Raw career line and recent game lines for one athlete, with row ids, for the admin Stats panel (F1).
 * @sideEffects `athlete_career_stats` and `athlete_game_logs` SELECT (public read).
 */
export async function fetchAthleteRecords(playerId: string, sport: string): Promise<AthleteRecords> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!playerId || !sport.trim()) throw new Error('Choose a sport before reading stats.');
  const [career, logs, unassigned] = await Promise.all([
    supabase.from('athlete_career_stats').select('sport, games_played, scoring_value, volume_value, mvp_badges').eq('player_id', playerId).eq('sport', sport).maybeSingle(),
    supabase.from('athlete_game_logs').select('id, player_id, sport, played_on, opponent_school, stat_line, scoring_value, volume_value').eq('player_id', playerId).eq('sport', sport).order('played_on', { ascending: false }).limit(20),
    callRpc<AthleteGameLog[]>('admin_list_unassigned_athlete_logs',{p_player_id:playerId,p_limit:20}),
  ]);
  // A failed read must not look like an empty record: saving zeros over real stats would destroy data.
  if (career.error || logs.error) throw new Error(isMissingColumn(career.error ?? logs.error) ? NOT_SWITCHED_ON : (career.error ?? logs.error)?.message || 'Could not read this athlete\'s stats.');
  const c = career.data as { sport: string; games_played: number; scoring_value: number; volume_value: number; mvp_badges: number } | null;
  return {
    career: c && c.sport === sport ? { sport: c.sport, gamesPlayed: c.games_played, scoringValue: c.scoring_value, volumeValue: c.volume_value, mvpBadges: c.mvp_badges } : null,
    unassignedLogs: mapGameLogs(unassigned.filter(row=>row.player_id===playerId&&row.sport===null)),
    logs: mapGameLogs((logs.data ?? []).filter(row => row.player_id === playerId && row.sport === sport) as Parameters<typeof mapGameLogs>[0]),
  };
}

/**
 * @purpose A school's current crest and colours, so the branding form starts from them (F4). The RPC writes
 *   all three columns, so a form that started blank would erase the ones not typed again.
 * @sideEffects `schools_and_teams` SELECT (public read).
 */
export async function fetchSchoolBranding(schoolId: string): Promise<{ logoUrl: string; colorPrimary: string; colorSecondary: string }> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('schools_and_teams').select('logo_url, color_primary, color_secondary').eq('id', schoolId).maybeSingle();
  if (error) throw new Error(/logo_url|color_primary|does not exist/i.test(error.message) ? NOT_SWITCHED_ON : error.message);
  const row = (data ?? {}) as { logo_url?: string | null; color_primary?: string | null; color_secondary?: string | null };
  return { logoUrl: row.logo_url ?? '', colorPrimary: row.color_primary ?? '', colorSecondary: row.color_secondary ?? '' };
}

/** Classify or correct the original game log row only if its original sport and target athlete still match. */
export async function classifyGameLogSport(logId:string,playerId:string,sport:string,expectedSport:string|null):Promise<AthleteGameLogRow> {
 const row=await callRpc<AthleteGameLog>('admin_set_athlete_game_log_sport',{p_log_id:logId,p_player_id:playerId,p_sport:sport.trim(),p_expected_sport:expectedSport});
 if(!row || row.id!==logId || row.player_id!==playerId || row.sport!==sport.trim() || typeof row.played_on!=='string')throw new Error('Could not confirm the corrected game line. Reload first.');
 return mapGameLogs([row])[0];
}
