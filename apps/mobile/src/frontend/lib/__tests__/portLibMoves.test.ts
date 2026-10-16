/**
 * PORT-01 lib moves: the fallbacks that used to live in hooks and the offline queue keep working from lib/.
 * Synthetic data only.
 */
import { fetchAuraBoard } from '@/lib/aura';
import { fetchDiscoveryGames, resolveFeaturedGameId } from '@/lib/liveGames';
import { searchLocalEntities } from '@/lib/localSearch';
import { saveReelBookmark } from '@/lib/savedReels';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  nextRealtimeTopic: (topic: string) => topic,
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// A query builder that resolves to `result` however the call chain ends.
function query(result: unknown) {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of ['select', 'eq', 'or', 'order', 'limit', 'maybeSingle', 'insert', 'delete']) chain[method] = jest.fn(() => chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

it('treats a duplicate bookmark as saved, but passes any other error through', async () => {
  mockFrom.mockReturnValueOnce(query({ error: { message: 'duplicate key value violates unique constraint' } }));
  await expect(saveReelBookmark('u1', 'r1')).resolves.toEqual({ error: null });
  const denied = { message: 'permission denied' };
  mockFrom.mockReturnValueOnce(query({ error: denied }));
  await expect(saveReelBookmark('u1', 'r1')).resolves.toEqual({ error: denied });
});

it('shows every game when the database has no is_active column', async () => {
  mockFrom
    .mockReturnValueOnce(query({ data: null, error: { message: 'column games.is_active does not exist' } }))
    .mockReturnValueOnce(query({ data: [{ id: 'g1' }], error: null }));
  await expect(fetchDiscoveryGames()).resolves.toEqual({ games: [{ id: 'g1' }], error: null });
  expect(mockFrom).toHaveBeenCalledTimes(2);
});

it('does not retry the scoreboard read for an unrelated error', async () => {
  mockFrom.mockReturnValueOnce(query({ data: null, error: { message: 'timeout' } }));
  await expect(fetchDiscoveryGames()).resolves.toEqual({ games: [], error: 'timeout' });
  expect(mockFrom).toHaveBeenCalledTimes(1);
});

it('features a running clock first, then an active game, then the newest game', async () => {
  mockFrom
    .mockReturnValueOnce(query({ data: null, error: null }))
    .mockReturnValueOnce(query({ data: null, error: { message: 'no is_active' } }))
    .mockReturnValueOnce(query({ data: { id: 'newest' }, error: null }));
  await expect(resolveFeaturedGameId()).resolves.toBe('newest');

  mockFrom.mockReset();
  mockFrom.mockReturnValueOnce(query({ data: { id: 'running' }, error: null }));
  await expect(resolveFeaturedGameId()).resolves.toBe('running');
  expect(mockFrom).toHaveBeenCalledTimes(1);
});

it('falls back to table search when search_local_entities fails', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'could not find the function' } });
  mockFrom.mockReturnValueOnce(query({ data: [{ id: 'p1', name: 'Sam Tui', school_name: 'Westlake' }], error: null }));
  await expect(searchLocalEntities('sam', 'athlete')).resolves.toEqual([
    { entity_type: 'athlete', entity_id: 'p1', title: 'Sam Tui', subtitle: 'Westlake' },
  ]);
});

it('reads the Aura board with display names, and reads profiles only when the board function is missing', async () => {
  mockRpc.mockResolvedValueOnce({ data: [{ id: 'a1', display_name: 'Lani', aura_points: 30 }], error: null });
  const board = await fetchAuraBoard(5);
  expect(board[0]).toMatchObject({ id: 'a1', full_name: 'Lani', aura_points: 30 });
  expect(mockFrom).not.toHaveBeenCalled();

  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } });
  mockFrom
    .mockReturnValueOnce(query({ data: null, error: { message: 'column username does not exist' } }))
    .mockReturnValueOnce(query({ data: [{ id: 'b1', full_name: 'Moana', aura_points: 9 }], error: null }));
  expect((await fetchAuraBoard(5))[0]).toMatchObject({ id: 'b1', full_name: 'Moana' });

  mockFrom.mockReset();
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
  await expect(fetchAuraBoard(5)).resolves.toEqual([]);
  expect(mockFrom).not.toHaveBeenCalled();
});
