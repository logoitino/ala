/**
 * Metro / Node adapter for payout requests (`POST /api/create-payout`). Node-only on purpose: there is no Edge twin
 * and none should be added while payouts are blocked (SCALE-04 note). The request reading, destination resolution
 * and the 503 block live in the shared money core (`supabase/functions/_shared/money/payout.ts`); the transfer /
 * admin-queue step stays in `../services/payouts.ts`. Requesting a payout moves money, so the session is always
 * confirmed live with `getUser` (no local token check).
 */

import { thrownMessage } from '../../../../../supabase/functions/_shared/money/http.ts';
import {
  PAYOUT_PROFILE_COLUMNS,
  PAYOUT_SIGN_IN_MESSAGE,
  decidePayout,
  parsePayoutBody,
  payoutResultStatus,
} from '../../../../../supabase/functions/_shared/money/payout.ts';
import { queueCustodialPayout } from '../services/payouts';
import { createAuthedDb, requireAuthedUser } from './session';

function payoutJson(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/**
 * @purpose JWT-gated custodial payout. Destination is `profiles.stripe_connect_id` for `auth.uid()`, never a client account id.
 * @param request JSON `{ amountCents, description }` plus `Authorization: Bearer <access_token>`.
 * @returns `{ status, message, id? }` — 503 for every real transfer while blocked; queues only if `STRIPE_SECRET_KEY` is missing.
 * @sideEffects `supabase.auth.getUser` (live session, every call); `profiles` SELECT (service role or user-scoped).
 * 2026-09 audit, critical, not yet resolved: there is no ledger anywhere (this route, `queueCustodialPayout`,
 * or a table) that tracks how much a given profile has actually earned vs. already been paid — `amountCents`
 * was trusted verbatim from the client and handed straight to `stripe.transfers.create`. Any authenticated
 * user who completes Stripe Express onboarding could request an arbitrary payout amount and have it wired out of
 * the platform's own Stripe balance. Tips never use Stripe destination charges (no `transfer_data`), so this
 * endpoint is the *only* path money ever leaves the platform balance — closing it here is not optional. Real
 * transfers stay blocked (`decidePayout`) until a real available-balance check is designed and this comment is removed.
 */
export async function createPayoutHandler(request: Request): Promise<Response> {
  try {
    const auth = await requireAuthedUser(request, PAYOUT_SIGN_IN_MESSAGE);
    if (!auth.ok) {
      return payoutJson({ status: 'error', message: auth.message }, auth.status);
    }

    const { amountCents, description } = parsePayoutBody(await request.json());

    const db = createAuthedDb({
      supabaseUrl: auth.supabaseUrl,
      anonKey: auth.anonKey,
      jwt: auth.jwt,
    });
    const { data: profile } = await db
      .from('profiles')
      .select(PAYOUT_PROFILE_COLUMNS)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    const decision = decidePayout(profile, Boolean(process.env.STRIPE_SECRET_KEY));
    if (decision.action === 'respond') {
      return payoutJson(decision.result.body, decision.result.status);
    }

    const result = await queueCustodialPayout({
      amountCents,
      destinationAccountId: decision.destinationAccountId,
      description,
    });
    return Response.json(result, { status: payoutResultStatus(result) });
  } catch (error) {
    return Response.json({ status: 'error', message: thrownMessage(error) }, { status: 400 });
  }
}
