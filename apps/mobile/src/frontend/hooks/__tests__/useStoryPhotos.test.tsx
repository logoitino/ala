/**
 * `useStoryPhotos` (UX-05): fetches only for a photo story while enabled, orders photos, reports errors,
 * and drops a result that lands after the card moved to another clip (stale story photos never show).
 */
import { act, renderHook } from '@testing-library/react-native';

import type { HighlightClip, StoryPhoto } from '@/data/highlights';
import { resetStoryPhotoCache, useStoryPhotos } from '@/hooks/useStoryPhotos';

const mockFetch = jest.fn();
jest.mock('@/lib/photoStories', () => ({
  fetchStoryPhotos: (...args: unknown[]) => mockFetch(...args),
}));

const clip = (id: string, mediaType: HighlightClip['mediaType'] = 'photo_story'): HighlightClip => ({
  id,
  athleteName: 'Sione',
  school: 'ALA',
  tag: 'Service day',
  videoUrl: '',
  mediaType,
  photoCount: 2,
});
const photo = (id: string, position: number): StoryPhoto => ({
  id,
  position,
  imageUrl: `https://x/${id}.jpg`,
  description: null,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockFetch.mockReset();
  resetStoryPhotoCache();
});

describe('useStoryPhotos', () => {
  it('does not fetch for a video or while disabled', async () => {
    await renderHook(() => useStoryPhotos(clip('v1', 'video'), true));
    await renderHook(() => useStoryPhotos(clip('s1'), false));
    await renderHook(() => useStoryPhotos(null, true));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads and orders photos when enabled', async () => {
    mockFetch.mockResolvedValue({ s1: [photo('b', 1), photo('a', 0)] });
    const { result } = await renderHook(() => useStoryPhotos(clip('s1'), true));
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledWith(['s1']);
    expect(result.current.photos.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('reports an error when the fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useStoryPhotos(clip('s1'), true));
    await act(async () => {});
    expect(result.current.error).toBe(true);
    expect(result.current.photos).toEqual([]);
  });

  it('ignores a stale result after the clip changes', async () => {
    const first = deferred<Record<string, StoryPhoto[]>>();
    const second = deferred<Record<string, StoryPhoto[]>>();
    mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = await renderHook(({ item }: { item: HighlightClip }) => useStoryPhotos(item, true), {
      initialProps: { item: clip('s1') },
    });
    await rerender({ item: clip('s2') });
    await act(async () => {
      first.resolve({ s1: [photo('old', 0)] });
    });
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => {
      second.resolve({ s2: [photo('new', 0)] });
    });
    expect(result.current.photos.map((item) => item.id)).toEqual(['new']);
  });

  it('drops a result that lands after unmount', async () => {
    const pending = deferred<Record<string, StoryPhoto[]>>();
    mockFetch.mockReturnValue(pending.promise);
    const { result, unmount } = await renderHook(() => useStoryPhotos(clip('s1'), true));
    await unmount();
    await act(async () => {
      pending.resolve({ s1: [photo('a', 0)] });
    });
    expect(result.current.photos).toEqual([]);
  });
});
