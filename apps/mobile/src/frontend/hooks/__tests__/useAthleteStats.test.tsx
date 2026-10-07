/** Profile navigation never paints another athlete's loaded sport or accepts their late network response. */
import { act, renderHook } from '@testing-library/react-native';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import type { AthleteStatsBundle } from '@/data/athleteStats';
import type { Player } from '@/types/database';

const mockFetch = jest.fn();
jest.mock('@/lib/athleteStats', () => ({ fetchAthleteStats: (...args: unknown[]) => mockFetch(...args) }));
const player: Player = { id: 'player-a', name: 'Ana', jersey_number: 0, position: 'Linebacker',
  height: '', school_name: 'North High', backer_count: 0 };
function bundle(sport: string, scoringValue: number): AthleteStatsBundle {
  return { physicals: { height: '—', weight: '—', fortyYard: '—', verticalJump: '—' },
    career: { sport, gamesPlayed: 3, scoringValue, volumeValue: 7, mvpBadges: 0,
      columns: { scoring: 'scoring', volume: 'volume' } }, logs: [], topThree: [] };
}
function deferred() {
  let resolve!: (stats: AthleteStatsBundle) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AthleteStatsBundle>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => mockFetch.mockReset());

it('starts with the selected volleyball sport and unavailable totals while loading', async () => {
  mockFetch.mockReturnValue(new Promise(() => {}));
  const { result } = await renderHook(() => useAthleteStats(player.id, player, 'Volleyball'));
  expect(result.current.stats.career.sport).toBe('Volleyball');
  expect(result.current.stats.career.scoringValue).toBeNull();
});

it('discards late responses after the profile changes athlete and sport', async () => {
  const first = deferred();
  const second = deferred();
  mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result, rerender } = await renderHook(
    ({ id, sport }: { id: string; sport: string }) => useAthleteStats(id, player, sport),
    { initialProps: { id: 'player-a', sport: 'Football' } });
  await rerender({ id: 'player-b', sport: 'Volleyball' });
  expect(result.current.stats.career.sport).toBe('Volleyball');
  expect(result.current.stats.career.scoringValue).toBeNull();
  await act(async () => second.resolve(bundle('Volleyball', 9)));
  await act(async () => first.resolve(bundle('Football', 99)));
  expect(result.current.stats.career.sport).toBe('Volleyball');
  expect(result.current.stats.career.scoringValue).toBe(9);
});

it('clears previously loaded numbers when the same athlete selects a different sport', async () => {
  mockFetch.mockResolvedValueOnce(bundle('Football', 99)).mockReturnValueOnce(new Promise(() => {}));
  const { result, rerender } = await renderHook(
    ({ sport }: { sport: string }) => useAthleteStats(player.id, player, sport),
    { initialProps: { sport: 'Football' } });
  await act(async () => {});
  expect(result.current.stats.career.scoringValue).toBe(99);
  await rerender({ sport: 'Volleyball' });
  expect(result.current.stats.career.sport).toBe('Volleyball');
  expect(result.current.stats.career.scoringValue).toBeNull();
});

it('recovers from a thrown stats fetch without showing invented values or remaining busy', async () => {
  mockFetch.mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useAthleteStats(player.id, player, 'Volleyball'));
  await act(async () => {});
  expect(result.current.loading).toBe(false);
  expect(result.current.stats.career.scoringValue).toBeNull();
});

it('does not retain loaded career totals after leaving the athlete profile', async () => {
  mockFetch.mockResolvedValue(bundle('Football', 99));
  const { result, rerender } = await renderHook(
    ({ id }: { id: string | null }) => useAthleteStats(id, player, 'Football'),
    { initialProps: { id: player.id as string | null } });
  await act(async () => {});
  await rerender({ id: null });
  expect(result.current.stats.career.scoringValue).toBeNull();
  expect(result.current.loading).toBe(false);
});

it('does not paint the previous hydrated player while the next profile loads', async () => {
  mockFetch.mockReturnValue(new Promise(() => {}));
  const previousPlayer = { ...player, height: '6 ft' };
  const { result } = await renderHook(() => useAthleteStats('player-b', previousPlayer));
  expect(result.current.stats.physicals.height).toBe('—');
  expect(result.current.stats.career.sport).toBe('');
});
