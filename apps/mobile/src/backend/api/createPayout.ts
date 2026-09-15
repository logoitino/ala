import { queueCustodialPayout } from '../services/payouts';
import { createAuthedDb, requireAuthedUser } from './session';

type PayoutBody = {
  amountCents?: number;
  description?: string;
};

function payoutJson(
  body: { status: string; message: string; id?: string },
  status: number,
): Response {
  return Response.json(body, { status });
}

/**
 * @purpose JWT-gated custodial payout. Destination is `profiles.stripe_connect_id` for `auth.uid()`, never a client account id.
 * @param request JSON `{ amountCents, description }` plus `Authorization: Bearer <access_token>`.
 * @returns `{ status, message, id? }` — transfers when Stripe + linked payouts are ready; queues only if `STRIPE_SECRET_KEY` is missing.
 * @sideEffects `supabase.auth.getUser`; `profiles` SELECT (service role or user-scoped); Stripe Transfer when configured.
 */
export async function createPayoutHandler(request: Request): Promise<Response> {
  try {
    const auth = await requireAuthedUser(request, 'Sign in to request a payout.');
    if (!auth.ok) {
      return payoutJson({ status: 'error', message: auth.message }, auth.status);
    }

    const body = (await request.json()) as PayoutBody;
    const amountCents = Number(body.amountCents);
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : "Tapua'i payout";

    const db = createAuthedDb({
      supabaseUrl: auth.supabaseUrl,
      anonKey: auth.anonKey,
      jwt: auth.jwt,
    });
    const { data: profile } = await db
      .from('profiles')
      .select('id, stripe_connect_id, payouts_enabled')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    const storedAccountId =
      typeof profile?.stripe_connect_id === 'string' && profile.stripe_connect_id.trim()
        ? profile.stripe_connect_id.trim()
        : null;

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
    if (stripeConfigured) {
      if (!storedAccountId) {
        return payoutJson(
          { status: 'error', message: 'No Stripe Express account is linked to this profile.' },
          400,
        );
      }
      if (!profile?.payouts_enabled) {
        return payoutJson(
          {
            status: 'error',
            message: 'Payouts are not enabled for this Stripe Express account yet.',
          },
          400,
        );
      }
    }

    const result = await queueCustodialPayout({
      amountCents,
      destinationAccountId: storedAccountId ?? undefined,
      description,
    });

    const status = result.status === 'error' ? 400 : 200;
    return Response.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ status: 'error', message }, { status: 400 });
  }
}
