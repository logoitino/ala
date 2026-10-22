/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { paymentIntentIdFromSecret, resolveTipOrigin, tipChannelLabel } from '@/lib/finance';

describe('resolveTipOrigin', () => {
  it('tags a Rally gift as rally (a gear goal still wins)', () => {
    expect(resolveTipOrigin({ rallyId: 'r1' })).toBe('rally');
    expect(resolveTipOrigin({ rallyId: 'r1', origin: 'profile' })).toBe('rally');
    expect(resolveTipOrigin({ rallyId: 'r1', wishlistItemId: 'w1' })).toBe('wishlist');
    expect(resolveTipOrigin({ reelId: 'reel-1' })).toBe('highlight');
    expect(resolveTipOrigin({})).toBe('profile');
  });

  it('labels the Rally channel and the tip revenue stream', () => {
    expect(tipChannelLabel('rally', 'in_app', 'New cleats')).toMatch(/Rally/);
  });
});

describe('paymentIntentIdFromSecret', () => {
  it('keeps only a well-formed PaymentIntent id', () => {
    expect(paymentIntentIdFromSecret('pi_3QabcDEF12345678_secret_xyz')).toBe('pi_3QabcDEF12345678');
    expect(paymentIntentIdFromSecret('seti_123_secret_x')).toBeNull();
    expect(paymentIntentIdFromSecret('pi_bad id_secret_x')).toBeNull();
    expect(paymentIntentIdFromSecret(undefined)).toBeNull();
  });
});
