/** Paid records use their initiating transport and surface denial for support rather than a false completion. */
import { recordDripOrder } from '@/lib/finance';
import { insertSubscription } from '@/lib/subscriptions';
const mockGlobal = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: (...args: unknown[]) => mockGlobal(...args) } }));
it('reports a denied paid Drip record and never adopts the global client', async () => {
  const insert = jest.fn(async () => ({ error: new Error('denied') }));
  const client = { from: jest.fn(() => ({ insert })) } as never;
  await expect(recordDripOrder({ productId: 'hoodie', amountCents: 4500, qty: 1, buyerId: 'A' }, client)).rejects.toThrow('denied');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ buyer_id: 'A', amount_cents: 4500 }));
  expect(mockGlobal).not.toHaveBeenCalled();
});
it('records the exclusive pass through the bound client', async () => {
  const insert = jest.fn(async () => ({ error: null }));
  await expect(insertSubscription('A', 'athlete', { from: () => ({ insert }) } as never)).resolves.toEqual({ ok: true });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ subscriber_id: 'A' }));
  expect(mockGlobal).not.toHaveBeenCalled();
});
