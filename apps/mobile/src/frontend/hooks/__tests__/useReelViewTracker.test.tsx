import { renderHook } from '@testing-library/react-native';

import { useReelViewTracker } from '@/hooks/useReelViewTracker';

const mockRecord = jest.fn();

jest.mock('@/lib/leaderboards', () => ({
  VIEW_DWELL_MS: 2000,
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
  it('records after the clip has been on screen for two seconds', async () => {
    await renderHook(() => useReelViewTracker(REEL, true, true));
    jest.advanceTimersByTime(1999);
    expect(mockRecord).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockRecord).toHaveBeenCalledWith(REEL, true);
  });

  it('does not count a clip swiped past before two seconds', async () => {
    const { rerender } = await renderHook(({ id }: { id: string }) => useReelViewTracker(id, true, true), {
      initialProps: { id: REEL },
    });
    jest.advanceTimersByTime(1500);
    await rerender({ id: REEL_2 });
    jest.advanceTimersByTime(1500);
    expect(mockRecord).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(REEL_2, true);
  });

  it('waits while playback is paused or the viewer is a guest', async () => {
    await renderHook(() => useReelViewTracker(REEL, true, false));
    await renderHook(() => useReelViewTracker(REEL, false, true));
    jest.advanceTimersByTime(5000);
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
