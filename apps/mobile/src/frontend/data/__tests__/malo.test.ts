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
    expect(maloAthleteCta('Trey Lawson')).toBe('Donate to Trey Lawson');
  });

  it('falls back to a generic phrase when the athlete name is missing', () => {
    expect(maloAthleteCta(undefined)).toBe('Donate to this athlete');
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
