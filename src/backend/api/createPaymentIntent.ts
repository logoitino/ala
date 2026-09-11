import Stripe from 'stripe';

type PaymentIntentBody = {
  amount?: number;
};

export async function createPaymentIntentHandler(request: Request): Promise<Response> {
  try {
    const secretKey =
      process.env.STRIPE_SECRET_KEY ?? process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY;

    if (!secretKey) {
      return Response.json(
        {
          error:
            'Missing STRIPE_SECRET_KEY (or EXPO_PUBLIC_STRIPE_SECRET_KEY). Add it to .env.local and restart Expo.',
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as PaymentIntentBody;
    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount < 50) {
      return Response.json(
        { error: 'amount must be an integer number of cents (min 50).' },
        { status: 400 },
      );
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ error: message }, { status: 400 });
  }
}
