/** VERIFY-02 client: argument names match the SQL and malformed overview rows are dropped. Synthetic data. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { adminDecidePayoutOverride, adminRecordPayeeCheck, adminRequestPayoutOverride, parsePayeeOverview } from '@/lib/payeeVerification';

beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: null, error: null }));

it('sends the exact argument names', async () => {
  await adminRecordPayeeCheck('pl1', 'g1', 'document_review', true, 'Birth certificate viewed, not kept');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_record_payee_check', { target_player_id: 'pl1', subject: 'g1', check_method: 'document_review', passed: true, p_reason: 'Birth certificate viewed, not kept', provider_ref: null });
  await adminRequestPayoutOverride('g1', null, false, 'Bank flagged the account');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_request_payout_override', { subject: 'g1', target_player_id: null, enable: false, p_reason: 'Bank flagged the account' });
  mockRpc.mockResolvedValueOnce({ data: 'rejected', error: null });
  await expect(adminDecidePayoutOverride('o1', false)).resolves.toBe('rejected');
});

it('drops malformed rows and unknown methods', () => {
  const o = parsePayeeOverview({
    athletes: [{ player_id: 'pl1', missing: ['identity', 'nonsense'], payout: { allowed: false, reason: 'needs_payee_verification' } }, { name: 'no id' }],
    checks: [{ id: 'v1', method: 'stripe_connect_kyc', status: 'verified', checks: { identity: true, tin: 'yes' } }, { id: 'v2', method: 'guess' }],
  });
  expect(o.athletes).toHaveLength(1);
  expect(o.athletes[0].missing).toEqual(['identity']);
  expect(o.checks.map((c) => c.id)).toEqual(['v1']);
  expect(o.checks[0].checks).toEqual({ identity: true, tin: false });
});
