/**
 * Money server core (SCALE-04): the payout decision. Reads the request, resolves the destination from the caller's
 * own profile only, and keeps self-service payouts blocked (503) while no balance ledger exists (STATE §0; COMMERCE
 * debt item 5). Only the Node / Metro route `POST /api/create-payout` uses it today: there is deliberately no Edge
 * twin, and none should be added until payouts are designed (amount owed, `athlete_payout_allowed`,
 * `payee_for_player`, two-person approval).
 *
 * The transfer / admin-queue step stays in `apps/mobile/src/backend/services/payouts.ts`. Requesting a payout is
 * money-moving, so the adapter confirms the live session with `getUser`, never the local token check.
 */

import type { CoreResult } from './http.ts';
import { storedConnectAccountId } from './connect.ts';

/** 401 copy when the Bearer header is missing on a payout request. */
export const PAYOUT_SIGN_IN_MESSAGE = 'Sign in to request a payout.';
/** Columns the payout gate reads from the caller's `profiles` row. */
export const PAYOUT_PROFILE_COLUMNS = 'id, stripe_connect_id, payouts_enabled';
/** The answer every real transfer gets until balance verification exists. */
export const PAYOUTS_BLOCKED_MESSAGE =
  'Self-service payouts are temporarily disabled while balance verification is built. Contact an admin for a manual disbursement.';

/** What the route does next: answer now, or hand a server-resolved destination to the queue step. */
export type PayoutDecision =
  | { action: 'respond'; result: CoreResult }
  | { action: 'queue'; destinationAccountId: string | undefined };

function payoutError(message: string, status: number): CoreResult {
  return { status, body: { status: 'error', message } };
}

/**
 * @purpose Read a payout request. Any client-supplied destination is ignored by construction.
 * @param body Parsed JSON (throws for the adapter's catch-all when it is not an object).
 * @returns `amountCents` (validated later by the queue step) and a trimmed description (default "Tapua'i payout").
 */
export function parsePayoutBody(body: unknown): { amountCents: number; description: string } {
  const raw = body as { amountCents?: unknown; description?: unknown };
  const amountCents = Number(raw.amountCents);
  const description =
    typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : "Tapua'i payout";
  return { amountCents, description };
}

/**
 * @purpose Decide a payout for the signed-in caller from their own profile row.
 * @param profile The caller's `profiles` row (`stripe_connect_id`, `payouts_enabled`), or null.
 * @param stripeConfigured Whether the server has a Stripe secret key.
 * @returns With Stripe configured: 400 (no linked account / payouts not enabled) or 503 (blocked) — never a transfer.
 *   Without Stripe: `queue` with the stored destination, so the queue step reports it for an admin.
 */
export function decidePayout(
  profile: { stripe_connect_id?: unknown; payouts_enabled?: unknown } | null | undefined,
  stripeConfigured: boolean,
): PayoutDecision {
  const storedAccountId = storedConnectAccountId(profile);
  if (stripeConfigured) {
    if (!storedAccountId) {
      return { action: 'respond', result: payoutError('No Stripe Express account is linked to this profile.', 400) };
    }
    if (!profile?.payouts_enabled) {
      return {
        action: 'respond',
        result: payoutError('Payouts are not enabled for this Stripe Express account yet.', 400),
      };
    }
    // No balance ledger yet to check the amount against what this payee is owed: refuse every real transfer.
    return { action: 'respond', result: payoutError(PAYOUTS_BLOCKED_MESSAGE, 503) };
  }
  return { action: 'queue', destinationAccountId: storedAccountId ?? undefined };
}

/**
 * @purpose HTTP status for the queue step's result.
 * @param result `{ status: 'queued' | 'transferred' | 'error' }`.
 * @returns 400 for `error`, else 200.
 */
export function payoutResultStatus(result: { status: string }): number {
  return result.status === 'error' ? 400 : 200;
}
