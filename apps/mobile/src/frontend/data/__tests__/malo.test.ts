/** Athlete gift copy binds the zero-cut allocation to source rates and keeps optional tips separate. */
import {
  donationWhereItGoes,
  canDropMaloOnHighlight,
  maloAthleteCta,
  maloAthleteSheetSubtitle,
  MALO_PENDING_TAG_TOAST,
  MALO_UNTAGGED_TOAST,
} from '@/data/malo';
import type { Player } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';

function fakePlayer(id: string | null | undefined): Player | null {
  if (id === null) return null;
  return { id } as Player;
}

function fakeClip(overrides: Partial<Pick<HighlightClip, 'playerId' | 'tagStatus' | 'athleteName'>> = {}) {
  return {
    playerId: undefined,
    tagStatus: undefined,
    athleteName: undefined,
    ...overrides,
  } as Pick<HighlightClip, 'playerId' | 'tagStatus' | 'athleteName'>;
}

describe('canDropMaloOnHighlight', () => {
  it('blocks Malo when there is no resolvable player at all', () => {
    expect(canDropMaloOnHighlight(fakeClip(), fakePlayer(null))).toBe(false);
    expect(canDropMaloOnHighlight(fakeClip(), undefined)).toBe(false);
  });

  it('blocks Malo while the tag is pending confirmation', () => {
    const clip = fakeClip({ playerId: 'p1', tagStatus: 'pending' });
    expect(canDropMaloOnHighlight(clip, fakePlayer('p1'))).toBe(false);
  });

  it('blocks Malo when the tag was rejected', () => {
    const clip = fakeClip({ playerId: 'p1', tagStatus: 'rejected' });
    expect(canDropMaloOnHighlight(clip, fakePlayer('p1'))).toBe(false);
  });

  it('allows Malo once the tag is confirmed', () => {
    const clip = fakeClip({ playerId: 'p1', tagStatus: 'confirmed' });
    expect(canDropMaloOnHighlight(clip, fakePlayer('p1'))).toBe(true);
  });

  it('treats a clip with no explicit tagStatus as confirmed (default-on)', () => {
    const clip = fakeClip({ playerId: 'p1' });
    expect(canDropMaloOnHighlight(clip, fakePlayer('p1'))).toBe(true);
  });

  it('falls back to the resolved player id when the clip has no playerId', () => {
    const clip = fakeClip({ playerId: undefined, tagStatus: 'confirmed' });
    expect(canDropMaloOnHighlight(clip, fakePlayer('p1'))).toBe(true);
  });
});

describe('Malo copy helpers', () => {
  it('names the athlete in the CTA', () => {
    expect(maloAthleteCta('Trey Lawson')).toBe('Give to Trey Lawson');
  });

  it('falls back to a generic phrase when the athlete name is missing', () => {
    expect(maloAthleteCta(undefined)).toBe('Give to this athlete');
  });

  it('sheet subtitle clarifies the gift goes to the athlete, not the uploader', () => {
    const subtitle = maloAthleteSheetSubtitle('Trey Lawson');
    expect(subtitle).toContain('Trey Lawson');
    expect(subtitle).toContain('not whoever uploaded the clip');
  });

  it('toast copy exists for both the pending-tag and untagged cases', () => {
    expect(MALO_PENDING_TAG_TOAST.length).toBeGreaterThan(0);
    expect(MALO_UNTAGGED_TOAST.length).toBeGreaterThan(0);
  });

  it('where-it-goes line names the family account, rules out performance and says not tax-deductible', () => {
    const line = donationWhereItGoes('Trey Lawson');
    expect(line).toContain("Trey Lawson's family account");
    expect(line).toContain('never for a play or a stat');
    expect(line).toContain('not tax-deductible');
    expect(line).not.toMatch(/Mālo|tip/i);
  });
});

describe('gift allocation and the optional tip to Tapua\'i', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const malo = require('@/data/malo') as typeof import('@/data/malo');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MALO_DISCLAIMER } = require('@/data/players') as typeof import('@/data/players');

  it('discloses100% allocation and no platform cut without promising a transfer', () => {
    expect(malo.donationSplitLine('Kaleo')).toBe("100% of your gift is allocated to Kaleo's family account. Tapua'i takes no cut.");
    expect(MALO_DISCLAIMER).toMatch(/^100% of your gift is allocated to the athlete's family account\. Tapua'i takes no cut/);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MALO_ATHLETE_SHARE_BPS, MALO_PLATFORM_CUT_BPS } = require('@/data/finance') as typeof import('@/data/finance');
    expect(MALO_DISCLAIMER.startsWith(`${MALO_ATHLETE_SHARE_BPS / 100}% `)).toBe(true);
    expect(MALO_PLATFORM_CUT_BPS).toBe(0);
    expect(MALO_DISCLAIMER).toContain('Stripe processing costs may reduce');
    expect(MALO_DISCLAIMER).toContain('not a completed transfer');
  });

  it('starts the tip at 0% and computes tip cents from the donation', () => {
    expect(malo.PLATFORM_TIP_PERCENTS[0]).toBe(0);
    expect(malo.platformTipChipLabel(0)).toBe('No tip');
    expect(malo.platformTipChipLabel(10)).toBe('10%');
    expect(malo.platformTipCentsFor(10, 10)).toBe(100);
    expect(malo.platformTipCentsFor(12.5, 15)).toBe(188);
    expect(malo.platformTipCentsFor(10, 0)).toBe(0);
  });

  it('spells out where every dollar goes', () => {
    expect(malo.donationBreakdownLine({ athleteName: 'Kaleo', donationDollars: 10, feeDollars: 0, tipPercent: 0 })).toBe(
      "On a $10.00 gift: $10.00 allocated to Kaleo's family. You pay $10.00.",
    );
    expect(malo.donationBreakdownLine({ athleteName: 'Kaleo', donationDollars: 10, feeDollars: 0.5, tipPercent: 10 })).toBe(
      "On a $10.00 gift: $10.00 allocated to Kaleo's family + $0.50 toward estimated Stripe processing + $1.00 tip to Tapua'i. You pay $11.50.",
    );
  });
});
