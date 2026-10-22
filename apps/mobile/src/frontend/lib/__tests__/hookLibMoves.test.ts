/**
 * R4-03 / PORT-01 hook moves: gift history, exclusive passes and subscriber requests now reach the database
 * through `lib/`. These pin the behaviour the hooks relied on: the receipt fallback order, the duplicate-pass rule,
 * the missing-table message and a failed read that stays distinct from "not subscribed". Database replies are synthetic.
 */
import { fetchFanTipHistory, fetchReceivedMalo } from '@/lib/donationHistory';
import { fetchRosterPlayers } from '@/lib/roster';
import { fetchActiveSubscription, insertSubscriberRequest, insertSubscription, isPlayerUuid } from '@/lib/subscriptions';

type Reply = { data?: unknown; error?: { code?: string; message: string } | null };
const mockRpc = jest.fn<Promise<Reply>, [string, Record<string, unknown>]>();
const mockFrom = jest.fn<Promise<Reply>, [string, string, string]>();

/** A thenable builder: every chained call returns itself, and awaiting it answers from `mockFrom(table, op, columns)`. */
function mockBuilder(table: string) {
  let op = 'select';
  let columns = '';
  const chain: Record<string, unknown> = {};
  for (const name of ['eq', 'order', 'limit', 'single', 'maybeSingle']) chain[name] = () => chain;
  chain.select = (cols: string) => { if (op === 'select') columns = cols; return chain; };
  chain.insert = () => { op = 'insert'; return chain; };
  chain.then = (resolve: (value: Reply) => unknown, reject: (reason: unknown) => unknown) =>
    mockFrom(table, op, columns).then(resolve, reject);
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args),
    from: (table: string) => mockBuilder(table),
  },
}));

const ATHLETE = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

describe('gift history', () => {
  it('returns null for a failed received-gifts call so the screen can show $0', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    await expect(fetchReceivedMalo('p1')).resolves.toBeNull();
  });

  it('parses received rows and drops rows without an id', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'g1', amount_cents: '500', fan_name: ' ', family_cents: 450 }, { amount_cents: 1 }], error: null });
    const rows = await fetchReceivedMalo('p1');
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ id: 'g1', amount_cents: 500, fan_name: 'Fan', family_cents: 450, reel_id: null });
  });

  it('uses the receipts function when it exists', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 't1', player_id: 'p1', amount_cents: 200, athlete_name: 'Sione' }], error: null });
    const result = await fetchFanTipHistory('u1');
    expect(mockRpc).toHaveBeenCalledWith('get_fan_tip_history', { fan_user_id: 'u1' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual({ receipts: [expect.objectContaining({ id: 't1', athlete_name: 'Sione' })], error: null });
  });

  it('falls back to the rich then the plain tips read, taking names from the players join', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'missing function' } });
    mockFrom.mockImplementation(async (_table, _op, columns) =>
      columns.includes('origin')
        ? { data: null, error: { message: 'column tips.origin does not exist' } }
        : { data: [{ id: 't1', player_id: 'p1', amount_cents: 300, players: [{ name: 'Malia', school_name: 'ALA' }] }], error: null });
    const result = await fetchFanTipHistory('u1');
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.receipts[0]).toMatchObject({ id: 't1', athlete_name: 'Malia', school_name: 'ALA', origin: 'profile' });
  });

  it('reports the database message when every receipts read fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'missing function' } });
    mockFrom.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(fetchFanTipHistory('u1')).resolves.toEqual({ receipts: [], error: 'permission denied' });
  });
});

describe('exclusive passes and subscriber requests', () => {
  it('only treats real roster ids as database ids', () => {
    expect(isPlayerUuid(ATHLETE)).toBe(true);
    expect(isPlayerUuid('sample-1')).toBe(false);
  });

  it('keeps a failed pass read distinct from "not subscribed"', async () => {
    mockFrom.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    await expect(fetchActiveSubscription('u1', ATHLETE)).resolves.toEqual({ active: false, failed: true });
    mockFrom.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchActiveSubscription('u1', ATHLETE)).resolves.toEqual({ active: false, failed: false });
    mockFrom.mockResolvedValueOnce({ data: { id: 's1', status: 'active' }, error: null });
    await expect(fetchActiveSubscription('u1', ATHLETE)).resolves.toEqual({ active: true, failed: false });
  });

  it('counts an existing pass (23505) as saved and any other rejection as not saved', async () => {
    mockFrom.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    await expect(insertSubscription('u1', ATHLETE)).resolves.toEqual({ ok: true });
    mockFrom.mockResolvedValueOnce({ error: { code: '42501', message: 'malo_target_frozen' } });
    await expect(insertSubscription('u1', ATHLETE)).resolves.toEqual({ ok: false });
    mockFrom.mockResolvedValueOnce({ error: null });
    await expect(insertSubscription('u1', ATHLETE)).resolves.toEqual({ ok: true });
  });

  it('names the SQL file when the requests table is missing', async () => {
    mockFrom.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the table public.subscriber_requests' } });
    await expect(insertSubscriberRequest('u1', ATHLETE, 'Hi')).resolves.toEqual({
      row: null,
      error: 'The subscriber_requests table is missing. Run supabase/subscriber_requests.sql in the SQL editor.',
    });
  });
});

describe('roster', () => {
  it('returns the database message and no players when the read fails', async () => {
    mockFrom.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });
    await expect(fetchRosterPlayers()).resolves.toEqual({ players: [], error: 'timeout' });
  });
});
