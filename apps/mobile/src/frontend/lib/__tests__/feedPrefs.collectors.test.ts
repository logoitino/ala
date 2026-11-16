/**
 * FEED-01: Phase 2 collectors must not write AsyncStorage while the counsel flag is off.
 */
const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: jest.fn() },
}));

describe('FEED-01 Phase 2 collectors', () => {
  const original = process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS;

  beforeEach(() => {
    mockStore.clear();
    jest.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS;
    else process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = original;
  });

  it('does not persist view/save/hide history when the flag is off', async () => {
    process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = '0';
    const {
      rememberFeedViewTouch,
      rememberFeedSaveTouch,
      rememberFeedHideAthlete,
      readFeedViewTouches,
      readFeedSaveTouches,
      readFeedHideDemotions,
    } = await import('@/lib/feedPrefs');

    await rememberFeedViewTouch({
      clipId: 'c1',
      athleteId: 'a1',
      school: 'East',
      sport: 'Football',
      atMs: Date.now(),
    });
    await rememberFeedSaveTouch({
      clipId: 'c1',
      athleteId: 'a1',
      school: 'East',
      sport: 'Football',
      atMs: Date.now(),
    });
    await rememberFeedHideAthlete('a1');
    await rememberFeedHideAthlete('a1');

    expect(await readFeedViewTouches()).toEqual([]);
    expect(await readFeedSaveTouches()).toEqual([]);
    expect((await readFeedHideDemotions()).size).toBe(0);
    expect(mockStore.size).toBe(0);
  });

  it('persists when the flag is on', async () => {
    process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = '1';
    const { rememberFeedViewTouch, readFeedViewTouches } = await import('@/lib/feedPrefs');
    await rememberFeedViewTouch({
      clipId: 'c2',
      athleteId: 'a2',
      sport: 'Soccer',
      atMs: 123,
    });
    const views = await readFeedViewTouches();
    expect(views).toHaveLength(1);
    expect(views[0].clipId).toBe('c2');
  });
});
