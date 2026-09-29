import { renderHook } from '@testing-library/react-native';

import { useReelViewTracker } from '@/hooks/useReelViewTracker';

const mockRecord = jest.fn();

jest.mock('@/lib/leaderboards', () => ({
  VIEW_PLAY_MS: 3000,
  recordReelView: (...args: unknown[]) => mockRecord(...args),
}));

const REEL = '22222222-2222-4222-8222-222222222222';
const REEL_2 = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  jest.useFakeTimers();
  mockRecord.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useReelViewTracker', () => {
  it('records after three seconds of real playback', async () => {
    await renderHook(() => useReelViewTracker(REEL, true, true));
    jest.advanceTimersByTime(2999);
    expect(mockRecord).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockRecord).toHaveBeenCalledWith(REEL, true);
  });

  it('does not count a clip swiped past before three seconds', async () => {
    const { rerender } = await renderHook(({ id }: { id: string }) => useReelViewTracker(id, true, true), {
      initialProps: { id: REEL },
    });
    jest.advanceTimersByTime(2500);
    await rerender({ id: REEL_2 });
    jest.advanceTimersByTime(2500);
    expect(mockRecord).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(REEL_2, true);
  });

  it('adds played time across a pause or buffering on the same clip', async () => {
    const { rerender } = await renderHook(
      ({ playing }: { playing: boolean }) => useReelViewTracker(REEL, true, playing),
      { initialProps: { playing: true } },
    );
    jest.advanceTimersByTime(2000);
    await rerender({ playing: false });
    jest.advanceTimersByTime(10_000);
    expect(mockRecord).not.toHaveBeenCalled();
    await rerender({ playing: true });
    jest.advanceTimersByTime(1000);
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  it('uses a shorter threshold for a short clip', async () => {
    await renderHook(() => useReelViewTracker(REEL, true, true, 1800));
    jest.advanceTimersByTime(1800);
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  it('never counts while not playing (never loaded, paused) or for a guest', async () => {
    await renderHook(() => useReelViewTracker(REEL, true, false));
    await renderHook(() => useReelViewTracker(REEL, false, true));
    jest.advanceTimersByTime(5000);
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
