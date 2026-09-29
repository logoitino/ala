import { resolveTipOrigin, revenueSourceTitle, tipChannelLabel } from '@/lib/finance';

describe('resolveTipOrigin', () => {
  it('tags a Rally donation as rally (a gear goal still wins)', () => {
    expect(resolveTipOrigin({ rallyId: 'r1' })).toBe('rally');
    expect(resolveTipOrigin({ rallyId: 'r1', origin: 'profile' })).toBe('rally');
    expect(resolveTipOrigin({ rallyId: 'r1', wishlistItemId: 'w1' })).toBe('wishlist');
    expect(resolveTipOrigin({ reelId: 'reel-1' })).toBe('highlight');
    expect(resolveTipOrigin({})).toBe('profile');
  });

  it('labels the Rally channel and the tip revenue stream', () => {
    expect(tipChannelLabel('rally', 'in_app', 'New cleats')).toMatch(/Rally/);
    expect(revenueSourceTitle('tip')).toBe("Tip to Tapua'i");
  });
});
