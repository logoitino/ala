import { createStripeAccountHandler } from '@backend/api/createStripeAccount';

export async function POST(request: Request) {
  return createStripeAccountHandler(request);
}
