import Stripe from 'stripe';

export type PayoutRequest = {
  amountCents: number;
  /** Server-resolved Connect id from `profiles.stripe_connect_id`. Never a client-supplied account. */
  destinationAccountId?: string;
  description: string;
};

export type PayoutResult = {
  status: 'queued' | 'transferred' | 'error';
  id?: string;
  message: string;
};

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

/**
 * @purpose Transfer athlete / parent custodial funds to the signed-in profile's Express account, or queue when Stripe is not configured.
 * @param request Integer cents (min 100) + description + optional server-resolved `destinationAccountId`.
 * @returns `{ status, message, id? }` — `queued` only if `STRIPE_SECRET_KEY` is missing.
 * @sideEffects Stripe `transfers.create` when the secret and a linked destination are present.
 */
export async function queueCustodialPayout(request: PayoutRequest): Promise<PayoutResult> {
  if (!Number.isInteger(request.amountCents) || request.amountCents < 100) {
    return { status: 'error', message: 'Payout amount must be at least $1.00.' };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      status: 'queued',
      message: `${request.description} queued for admin disbursement ($${
        (request.amountCents / 100).toFixed(2)
      }).`,
    };
  }

  if (!request.destinationAccountId) {
    return {
      status: 'error',
      message: 'No Stripe Express account is linked to this profile.',
    };
  }

  const transfer = await stripe.transfers.create({
    amount: request.amountCents,
    currency: 'usd',
    destination: request.destinationAccountId,
    description: request.description,
  });

  return {
    status: 'transferred',
    id: transfer.id,
    message: `Transferred $${(request.amountCents / 100).toFixed(2)} to the custodial account.`,
  };
}

/**
 * @purpose Athlete disbursement alias for `queueCustodialPayout` (same destination rules).
 * @param request Same as `queueCustodialPayout`.
 * @returns Payout result.
 * @sideEffects Stripe transfer when configured.
 */
export async function disburseAthleteFunds(request: PayoutRequest): Promise<PayoutResult> {
  return queueCustodialPayout({
    ...request,
    description: request.description || 'Athlete disbursement',
  });
}
