/**
 * Expo API route (Metro only): POST creates a Stripe PaymentIntent for a donation.
 * All logic is in `src/backend/api/createPaymentIntent.ts`. Installed builds call the `create-payment-intent`
 * Edge Function first and fall back to this route only when it is not deployed.
 */

import { createPaymentIntentHandler } from '@backend/api/createPaymentIntent';

export async function POST(request: Request) {
  return createPaymentIntentHandler(request);
}
