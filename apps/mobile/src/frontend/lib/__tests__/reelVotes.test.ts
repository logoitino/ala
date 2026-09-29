import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearReelVote, loadReelVotes, markReelVote } from '@/lib/reelVotes';

describe('reel vote storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('does not lose a vote when two taps write at once (regression: Seki then Aura kept only one)', async () => {
    await Promise.all([markReelVote('hl-1', 'seki', 'u1'), markReelVote('hl-1', 'aura', 'u1')]);
    expect(await loadReelVotes('hl-1', 'u1')).toEqual({ seki: true, aura: true, flex: false });
  });

  it('applies mark and clear in tap order', async () => {
    await Promise.all([markReelVote('hl-2', 'seki'), clearReelVote('hl-2', 'seki')]);
    expect((await loadReelVotes('hl-2')).seki).toBe(false);
  });
});
