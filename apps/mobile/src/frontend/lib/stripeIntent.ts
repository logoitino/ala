import { requireAccessToken } from '@/lib/sessionToken';

/**
 * @purpose Ask the JWT-gated Expo route for a PaymentIntent client secret (Mālo / exclusive / Drip / booster).
 * @param amount Integer cents charged by PaymentSheet (min 50, enforced server-side).
 * @param playerId `players.id` this charge is for, when there is one (Mālo tip / vault unlock / exclusive
 *   subscribe) — lets the server reject the charge before it happens when that athlete is Mālo-frozen
 *   (LEGAL_BRIEFING.md §8 item 5). Omit for player-agnostic charges (Drip merch, booster sponsorships).
 * @returns Stripe `clientSecret`.
 * @sideEffects `supabase.auth.getSession`; `POST /api/create-payment-intent` with `Authorization: Bearer`.
 */
export async function createPaymentIntent(amount: number, playerId?: string | null): Promise<string> {
  const accessToken = await requireAccessToken('Sign in to complete payment.');
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(playerId ? { amount, playerId } : { amount }),
  });

  const data = (await response.json()) as {
    clientSecret?: string | null;
    error?: string;
  };

  if (!response.ok || !data.clientSecret) {
    throw new Error(data.error ?? 'PaymentIntent did not return a clientSecret.');
  }

  return data.clientSecret;
}
