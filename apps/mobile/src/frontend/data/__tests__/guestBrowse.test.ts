/** Guest Highlights stop after the free looks, including the clip someone sent them. */
import { GUEST_FREE_HIGHLIGHTS, guestBrowseNeedsAccount } from '@/data/guestBrowse';

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
