/** PORT-01: the cheer vote call and its older-database fallback live in one lib module. Synthetic data. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { castCheerVote } from '@/lib/cheerPoll';

beforeEach(() => mockRpc.mockReset());

it('sends the team names, and retries without them on an older database', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'function cast_cheer_vote(home_name) does not exist' } })
    .mockResolvedValueOnce({ data: { home_votes: 3 }, error: null });
  const result = await castCheerVote({ slug: 'g1', side: 'home', previousSide: null, homeName: 'Hawks', awayName: 'Owls' });
  expect(mockRpc).toHaveBeenNthCalledWith(1, 'cast_cheer_vote', { poll_slug: 'g1', side: 'home', previous_side: null, home_name: 'Hawks', away_name: 'Owls' });
  expect(mockRpc).toHaveBeenNthCalledWith(2, 'cast_cheer_vote', { poll_slug: 'g1', side: 'home', previous_side: null });
  expect(result).toEqual({ data: { home_votes: 3 }, error: null });
});

it('makes one call when the first succeeds', async () => {
  mockRpc.mockResolvedValueOnce({ data: { home_votes: 1 }, error: null });
  await castCheerVote({ slug: 'g1', side: 'away', previousSide: 'home' });
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
