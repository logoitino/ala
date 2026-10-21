import {
  isPhotoStory,
  isSekiHighlight,
  labeledReelCategories,
  parseReelCategory,
  PHOTO_DESCRIPTION_MAX,
  PHOTO_STORY_MAX_PHOTOS,
  homePagerClips,
  pinFeedOrder,
  rankHomeFeed,
  REEL_CATEGORY_PILLS,
} from '@/data/highlights';
import type { HighlightClip } from '@/data/highlights';

type Row = { clip: { id: string; athleteName: string; sekiCount: number; auraCount: number; flexCount: number } };

const row = (id: string, sekiCount: number): Row => ({
  clip: { id, athleteName: id, sekiCount, auraCount: 0, flexCount: 0 },
});

describe('pinFeedOrder', () => {
  it('keeps the ranked order when an un-Seki would have re-ranked the clip (regression: feed jumped under the finger)', () => {
    const before = [row('b', 2), row('a', 3), row('c', 0)];
    const order = rankHomeFeed(before as never, { crewIds: new Set() }).map((item) => item.clip.id);
    expect(order).toEqual(['a', 'b', 'c']);

    // Un-Seki on "a": re-ranking would drop it below "b" and, on the Seki pill, remove it outright.
    const after = [row('b', 2), row('a', 2), row('c', 0)];
    expect(rankHomeFeed(after as never, { crewIds: new Set() }).map((item) => item.clip.id)).not.toEqual(order);
    expect(isSekiHighlight(after[1].clip)).toBe(false);

    const pinned = pinFeedOrder(order, after);
    expect(pinned.map((item) => item.clip.id)).toEqual(['a', 'b', 'c']);
    expect(pinned[0].clip.sekiCount).toBe(2);
    expect(pinned[0]).toBe(after[1]);
  });

  it('pages uploaded clips and leaves empty samples off once a file exists', () => {
    type Item = { clip: Pick<HighlightClip, 'videoUrl' | 'mediaType' | 'photoCount'> };
    const sample: Item = { clip: { videoUrl: '', mediaType: undefined, photoCount: 0 } };
    const upload: Item = { clip: { videoUrl: 'https://example.com/a.mp4', mediaType: undefined, photoCount: 0 } };
    const story: Item = { clip: { videoUrl: '', mediaType: 'photo_story', photoCount: 2 } };
    const brokenStory: Item = { clip: { videoUrl: '', mediaType: 'photo_story', photoCount: 0 } };
    expect(homePagerClips([upload, brokenStory], [sample])).toEqual([upload]);
    expect(homePagerClips([story], [sample])).toEqual([story]);
    expect(homePagerClips([brokenStory], [sample])).toEqual([sample]);
  });

  it('drops ids that are no longer in the list', () => {
    expect(pinFeedOrder(['x', 'a'], [row('a', 0)]).map((item) => item.clip.id)).toEqual(['a']);
  });
});

describe('photo stories and the Game Day label (UX-05)', () => {
  it('isPhotoStory is true only for photo_story; missing media type is a video', () => {
    expect(isPhotoStory({ mediaType: 'photo_story' })).toBe(true);
    expect(isPhotoStory({ mediaType: 'video' })).toBe(false);
    expect(isPhotoStory({})).toBe(false);
  });

  it('caps a story at 10 photos and descriptions at 200 characters', () => {
    expect(PHOTO_STORY_MAX_PHOTOS).toBe(10);
    expect(PHOTO_DESCRIPTION_MAX).toBe(200);
  });

  it('labels the game_play category "Game Day" (owner rename 2026-10-07) while the stored id stays game_play', () => {
    const game = REEL_CATEGORY_PILLS.find((pill) => pill.id === 'game_play');
    expect(game?.label).toBe('⚡ Game Day');
    expect(REEL_CATEGORY_PILLS.some((pill) => /Game Play/.test(pill.label))).toBe(false);
    expect(parseReelCategory(undefined)).toBe('game_play');
    expect(labeledReelCategories(null)[0]).toEqual({ id: 'game_play', label: '⚡ Game Day' });
  });
});
