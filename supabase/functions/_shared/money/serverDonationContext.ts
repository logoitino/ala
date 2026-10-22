/** MONEY-TIPS-01 runtime-neutral service quote boundary: preserves allocation before charge, never credits money. */
import type { DonationContextAdapter, DonationPaymentContext } from './paymentContext.ts';

type ServiceRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/** A missing service client refuses gift quotations before Stripe is called; all authorization stays in SQL. */
export function serverDonationContextAdapter(rpc?: ServiceRpc): DonationContextAdapter {
  return {
    async quote(request) {
      if (!rpc) return null;
      const result = await rpc('prepare_tip_payment_context', {
        donor_user_id: request.donorId, athlete_id: request.athleteId, gift_cents: request.giftCents,
        cover_fees: request.coverFees, platform_tip_percent: request.platformTipPercent,
      });
      if (result.error || !result.data) return null;
      return result.data as DonationPaymentContext;
    },
    async persist(context, paymentIntentId) {
      if (!rpc) return { data: null, error: { code: 'payment_context_unavailable' } };
      return await rpc('record_notification_payment_context', {
        context_id: context.id, provider_intent_id: paymentIntentId, donor_user_id: context.donorId,
        athlete_id: context.athleteId, gift_cents: context.giftCents, cover_fee_cents: context.coverFeeCents,
        platform_tip_cents: context.platformTipCents, currency_code: context.currency, provider_livemode: context.livemode,
      });
    },
  };
}
