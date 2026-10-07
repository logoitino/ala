/**
 * Fan scoreboard presentation shared by Local cards and game banners.
 * Only report the status, score and clock present in the game row; absent data is never a live game or 0–0.
 */
import type { Game } from '@/types/database';

/** Prefer the recorded team name, then its school, without inventing a team identity. */
export function gameTeamName(team?: string | null, school?: string | null): string {
  return team?.trim() || school?.trim() || 'Team TBA';
}

/** A recorded zero is a score; a missing or invalid value is not. */
export function gameScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : '—';
}

/**
 * @purpose Derive fan-facing game state without the operator helpers' default quarter/clock.
 * @returns A readable status and actual period/clock, plus a live flag for presentation only.
 */
export function gameScoreboardStatus(game: Pick<Game, 'status' | 'quarter' | 'clock' | 'is_clock_running'>) {
  const status = game.status?.trim() ?? '';
  const period = game.quarter?.trim() ?? '';
  const state = status.toLowerCase();
  const segment = period.toLowerCase();
  const terminal = ['final', 'completed', 'finished'];
  if (terminal.includes(state) || terminal.includes(segment)) {
    return { label: 'Final', detail: '', isLive: false, isScheduled: false };
  }
  // A scheduled/cancelled row can still carry the operator's prefilled Q1 and clock.
  if (['scheduled', 'upcoming', 'pregame', 'pre-game', 'not started'].includes(state)) {
    return { label: 'Scheduled', detail: 'Start time TBA', isLive: false, isScheduled: true };
  }
  if (['cancelled', 'canceled', 'postponed', 'suspended'].includes(state)) {
    return { label: state[0].toUpperCase() + state.slice(1), detail: '', isLive: false, isScheduled: false };
  }
  if (state === 'halftime' || segment === 'halftime') {
    return { label: 'Halftime', detail: '', isLive: false, isScheduled: false };
  }
  const periodCode = (period || status).replace(/^live\s+/i, '');
  const hasPeriod = /^(?:Q\d+|P\d+|H\d+|S\d+|\d+|OT\d*|ET|PK|SO|Prelims|Finals|Set\s*\d+|(?:Top|Bottom|Mid|End)\s+\d+|\d+(?:st|nd|rd|th)(?:\s+(?:half|inning|period))?)$/i.test(periodCode);
  const explicitLive = ['live', 'in progress', 'in_progress', 'in-progress'].includes(state) || /^live\s+/i.test(status);
  const isLive = explicitLive || hasPeriod || game.is_clock_running === true;
  if (!isLive) {
    return { label: status || 'Status TBA', detail: '', isLive: false, isScheduled: false };
  }
  const clock = game.clock?.trim() ?? '';
  const validClock = /^\d{1,3}:[0-5]\d$/.test(clock);
  const detail = [hasPeriod || (explicitLive && period) ? periodCode : '', validClock ? clock : ''].filter(Boolean).join(' · ');
  return { label: 'Live', detail, isLive: true, isScheduled: false };
}
