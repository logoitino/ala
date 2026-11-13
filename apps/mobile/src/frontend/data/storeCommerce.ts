/**
 * Platform payment rails for gifts vs Exclusive (Vault) digital access.
 * Records the owner/engineering working model for web / iOS / Android. Not counsel advice —
 * App Store and Play policies still need LEGAL review before store claims or live money.
 *
 * Honest checkout availability: native PaymentSheet and Expo web Payment Element (Stripe.js) when
 * `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set. Production App Store / Play builds still need store billing for Exclusive.
 */
import { Platform } from 'react-native';

import { VAULT_ATHLETE_SHARE_BPS, VAULT_PLATFORM_CUT_BPS } from '@/data/finance';

export type CommerceSurface = 'ios' | 'android' | 'web';

export type ExclusiveCheckoutRail = 'web_stripe' | 'stripe_test' | 'app_store_iap' | 'play_billing';

export type ExclusiveCheckoutDecision = {
  /** When false, do not open Stripe PaymentSheet for Exclusive on this surface. */
  allowStripe: boolean;
  rail: ExclusiveCheckoutRail;
  /** Short engineering reason (logs / docs). */
  reason: string;
  /** Dismiss / CTA label when Stripe is blocked (single OK — no fake redirect). */
  fanCta: string;
  /** Fan-facing body: Vault cut + which rail applies. */
  fanBody: string;
};

/**
 * @purpose Map React Native `Platform.OS` onto the three commerce surfaces we care about.
 * @param os `ios` | `android` | `web` (and anything else treated as web).
 */
export function commerceSurface(os: string = Platform.OS): CommerceSurface {
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  return 'web';
}

/**
 * @purpose True for EAS `production` profiles that set `EXPO_PUBLIC_APP_ENV=production`.
 * Preview / development keep Stripe Exclusive so APP-TEST can unlock Vault.
 */
export function isStoreProductionBuild(
  env: string | undefined = process.env.EXPO_PUBLIC_APP_ENV,
): boolean {
  return env === 'production';
}

/**
 * @purpose Fan-facing Exclusive split from the books (`VAULT_*_BPS`). Store processor fees are separate.
 */
export function exclusiveSplitDisclosure(
  platformBps = VAULT_PLATFORM_CUT_BPS,
  athleteBps = VAULT_ATHLETE_SHARE_BPS,
): string {
  const platformPct = Math.round(platformBps) / 100;
  const athletePct = Math.round(athleteBps) / 100;
  return `Tapua'i keeps ${platformPct}% of one-time Exclusive access; ${athletePct}% is recorded for the athlete. App Store or Google Play fees may apply separately when those rails are used.`;
}

/**
 * @purpose Athlete Management line when the Vault is locked — same books split, no store legal claim.
 */
export function exclusiveAthleteSplitHint(
  dollars: number,
  platformBps = VAULT_PLATFORM_CUT_BPS,
  athleteBps = VAULT_ATHLETE_SHARE_BPS,
): string {
  const platformPct = Math.round(platformBps) / 100;
  const athletePct = Math.round(athleteBps) / 100;
  return `Fans pay $${dollars.toFixed(2)} for one-time Exclusive access. Books record ${athletePct}% for you and ${platformPct}% for Tapua'i. Store billing fees (App Store / Play) are separate when those rails ship.`;
}

/**
 * @purpose Decide whether Exclusive may use Stripe on this surface.
 *
 * Working model (counsel still owns final store claims):
 * - **Web:** Stripe.js Payment Element + Vault 20/80 books split (same create-payment-intent as native).
 * - **iOS App Store:** digital Vault unlock is App Store IAP class — not Stripe in the production app.
 * - **Android / Google Play:** same class as Apple for in-app digital goods — Play Billing is required
 *   for that SKU in the Play-distributed app. Android is **not** freer than Apple here.
 * - **Wave 0 / non-production native:** Stripe Exclusive stays on so APP-TEST can unlock Vault.
 *
 * Gifts stay on Stripe (0% Tapua'i cut); Apple 3.2.1(vii) / gift treatment remains a LEGAL open item.
 *
 * @param surface ios | android | web
 * @param production `EXPO_PUBLIC_APP_ENV === 'production'`
 */
export function decideExclusiveCheckout(
  surface: CommerceSurface = commerceSurface(),
  production: boolean = isStoreProductionBuild(),
): ExclusiveCheckoutDecision {
  const split = exclusiveSplitDisclosure();

  if (surface === 'web') {
    return {
      allowStripe: true,
      rail: 'web_stripe',
      reason: 'Web Exclusive uses Stripe.js Payment Element; books record the Vault 20/80 split.',
      fanCta: 'One-time Exclusive',
      fanBody: `${split} Checkout runs in the browser with Stripe (test card 4242 in Wave 0).`,
    };
  }

  if (!production) {
    const storeName = surface === 'ios' ? 'App Store' : 'Google Play';
    return {
      allowStripe: true,
      rail: 'stripe_test',
      reason: `Test/preview build: Stripe Exclusive for APP-TEST. A ${storeName} production app must use store billing for digital Vault unlock (not built yet).`,
      fanCta: 'Test unlock',
      fanBody: `${split} This is a test checkout. A store release will use ${storeName} billing for Exclusive — Android follows the same digital-goods class as Apple, not a freer Stripe path.`,
    };
  }

  if (surface === 'ios') {
    return {
      allowStripe: false,
      rail: 'app_store_iap',
      reason: 'Production iOS Exclusive requires App Store IAP; Stripe Exclusive is blocked until StoreKit ships.',
      fanCta: 'OK',
      fanBody: `On iPhone and iPad, App Store rules apply to digital Vault access. ${split} In-app App Store purchase is not wired yet, so Exclusive unlock is unavailable on this build.`,
    };
  }

  return {
    allowStripe: false,
    rail: 'play_billing',
    reason: 'Production Android Exclusive requires Google Play Billing; Stripe Exclusive is blocked until Play Billing ships.',
    fanCta: 'OK',
    fanBody: `On Android, Google Play Billing generally applies to digital Vault access the same way Apple IAP does — Android is not exempt. ${split} Play Billing is not wired yet, so Exclusive unlock is unavailable on this build.`,
  };
}
