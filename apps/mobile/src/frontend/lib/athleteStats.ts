import {
  careerColumnsForSport,
  careerPreviewStats,
  demoAthleteStats,
  inferAthleteSport,
  type AthleteGameLogRow,
  type AthleteStatsBundle,
} from '@/data/athleteStats';
import type { AthleteCareerStat, AthleteGameLog, Player } from '@/types/database';
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

function mapLogs(rows: AthleteGameLog[] | null | undefined): AthleteGameLogRow[] {
  return (rows ?? [])
    .slice()
    .sort((left, right) => Date.parse(right.played_on) - Date.parse(left.played_on))
    .map((row) => ({
      id: row.id,
      playedOn: row.played_on,
      opponentSchool: row.opponent_school,
      statLine: row.stat_line,
      scoringValue: row.scoring_value,
      volumeValue: row.volume_value,
    }));
}

/**
 * @purpose Load combine measurables, sport-specific career totals, and recent game log for Stats 📊.
 * @param playerId `players.id`.
 * @param player Optional already-fetched roster row (avoids a second SELECT).
 * @returns Bundle for `AthleteStatsTab` + trading-card `careerPreview`. Falls back to demo numbers.
 * @sideEffects `players` SELECT; `athlete_career_stats`; `athlete_game_logs`.
 */
export async function fetchAthleteStats(
  playerId: string | null | undefined,
  player?: Player | null,
): Promise<AthleteStatsBundle> {
  const id = playerId?.trim();
  if (!id) return demoAthleteStats(asPlayer(player, 'demo-athlete'));

  if (!isSupabaseConfigured || id.startsWith('demo-') || id.startsWith('dev-')) {
    return demoAthleteStats(asPlayer(player, id));
  }

  const [playerResult, careerResult, logResult] = await Promise.all([
    player
      ? Promise.resolve({ data: player, error: null })
      : supabase.from('players').select('*').eq('id', id).maybeSingle(),
    supabase.from('athlete_career_stats').select('*').eq('player_id', id).maybeSingle(),
    supabase.from('athlete_game_logs').select('*').eq('player_id', id).order('played_on', { ascending: false }).limit(12),
  ]);

  const nextPlayer = asPlayer((playerResult.data as Player | null) ?? player, id);
  const demo = demoAthleteStats(nextPlayer);
  const careerRow = careerResult.data as AthleteCareerStat | null;
  const logs = mapLogs(logResult.data as AthleteGameLog[] | null);

  if (careerResult.error && !careerRow) return { ...demo, logs: logs.length ? logs : demo.logs };

  const sport = inferAthleteSport(nextPlayer.position, careerRow?.sport);
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
    : demo.career;

  return {
    physicals: {
      height: nextPlayer.height?.trim() || demo.physicals.height,
      weight: nextPlayer.weight?.trim() || demo.physicals.weight,
      fortyYard: nextPlayer.forty_yard?.trim() || demo.physicals.fortyYard,
      verticalJump: nextPlayer.vertical_jump?.trim() || demo.physicals.verticalJump,
    },
    career,
    logs: logs.length ? logs : demo.logs,
    topThree: careerPreviewStats(career),
  };
}
