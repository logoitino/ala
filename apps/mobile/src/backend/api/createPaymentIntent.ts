/**
 * Metro / Node adapter for gift and purchase checkout (`POST /api/create-payment-intent`). The validation, freeze check and
 * PaymentIntent shape live in the shared money core (`supabase/functions/_shared/money/paymentIntent.ts`, SCALE-04),
 * which the Edge Function `create-payment-intent` uses too. This file keeps only what is Node-specific: reading
 * `process.env`, the Node Stripe SDK, the Supabase client for the freeze RPC, and this route's order of checks
 * (session first, then the Stripe key). Installed builds call the Edge Function first.
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

import { errorResult, refuseLiveStripeKey, thrownMessage, type CoreResult } from '../../../../../supabase/functions/_shared/money/http.ts';
import {
  PAYMENT_SIGN_IN_MESSAGE,
  runCreatePaymentIntent,
} from '../../../../../supabase/functions/_shared/money/paymentIntent.ts';
import { createAuthedDb, requireAuthedUser } from './session';
import { serverDonationContextAdapter } from '../../../../../supabase/functions/_shared/money/serverDonationContext.ts';

function respond(result: CoreResult): Response {
  return Response.json(result.body, { status: result.status });
}

/**
 * @purpose Mint a Stripe PaymentIntent (test mode) for donation / exclusive / Drip / booster checkout.
 * @param request JSON `{ amount, playerId?, platformTipCents? }` in integer cents (min 50) plus `Authorization: Bearer <access_token>`.
 * @returns `{ clientSecret }` for PaymentSheet.
 * @sideEffects Session check (local WebCrypto token check first, `supabase.auth.getUser` when it cannot decide — this
 *   route creates an intent but moves no money); `malo_target_frozen` RPC when `playerId` is supplied (2026-09
 *   compliance — LEGAL_BRIEFING.md §8 item 5: the only point where a donation can be rejected before the card is
 *   charged); Stripe `paymentIntents.create`. Secret is `STRIPE_SECRET_KEY` only.
 */
export async function createPaymentIntentHandler(request: Request): Promise<Response> {
  try {
    const auth = await requireAuthedUser(request, PAYMENT_SIGN_IN_MESSAGE, { allowLocalVerification: true });
    if (!auth.ok) {
      return respond(errorResult(auth.message, auth.status));
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return respond(
        errorResult('Missing STRIPE_SECRET_KEY. Add it to .env.local (server only) and restart Expo.', 500),
      );
    }
    const liveKey = refuseLiveStripeKey(secretKey);
    if (liveKey) return respond(liveKey);

    const body: unknown = await request.json();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return respond(
      await runCreatePaymentIntent({
        userId: auth.user.id,
        body,
        // Service role when configured, else the caller's own session (`createAuthedDb`), as before.
        isTargetFrozen: (playerId) =>
          createAuthedDb({ supabaseUrl: auth.supabaseUrl, anonKey: auth.anonKey, jwt: auth.jwt }).rpc(
            'malo_target_frozen',
            { target_player_id: playerId },
          ),
        getStripe: () => new Stripe(secretKey),
        // The quote client never falls back to a user's JWT: missing service authority must refuse before charge.
        donationContext: serverDonationContextAdapter(serviceKey
          ? (name, args) => createClient(auth.supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          }).rpc(name, args)
          : undefined),
      }),
    );
  } catch (error) {
    return respond(errorResult(thrownMessage(error), 400));
  }
}
