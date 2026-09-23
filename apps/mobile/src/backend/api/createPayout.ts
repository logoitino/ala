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
 * 2026-09 audit, critical, not yet resolved: there is no ledger anywhere (this route, `queueCustodialPayout`,
 * or a table) that tracks how much a given profile has actually earned vs. already been paid — `amountCents`
 * was trusted verbatim from the client and handed straight to `stripe.transfers.create`. Any authenticated
 * user who completes Stripe Express onboarding (a normal athlete/parent flow, not an admin action) could
 * request an arbitrary payout amount and have it wired out of the platform's own Stripe balance. Tips never
 * use Stripe destination charges (`createPaymentIntent.ts` has no `transfer_data`), so this endpoint is the
 * *only* path money ever leaves the platform balance — closing it here is not optional. Blocking real
 * transfers below until a real available-balance check is designed and this comment is removed.
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
      // 2026-09 audit, critical: no balance ledger exists yet to check `amountCents` against what
      // this profile has actually earned. Refusing every real transfer here (not just clamping the
      // amount) until that ledger is designed — this is the only path money leaves the platform's
      // Stripe balance, so trusting a client-supplied amount is a direct fund-theft vector, not a
      // vanity-metric one. Contact an admin for a manual disbursement in the meantime.
      return payoutJson(
        {
          status: 'error',
          message:
            'Self-service payouts are temporarily disabled while balance verification is built. Contact an admin for a manual disbursement.',
        },
        503,
      );
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
