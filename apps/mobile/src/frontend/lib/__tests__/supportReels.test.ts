/** A network outage must not trigger every legacy schema fallback; safe read recovery is capped at one. */
import { fetchReels } from '@/lib/reels';
import { supportSignals } from '@/services/SupportSignalManager';
const mockOrder = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: () => ({ select: () => ({ order: (...args: unknown[]) => ({ retry: () => mockOrder(...args) }) }) }), rpc: () => ({ setHeader: () => Promise.resolve({ error: null }) }) } }));

beforeEach(() => { mockOrder.mockReset(); supportSignals.configure({ enabled: true, environment: 'test', release: 'test-release', accessToken: 'synthetic-token' }); });
afterEach(() => supportSignals.dispose());
it('recovers one transient outage without cascading through old column sets', async () => {
 mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'private network detail', code: 'NETWORK_ERROR' }, status: 503 }).mockResolvedValue({ data: [], error: null, status: 200 });
 expect(await fetchReels()).toEqual([]); expect(mockOrder).toHaveBeenCalledTimes(2);
});
it('fails after two transient attempts and keeps the owning caller error', async () => {
 mockOrder.mockResolvedValue({ data: null, error: { message: 'read unavailable', code: 'NETWORK_ERROR' }, status: 503 });
 await expect(fetchReels()).rejects.toThrow('read unavailable'); expect(mockOrder).toHaveBeenCalledTimes(2);
});
it('does not retry authorization or use schema fallbacks to bypass it', async () => {
 mockOrder.mockResolvedValue({ data: null, error: { message: 'denied', code: '42501' }, status: 403 });
 await expect(fetchReels()).rejects.toThrow('denied'); expect(mockOrder).toHaveBeenCalledTimes(1);
});
it('recovers the actual SDK offline response with an empty code once', async () => {
 mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Network request failed', code: '', details: '', hint: '' }, status: 0 }).mockResolvedValue({ data: [], error: null, status: 200 });
 expect(await fetchReels()).toEqual([]); expect(mockOrder).toHaveBeenCalledTimes(2);
});
it('preserves SDK-flattened cancellation without a retry or column fallback', async () => {
 mockOrder.mockResolvedValue({ data: null, error: { message: 'AbortError: The operation was aborted.', code: '', details: '', hint: '' }, status: 0 });
 await expect(fetchReels()).rejects.toMatchObject({ name: 'AbortError' }); expect(mockOrder).toHaveBeenCalledTimes(1);
});
