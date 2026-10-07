/**
 * Account-tag search stays quiet until the query is long enough to match a username.
 */

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { attachAccountTags, confirmAccountTag, searchTaggableAccounts } from '@/lib/accountTags';

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

describe('account-tag writes', () => {
  beforeEach(() => mockRpc.mockReset());
  it('keeps publishing compatible with a missing attachment RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(attachAccountTags('r1', ['p1'])).resolves.toBe(0);
  });
  it.each([
    { code: '42501', message: 'permission denied for reel_account_tags' },
    { code: '23503', message: 'reel_account_tags violates foreign key' },
    { code: 'XX000', message: 'schema cache failure unrelated to a missing function' },
  ])('does not hide a deployed attachment failure: $code', async (error) => {
    mockRpc.mockResolvedValue({ data: null, error });
    await expect(attachAccountTags('r1', ['p1'])).rejects.toThrow('Could not save the account mentions.');
  });
  it('sends at most three profiles and returns a verified count', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });
    await expect(attachAccountTags('r1', ['p1', 'p2', 'p3', 'p4'])).resolves.toBe(3);
    expect(mockRpc).toHaveBeenCalledWith('tag_reel_accounts', { target_reel_id: 'r1', profile_ids: ['p1', 'p2', 'p3'] });
  });
  it('does not report malformed attachment results as zero successful mentions', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(attachAccountTags('r1', ['p1'])).rejects.toThrow('Could not verify');
  });
  it.each([
    ['confirm', 'confirmed', true], ['reject', 'rejected', true],
    ['confirm', null, false], ['reject', null, false],
    ['confirm', 'rejected', false], ['reject', 'confirmed', false],
  ] as const)('answers %s successfully only for the actual SQL state: %s', async (action, data, expected) => {
    mockRpc.mockResolvedValue({ data, error: null });
    await expect(confirmAccountTag('t1', action)).resolves.toBe(expected);
  });
  it('does not confirm when the RPC failed even if a status is included', async () => {
    mockRpc.mockResolvedValue({ data: 'confirmed', error: { code: '42501' } });
    await expect(confirmAccountTag('t1', 'confirm')).resolves.toBe(false);
  });
});
