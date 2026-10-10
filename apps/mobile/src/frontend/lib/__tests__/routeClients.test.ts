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

it('loads the newest donations and a public profile, or nothing when the read fails', async () => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tips') return chain({ data: [{ id: 'tip-1' }] });
    return chain({ data: { player_id: 'player-1' }, error: null });
  });
  await expect(fetchRecentTips()).resolves.toEqual([{ id: 'tip-1' }]);
  await expect(fetchPublicProfileForPlayer('player-1')).resolves.toEqual({ player_id: 'player-1' });

  mockFrom.mockReturnValue(chain({ data: null, error: { message: 'missing' } }));
  await expect(fetchPublicProfileForPlayer('player-1')).resolves.toBeNull();
});
