/**
 * Load recorded profile statistics for the athlete's canonical sport. Missing or denied live records stay empty;
 * generated numbers are restricted to demo identities and another sport's totals are never relabelled.
 * @sideEffects Reads `players`, `athlete_career_stats` and `athlete_game_logs` through Supabase.
 */
import {
  careerColumnsForSport,
  careerPreviewStats,
  demoAthleteStats,
  emptyAthleteStats,
  inferAthleteSport,
  isDemoAthleteId,
  mapGameLogs,
  type AthleteStatsBundle,
} from '@/data/athleteStats';
import type { AthleteCareerStat, AthleteGameLog, Player } from '@/types/database';
import { isAuraUuid } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function asPlayer(row: Player | null | undefined, fallbackId: string): Player {
  if (row) return row;
  return {
    id: fallbackId,
    name: 'Athlete',
    jersey_number: 0,
    position: '',
    height: '',
    school_name: '',
    backer_count: 0,
  };
}

/**
 * @purpose Load combine measurables, sport-specific career totals, and recent game log for Stats 📊.
 * @param playerId `players.id`.
 * @param player Optional already-fetched roster row (avoids a second SELECT).
 * @param targetSport Explicit selected sport on the linked athlete's profile, when available.
 * @returns Recorded bundle for Stats and Aura; missing totals are null and missing logs are empty.
 * @sideEffects `players` SELECT; `athlete_career_stats`; `athlete_game_logs`.
 */
export async function fetchAthleteStats(
  playerId: string | null | undefined,
  player?: Player | null,
  targetSport?: string | null,
): Promise<AthleteStatsBundle> {
  const id = playerId?.trim();
  // A route can change ids before its old roster request completes; that row belongs to another athlete.
  const hydratedPlayer = player?.id === id ? player : null;
  const initial = emptyAthleteStats(hydratedPlayer, targetSport);
  if (!id) return initial;

  if (isDemoAthleteId(id)) return demoAthleteStats(asPlayer(hydratedPlayer, id), targetSport);
  if (!isSupabaseConfigured || !isAuraUuid(id)) return initial;

  const requested = targetSport?.trim() || null;
  let careerQuery = supabase.from('athlete_career_stats').select('*').eq('player_id', id);
  if (requested) careerQuery = careerQuery.eq('sport', requested);
  const [playerResult, careerResult] = await Promise.all([
    hydratedPlayer ? Promise.resolve({ data: hydratedPlayer, error: null })
      : supabase.from('players').select('*').eq('id', id).maybeSingle(),
    careerQuery.limit(requested ? 1 : 2),
  ]);
  const nextPlayer = asPlayer((playerResult.data as Player | null) ?? hydratedPlayer, id);
  const raw = careerResult.error ? [] : careerResult.data;
  const careers = (Array.isArray(raw) ? raw : raw ? [raw] : []) as AthleteCareerStat[];
  // The legacy no-target caller works only with one stored sport; ambiguous rows never borrow position defaults.
  const candidates = requested ? careers.filter(c => c.sport === requested) : careers;
  const careerRow = candidates.length === 1 ? candidates[0] : null;
  const sport = requested || careerRow?.sport || (careers.length > 1 ? '' : inferAthleteSport(nextPlayer.position));
  let logs: ReturnType<typeof mapGameLogs> = [];
  if (sport) {
    const logResult = await supabase.from('athlete_game_logs').select('*').eq('player_id', id).eq('sport', sport)
      .order('played_on', { ascending: false }).limit(12);
    // Filter again at the mapping boundary so malformed/mock/legacy responses cannot mix sport histories.
    if (!logResult.error && Array.isArray(logResult.data)) logs = mapGameLogs((logResult.data as AthleteGameLog[])
      .filter(log => log.player_id === id && log.sport === sport));
  }
  const empty = emptyAthleteStats(nextPlayer, sport);
  const columns = careerColumnsForSport(sport);
  const career = careerRow
    ? {
        sport,
        gamesPlayed: careerRow.games_played,
        scoringValue: careerRow.scoring_value,
        volumeValue: careerRow.volume_value,
        mvpBadges: careerRow.mvp_badges,
        columns,
      }
    : empty.career;

  return {
    physicals: empty.physicals,
    career,
    logs,
    topThree: careerPreviewStats(career),
  };
}
