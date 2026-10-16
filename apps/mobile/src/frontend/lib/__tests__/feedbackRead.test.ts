/** Strict desk reads expose denied/malformed feedback instead of certifying an empty queue. */
import { fetchAppFeedback } from '@/lib/feedback';
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
it('keeps strict feedback failures visible while retaining the legacy optional empty behavior', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'Feedback denied' } });
  await expect(fetchAppFeedback({ strict: true })).rejects.toThrow('Feedback denied');
  expect(await fetchAppFeedback()).toEqual([]);
});
it('distinguishes successful empty strict reads from missing data', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });
  await expect(fetchAppFeedback({ strict: true })).rejects.toThrow('returned no data');
  mockRpc.mockResolvedValue({ data: [], error: null });
  expect(await fetchAppFeedback({ strict: true })).toEqual([]);
});
