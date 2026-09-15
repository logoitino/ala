import { queueCustodialPayout } from '../services/payouts';

type PayoutBody = {
  amountCents?: number;
  destinationAccountId?: string;
  description?: string;
};

export async function createPayoutHandler(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as PayoutBody;
    const amountCents = Number(body.amountCents);
    const result = await queueCustodialPayout({
      amountCents,
      destinationAccountId: body.destinationAccountId,
      description: body.description ?? "Tapua'i payout",
    });

    const status = result.status === 'error' ? 400 : 200;
    return Response.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ status: 'error', message }, { status: 400 });
  }
}
