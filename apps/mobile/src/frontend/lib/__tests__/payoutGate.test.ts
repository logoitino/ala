const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  fetchMyPayoutStatus,
  fetchPayoutAllowed,
  parseMyPayoutStatus,
  parseTeammatesToVouch,
  vouchForTeammate,
} from '@/lib/payoutGate';
import { payoutUnlockedCopy } from '@/data/verification';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('payout gate client (design §9)', () => {
  it('parses the identity path with a cap', () => {
    expect(
      parseMyPayoutStatus({ allowed: true, path: 'identity', cap_cents: 25000, reason: null, vouches: 1 }),
    ).toEqual({ allowed: true, path: 'identity', capCents: 25000, reason: null, vouches: 1 });
  });

  it('parses a held claim and ignores unknown values', () => {
    expect(parseMyPayoutStatus({ allowed: false, path: 'bogus', reason: 'needs_payout_setup' })).toEqual({
      allowed: false,
      path: null,
      capCents: null,
      reason: 'needs_payout_setup',
      vouches: 0,
    });
    expect(parseMyPayoutStatus(null)).toBeNull();
  });

  it('unknown payout state reads as held on the gift sheet', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchPayoutAllowed('p1')).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('athlete_payout_allowed', { target_player_id: 'p1' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(fetchPayoutAllowed('p1')).resolves.toBe(false);
    await expect(fetchPayoutAllowed(null)).resolves.toBe(false);
  });

  it('a missing RPC gives no payout status rather than an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function' } });
    await expect(fetchMyPayoutStatus()).resolves.toBeNull();
  });

  it('parses teammates and drops rows without a request id', () => {
    expect(
      parseTeammatesToVouch([
        { request_id: 'r1', name: 'Sione', sport: 'Rugby', class_year: '2027', jersey: '9', vouches: 2, vouched_by_me: false },
        { name: 'no id' },
      ]),
    ).toEqual([
      { requestId: 'r1', name: 'Sione', sport: 'Rugby', classYear: '2027', jersey: '9', vouches: 2, vouchedByMe: false },
    ]);
  });

  it('vouching returns the new count and surfaces server refusals', async () => {
    mockRpc.mockResolvedValueOnce({ data: 3, error: null });
    await expect(vouchForTeammate('r1')).resolves.toBe(3);
    expect(mockRpc).toHaveBeenCalledWith('vouch_for_teammate', { target_request_id: 'r1' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'You can only vouch for teammates at your school' } });
    await expect(vouchForTeammate('r1')).rejects.toThrow(/your school/);
  });

  it('cap copy counts down the vouches still needed', () => {
    expect(payoutUnlockedCopy(25000, 1)).toMatch(/up to \$250.*2 more teammates vouch for you/);
    expect(payoutUnlockedCopy(25000, 2)).toMatch(/1 more teammate vouches/);
    expect(payoutUnlockedCopy(null, 3)).toBe('Payouts are unlocked.');
  });
});
