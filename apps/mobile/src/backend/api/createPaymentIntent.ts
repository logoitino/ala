import Stripe from 'stripe';

import { requireAuthedUser } from './session';

type PaymentIntentBody = {
  amount?: number;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * @purpose Mint a Stripe PaymentIntent (test mode) for Mālo / exclusive / Drip / booster checkout.
 * @param request JSON `{ amount }` in integer cents (min 50) plus `Authorization: Bearer <access_token>`.
 * @returns `{ clientSecret }` for PaymentSheet.
 * @sideEffects Stripe `paymentIntents.create`; `supabase.auth.getUser` for the JWT gate. Secret is `STRIPE_SECRET_KEY` only.
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

    if (!Number.isInteger(amount) || amount < 50) {
      return jsonError('amount must be an integer number of cents (min 50).', 400);
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { tapuai_user_id: auth.user.id },
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ error: message }, { status: 400 });
  }
}
