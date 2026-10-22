/** ADM-02: real client adapters preserve missing data, RPC failures and bounded fallback provenance. */
import {
  fetchAdminReportSnapshot,
  fetchAdminRevenueSnapshot,
  fetchAdminDonationBreakdown,
  fetchAdminRuntimeSnapshot,
  fetchAdminProfileSnapshot,
  fetchAdminSoftWallSnapshot,
  fetchAdminPeopleSnapshot,
  fetchAdminStockSnapshot,
} from '@/lib/adminReports';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) },
}));

function query(result: unknown) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = { then: promise.then.bind(promise) };
  for (const method of ['select', 'eq', 'not', 'or', 'gte', 'order', 'limit', 'maybeSingle', 'gt', 'lt']) {
    chain[method] = jest.fn(() => chain);
  }
  return chain;
}

beforeEach(() => { mockRpc.mockReset(); mockFrom.mockReset(); });

it('keeps partial report keys, decimal averages, empty lists and gift bands distinct', async () => {
  mockRpc.mockResolvedValue({ data: { usage: { avg_scroll_pct_7d: 12.5 }, tabs: [], donation_bands: { under_50: 0, '250_plus': 4 } }, error: null });
  const result = await fetchAdminReportSnapshot();
  expect(result.usage.avg_scroll_pct_7d).toBe(12.5);
  expect(result.tabs).toEqual([]);
  expect(result.features).toBeNull();
  expect(result.series.clips).toBeNull();
  expect(result.donationBands).toEqual({ under50: 0, from50to250: null, over250: 4 });
});

it('reports denied or failed RPCs as errors with missing data', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Admin access required' } });
  const report = await fetchAdminReportSnapshot();
  const revenue = await fetchAdminRevenueSnapshot();
  expect(report).toMatchObject({ configured: true, error: 'Admin access required', tabs: null });
  expect(revenue).toMatchObject({ configured: true, error: 'Admin access required', gross_volume_cents: null, streams: [] });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('keeps measured revenue zero and missing totals separate', async () => {
  mockRpc.mockResolvedValue({ data: { gross_volume_cents: 0 }, error: null });
  expect(await fetchAdminRevenueSnapshot()).toMatchObject({ gross_volume_cents: 0, company_net_cents: null, stripe_paid_cents: null });
});

it('never substitutes a personal tips read after gift permission denial', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Admin access required' } });
  expect(await fetchAdminDonationBreakdown()).toMatchObject({ source: null, error: 'Admin access required' });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('labels the missing-RPC 200-row gift fallback as partial', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Function not found' } });
  const listed = query({ data: [{ id: 'd1', amount_cents: 500, origin: 'highlight', created_at: '2026-10-12T00:00:00Z' }], error: null });
  mockFrom.mockReturnValue(listed);
  const result = await fetchAdminDonationBreakdown();
  expect(result.source).toBe('fallback');
  expect(result.byOrigin).toEqual([{ key: 'highlight', label: 'Highlight', cents: 500, count: 1 }]);
  expect(listed.limit).toHaveBeenCalledWith(200);
});

it('does not turn a failed runtime read into published defaults', async () => {
  mockFrom.mockReturnValue(query({ data: null, error: { message: 'Runtime unavailable' } }));
  expect(await fetchAdminRuntimeSnapshot()).toMatchObject({ configured: true, error: 'Runtime unavailable', published: {}, dirty: null });
});

it('keeps failed oversight counts and flags missing', async () => {
  mockFrom.mockReturnValue(query({ data: null, count: null, error: { message: 'Denied' } }));
  expect(await fetchAdminProfileSnapshot()).toMatchObject({ error: 'Denied', claimedAthletes: null, athleteProfiles: null, showStats: null });
  expect(await fetchAdminSoftWallSnapshot()).toMatchObject({ error: 'Denied', fanProfiles: null, fansLast7d: null, maloLive: null });
});

it('reads measured oversight counts and published flags without inventing absent values', async () => {
  mockFrom
    .mockReturnValueOnce(query({ data: { published: { profile: { showStats: false } }, published_at: 'today' }, error: null }))
    .mockReturnValueOnce(query({ count: 0, data: null, error: null }))
    .mockReturnValueOnce(query({ count: 3, data: null, error: null }));
  expect(await fetchAdminProfileSnapshot()).toMatchObject({ error: null, claimedAthletes: 0, athleteProfiles: 3, showStats: false, showVault: null });
});

it('returns people read errors rather than a successful empty roster', async () => {
  mockFrom.mockReturnValue(query({ data: null, error: { code: '42501', message: 'Profiles denied' } }));
  expect(await fetchAdminPeopleSnapshot()).toMatchObject({ configured: true, error: 'Profiles denied', people: [] });
});

it('uses an exact low-stock count without depending on a capped product list', async () => {
  const stock = query({ count: 2, data: null, error: null });
  mockFrom.mockReturnValue(stock);
  const result = await fetchAdminStockSnapshot();
  expect(stock.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  expect(stock.eq).toHaveBeenCalledWith('is_active', true);
  expect(stock.gt).toHaveBeenCalledWith('inventory', 0);
  expect(stock.lt).toHaveBeenCalledWith('inventory', 8);
  expect(result).toMatchObject({ error: null, lowStock: 2 });
});

it('keeps absent, denied and measured zero stock counts distinct', async () => {
  mockFrom.mockReturnValueOnce(query({ count: null, error: { message: 'Stock denied' } }));
  expect(await fetchAdminStockSnapshot()).toMatchObject({ error: 'Stock denied', lowStock: null });
  mockFrom.mockReturnValueOnce(query({ count: null, error: null }));
  expect(await fetchAdminStockSnapshot()).toMatchObject({ lowStock: null });
  mockFrom.mockReturnValueOnce(query({ count: 0, data: null, error: null }));
  expect(await fetchAdminStockSnapshot()).toMatchObject({ error: null, lowStock: 0 });
});

it('compares normalized runtime snapshots like the editing context does', async () => {
  mockFrom.mockReturnValue(query({ data: { draft: { tabs: { home: true } }, published: { tabs: { local: true, home: true } } }, error: null }));
  expect(await fetchAdminRuntimeSnapshot()).toMatchObject({ dirty: false });
});
