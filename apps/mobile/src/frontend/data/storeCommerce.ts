/**
 * Platform payment rails for gifts vs Exclusive (Vault) digital access.
 * Records the owner/engineering working model for web / iOS / Android. Not counsel advice —
 * App Store and Play policies still need LEGAL review before store claims or live money.
 */
import { Platform } from 'react-native';

import { VAULT_ATHLETE_SHARE_BPS, VAULT_PLATFORM_CUT_BPS } from '@/data/finance';
import { TAPUAI_WEB_ORIGIN } from '@/data/share';

export type CommerceSurface = 'ios' | 'android' | 'web';

export type ExclusiveCheckoutRail = 'web_stripe' | 'stripe_test' | 'app_store_iap' | 'play_billing';

export type ExclusiveCheckoutDecision = {
  /** When false, do not open Stripe PaymentSheet for Exclusive on this surface. */
  allowStripe: boolean;
  rail: ExclusiveCheckoutRail;
  /** Short engineering reason (logs / docs). */
  reason: string;
  /** Primary button when Stripe is blocked. */
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
 * @purpose Web deep link for Exclusive when a production store app must not open Stripe for digital Vault.
 * @param athleteId `players.id` on `/user/[id]`.
 */
export function formatExclusiveWebUrl(athleteId: string): string {
  const id = athleteId.trim();
  return `${TAPUAI_WEB_ORIGIN}/user/${encodeURIComponent(id || 'athlete')}`;
}

/**
 * @purpose Decide whether Exclusive may use Stripe on this surface.
 *
 * Working model (counsel still owns final store claims):
 * - **Web:** Stripe PaymentSheet + Vault 20/80 books split.
 * - **iOS App Store:** digital Vault unlock is App Store IAP class — not Stripe in the production app.
 * - **Android / Google Play:** same class as Apple for in-app digital goods — Play Billing is required
 *   for that SKU in the Play-distributed app. Android is **not** freer than Apple here.
 * - **Wave 0 / non-production:** Stripe Exclusive stays on so APP-TEST can unlock Vault, with honest copy.
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
      reason: 'Web Exclusive uses Stripe; books record the Vault 20/80 split.',
      fanCta: 'One-time Exclusive',
      fanBody: split,
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
      reason: 'Production iOS Exclusive requires App Store IAP; Stripe digital unlock stays web-only until StoreKit ships.',
      fanCta: 'Unlock on the website',
      fanBody: `On iPhone and iPad, App Store rules apply to digital Vault access. ${split} In-app App Store purchase is not wired yet — unlock Exclusive on the Tapua'i website for now.`,
    };
  }

  return {
    allowStripe: false,
    rail: 'play_billing',
    reason: 'Production Android Exclusive requires Google Play Billing; Stripe digital unlock stays web-only until Play Billing ships.',
    fanCta: 'Unlock on the website',
    fanBody: `On Android, Google Play Billing generally applies to digital Vault access the same way Apple IAP does — Android is not exempt. ${split} Play Billing is not wired yet — unlock Exclusive on the Tapua'i website for now.`,
  };
}
