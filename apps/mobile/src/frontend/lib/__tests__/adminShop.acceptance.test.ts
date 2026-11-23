/** UX-14 catalog admission: only a genuinely missing rack uses seeds; denied/failed real reads stay unavailable. */
import { fetchLiveDripItems } from '@/lib/adminShop';
import { DRIP_ITEMS } from '@/data/shop';
const mockRead = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: () => ({ select: () => ({ eq: () => ({ order: mockRead }) }) }) } }));
beforeEach(() => mockRead.mockReset());
it.each([
  { code: '42501', message: 'permission denied for table shop_products' },
  { message: 'Network read of shop_products failed' },
  { code: 'PGRST204', message: 'A column of shop_products is missing from the schema cache' },
])('never offers seeded purchasable products after a real read refusal: %j', async (error) => {
  mockRead.mockResolvedValue({ data: null, error });
  await expect(fetchLiveDripItems()).rejects.toThrow(/Could not load|could not load/);
});
it.each(['42P01', 'PGRST205'])('preserves the known missing-relation fallback for %s', async (code) => {
  mockRead.mockResolvedValue({ data: null, error: { code, message: 'shop_products is missing' } });
  await expect(fetchLiveDripItems()).resolves.toEqual(DRIP_ITEMS);
});
it('keeps a valid zero inventory and an empty published catalog truthful', async () => {
  mockRead.mockResolvedValueOnce({ data: [{ id: 'bottle', name: 'Bottle', category: 'merch', price_cents: 1800, inventory: 0, is_active: true }], error: null });
  expect((await fetchLiveDripItems())[0].inventory).toBe(0);
  mockRead.mockResolvedValueOnce({ data: [], error: null });
  await expect(fetchLiveDripItems()).resolves.toEqual([]);
});
