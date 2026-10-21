/** NOTIFY-01 prepared payment context; this is quote attribution, never a receipt or money credit authority. */
export type DonationRequest = { giftCents: number; coverFees: boolean; platformTipPercent: number };
export type DonationPaymentContext = {
  id: string; donorId: string; athleteId: string; purpose: 'donation'; currency: 'usd';
  giftCents: number; coverFeeCents: number; platformTipCents: number; totalCents: number;
  livemode: false; notificationAuthority: false;
};
/** Optional runtime boundary is intentionally unwired until the canonical business writer can commit atomically. */
export type DonationContextAdapter = {
  quote(request: DonationRequest & { donorId: string; athleteId: string }): Promise<DonationPaymentContext | null>;
  persist(context: DonationPaymentContext, paymentIntentId: string): Promise<{ data: unknown; error: unknown }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cents = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Server quote must bind the verified actor/target and every allocation; no client-provided fee or purpose is authoritative. */
export function validDonationContext(context: DonationPaymentContext | null, expected: {
  donorId: string; athleteId: string; giftCents: number; amount: number; platformTipCents: number; coverFees: boolean;
}): context is DonationPaymentContext {
  return !!context && uuid.test(context.id) && uuid.test(context.donorId) && uuid.test(context.athleteId)
    && context.donorId === expected.donorId && context.athleteId === expected.athleteId
    && context.purpose === 'donation' && context.currency === 'usd'
    && context.livemode === false && context.notificationAuthority === false
    && cents(context.giftCents) && context.giftCents >= 50 && cents(context.coverFeeCents)
    && cents(context.platformTipCents) && cents(context.totalCents)
    && context.giftCents === expected.giftCents && context.platformTipCents === expected.platformTipCents
    && (expected.coverFees || context.coverFeeCents === 0)
    && context.totalCents === expected.amount
    && context.totalCents === context.giftCents + context.coverFeeCents + context.platformTipCents;
}

/** These exact strings are matched against stored context on verified provider observations. */
export function donationContextMetadata(context: DonationPaymentContext): Record<string, string> {
  return { tapuai_context_id: context.id, tapuai_purpose: context.purpose, tapuai_user_id: context.donorId,
    tapuai_player_id: context.athleteId, tapuai_gift_cents: String(context.giftCents),
    tapuai_cover_fee_cents: String(context.coverFeeCents), tapuai_platform_tip_cents: String(context.platformTipCents),
    tapuai_notification_authority: 'false' };
}
