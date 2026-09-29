import {
  parseRally,
  rallyDaysLeft,
  rallyDraftProblem,
  rallyProgress,
  rallyStatusLine,
  rallyTargetCents,
  type RallyDraft,
} from '@/lib/rallies';

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

const NOW = new Date('2026-09-29T12:00:00');
const draft = (overrides: Partial<RallyDraft> = {}): RallyDraft => ({
  title: 'New cleats',
  story: '',
  costKind: 'gear',
  targetDollars: '250',
  endsOn: '',
  ...overrides,
});

describe('rallyProgress', () => {
  it('shows raised of goal and caps the bar at full', () => {
    expect(rallyProgress({ raisedCents: 14000, targetCents: 25000, donationCount: 12 })).toEqual({
      fraction: 0.56,
      amountLine: '$140 of $250',
      donorsLine: '12 donations',
    });
    expect(rallyProgress({ raisedCents: 30000, targetCents: 25000, donationCount: 1 }).fraction).toBe(1);
    expect(rallyProgress({ raisedCents: 0, targetCents: 25000, donationCount: 0 }).donorsLine).toBe('Be the first to donate');
    expect(rallyProgress({ raisedCents: 550, targetCents: 1000, donationCount: 1 }).amountLine).toBe('$5.50 of $10');
  });
});

describe('rallyDaysLeft / rallyStatusLine', () => {
  it('counts whole days to the end date and never urges', () => {
    expect(rallyDaysLeft(null, NOW)).toBeNull();
    expect(rallyDaysLeft('2026-09-29', NOW)).toBe(0);
    expect(rallyDaysLeft('2026-10-09', NOW)).toBe(10);
    expect(rallyStatusLine({ status: 'live', endsOn: '2026-09-29' }, NOW)).toBe('Last day');
    expect(rallyStatusLine({ status: 'live', endsOn: '2026-09-30' }, NOW)).toBe('1 day left');
    expect(rallyStatusLine({ status: 'live', endsOn: null }, NOW)).toBe('Open');
    expect(rallyStatusLine({ status: 'pending_guardian', endsOn: null }, NOW)).toMatch(/parent or guardian/);
    expect(rallyStatusLine({ status: 'filled', endsOn: null }, NOW)).toMatch(/Goal reached/);
  });
});

describe('rallyDraftProblem', () => {
  it('accepts a real cost within the SQL limits', () => {
    expect(rallyDraftProblem(draft(), NOW)).toBeNull();
    expect(rallyDraftProblem(draft({ endsOn: '2026-12-01' }), NOW)).toBeNull();
  });

  it('rejects short names, out-of-range goals and bad dates', () => {
    expect(rallyDraftProblem(draft({ title: 'ab' }), NOW)).toMatch(/short name/);
    expect(rallyDraftProblem(draft({ targetDollars: '4' }), NOW)).toMatch(/between \$5/);
    expect(rallyDraftProblem(draft({ targetDollars: '30000' }), NOW)).toMatch(/between \$5/);
    expect(rallyDraftProblem(draft({ endsOn: '12/01/2026' }), NOW)).toMatch(/2026-12-01/);
    expect(rallyDraftProblem(draft({ endsOn: '2026-09-29' }), NOW)).toMatch(/6 months/);
    expect(rallyDraftProblem(draft({ endsOn: '2027-06-01' }), NOW)).toMatch(/6 months/);
  });

  it('turns "$1,250.50" into cents', () => {
    expect(rallyTargetCents('$1,250.50')).toBe(125050);
  });
});

describe('parseRally', () => {
  it('maps a row and falls back safely on unknown values', () => {
    const rally = parseRally({
      id: 'r1',
      player_id: 'p1',
      title: ' Travel ',
      cost_kind: 'nope',
      status: 'weird',
      target_cents: 5000,
      raised_cents: '1200',
      donation_count: 3,
    });
    expect(rally).toMatchObject({ id: 'r1', title: 'Travel', costKind: 'other', status: 'closed', raisedCents: 1200 });
    expect(parseRally({ id: 'r1' })).toBeNull();
    expect(parseRally(null)).toBeNull();
  });
});
