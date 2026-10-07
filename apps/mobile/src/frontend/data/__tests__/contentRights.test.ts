/** Upload confirmations per category and media (video vs photo story) and report-hide rules. */
import { REEL_CATEGORY_GAME, REEL_CATEGORY_SERVE, REEL_CATEGORY_TRAIN } from '@/data/highlights';
import { reportHidesNow, rightsChecksFor, rightsReady, UPLOAD_RIGHTS_CHECKS } from '@/data/contentRights';

describe('content rights', () => {
  it('requires the real-footage line only for Game Day (game_play)', () => {
    expect(rightsChecksFor(REEL_CATEGORY_GAME).map((row) => row.id)).toContain('game');
    expect(rightsChecksFor(REEL_CATEGORY_TRAIN).map((row) => row.id)).not.toContain('game');
  });

  it('blocks publish until every line for that category is checked', () => {
    const partial = { permission: true, sound: true, marks: true };
    expect(rightsReady(partial, REEL_CATEGORY_TRAIN)).toBe(true);
    expect(rightsReady(partial, REEL_CATEGORY_GAME)).toBe(false);
    expect(rightsReady({ ...partial, game: true }, REEL_CATEGORY_GAME)).toBe(true);
  });

  it('uses the photo wording for photo stories without changing the video rules', () => {
    const photoGame = rightsChecksFor(REEL_CATEGORY_GAME, 'photo_story');
    expect(photoGame.map((row) => row.id)).toEqual(['photo_permission', 'marks', 'photo_real']);
    expect(photoGame[0].label).toBe('I took these photos or have permission from the people in them.');
    expect(rightsChecksFor(REEL_CATEGORY_SERVE, 'photo_story').map((row) => row.id)).toEqual(['photo_permission', 'marks']);
    // Video defaults are untouched: same four lines, same Game Day gate.
    expect(rightsChecksFor(REEL_CATEGORY_GAME)).toEqual(UPLOAD_RIGHTS_CHECKS);
    expect(rightsChecksFor(REEL_CATEGORY_GAME, 'video')).toEqual(UPLOAD_RIGHTS_CHECKS);
  });

  it('does not let video confirmations publish a photo story, or the reverse', () => {
    const video = { permission: true, sound: true, marks: true, game: true };
    expect(rightsReady(video, REEL_CATEGORY_GAME, 'photo_story')).toBe(false);
    const photos = { photo_permission: true, marks: true, photo_real: true };
    expect(rightsReady(photos, REEL_CATEGORY_GAME, 'photo_story')).toBe(true);
    expect(rightsReady(photos, REEL_CATEGORY_GAME)).toBe(false);
  });

  it('hides immediately for music, logos, fake footage, impersonation, or the athlete', () => {
    expect(reportHidesNow('rights', false)).toBe(true);
    expect(reportHidesNow('fake_footage', false)).toBe(true);
    expect(reportHidesNow('impersonation', false)).toBe(true);
    expect(reportHidesNow('other', false)).toBe(false);
    expect(reportHidesNow('other', true)).toBe(true);
  });
});
