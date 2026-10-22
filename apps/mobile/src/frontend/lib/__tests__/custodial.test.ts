/** Family account parsing and exact RPC boundaries, including rejecting a returned account for another athlete. */
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
  receivedLines,
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
  it('rejects a returned summary whose player does not match the requested athlete', async () => {
    mockRpc.mockResolvedValue({ data: { ...RAW, player_id: 'different-player' }, error: null });
    await expect(fetchCustodialSummary(PLAYER)).resolves.toEqual({ state: 'error', message: 'Could not load the family account. Please try again.' });
  });
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

describe('receivedLines (what reaches the family account)', () => {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  it('reads the family share from the summary, or null on an older database', () => {
    expect(parseCustodialSummary({ ...RAW, family_cents: 11250 })?.familyCents).toBe(11250);
    expect(parseCustodialSummary(RAW)?.familyCents).toBeNull();
  });
  it('leads with the family share and shows the gave total beside it', () => {
    expect(receivedLines(12500, 11250, money)).toEqual({ headline: '$112.50 recorded for your family account so far', detail: "Fans gave $125.00. Historical Tapua'i gift share recorded: $12.50." });
  });
  it('keeps a missing recorded share unknown rather than applying the current rate', () => {
    expect(receivedLines(12500, null, money)).toEqual({ headline: '$125.00 given', detail: "The recorded family share is unavailable. Check the original gift receipts." });
  });
});

it('says all of it is recorded when Tapua\'i kept nothing (for example the App Store fallback of 0%)', () => {
  expect(receivedLines(5000, 5000, (c) => `$${c / 100}`).detail).toBe('Fans gave $50. All of it is recorded for your family account.');
});
