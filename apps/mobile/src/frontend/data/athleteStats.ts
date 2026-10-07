/**
 * Athlete Stats and Aura share one sport playbook and recorded values. Position inference must be unambiguous;
 * missing live data stays missing, while generated numbers belong only to explicit demo identities.
 */

import { GENERIC_SPORT_CONFIG, SPORT_CONFIG_SEEDS, statLabelFor, visibleStatFields,
  type SportConfig, type SportStatSource } from '@/data/sports';
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
  gamesPlayed: number | null;
  scoringValue: number | null;
  volumeValue: number | null;
  mvpBadges: number | null;
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

/** Profile statistics use exact sport identities; a blank sport must never select the first (football) console. */
export function athleteStatsPlaybookForSport(sport: string | null | undefined, configs?: SportConfig[]): SportConfig {
  const name = sport?.trim() || '';
  const match = (configs ?? []).find((row) => row.sport.trim().toLowerCase() === name.toLowerCase())
    ?? SPORT_CONFIG_SEEDS.find((row) => row.sport.trim().toLowerCase() === name.toLowerCase());
  return match ?? { ...GENERIC_SPORT_CONFIG, sport: name, statFields: [], measurables: [] };
}

/**
 * @purpose Career-table headers for any sport, read from the sport playbooks (`sport_configs` seeds).
 * @param sport Canonical profile sport or stored `athlete_career_stats.sport`.
 * @param configs Live playbooks when the caller has them; defaults to the seeded catalog.
 */
export function careerColumnsForSport(
  sport: string | null | undefined,
  configs?: SportConfig[],
): CareerColumns {
  const config = athleteStatsPlaybookForSport(sport, configs);
  return {
    scoring: statLabelFor(config, 'scoring', 'Points'),
    volume: statLabelFor(config, 'volume', 'Volume'),
  };
}

/**
 * @purpose Infer only unique, exact catalog positions when no profile or career sport is known.
 */
export function inferAthleteSport(position: string | null | undefined, stored?: string | null): string {
  const explicit = stored?.trim();
  if (explicit) return athleteStatsPlaybookForSport(explicit).sport;
  const pos = position?.trim().toLowerCase() || '';
  if (!pos) return '';
  // Some catalogues omit a shared role even though athletes use it (e.g. football fullback).
  if (['center', 'centre', 'wing', 'winger', 'forward', 'fullback', 'goalie', 'goalkeeper',
    'keeper', 'defender', 'midfield', 'midfielder', 'defense', 'attack'].includes(pos)) return '';
  // Catalog aliases are exact too: broad substrings misread volleyball blockers and shared positions.
  const aliases: Record<string, string[]> = {
    Volleyball: ['defensive specialist', 'opposite hitter'],
    Football: ['defensive end', 'defensive tackle', 'cornerback', 'safety', 'offensive guard', 'offensive tackle'],
    Rugby: ['scrum half', 'fly half'],
    Soccer: ['striker', 'keeper', 'winger'],
    'Track & Field': ['sprinter', 'distance runner', 'hurdler', 'thrower', 'jumper'],
    'Ice Hockey': ['defenseman'],
  };
  const sports = SPORT_CONFIG_SEEDS.filter((config) =>
    config.positions.some((row) => row.short.toLowerCase() === pos || row.full.toLowerCase() === pos)
      || aliases[config.sport]?.includes(pos));
  return sports.length === 1 ? sports[0].sport : '';
}

/**
 * @purpose Compact trading-card back-face stats: Games, scoring, volume.
 */
export function careerPreviewStats(career: AthleteCareerSummary, config?: SportConfig): CareerPreviewStat[] {
  const playbook = athleteStatsPlaybookForSport(career.sport, config ? [config] : undefined);
  const values: Record<SportStatSource, number | null> = {
    games: career.gamesPlayed, scoring: career.scoringValue, volume: career.volumeValue, mvp: career.mvpBadges,
  };
  return visibleStatFields(playbook).slice(0, 3).map((field) => ({
    label: field.label, value: values[field.source] ?? EMPTY,
  }));
}

/** @purpose Apply the same published sport labels and visibility to Stats and the Aura card preview. */
export function applyAthleteStatsPlaybook(stats: AthleteStatsBundle, config?: SportConfig): AthleteStatsBundle {
  const playbook = athleteStatsPlaybookForSport(stats.career.sport, config ? [config] : undefined);
  const career = { ...stats.career, columns: careerColumnsForSport(stats.career.sport, [playbook]) };
  return { ...stats, career, topThree: careerPreviewStats(career, playbook) };
}

/** @purpose Recorded measurables with unavailable career totals, never fictional games or combine numbers. */
export function emptyAthleteStats(player?: Player | null, targetSport?: string | null): AthleteStatsBundle {
  const sport = inferAthleteSport(player?.position, targetSport);
  const career: AthleteCareerSummary = { sport, gamesPlayed: null, scoringValue: null,
    volumeValue: null, mvpBadges: null, columns: careerColumnsForSport(sport) };
  return {
    physicals: { height: displayMetric(player?.height, EMPTY), weight: displayMetric(player?.weight, EMPTY),
      fortyYard: displayMetric(player?.forty_yard, EMPTY), verticalJump: displayMetric(player?.vertical_jump, EMPTY) },
    career, logs: [], topThree: careerPreviewStats(career),
  };
}

/** Explicit fixture identities are the sole automatic source of generated athlete numbers. */
export function isDemoAthleteId(id: string | null | undefined): boolean {
  return Boolean(id?.trim().startsWith('demo-') || id?.trim().startsWith('dev-'));
}

function displayMetric(value: string | null | undefined, fallback: string): string {
  const next = value?.trim();
  return next ? next : fallback;
}

/**
 * @purpose Generated Stats bundle for an explicitly identified demo athlete only.
 */
export function demoAthleteStats(player: Player, targetSport?: string | null): AthleteStatsBundle {
  const sport = inferAthleteSport(player.position, targetSport);
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
