/** Guest Highlights stop after the free looks, including the clip someone sent them. */
import {
  GUEST_FREE_HIGHLIGHTS,
  decideGuestDesktopPlay,
  guestBrowseNeedsAccount,
} from '@/data/guestBrowse';

describe('guestBrowseNeedsAccount', () => {
  it('lets a guest finish the opened Highlight and two more swipes', () => {
    expect(GUEST_FREE_HIGHLIGHTS).toBe(3);
    expect(guestBrowseNeedsAccount(1)).toBe(false);
    expect(guestBrowseNeedsAccount(3)).toBe(false);
  });

  it('asks for an account on the next swipe', () => {
    expect(guestBrowseNeedsAccount(4)).toBe(true);
  });
});

describe('decideGuestDesktopPlay', () => {
  it('allows the first three distinct desktop clips', () => {
    const seen = new Set<string>();
    let allowed: string | null = null;
    for (const id of ['a', 'b', 'c']) {
      const decision = decideGuestDesktopPlay(seen, id, allowed);
      expect(decision.allow).toBe(true);
      if (decision.allow) allowed = decision.nextAllowedClipId;
    }
    expect(seen.size).toBe(3);
    expect(allowed).toBe('c');
  });

  it('blocks a fourth distinct clip but still allows the last free one', () => {
    const seen = new Set(['a', 'b', 'c']);
    const blocked = decideGuestDesktopPlay(seen, 'd', 'c');
    expect(blocked.allow).toBe(false);
    const replay = decideGuestDesktopPlay(seen, 'c', 'c');
    expect(replay).toEqual({ allow: true, nextAllowedClipId: 'c' });
  });
});
