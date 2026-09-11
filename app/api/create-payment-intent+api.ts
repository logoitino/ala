import { createPaymentIntentHandler } from '@backend/api/createPaymentIntent';

export async function POST(request: Request) {
  return createPaymentIntentHandler(request);
}
