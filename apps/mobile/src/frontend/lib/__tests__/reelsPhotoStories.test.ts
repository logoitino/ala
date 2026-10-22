/**
 * Photo stories in the Highlights data layer (UX-05): media columns map onto the clip, a database without
 * the photo-story columns falls back to the older tier (every row is a video), and stories whose photo
 * list never published (`photo_count` 0) never reach the feed or profile grids. The database exposes a
 * Storage path (`cover_path`); the clip carries the public URL built from it.
 */

jest.mock('@/lib/photoStories', () => ({
  storyPhotoPublicUrl: (path: string | null) => (path?.trim() ? `https://cdn.test/reels/${path.trim()}` : null),
}));

const mockSelect = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: (columns: string) => ({
        order: () => {
          const result = mockSelect(columns);
          const response = Object.assign(Promise.resolve(result), { retry: () => Promise.resolve(result) });
          return Object.assign(response, { eq: () => response });
        },
      }),
    }),
  },
}));

import { fetchReels, fetchReelsForPlayer, isListableReel, reelMedia, reelToClip } from '@/lib/reels';
import type { Player, Reel } from '@/types/database';

const reel = (patch: Record<string, unknown> = {}): Reel =>
  ({
    id: 'r1',
    title: 'Serving at the food bank',
    video_url: 'https://x/v.mp4',
    player_id: 'p1',
    created_at: '2026-10-07T00:00:00Z',
    ...patch,
  }) as Reel;
const sione = { id: 'p1', name: 'Sione Tuilagi' } as Player;

const story = (patch: Record<string, unknown> = {}) =>
  reel({ id: 's1', video_url: '', media_type: 'photo_story', photo_count: 5, cover_path: 'u1/stories/k1/0-1.jpg', ...patch });

describe('reelToClip media mapping', () => {
  it('maps a photo story with its count and a cover URL built from cover_path', () => {
    const clip = reelToClip(story(), sione);
    expect(clip.mediaType).toBe('photo_story');
    expect(clip.photoCount).toBe(5);
    expect(clip.coverUrl).toBe('https://cdn.test/reels/u1/stories/k1/0-1.jpg');
    expect(clip.videoUrl).toBe('');
    expect(reelToClip(story({ cover_path: null }), sione).coverUrl).toBeNull();
    expect(reelToClip(story({ cover_path: '  ' }), sione).coverUrl).toBeNull();
  });

  it('treats rows without the columns (pre-migration) as video', () => {
    const clip = reelToClip(reel(), sione);
    expect(clip.mediaType).toBe('video');
    expect(clip.photoCount).toBeUndefined();
    expect(clip.coverUrl).toBeUndefined();
    expect(reelMedia(reel({ media_type: 'something_new' })).mediaType).toBe('video');
  });

  it('hides unpublished stories and videos with no URL; keeps published stories', () => {
    expect(isListableReel(story())).toBe(true);
    expect(isListableReel(story({ photo_count: 0 }))).toBe(false);
    expect(isListableReel(story({ photo_count: null }))).toBe(false);
    expect(isListableReel(story({ is_removed: true }))).toBe(false);
    expect(isListableReel(reel({ video_url: '' }))).toBe(false);
    expect(isListableReel(reel())).toBe(true);
  });
});

describe('fetchReels media tier', () => {
  beforeEach(() => mockSelect.mockReset());

  it('requests the photo columns first and drops 0-photo stories', async () => {
    mockSelect.mockReturnValue({
      data: [reel({ id: 'v1' }), story({ id: 's1' }), story({ id: 's0', photo_count: 0 })],
      error: null,
    });
    const rows = await fetchReels();
    expect(rows.map((row) => row.id)).toEqual(['v1', 's1']);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelect.mock.calls[0][0]).toContain('media_type, photo_count, cover_path');
    expect(mockSelect.mock.calls[0][0]).not.toContain('cover_url');
  });

  it('falls back to the credit tier when the photo columns are missing; every row is a video', async () => {
    mockSelect.mockImplementation((columns: string) =>
      columns.includes('media_type')
        ? { data: null, error: { code: '42703', message: 'column reels_feed.media_type does not exist' } }
        : { data: [reel({ id: 'v1' }), reel({ id: 'v2', video_url: '' })], error: null },
    );
    const rows = await fetchReelsForPlayer('p1');
    expect(rows.map((row) => row.id)).toEqual(['v1']);
    // Sport annotation tier, coach-level label tier, photo tier, then the credit tier.
    expect(mockSelect).toHaveBeenCalledTimes(4);
    expect(mockSelect.mock.calls[3][0]).toContain('view_count');
    expect(mockSelect.mock.calls[3][0]).not.toContain('media_type');
    expect(reelToClip(rows[0], sione).mediaType).toBe('video');
  });
});
