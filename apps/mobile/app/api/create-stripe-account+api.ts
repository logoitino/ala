/**
 * Expo API route (Metro only): POST sets up a Stripe Connect account for a payee.
 * All logic is in `src/backend/api/createStripeAccount.ts`; installed builds use the `create-stripe-account` Edge Function.
 */

import { createStripeAccountHandler } from '@backend/api/createStripeAccount';

export async function POST(request: Request) {
  return createStripeAccountHandler(request);
}
