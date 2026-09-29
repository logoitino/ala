import Stripe from 'stripe';

import { createAuthedDb, requireAuthedUser } from './session';

type PaymentIntentBody = {
  amount?: number;
  /** `players.id` this charge is for (Mālo tip / vault unlock / exclusive subscribe). Omitted for
   *  player-agnostic charges (Drip merch, booster sponsorships) that have no freeze target. */
  playerId?: string;
  /** Optional tip to Tapua'i included in `amount` (cents). Metadata only — the athlete's donation is
   *  `amount - platformTipCents - fee`. */
  platformTipCents?: number;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @purpose Mint a Stripe PaymentIntent (test mode) for Mālo / exclusive / Drip / booster checkout.
 * @param request JSON `{ amount, playerId? }` in integer cents (min 50) plus `Authorization: Bearer <access_token>`.
 * @returns `{ clientSecret }` for PaymentSheet.
 * @sideEffects Stripe `paymentIntents.create`; `supabase.auth.getUser` for the JWT gate;
 *   `malo_target_frozen` RPC when `playerId` is supplied (2026-09 compliance — LEGAL_BRIEFING.md §8
 *   item 5: this is the only point where a Mālo charge can be rejected before the card is ever
 *   charged, since `tips` / RPC freeze checks only run after `presentPaymentSheet()` resolves).
 *   Secret is `STRIPE_SECRET_KEY` only.
 */
export async function createPaymentIntentHandler(request: Request): Promise<Response> {
  try {
    const auth = await requireAuthedUser(request, 'Sign in to complete payment.');
    if (!auth.ok) {
      return jsonError(auth.message, auth.status);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return jsonError(
        'Missing STRIPE_SECRET_KEY. Add it to .env.local (server only) and restart Expo.',
        500,
      );
    }

    const body = (await request.json()) as PaymentIntentBody;
    const amount = Number(body.amount);
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    const platformTipCents = Number(body.platformTipCents ?? 0);

    if (!Number.isInteger(amount) || amount < 50) {
      return jsonError('amount must be an integer number of cents (min 50).', 400);
    }
    if (!Number.isInteger(platformTipCents) || platformTipCents < 0 || platformTipCents >= amount) {
      return jsonError('platformTipCents must be whole cents, less than amount.', 400);
    }

    if (playerId) {
      if (!UUID_RE.test(playerId)) {
        return jsonError('playerId must be a uuid.', 400);
      }
      const db = createAuthedDb({
        supabaseUrl: auth.supabaseUrl,
        anonKey: auth.anonKey,
        jwt: auth.jwt,
      });
      const { data: frozen, error: frozenError } = await db.rpc('malo_target_frozen', {
        target_player_id: playerId,
      });
      // Fail closed only on an explicit `true` — a lookup error (missing RPC on an older schema,
      // transient DB issue) must not block every checkout, so it falls through to Stripe like
      // before. The RPC-level checks in `add_user_aura` / `increment_backer_count` /
      // `increment_reel_tips` still catch a frozen athlete even if this pre-charge check is bypassed.
      if (!frozenError && frozen === true) {
        return jsonError('This athlete cannot currently receive Mālo.', 403);
      }
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        tapuai_user_id: auth.user.id,
        ...(playerId ? { tapuai_player_id: playerId } : {}),
        ...(platformTipCents > 0 ? { tapuai_platform_tip_cents: String(platformTipCents) } : {}),
      },
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ error: message }, { status: 400 });
  }
}
