import { createPayoutHandler } from '@backend/api/createPayout';

export async function POST(request: Request) {
  return createPayoutHandler(request);
}
