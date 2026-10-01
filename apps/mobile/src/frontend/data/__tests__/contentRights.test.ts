import { REEL_CATEGORY_GAME, REEL_CATEGORY_TRAIN } from '@/data/highlights';
import { reportHidesNow, rightsChecksFor, rightsReady } from '@/data/contentRights';

describe('content rights', () => {
  it('requires the real-footage line only for game play', () => {
    expect(rightsChecksFor(REEL_CATEGORY_GAME).map((row) => row.id)).toContain('game');
    expect(rightsChecksFor(REEL_CATEGORY_TRAIN).map((row) => row.id)).not.toContain('game');
  });

  it('blocks publish until every line for that category is checked', () => {
    const partial = { permission: true, sound: true, marks: true };
    expect(rightsReady(partial, REEL_CATEGORY_TRAIN)).toBe(true);
    expect(rightsReady(partial, REEL_CATEGORY_GAME)).toBe(false);
    expect(rightsReady({ ...partial, game: true }, REEL_CATEGORY_GAME)).toBe(true);
  });

  it('hides immediately for music, logos, fake footage, impersonation, or the athlete', () => {
    expect(reportHidesNow('rights', false)).toBe(true);
    expect(reportHidesNow('fake_footage', false)).toBe(true);
    expect(reportHidesNow('impersonation', false)).toBe(true);
    expect(reportHidesNow('other', false)).toBe(false);
    expect(reportHidesNow('other', true)).toBe(true);
  });
});
