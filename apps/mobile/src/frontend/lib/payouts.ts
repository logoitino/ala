import { requireAccessToken } from '@/lib/sessionToken';

/**
 * @purpose Request a custodial payout for the signed-in profile. Destination is resolved server-side from `profiles.stripe_connect_id`.
 * @param input Integer cents plus a description. Never send a Connect account id from the client.
 * @returns `{ status, message, id? }` from `POST /api/create-payout`.
 * @sideEffects `supabase.auth.getSession`; JWT `POST /api/create-payout`.
 */
export async function requestPayout(input: {
  amountCents: number;
  description: string;
}): Promise<{ status: string; message: string; id?: string }> {
  const accessToken = await requireAccessToken('Sign in to request a payout.');
  const response = await fetch('/api/create-payout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      amountCents: input.amountCents,
      description: input.description,
    }),
  });

  const data = (await response.json()) as {
    status?: string;
    message?: string;
    id?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Payout request failed.');
  }

  return {
    status: data.status ?? 'queued',
    message: data.message ?? 'Queued.',
    id: data.id,
  };
}
