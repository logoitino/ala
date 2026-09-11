import Stripe from 'stripe';

export type PayoutRequest = {
  amountCents: number;
  destinationAccountId?: string;
  description: string;
};

export type PayoutResult = {
  status: 'queued' | 'transferred' | 'error';
  id?: string;
  message: string;
};

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export async function queueCustodialPayout(request: PayoutRequest): Promise<PayoutResult> {
  if (!Number.isInteger(request.amountCents) || request.amountCents < 100) {
    return { status: 'error', message: 'Payout amount must be at least $1.00.' };
  }

  const stripe = getStripe();
  if (!stripe || !request.destinationAccountId) {
    return {
      status: 'queued',
      message: `${request.description} queued for admin disbursement ($${
        (request.amountCents / 100).toFixed(2)
      }).`,
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

export async function disburseAthleteFunds(request: PayoutRequest): Promise<PayoutResult> {
  return queueCustodialPayout({
    ...request,
    description: request.description || 'Athlete disbursement',
  });
}
