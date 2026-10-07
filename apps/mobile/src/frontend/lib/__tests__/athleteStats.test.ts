/** Recorded athlete stats must never become generated demo numbers or another sport's career totals. */
import { fetchAthleteStats } from '@/lib/athleteStats';
import type { Player } from '@/types/database';

let mockConfigured = true;
let mockCareer: unknown;
let mockLogs: unknown[];
let mockError: unknown;
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const player: Player = { id: '6bdfe860-3579-4eb0-8f80-1cb2bb702521', name: 'Ana',
  jersey_number: 0, position: 'Linebacker', height: '6 ft', school_name: 'North High', backer_count: 0 };
function query(result: unknown) {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of ['select', 'eq', 'maybeSingle', 'order', 'limit']) chain[method] = () => chain;
  return chain;
}

beforeEach(() => {
  mockConfigured = true;
  mockError = null;
  mockCareer = null;
  mockLogs = [];
  mockFrom.mockImplementation((table: string) => query({ data:
    table === 'athlete_career_stats' ? mockCareer : table === 'athlete_game_logs' ? mockLogs : player,
    error: mockError,
  }));
});

it('shows recorded physicals and missing career totals when a live athlete has no rows', async () => {
  const stats = await fetchAthleteStats(player.id, player);
  expect(stats.physicals).toEqual({ height: '6 ft', weight: '—', fortyYard: '—', verticalJump: '—' });
  expect(stats.career.gamesPlayed).toBeNull();
  expect(stats.career.scoringValue).toBeNull();
  expect(stats.logs).toEqual([]);
  expect(stats.topThree.map((row) => row.value)).toEqual(['—', '—', '—']);
});

it('does not invent career totals when the server denies or fails stats reads', async () => {
  mockError = { message: 'permission denied' };
  const stats = await fetchAthleteStats(player.id, player);
  expect(stats.career.gamesPlayed).toBeNull();
  expect(stats.logs).toEqual([]);
});

it('does not generate demo data for an unconfigured live athlete', async () => {
  mockConfigured = false;
  expect((await fetchAthleteStats(player.id, player)).career.gamesPlayed).toBeNull();
});

it('does not turn a missing player identifier into a synthetic career', async () => {
  expect((await fetchAthleteStats(null, player)).career.scoringValue).toBeNull();
});

it('keeps recorded zeroes and uses the stored volleyball sport', async () => {
  mockCareer = { player_id: player.id, sport: 'Volleyball', games_played: 4,
    scoring_value: 0, volume_value: 7, mvp_badges: 0 };
  const stats = await fetchAthleteStats(player.id, player);
  expect(stats.career).toMatchObject({ sport: 'Volleyball', gamesPlayed: 4, scoringValue: 0, volumeValue: 7 });
  expect(stats.topThree).toEqual([
    { label: 'Matches Played', value: 4 }, { label: 'Kills', value: 0 }, { label: 'Digs', value: 7 },
  ]);
});

it('rejects football values and sportless logs when the profile selects volleyball', async () => {
  mockCareer = { player_id: player.id, sport: 'Football', games_played: 8,
    scoring_value: 48, volume_value: 901, mvp_badges: 2 };
  mockLogs = [{ id: 'log', player_id: player.id, played_on: '2026-09-04',
    opponent_school: 'South High', stat_line: '2 TD · 186 yds', scoring_value: 12, volume_value: 186 }];
  const stats = await fetchAthleteStats(player.id, player, 'Volleyball');
  expect(stats.career.sport).toBe('Volleyball');
  expect(stats.career.scoringValue).toBeNull();
  expect(stats.career.volumeValue).toBeNull();
  expect(stats.logs).toEqual([]);
});

it('retains matching recorded logs without adding synthetic matches', async () => {
  mockCareer = { player_id: player.id, sport: 'Volleyball', games_played: 0,
    scoring_value: 0, volume_value: 0, mvp_badges: 0 };
  mockLogs = [{ id: 'log', player_id: player.id, played_on: '2026-09-04',
    opponent_school: 'South High', stat_line: '3 kills', scoring_value: 3, volume_value: 2 }];
  const stats = await fetchAthleteStats(player.id, player, 'Volleyball');
  expect(stats.logs).toHaveLength(1);
  expect(stats.logs[0].statLine).toBe('3 kills');
});

it('still provides intentional demo data for explicit demo ids in the selected sport', async () => {
  const stats = await fetchAthleteStats('demo-ana', { ...player, id: 'demo-ana' }, 'Volleyball');
  expect(stats.career.sport).toBe('Volleyball');
  expect(stats.career.gamesPlayed).toEqual(expect.any(Number));
});

it('does not borrow physicals or position from a stale hydrated player during navigation', async () => {
  mockConfigured = false;
  const stats = await fetchAthleteStats('new-athlete', player);
  expect(stats.physicals.height).toBe('—');
  expect(stats.career.sport).toBe('');
});
