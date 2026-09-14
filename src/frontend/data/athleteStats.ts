import type { AthleteSport } from '@/data/teams';
import type { Player } from '@/types/database';

export type CareerColumns = {
  scoring: string;
  volume: string;
};

export type CareerPreviewStat = {
  label: string;
  value: string | number;
};

export type AthletePhysicals = {
  height: string;
  weight: string;
  fortyYard: string;
  verticalJump: string;
};

export type AthleteCareerSummary = {
  sport: AthleteSport | string;
  gamesPlayed: number;
  scoringValue: number;
  volumeValue: number;
  mvpBadges: number;
  columns: CareerColumns;
};

export type AthleteGameLogRow = {
  id: string;
  playedOn: string;
  opponentSchool: string;
  statLine: string;
  scoringValue: number;
  volumeValue: number;
};

export type AthleteStatsBundle = {
  physicals: AthletePhysicals;
  career: AthleteCareerSummary;
  logs: AthleteGameLogRow[];
  topThree: CareerPreviewStat[];
};

const EMPTY = '—';

/**
 * @purpose Map Football / Basketball / Rugby / Volleyball onto career-table headers.
 * @param sport Stored `athlete_career_stats.sport` or a roster position guess.
 */
export function careerColumnsForSport(sport: string | null | undefined): CareerColumns {
  const key = (sport ?? '').trim().toLowerCase();
  if (key.includes('basket')) return { scoring: 'Points', volume: 'Rebounds' };
  if (key.includes('rugby')) return { scoring: 'Tries', volume: 'Tackles' };
  if (key.includes('volley')) return { scoring: 'Kills', volume: 'Digs' };
  return { scoring: 'Points', volume: 'Yards' };
}

/**
 * @purpose Infer sport from a roster position when `athlete_career_stats.sport` is empty.
 */
export function inferAthleteSport(position: string | null | undefined, stored?: string | null): string {
  const explicit = stored?.trim();
  if (explicit) return explicit;
  const pos = (position ?? '').toLowerCase();
  if (/(guard|forward|center|wing)/.test(pos) && !pos.includes('defensive')) return 'Basketball';
  if (/(flanker|hooker|scrum|fly-half|fullback)/.test(pos)) return 'Rugby';
  if (/(setter|libero|outside|opposite)/.test(pos)) return 'Volleyball';
  return 'Football';
}

/**
 * @purpose Compact trading-card back-face stats: Games, scoring, volume.
 */
export function careerPreviewStats(career: AthleteCareerSummary): CareerPreviewStat[] {
  return [
    { label: 'Games Played', value: career.gamesPlayed },
    { label: career.columns.scoring, value: career.scoringValue },
    { label: career.columns.volume, value: career.volumeValue },
  ];
}

function displayMetric(value: string | null | undefined, fallback: string): string {
  const next = value?.trim();
  return next ? next : fallback;
}

/**
 * @purpose Offline / unseeded Stats 📊 bundle so every athlete card has combine + career numbers.
 */
export function demoAthleteStats(player: Player): AthleteStatsBundle {
  const sport = inferAthleteSport(player.position);
  const columns = careerColumnsForSport(sport);
  const seed = Math.abs(
    player.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), player.jersey_number || 7),
  );
  const gamesPlayed = 8 + (seed % 7);
  const scoringValue = sport === 'Rugby' ? 4 + (seed % 9) : 48 + (seed % 140);
  const volumeValue =
    sport === 'Basketball' ? 40 + (seed % 80) : sport === 'Volleyball' ? 30 + (seed % 90) : 900 + (seed % 1400);
  const career: AthleteCareerSummary = {
    sport,
    gamesPlayed,
    scoringValue,
    volumeValue,
    mvpBadges: seed % 4,
    columns,
  };
  const school = player.school_name?.trim() || 'Utah County';
  const logs: AthleteGameLogRow[] = [
    {
      id: `${player.id}-log-1`,
      playedOn: '2026-09-04',
      opponentSchool: school.toLowerCase().includes('lone peak') ? 'Westlake Thunder' : 'Lone Peak Knights',
      statLine: sport === 'Football' ? '2 TD · 186 yds' : `${scoringValue % 28} ${columns.scoring.toLowerCase()}`,
      scoringValue: Math.max(1, scoringValue % 28),
      volumeValue: Math.max(1, volumeValue % 220),
    },
    {
      id: `${player.id}-log-2`,
      playedOn: '2026-08-28',
      opponentSchool: 'Skyridge Sentinels',
      statLine: sport === 'Football' ? '1 TD · 142 yds' : `${Math.max(1, scoringValue % 18)} ${columns.scoring.toLowerCase()}`,
      scoringValue: Math.max(1, scoringValue % 18),
      volumeValue: Math.max(1, volumeValue % 160),
    },
    {
      id: `${player.id}-log-3`,
      playedOn: '2026-08-21',
      opponentSchool: 'Timpview Thunderbirds',
      statLine: sport === 'Football' ? '3 TD · 221 yds' : `${Math.max(2, scoringValue % 32)} ${columns.scoring.toLowerCase()}`,
      scoringValue: Math.max(2, scoringValue % 32),
      volumeValue: Math.max(2, volumeValue % 240),
    },
  ];
  return {
    physicals: {
      height: displayMetric(player.height, `6'${1 + (seed % 4)}"`),
      weight: displayMetric(player.weight, `${175 + (seed % 40)} lb`),
      fortyYard: displayMetric(player.forty_yard, `4.${50 + (seed % 40)}s`),
      verticalJump: displayMetric(player.vertical_jump, `${30 + (seed % 8)} in`),
    },
    career,
    logs,
    topThree: careerPreviewStats(career),
  };
}

export function emptyPhysicals(): AthletePhysicals {
  return { height: EMPTY, weight: EMPTY, fortyYard: EMPTY, verticalJump: EMPTY };
}
