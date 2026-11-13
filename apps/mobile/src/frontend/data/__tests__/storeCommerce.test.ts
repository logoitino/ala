/** Platform Exclusive rails: web Stripe; production native store billing; Android not freer than Apple. */
import {
  commerceSurface,
  decideExclusiveCheckout,
  exclusiveAthleteSplitHint,
  exclusiveSplitDisclosure,
  formatExclusiveWebUrl,
  isStoreProductionBuild,
} from '@/data/storeCommerce';

describe('commerceSurface', () => {
  it('maps ios and android; everything else is web', () => {
    expect(commerceSurface('ios')).toBe('ios');
    expect(commerceSurface('android')).toBe('android');
    expect(commerceSurface('web')).toBe('web');
    expect(commerceSurface('windows')).toBe('web');
  });
});

describe('isStoreProductionBuild', () => {
  it('is true only for production APP_ENV', () => {
    expect(isStoreProductionBuild('production')).toBe(true);
    expect(isStoreProductionBuild('preview')).toBe(false);
    expect(isStoreProductionBuild('development')).toBe(false);
    expect(isStoreProductionBuild(undefined)).toBe(false);
  });
});

describe('exclusiveSplitDisclosure', () => {
  it('names the books 20/80 Vault cut', () => {
    expect(exclusiveSplitDisclosure()).toMatch(/20%/);
    expect(exclusiveSplitDisclosure()).toMatch(/80%/);
    expect(exclusiveSplitDisclosure()).toMatch(/Exclusive/);
  });
});

describe('exclusiveAthleteSplitHint', () => {
  it('includes the price and the athlete share', () => {
    expect(exclusiveAthleteSplitHint(4.99)).toMatch(/\$4\.99/);
    expect(exclusiveAthleteSplitHint(4.99)).toMatch(/80%/);
  });
});

describe('formatExclusiveWebUrl', () => {
  it('points at /user/{id} on the trusted web origin', () => {
    expect(formatExclusiveWebUrl('abc-123')).toMatch(/\/user\/abc-123$/);
  });
});

describe('decideExclusiveCheckout', () => {
  it('allows Stripe on web in production with the Vault split body', () => {
    const d = decideExclusiveCheckout('web', true);
    expect(d.allowStripe).toBe(true);
    expect(d.rail).toBe('web_stripe');
    expect(d.fanBody).toMatch(/20%/);
  });

  it('allows Stripe on native test builds and warns that store billing comes later', () => {
    const ios = decideExclusiveCheckout('ios', false);
    expect(ios.allowStripe).toBe(true);
    expect(ios.rail).toBe('stripe_test');
    expect(ios.fanBody).toMatch(/App Store/);

    const android = decideExclusiveCheckout('android', false);
    expect(android.allowStripe).toBe(true);
    expect(android.fanBody).toMatch(/Google Play/);
    expect(android.fanBody).toMatch(/not a freer Stripe path|not exempt|same digital-goods/i);
  });

  it('blocks Stripe on production iOS and Android (Android is not exempt)', () => {
    const ios = decideExclusiveCheckout('ios', true);
    expect(ios.allowStripe).toBe(false);
    expect(ios.rail).toBe('app_store_iap');
    expect(ios.fanCta).toMatch(/website/i);

    const android = decideExclusiveCheckout('android', true);
    expect(android.allowStripe).toBe(false);
    expect(android.rail).toBe('play_billing');
    expect(android.fanBody).toMatch(/not exempt|same way Apple/i);
  });
});
