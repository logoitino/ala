/** BOOKS-02 data layer: a failed page discards partial money rows, the exact row count proves a read is
 * complete even when the server caps pages, a missing bookkeeping migration reads as "not switched on"
 * (not an error), and a missing column or table leaves that source unread rather than zero. Synthetic. */

type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number | null };
const mockTables: Record<string, (from: number, to: number, columns: string) => Result> = {};
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => {
      let columns = '';
      const builder = {
        select: (cols: string) => { columns = cols; return builder; },
        order: () => builder,
        range: async (from: number, to: number) => (mockTables[table] ? mockTables[table](from, to, columns) : { data: [], error: null, count: 0 }),
        in: async () => ({ data: [], error: null }),
      };
      return builder;
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { fetchBooksSnapshot, readAllRows } from '@/lib/bookkeeping';

const rows = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${offset + i}`, created_at: '2026-10-01T00:00:00Z', source: 'malo', gross_cents: 100, platform_cents: 10, payout_cents: 90 }));

beforeEach(() => {
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  mockRpc.mockReset().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_ledger_books' } });
});

it('discards rows already read when a later page fails', async () => {
  mockTables.company_revenue_logs = (from) => (from === 0 ? { data: rows(1000), error: null, count: 1500 } : { data: null, error: { message: 'timeout' } });
  const read = await readAllRows('company_revenue_logs', '*');
  expect(read).toEqual({ rows: [], truncated: false, error: 'timeout' });
});

it('keeps reading until the exact count is reached when the server caps each page', async () => {
  mockTables.company_revenue_logs = (from) => ({ data: rows(Math.min(500, 1200 - from), from), error: null, count: 1200 });
  const read = await readAllRows('company_revenue_logs', '*');
  expect(read.rows).toHaveLength(1200);
  expect(read.truncated).toBe(false);
});

it('treats a missing bookkeeping migration as not switched on and a missing column or table as unread', async () => {
  mockTables.company_revenue_logs = () => ({ data: rows(2), error: null, count: 2 });
  mockTables.disbursements = () => ({ data: [], error: null, count: 0 });
  mockTables.tips = (_from, _to, columns) => (columns.includes('cover_fee_cents')
    ? { data: null, error: { code: '42703', message: 'column tips.cover_fee_cents does not exist' } }
    : { data: [{ id: 't1', player_id: 'p1', amount_cents: 100, created_at: '2026-10-01T00:00:00Z' }], error: null, count: 1 });
  mockTables.custodial_withdrawals = () => ({ data: null, error: { code: '42P01', message: 'relation "public.custodial_withdrawals" does not exist' } });
  const snapshot = await fetchBooksSnapshot();
  expect(snapshot.manualConfigured).toBe(false);
  expect(snapshot.errors).toEqual({ revenue: null, disbursements: null, manual: null });
  expect(snapshot.input.revenue).toHaveLength(2);
  expect(snapshot.sources.coverFeeColumn).toBe(false);
  expect(snapshot.sources.tips).toHaveLength(1);
  expect(snapshot.sources.withdrawals).toBeNull();
  expect(snapshot.sourceErrors.custodial_withdrawals).toMatch(/does not exist/);
  expect(snapshot.readAt).toBeTruthy();
});

it('reads recorded entries with athlete references, closes and reopens once the migration is applied', async () => {
  mockRpc.mockResolvedValue({ data: {
    entries: [{ id: 'e1', entry_date: '2026-10-02', kind: 'refund', memo: 'Refund', lines: [{ account_code: '2000', debit_cents: 900, credit_cents: 0, athlete_ref: 'ath-11111111' }, { account_code: '1010', debit_cents: 0, credit_cents: 900 }] }],
    closes: [{ period: '2026-09', closed_at: '2026-10-01T00:00:00Z', totals: { '1010': 5 } }],
    reopens: [{ period: '2026-08', reopened_at: '2026-09-02T00:00:00Z', reason: 'Late invoice' }],
  }, error: null });
  const snapshot = await fetchBooksSnapshot();
  expect(snapshot.manualConfigured).toBe(true);
  expect(snapshot.input.manual[0].lines[0]).toEqual(expect.objectContaining({ athlete_ref: 'ath-11111111' }));
  expect(snapshot.closes[0].totals).toEqual({ '1010': 5 });
  expect(snapshot.reopens).toEqual([{ period: '2026-08', reopened_at: '2026-09-02T00:00:00Z', reason: 'Late invoice' }]);
});
