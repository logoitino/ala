/**
 * Expo API route (Metro only): POST requests a payout. All logic is in `src/backend/api/createPayout.ts`.
 * Payouts are not live yet (the handler answers 503) — see docs/STATE.md.
 */

import { createPayoutHandler } from '@backend/api/createPayout';

export async function POST(request: Request) {
  return createPayoutHandler(request);
}
