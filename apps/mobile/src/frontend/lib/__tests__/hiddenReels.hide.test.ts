/**
 * FEED-01 Phase 1: Hide writes `tapuai.hiddenReels` and the Home filter predicate drops that clip.
 * This is the local AsyncStorage contract. It does not tap the report sheet or relaunch a device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { hideReelLocally, readHiddenReelIds, reelHiddenForUser } from '@/lib/reels';

describe('FEED-01 local hide', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps a hidden clip id in AsyncStorage and out of the visible set', async () => {
    const stored = await hideReelLocally('hl-seed-1');
    expect(stored).toContain('hl-seed-1');
    expect(await readHiddenReelIds()).toEqual(stored);
    expect(await AsyncStorage.getItem('tapuai.hiddenReels')).toContain('hl-seed-1');
    expect(reelHiddenForUser({ id: 'hl-seed-1' }, 'user-1', stored)).toBe(true);
    expect(reelHiddenForUser({ id: 'hl-other' }, 'user-1', stored)).toBe(false);
  });

  it('does not store a second copy of the same clip', async () => {
    await hideReelLocally('hl-seed-1');
    const next = await hideReelLocally('hl-seed-1');
    expect(next.filter((id) => id === 'hl-seed-1')).toHaveLength(1);
  });

  it('ignores a blank id', async () => {
    const next = await hideReelLocally('   ');
    expect(next).toEqual([]);
    expect(await AsyncStorage.getItem('tapuai.hiddenReels')).toBeNull();
  });
});
