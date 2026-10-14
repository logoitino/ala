/**
 * The shared call path must keep `supabase.rpc` bound to its client. The real client's `rpc` reads `this.rest`; a
 * detached reference threw on every call while arrow-function mocks hid it (2026-10-14).
 */
class FakeClient {
  rest = { rpc: jest.fn(async (fn: string, args: unknown) => ({ data: { fn, args }, error: null })) };
  rpc(fn: string, args: unknown) {
    return this.rest.rpc(fn, args);
  }
}
const mockClient = new FakeClient();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, get supabase() { return mockClient; } }));

import { callRpc, untypedRpc } from '@/lib/rpc';

it('calls rpc on the client itself, so a client that uses `this` works', async () => {
  await expect(untypedRpc('get_public_profiles', { handle: 'kaleo' })).resolves.toEqual({ data: { fn: 'get_public_profiles', args: { handle: 'kaleo' } }, error: null });
  await expect(callRpc('get_my_privacy')).resolves.toEqual({ fn: 'get_my_privacy', args: {} });
  expect(mockClient.rest.rpc).toHaveBeenCalledTimes(2);
});
