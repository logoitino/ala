/** The swipe hint must clear the clip's chips under the Home header (it used to sit on the Serve Like Me chip). */
import { peekHintTop } from '@/components/Reels/ReelPage';

describe('peekHintTop', () => {
  it('drops below the chips when the Home header is tall', () => {
    // 770pt page under a ~330pt scoreboard + rivalry banner + pill row.
    expect(peekHintTop(770, 342)).toBe(446);
  });

  it('keeps the original mid-clip spot when there is no tall header', () => {
    expect(peekHintTop(770, 56)).toBeCloseTo(354.2);
  });

  it('skips the hint on a screen too short to fit it between the chips and the caption', () => {
    expect(peekHintTop(600, 400)).toBeNull();
    expect(peekHintTop(600, 250)).toBe(354);
  });
});
