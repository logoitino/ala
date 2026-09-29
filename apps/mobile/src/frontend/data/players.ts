import type { Player } from '@/types/database';

export type { Game, GameStatus, Player } from '@/types/database';

export const TIP_AMOUNTS = [5, 10, 25] as const;

export const AURA_PER_DOLLAR = 10;

export const FEE_AMOUNT = 0.5;

export function auraPointsForTip(tipAmount: number): number {
  return Math.max(0, Math.round(tipAmount * AURA_PER_DOLLAR));
}

export const MALO_DISCLAIMER =
  "100% of your donation (minus standard payment processing unless covered) goes directly to the athlete's custodial account — not the person who uploaded the clip.";

export const QUICK_REACTIONS = [
  { id: 'aura', label: 'Aura ⚡', reaction: 'Aura' },
  { id: 'flex', label: 'Flex 💪', reaction: 'Flex' },
  { id: 'seki', label: 'Seki 🤙', reaction: 'Seki', hint: 'Awesome' },
] as const;

export const PLAY_REACTIONS = [
  { id: 'aura', emoji: '⚡', label: 'Aura' },
  { id: 'flex', emoji: '💪', label: 'Flex' },
  { id: 'seki', emoji: '🤙', label: 'Seki', hint: 'Awesome' },
] as const;

export type PlayReactionId = (typeof PLAY_REACTIONS)[number]['id'];

export function emptyReactionCounts(): Record<PlayReactionId, number> {
  return { aura: 0, flex: 0, seki: 0 };
}

export type QuickReaction = (typeof QUICK_REACTIONS)[number];

export const SCORER_ACTIONS = ['Touchdown', 'Tackle', 'Sack'] as const;

export type ScorerAction = (typeof SCORER_ACTIONS)[number];

export function getPlayerFirstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function formatTipTotal(amount: number, includeFee: boolean, feeAmount = FEE_AMOUNT): string {
  const fee = includeFee ? feeAmount : 0;
  const total = amount + fee;
  return `Total: $${total.toFixed(2)} ($${amount.toFixed(2)} donation + $${fee.toFixed(2)} fee)`;
}

export function displayValue(value: string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

export function getTipCharge(tipAmount: number, coverFees: boolean, feeAmount = FEE_AMOUNT) {
  const fee = coverFees ? feeAmount : 0;
  const total = tipAmount + fee;
  return {
    tipAmount,
    fee,
    total,
    amountCents: Math.round(total * 100),
  };
}

export function buildPlayEventPayload(
  eventType: string,
  player: Player,
  gameId?: string,
) {
  return {
    player_id: player.id,
    event_type: eventType,
    description: `#${displayValue(player.jersey_number)} ${displayValue(player.name)} — ${eventType}`,
    ...(gameId ? { game_id: gameId } : {}),
  };
}

export const GAME_STATUSES = ['Q1', 'Q2', 'Q3', 'Q4', 'Halftime', 'Final'] as const;

export const SCORE_MACROS = [
  { label: '+6 TD', points: 6 },
  { label: '+3 FG', points: 3 },
  { label: '+1 PAT', points: 1 },
] as const;

export type NotificationPref = 'all' | 'touchdowns' | 'favorites';

export const NOTIFICATION_PREFS: { id: NotificationPref; label: string }[] = [
  { id: 'all', label: 'All Game Plays' },
  { id: 'touchdowns', label: 'Touchdowns Only' },
  { id: 'favorites', label: 'My Favorited Players Only' },
];

export function getQuarterCode(game: {
  status?: string | null;
  quarter?: string | null;
}): string {
  const status = (game.status ?? '').trim();
  const quarter = (game.quarter ?? '').trim();
  if (status.toLowerCase() === 'final' || quarter.toLowerCase() === 'final') return 'FINAL';
  if (status.toLowerCase() === 'halftime' || quarter.toLowerCase() === 'halftime') {
    return 'HALFTIME';
  }
  const raw = (quarter || status).toUpperCase().replace(/^LIVE\s+/, '');
  if (!raw || raw === 'LIVE') return 'Q1';
  return raw;
}

export function isGameClockLive(game: {
  status?: string | null;
  quarter?: string | null;
  is_clock_running?: boolean | null;
}): boolean {
  if (typeof game.is_clock_running === 'boolean') return game.is_clock_running;
  const code = getQuarterCode(game);
  return code !== 'FINAL' && code !== 'HALFTIME';
}

export function parseClockToSeconds(clock?: string | null): number | null {
  if (!clock) return null;
  const match = clock.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatQuarterClock(
  game: { status?: string | null; quarter?: string | null; clock?: string | null },
  remainingSeconds?: number,
): string {
  const quarter = getQuarterCode(game);
  if (quarter === 'FINAL' || quarter === 'HALFTIME') return quarter;
  const seconds = remainingSeconds ?? parseClockToSeconds(game.clock) ?? 4 * 60 + 15;
  return `${quarter} ${formatClock(seconds)}`;
}

export function formatActionTag(eventType: string): string {
  const label = eventType.trim() || 'Play';
  return `[${label}]`;
}

export function formatGameStatus(
  gameOrStatus: string | { status?: string | null; quarter?: string | null },
): string {
  if (typeof gameOrStatus === 'string') {
    return formatQuarterTag(gameOrStatus);
  }

  const status = (gameOrStatus.status ?? '').trim();
  const quarter = (gameOrStatus.quarter ?? '').trim();
  if (status.toLowerCase() === 'final' || quarter.toLowerCase() === 'final') return 'FINAL';
  if (status.toLowerCase() === 'halftime' || quarter.toLowerCase() === 'halftime') {
    return 'HALFTIME';
  }
  return formatQuarterTag(quarter || status);
}

function formatQuarterTag(value: string): string {
  const normalized = value.trim();
  if (!normalized) return 'LIVE';
  if (normalized.toLowerCase() === 'final') return 'FINAL';
  if (normalized.toLowerCase() === 'halftime') return 'HALFTIME';
  if (normalized.toLowerCase() === 'live') return 'LIVE';
  if (normalized.toUpperCase().startsWith('LIVE')) return normalized.toUpperCase();
  return `LIVE ${normalized.toUpperCase()}`;
}

export function gameMatchesQuery(
  game: { home_team: string; away_team: string; home_school: string; away_school: string; venue: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    game.home_team,
    game.away_team,
    game.home_school,
    game.away_school,
    game.venue,
  ].some((value) => value.toLowerCase().includes(needle));
}

export function eventMatchesNotificationPref(
  event: { player_id?: string | null; event_type: string; description: string },
  pref: NotificationPref,
  favoritePlayerIds: string[],
): boolean {
  if (pref === 'all') return true;
  if (pref === 'touchdowns') {
    const haystack = `${event.event_type} ${event.description}`.toLowerCase();
    return haystack.includes('touchdown') || haystack.includes(' td') || haystack.endsWith('td');
  }
  return Boolean(event.player_id && favoritePlayerIds.includes(event.player_id));
}

export function playerBelongsToSchool(
  player: Player | null | undefined,
  school?: string | null,
): boolean {
  if (!school) return false;
  const needle = school.trim().toLowerCase();
  if (!needle) return false;
  return [player?.school_name, player?.team_name, player?.team]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle) || needle.includes(value.toLowerCase()));
}
