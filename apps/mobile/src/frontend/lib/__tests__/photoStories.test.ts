/**
 * Photo stories data layer: pure reorder, path → public URL mapping with the pre-migration fallback, the
 * availability probe (session caching rules), and the publish rule that a story is never half-published (a failed
 * photo or a failed `set_reel_photos` throws PhotoStoryPublishError with the reel id, and a retry reuses that
 * row instead of inserting another — the RPC is publish-once). The database stores paths, never URLs (QA, UX-05b).
 */

const mockRpc = jest.fn();
const mockFeedQuery = jest.fn();
const mockHeadQuery = jest.fn();
const mockInsertReelRow = jest.fn();
const mockUploadStoryPhoto = jest.fn();
const mockUpdate = jest.fn();
const mockRowQuery = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: (bucket: string) => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }) }) },
    from: (relation: string) => ({
      update: (values: unknown) => ({ eq: (column: string, value: string) => mockUpdate({ relation, values, column, value }) }),
      select: (columns: string, options?: unknown) => ({
        in: (column: string, values: string[]) => ({
          order: (orderColumn: string, orderOptions: unknown) => mockFeedQuery({ relation, columns, column, values, orderColumn, orderOptions }),
        }),
        limit: () => mockHeadQuery({ relation, columns, options }),
        eq: (column: string, value: string) => ({ maybeSingle: () => mockRowQuery({ relation, columns, column, value }) }),
      }),
    }),
  },
}));
jest.mock('@/services/MediaUploadService', () => ({
  insertReelRow: (...args: unknown[]) => mockInsertReelRow(...args),
  uploadStoryPhoto: (...args: unknown[]) => mockUploadStoryPhoto(...args),
}));

import {
  createPhotoStory,
  fetchStoryPhotos,
  movePhoto,
  photoStoriesAvailable,
  PhotoStoryPublishError,
  resetPhotoStoriesProbe,
  setStoryPhotos,
  storyPhotoPublicUrl,
} from '@/lib/photoStories';

beforeEach(() => {
  jest.clearAllMocks();
  resetPhotoStoriesProbe();
});

describe('movePhoto', () => {
  it('moves earlier and later without mutating the input', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(movePhoto(list, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(movePhoto(list, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clamps the destination and ignores an out-of-range source', () => {
    expect(movePhoto(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(movePhoto(['a', 'b'], 1, 9)).toEqual(['a', 'b']);
    expect(movePhoto(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('storyPhotoPublicUrl', () => {
  it('builds a public URL from a stored path and returns null for blank or hidden paths', () => {
    expect(storyPhotoPublicUrl('u1/stories/r1/0-1700000000000.jpg')).toBe('https://cdn.test/reels/u1/stories/r1/0-1700000000000.jpg');
    expect(storyPhotoPublicUrl('')).toBeNull();
    expect(storyPhotoPublicUrl('   ')).toBeNull();
    expect(storyPhotoPublicUrl(null)).toBeNull();
  });
});

describe('fetchStoryPhotos', () => {
  it('reads paths in position order, maps them to public URLs and skips hidden rows', async () => {
    mockFeedQuery.mockResolvedValue({
      data: [
        { id: 'p2', reel_id: 'r1', position: 1, description: '  ', width: 1200, height: 1600, image_path: 'u1/stories/r1/1-1700000000001.jpg' },
        { id: 'p1', reel_id: 'r1', position: 0, description: 'Team huddle', width: null, height: null, image_path: 'u1/stories/r1/0-1700000000000.jpg' },
        { id: 'p3', reel_id: 'r2', position: 0, description: null, width: 800, height: 600, image_path: '' },
      ],
      error: null,
    });
    const result = await fetchStoryPhotos(['r1', 'r2', 'r1', '']);
    expect(mockFeedQuery).toHaveBeenCalledWith(expect.objectContaining({
      relation: 'reel_photos_feed', columns: expect.stringContaining('image_path'), column: 'reel_id', values: ['r1', 'r2'],
      orderColumn: 'position', orderOptions: { ascending: true },
    }));
    expect(result).toEqual({
      r1: [
        { id: 'p1', position: 0, imageUrl: 'https://cdn.test/reels/u1/stories/r1/0-1700000000000.jpg', description: 'Team huddle', width: null, height: null },
        { id: 'p2', position: 1, imageUrl: 'https://cdn.test/reels/u1/stories/r1/1-1700000000001.jpg', description: null, width: 1200, height: 1600 },
      ],
    });
  });

  it('returns {} before the view exists and skips the query for no ids', async () => {
    mockFeedQuery.mockResolvedValue({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.reel_photos_feed' in the schema cache" } });
    await expect(fetchStoryPhotos(['r1'])).resolves.toEqual({});
    mockFeedQuery.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "public.reel_photos_feed" does not exist' } });
    await expect(fetchStoryPhotos(['r1'])).resolves.toEqual({});
    mockFeedQuery.mockClear();
    await expect(fetchStoryPhotos([])).resolves.toEqual({});
    expect(mockFeedQuery).not.toHaveBeenCalled();
  });

  it('surfaces other read failures so the feed can offer a retry', async () => {
    mockFeedQuery.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } });
    await expect(fetchStoryPhotos(['r1'])).rejects.toThrow('Photos could not load');
  });
});

describe('setStoryPhotos', () => {
  it('treats "already published" as success when the row shows the photos landed (lost reply)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '55000', message: 'This photo story is already published' } });
    mockRowQuery.mockResolvedValue({ data: { id: 'r1', photo_count: 3 }, error: null });
    await expect(setStoryPhotos('r1', [{ imagePath: 'u1/stories/r1/0-1700000000000.jpg', description: null }])).resolves.toBe(3);
    expect(mockRowQuery).toHaveBeenCalledWith(expect.objectContaining({ relation: 'reels', column: 'id', value: 'r1' }));
  });

  it('still fails on "already published" when the row cannot confirm any photos', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '55000', message: 'This photo story is already published' } });
    mockRowQuery.mockResolvedValue({ data: null, error: null });
    await expect(setStoryPhotos('r1', [{ imagePath: 'u1/stories/r1/0-1700000000000.jpg', description: null }])).rejects.toThrow(
      'already published',
    );
  });

  it('sends storage paths with trimmed descriptions in order and returns the stored count', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    await expect(setStoryPhotos('r1', [
      { imagePath: 'u1/stories/r1/0-1700000000000.jpg', description: '  Warmups  ', width: 10, height: 20 },
      { imagePath: 'u1/stories/r1/1-1700000000001.jpg', description: '' },
    ])).resolves.toBe(2);
    expect(mockRpc).toHaveBeenCalledWith('set_reel_photos', {
      p_reel_id: 'r1',
      p_photos: [
        { image_path: 'u1/stories/r1/0-1700000000000.jpg', description: 'Warmups', width: 10, height: 20 },
        { image_path: 'u1/stories/r1/1-1700000000001.jpg', description: null, width: null, height: null },
      ],
    });
  });
});

describe('photoStoriesAvailable', () => {
  it('is false when the RPC is missing and caches the answer for the session', async () => {
    mockHeadQuery.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.set_reel_photos' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('is false when reels.media_type is missing', async () => {
    mockHeadQuery.mockResolvedValue({ data: null, error: { code: '42703', message: 'column reels.media_type does not exist' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('is true when the RPC exists and only rejects the empty probe', async () => {
    mockHeadQuery.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Not your reel' } });
    await expect(photoStoriesAvailable()).resolves.toBe(true);
  });

  it('caches "unavailable" for an empty or unknown probe error before the migration', async () => {
    mockHeadQuery.mockResolvedValue({ data: null, error: { code: '', message: '' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    mockHeadQuery.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Not your reel' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    expect(mockHeadQuery).toHaveBeenCalledTimes(1);

    resetPhotoStoriesProbe();
    mockRpc.mockResolvedValue({ data: null, error: { message: '' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('does not cache a network or transport failure', async () => {
    mockHeadQuery.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: null, error: { code: '', message: 'TypeError: Network request failed' } })
      .mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Not your reel' } });
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    await expect(photoStoriesAvailable()).resolves.toBe(false);
    await expect(photoStoriesAvailable()).resolves.toBe(true);
  });
});

describe('createPhotoStory', () => {
  const input = {
    photos: [{ uri: 'file:///a.jpg', description: 'Warmups' }, { uri: 'file:///b.jpg', width: 900, height: 1200 }],
    title: '  Serving at the food bank ',
    playerId: 'p1',
    gameId: '',
    category: 'serve_like_me' as const,
    rightsVersion: '2026-10-07',
  };

  beforeEach(() => {
    mockInsertReelRow.mockResolvedValue({ id: 'reel-1', video_url: '', title: 'Serving at the food bank', media_type: 'photo_story', photo_count: 0 });
    mockUploadStoryPhoto.mockImplementation(async (_uri: string, reelId: string, position: number) => ({
      imagePath: `u1/stories/${reelId}/${position}-1700000000000.jpg`,
      imageUrl: `https://cdn.test/reels/u1/stories/${reelId}/${position}-1700000000000.jpg`,
      width: position === 0 ? 1600 : undefined, height: position === 0 ? 1200 : undefined,
    }));
  });

  it('inserts like a video, uploads in order with progress, then stores the ordered list', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    const onProgress = jest.fn();
    const reel = await createPhotoStory({ ...input, onProgress });
    expect(mockInsertReelRow).toHaveBeenCalledWith(expect.objectContaining({
      video_url: '', title: 'Serving at the food bank', player_id: 'p1', game_id: null, media_type: 'photo_story',
      is_exclusive: false, is_vault_only: false, category: 'serve_like_me', rights_version: '2026-10-07', attested_at: expect.any(String),
    }));
    expect(mockUploadStoryPhoto.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      ['file:///a.jpg', 'reel-1', 0], ['file:///b.jpg', 'reel-1', 1],
    ]);
    expect(onProgress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(mockRpc).toHaveBeenCalledWith('set_reel_photos', {
      p_reel_id: 'reel-1',
      p_photos: [
        { image_path: 'u1/stories/reel-1/0-1700000000000.jpg', description: 'Warmups', width: 1600, height: 1200 },
        { image_path: 'u1/stories/reel-1/1-1700000000000.jpg', description: null, width: 900, height: 1200 },
      ],
    });
    expect(reel).toEqual(expect.objectContaining({ id: 'reel-1', photo_count: 2, cover_path: 'u1/stories/reel-1/0-1700000000000.jpg' }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('stops at a failed photo, never calls set_reel_photos, and returns the reel id for a retry', async () => {
    mockUploadStoryPhoto.mockImplementation(async (_uri: string, reelId: string, position: number) => {
      if (position === 1) throw new Error('Network request failed');
      return { imagePath: `u1/stories/${reelId}/0-1700000000000.jpg`, imageUrl: 'https://cdn.test/x.jpg' };
    });
    const failure = await createPhotoStory(input).catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(PhotoStoryPublishError);
    expect((failure as PhotoStoryPublishError).reelId).toBe('reel-1');
    expect((failure as Error).message).toContain('Photo 2 of 2 did not upload, so nothing was published');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reports an RPC rejection as not published, with the reel id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Photo path must be in your own folder' } });
    const failure = await createPhotoStory(input).catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(PhotoStoryPublishError);
    expect((failure as PhotoStoryPublishError).reelId).toBe('reel-1');
    expect((failure as Error).message).toMatch(/nothing was published.*own folder/);
  });

  it('retries on the same reel: no second insert, caption/category refreshed, photos re-uploaded into its folder', async () => {
    mockUpdate.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: 2, error: null });
    const reel = await createPhotoStory({ ...input, title: 'Food bank, round two', existingReelId: 'reel-old' });
    expect(mockInsertReelRow).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ relation: 'reels', values: { title: 'Food bank, round two', category: 'serve_like_me' }, column: 'id', value: 'reel-old' });
    expect(mockUploadStoryPhoto.mock.calls.map((call) => call[1])).toEqual(['reel-old', 'reel-old']);
    expect(mockRpc).toHaveBeenCalledWith('set_reel_photos', expect.objectContaining({ p_reel_id: 'reel-old' }));
    expect(reel).toEqual(expect.objectContaining({ id: 'reel-old', photo_count: 2, media_type: 'photo_story' }));
  });

  it('keeps the same reel id when the retry fails again', async () => {
    mockUpdate.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'already published' } });
    const failure = await createPhotoStory({ ...input, existingReelId: 'reel-old' }).catch((caught: unknown) => caught);
    expect((failure as PhotoStoryPublishError).reelId).toBe('reel-old');
  });

  it('does not wrap an insert failure (no row exists to retry)', async () => {
    mockInsertReelRow.mockRejectedValue(new Error('Photo stories need the latest database update.'));
    const failure = await createPhotoStory(input).catch((caught: unknown) => caught);
    expect(failure).not.toBeInstanceOf(PhotoStoryPublishError);
    expect(mockUploadStoryPhoto).not.toHaveBeenCalled();
  });

  it('validates before writing anything', async () => {
    await expect(createPhotoStory({ ...input, photos: [] })).rejects.toThrow('at least one photo');
    await expect(createPhotoStory({ ...input, title: '   ' })).rejects.toThrow('caption');
    await expect(createPhotoStory({ ...input, photos: Array.from({ length: 11 }, (_, i) => ({ uri: `file:///${i}.jpg` })) })).rejects.toThrow('up to 10');
    expect(mockInsertReelRow).not.toHaveBeenCalled();
  });
});
