/**
 * Money server core (SCALE-04): donation checkout. Validates the amount and the optional tip for Tapua'i, runs the
 * pre-charge freeze check for a target athlete, and mints the Stripe PaymentIntent (test mode in Wave 0). Used by the
 * Edge Function `create-payment-intent` and the Metro route `POST /api/create-payment-intent`; each runtime injects
 * its own database call and Stripe client and keeps its own session / configuration order in front of this.
 *
 * This creates the intent only. The app still owns `tips`/Aura. Optional server quote/persistence is prepared,
 * unwired in both runtimes; even a stored context has notificationAuthority=false until atomic business integration.
 */

import { errorResult, type CoreResult } from './http.ts';
import { donationContextMetadata, validDonationContext, type DonationContextAdapter, type DonationPaymentContext, type DonationRequest } from './paymentContext.ts';

/** 401 copy when the Bearer header is missing on checkout. */
export const PAYMENT_SIGN_IN_MESSAGE = 'Sign in to complete payment.';
/** 403 copy when the target athlete is frozen. */
export const FROZEN_TARGET_MESSAGE = 'This athlete cannot currently receive gifts.';
/** Stripe's US card minimum, in cents. */
export const PAYMENT_MIN_CENTS = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The JSON the app sends. Everything is re-validated; nothing is trusted. */
type PaymentIntentBody = {
  amount?: number;
  /** `players.id` this charge is for (donation / vault unlock / exclusive subscribe). Omitted for player-agnostic
   *  charges (Drip merch, booster sponsorships) that have no freeze target. */
  playerId?: string;
  /** Optional tip to Tapua'i included in `amount` (cents). Metadata only. */
  platformTipCents?: number;
  /** Client checkout declaration only; the server quote adapter must supply the authoritative allocation. */
  donation?: DonationRequest;
};

/** Exactly what is sent to `stripe.paymentIntents.create`. */
export type PaymentIntentParams = {
  amount: number;
  currency: 'usd';
  payment_method_types: string[];
  metadata: Record<string, string>;
};

/** The one Stripe call checkout needs; the runtime's Stripe SDK instance satisfies it. */
export type PaymentIntentStripe = {
  paymentIntents: { create(params: PaymentIntentParams): Promise<{ id?: string; livemode?: boolean; client_secret: string | null }> };
};

/**
 * @purpose Validate a checkout request, run the freeze check and mint the PaymentIntent for a signed-in caller.
 * @param input `userId` from the verified session; the parsed JSON `body`; `isTargetFrozen` (the runtime's
 *   `malo_target_frozen` RPC with its own client); `getStripe` (called only once validation and the freeze check pass).
 * @returns 400 for invalid input, 403 for a frozen athlete, else 200 `{ clientSecret }`.
 * @sideEffects One `malo_target_frozen` RPC when `playerId` is given; one Stripe `paymentIntents.create`.
 *   A lookup error (not a confirmed `true`) fails open, as before: the RPC-level checks in `add_user_aura` /
 *   `increment_backer_count` / `increment_reel_tips` still catch a frozen athlete after the charge.
 *   Throws (for the adapter's catch-all) when the body is not an object or Stripe fails.
 */
export async function runCreatePaymentIntent(input: {
  userId: string;
  body: unknown;
  isTargetFrozen: (playerId: string) => PromiseLike<{ data: unknown; error: unknown }>;
  getStripe: () => PaymentIntentStripe;
  donationContext?: DonationContextAdapter;
}): Promise<CoreResult> {
  // Property reads on the raw body on purpose: a `null` body throws the same TypeError the handlers always reported.
  const body = input.body as PaymentIntentBody;
  const amount = Number(body.amount);
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  const platformTipCents = Number(body.platformTipCents ?? 0);

  if (!Number.isSafeInteger(amount) || amount < PAYMENT_MIN_CENTS) {
    return errorResult('amount must be an integer number of cents (min 50).', 400);
  }
  if (!Number.isSafeInteger(platformTipCents) || platformTipCents < 0 || platformTipCents >= amount) {
    return errorResult('platformTipCents must be whole cents, less than amount.', 400);
  }

  let context: DonationPaymentContext | null = null;
  if (body.donation !== undefined) {
    const request = body.donation;
    if (!request || !playerId || !Number.isSafeInteger(request.giftCents) || request.giftCents < PAYMENT_MIN_CENTS
      || typeof request.coverFees !== 'boolean' || !Number.isFinite(request.platformTipPercent)
      || request.platformTipPercent < 0 || request.platformTipPercent > 100
      || request.giftCents + platformTipCents > amount
      || (!request.coverFees && request.giftCents + platformTipCents !== amount)
      || Math.round(request.giftCents * request.platformTipPercent / 100) !== platformTipCents) {
      return errorResult('Invalid gift allocation.', 400);
    }
  }

  if (playerId) {
    if (!UUID_RE.test(playerId)) {
      return errorResult('playerId must be a uuid.', 400);
    }
    const { data: frozen, error: frozenError } = await input.isTargetFrozen(playerId);
    // Fail closed only on an explicit `true` (LEGAL_BRIEFING §8 item 5): this is the one point where a donation can
    // be refused before the card is charged; a missing RPC or a transient error must not block every checkout.
    if (!frozenError && frozen === true) {
      return errorResult(FROZEN_TARGET_MESSAGE, 403);
    }
  }

  if (body.donation && input.donationContext) {
    // This capability comes from the server runtime, never request JSON. Validate/freeze the target before quoting.
    try {
      const request = body.donation;
      context = await input.donationContext.quote({ ...request, donorId: input.userId, athleteId: playerId });
      if (!validDonationContext(context, { donorId: input.userId, athleteId: playerId, giftCents: request.giftCents,
        amount, platformTipCents, coverFees: request.coverFees })) return errorResult('Payment context unavailable.', 503);
    } catch { return errorResult('Payment context unavailable.', 503); }
  }

  const paymentIntent = await input.getStripe().paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method_types: ['card'],
    metadata: {
      tapuai_user_id: input.userId,
      ...(playerId ? { tapuai_player_id: playerId } : {}),
      ...(platformTipCents > 0 ? { tapuai_platform_tip_cents: String(platformTipCents) } : {}),
      ...(body.donation ? { tapuai_purpose: 'donation', tapuai_notification_authority: 'false' } : {}),
      ...(context ? donationContextMetadata(context) : {}),
    },
  });

  if (context && input.donationContext) {
    if (!paymentIntent.id || paymentIntent.livemode !== false) return errorResult('Payment context unavailable.', 503);
    try {
      const result = await input.donationContext.persist(context, paymentIntent.id);
      if (result.error || result.data !== true) return errorResult('Payment context unavailable.', 503);
    } catch { return errorResult('Payment context unavailable.', 503); }
  }

  return { status: 200, body: { clientSecret: paymentIntent.client_secret } };
}
