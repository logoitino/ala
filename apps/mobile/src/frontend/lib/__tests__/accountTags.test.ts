/**
 * Account-tag search stays quiet until the query is long enough to match a username.
 */

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { searchTaggableAccounts } from '@/lib/accountTags';

describe('searchTaggableAccounts', () => {
  beforeEach(() => mockRpc.mockReset());

  it('does not search on a one-character query', async () => {
    await expect(searchTaggableAccounts('a')).resolves.toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns labels from the search call', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'p1', label: 'kaleo' }], error: null });
    await expect(searchTaggableAccounts('ka')).resolves.toEqual([{ id: 'p1', label: 'kaleo' }]);
  });

  it('returns nothing when the function is not on the database yet', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function search_taggable_accounts' },
    });
    await expect(searchTaggableAccounts('kaleo')).resolves.toEqual([]);
  });
});
