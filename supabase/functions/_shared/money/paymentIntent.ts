/**
 * Money server core (SCALE-04): donation checkout. Validates the amount and the optional tip for Tapua'i, runs the
 * pre-charge freeze check for a target athlete, and mints the Stripe PaymentIntent (test mode in Wave 0). Used by the
 * Edge Function `create-payment-intent` and the Metro route `POST /api/create-payment-intent`; each runtime injects
 * its own database call and Stripe client and keeps its own session / configuration order in front of this.
 *
 * This creates the intent only. It writes no ledger row: the app still writes `tips` after PaymentSheet, and the
 * webhook's crediting branch stays off until that client insert is retired (STATE §0, §6 item 3).
 */

import { errorResult, type CoreResult } from './http.ts';

/** 401 copy when the Bearer header is missing on checkout. */
export const PAYMENT_SIGN_IN_MESSAGE = 'Sign in to complete payment.';
/** 403 copy when the target athlete is frozen. */
export const FROZEN_TARGET_MESSAGE = 'This athlete cannot currently receive Mālo.';
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
  paymentIntents: { create(params: PaymentIntentParams): Promise<{ client_secret: string | null }> };
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
}): Promise<CoreResult> {
  // Property reads on the raw body on purpose: a `null` body throws the same TypeError the handlers always reported.
  const body = input.body as PaymentIntentBody;
  const amount = Number(body.amount);
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  const platformTipCents = Number(body.platformTipCents ?? 0);

  if (!Number.isInteger(amount) || amount < PAYMENT_MIN_CENTS) {
    return errorResult('amount must be an integer number of cents (min 50).', 400);
  }
  if (!Number.isInteger(platformTipCents) || platformTipCents < 0 || platformTipCents >= amount) {
    return errorResult('platformTipCents must be whole cents, less than amount.', 400);
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

  const paymentIntent = await input.getStripe().paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method_types: ['card'],
    metadata: {
      tapuai_user_id: input.userId,
      ...(playerId ? { tapuai_player_id: playerId } : {}),
      ...(platformTipCents > 0 ? { tapuai_platform_tip_cents: String(platformTipCents) } : {}),
    },
  });

  return { status: 200, body: { clientSecret: paymentIntent.client_secret } };
}
