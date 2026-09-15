/**
 * Admin finance splits (basis points, 10_000 = 100%).
 * Fan Mālo copy (`MALO_DISCLAIMER`) still says 100% to custodial until counsel updates it.
 * SQL `company_revenue_bps` must stay in lockstep.
 */
export const MALO_PLATFORM_CUT_BPS = 1000;
export const MALO_ATHLETE_SHARE_BPS = 9000;

export const BOOSTER_PLATFORM_CUT_BPS = 1500;
export const BOOSTER_OPERATOR_SHARE_BPS = 8500;

export const VAULT_PLATFORM_CUT_BPS = 2000;
export const VAULT_ATHLETE_SHARE_BPS = 8000;

export const MERCH_PLATFORM_CUT_BPS = 10000;
export const MERCH_PAYOUT_BPS = 0;

export type RevenueSource = 'malo' | 'booster' | 'vault' | 'merch';

/**
 * @purpose Split gross cents into platform cut vs athlete/operator payout for one revenue source.
 * @param grossCents Stripe-style cents that flowed through the platform.
 * @param platformBps Platform share in basis points (`MALO_PLATFORM_CUT_BPS` = 10%).
 * @returns Platform cents and residual payout cents (gross − platform).
 */
export function splitRevenueCents(grossCents: number, platformBps: number): {
  platform_cents: number;
  payout_cents: number;
} {
  const gross = Math.max(0, Math.round(grossCents));
  const bps = Math.min(10000, Math.max(0, Math.round(platformBps)));
  const platform_cents = Math.round((gross * bps) / 10000);
  return { platform_cents, payout_cents: gross - platform_cents };
}

export function platformBpsForSource(source: RevenueSource): number {
  if (source === 'malo') return MALO_PLATFORM_CUT_BPS;
  if (source === 'booster') return BOOSTER_PLATFORM_CUT_BPS;
  if (source === 'vault') return VAULT_PLATFORM_CUT_BPS;
  return MERCH_PLATFORM_CUT_BPS;
}

export function splitLabelForSource(source: RevenueSource): string {
  if (source === 'malo') return '10% platform / 90% athlete';
  if (source === 'booster') return '15% platform / 85% operator';
  if (source === 'vault') return '20% platform / 80% athlete';
  return '100% platform';
}
