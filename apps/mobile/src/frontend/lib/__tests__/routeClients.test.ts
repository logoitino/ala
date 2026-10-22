/** Role screens read and write through lib clients. The route files no longer call Supabase. */
import { updateOwnDisplayName } from '@/lib/auth';
import { setParentPlayerConsent } from '@/lib/custodial';
import { fetchRecentTips } from '@/lib/finance';
import { fetchPublicProfileForPlayer } from '@/lib/roster';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
let mockConfigured = true;

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockConfigured;
  },
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function chain(result: unknown) {
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'update']) {
    query[method] = jest.fn(() => query);
  }
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = true;
});

it('saves a display name and returns the database message', async () => {
  mockFrom.mockReturnValue(chain({ error: { message: 'denied' } }));
  await expect(updateOwnDisplayName('user-1', 'Sione')).resolves.toBe('denied');
  mockFrom.mockReturnValue(chain({ error: null }));
  await expect(updateOwnDisplayName('user-1', 'Sione')).resolves.toBeNull();
  await expect(updateOwnDisplayName('user-1', '   ')).resolves.toBe('Sign in to save your name to Profile.');
});

it('returns the guardian consent error from the RPC', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'not the guardian' } });
  await expect(setParentPlayerConsent('player-1', true)).resolves.toBe('not the guardian');
  mockRpc.mockResolvedValue({ error: null });
  await expect(setParentPlayerConsent('player-1', false)).resolves.toBeNull();
});

it('loads the newest gifts and a public profile, or nothing when the read fails', async () => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tips') return chain({ data: [{ id: 'tip-1' }] });
    return chain({ data: { player_id: 'player-1' }, error: null });
  });
  await expect(fetchRecentTips()).resolves.toEqual([{ id: 'tip-1' }]);
  // Other people's profiles come through get_public_profiles, which applies their privacy (PRIV-01).
  mockRpc.mockResolvedValueOnce({ data: [{ player_id: 'player-1' }], error: null });
  await expect(fetchPublicProfileForPlayer('player-1')).resolves.toEqual({ player_id: 'player-1' });
  expect(mockRpc).toHaveBeenLastCalledWith('get_public_profiles', { profile_ids: null, player_ids: ['player-1'], handle: null });

  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
  await expect(fetchPublicProfileForPlayer('player-1')).resolves.toBeNull();
});
