/** A missing/failed incident read cannot announce an empty QA queue. */
import { fetchAdminTelemetryDigest } from '@/lib/admin';
const mockResult = { data: null as unknown, error: null as { message: string } | null };
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: () => {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(mockResult).then(resolve) };
  for (const name of ['select', 'gte', 'order', 'limit']) chain[name] = () => chain;
  return chain;
} } }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));
it('keeps the denied read visible instead of returning a healthy empty incident list', async () => {
  mockResult.error = { message: 'Incidents denied' }; mockResult.data = null;
  expect(await fetchAdminTelemetryDigest()).toMatchObject({ error: 'Incidents denied' });
});
it('distinguishes successful empty readings from absent data', async () => {
  mockResult.error = null; mockResult.data = null;
  expect((await fetchAdminTelemetryDigest()).error).toBeTruthy();
  mockResult.data = [];
  expect(await fetchAdminTelemetryDigest()).toMatchObject({ error: null, recent: [] });
});
