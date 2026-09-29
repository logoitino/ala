const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  athleteMoneyNotice,
  decideWithdrawal,
  fetchCustodialSummary,
  parseBirthDateInput,
  parseCustodialSummary,
  parseDollarInput,
  pendingRequests,
  requestWithdrawal,
  type CustodialSummary,
} from '@/lib/custodial';

const PLAYER = '11111111-1111-4111-8111-111111111111';

const RAW = {
  viewer_role: 'athlete',
  player_id: PLAYER,
  athlete_name: 'Malia',
  guardian_linked: true,
  guardian_name: 'Losa',
  has_account: true,
  payouts_enabled: false,
  bank_in_athlete_name: true,
  handover_age: 18,
  handover_date: '2027-03-04',
  athlete_controls: false,
  received_cents: 12500,
  requests: [
    { id: 'r1', requested_role: 'guardian', amount_cents: 4000, note: 'Club fee', status: 'pending_athlete', created_at: '2026-09-29T00:00:00Z', decided_at: null },
    { id: 'r0', requested_role: 'guardian', amount_cents: 2000, note: '', status: 'declined', created_at: '2026-09-20T00:00:00Z', decided_at: '2026-09-21T00:00:00Z' },
    { id: 'bad', status: 'stolen' },
  ],
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe('parseCustodialSummary', () => {
  it('parses the RPC payload and drops malformed requests', () => {
    const summary = parseCustodialSummary(RAW) as CustodialSummary;
    expect(summary.viewerRole).toBe('athlete');
    expect(summary.receivedCents).toBe(12500);
    expect(summary.requests.map((r) => r.id)).toEqual(['r1', 'r0']);
    expect(pendingRequests(summary).map((r) => r.id)).toEqual(['r1']);
  });

  it('returns null when the server gives the viewer no role', () => {
    expect(parseCustodialSummary(null)).toBeNull();
    expect(parseCustodialSummary({ viewer_role: 'fan' })).toBeNull();
  });

  it('never lets the handover age fall below 18', () => {
    expect(parseCustodialSummary({ ...RAW, handover_age: 12 })?.handoverAge).toBe(18);
    expect(parseCustodialSummary({ ...RAW, handover_age: 21 })?.handoverAge).toBe(21);
  });
});

describe('athleteMoneyNotice', () => {
  const base = parseCustodialSummary(RAW) as CustodialSummary;

  it('tells a minor who holds the money, until when, and that nothing leaves without their OK', () => {
    const text = athleteMoneyNotice(base);
    expect(text).toContain("Losa's custodial account");
    expect(text).toContain('March 4, 2027');
    expect(text).toContain('without your OK');
  });

  it('hands control to the athlete after the handover date', () => {
    expect(athleteMoneyNotice({ ...base, athleteControls: true })).toContain('yours to move');
  });

  it('says a guardian is needed when none is linked', () => {
    expect(athleteMoneyNotice({ ...base, guardianLinked: false })).toContain('guardian needs to be linked');
  });
});

describe('input parsing', () => {
  it('accepts ISO and US birth dates and rejects impossible ones', () => {
    expect(parseBirthDateInput('2009-03-04')).toBe('2009-03-04');
    expect(parseBirthDateInput('3/4/2009')).toBe('2009-03-04');
    expect(parseBirthDateInput('2009-02-30')).toBeNull();
    expect(parseBirthDateInput('March 4')).toBeNull();
  });

  it('turns typed dollars into cents', () => {
    expect(parseDollarInput('$40')).toBe(4000);
    expect(parseDollarInput('12.345')).toBe(1235);
    expect(parseDollarInput('0')).toBeNull();
    expect(parseDollarInput('abc')).toBeNull();
  });
});

describe('RPC calls', () => {
  it('reports unavailable when the custodial SQL is not applied', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await expect(fetchCustodialSummary(PLAYER)).resolves.toEqual({ state: 'unavailable' });
  });

  it('stays idle without a player', async () => {
    await expect(fetchCustodialSummary(null)).resolves.toEqual({ state: 'ok', summary: null });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sends the exact RPC arguments and surfaces server refusals', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await requestWithdrawal(PLAYER, 4000, '  Club fee ');
    expect(mockRpc).toHaveBeenCalledWith('request_custodial_withdrawal', {
      target_player_id: PLAYER,
      amount_cents: 4000,
      note: 'Club fee',
    });

    mockRpc.mockResolvedValue({ data: null, error: { message: 'Only the athlete can decide' } });
    await expect(decideWithdrawal('r1', true)).rejects.toThrow('Only the athlete can decide');
  });
});
