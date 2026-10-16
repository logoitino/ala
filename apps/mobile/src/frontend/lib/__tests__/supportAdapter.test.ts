/** Support adapter keeps a failed/partial snapshot unknown and sends only bounded review metadata. */
import { fetchEngineeringSupport, recordSupportReview } from '@/lib/engineeringSupport';
import { supabase } from '@/lib/supabase';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
const setHeader = jest.fn();
beforeEach(() => { rpc.mockReset(); setHeader.mockReset(); });
it('does not turn unavailable or partial data into a clean empty incident list', async () => {
  rpc.mockResolvedValue({ data: { version: 1 }, error: null });
  expect((await fetchEngineeringSupport()).snapshot).toBeNull();
  rpc.mockResolvedValue({ data: null, error: { message: 'private detail' } });
  expect(await fetchEngineeringSupport()).toEqual({ snapshot: null, error: 'Support data could not be read. Refresh or ask Engineering to check the migration and access.' });
});
it('rejects an empty rationale without making a write', async () => {
  await expect(recordSupportReview({ fingerprint: 'highlights:render_failure:client:test:detect-02', disposition: 'resolved', rationale: '', reviewedThrough: '2026-10-13T10:00:00Z' }, 'synthetic-admin-A')).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it('sends review coverage and parent without supplied actor/time authority', async () => {
  setHeader.mockReturnValue(Promise.resolve({ data: '11111111-1111-1111-1111-111111111111', error: null })); rpc.mockReturnValue({ setHeader });
  await recordSupportReview({ fingerprint: 'highlights:render_failure:client:test:detect-02', disposition: 'investigating', rationale: 'Reproducing in preview.', reviewedThrough: '2026-10-13T10:00:00Z' }, 'synthetic-admin-A');
  expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-admin-A');
  expect(rpc).toHaveBeenCalledWith('record_support_review', { p_fingerprint: 'highlights:render_failure:client:test:detect-02', p_disposition: 'investigating', p_rationale: 'Reproducing in preview.', p_reviewed_through: '2026-10-13T10:00:00Z', p_parent_review_id: null });
});
