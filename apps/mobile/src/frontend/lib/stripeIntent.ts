/** Shared checkout transport; donation declarations distinguish gifts from purchases but never prove settlement. Optional actor guards bind Edge and Metro dispatch to the checkout owner. */
import { assertCurrent } from '@/lib/offlineActor';
import type { PaymentActor } from '@/lib/payments';
import { apiUrl } from '@/lib/apiUrl';
import { isMissingEdgeFunction } from '@/lib/edgeFunction';
import { requireAccessToken } from '@/lib/sessionToken';
import { supabase } from '@/lib/supabase';

type IntentPayload = { clientSecret?: string | null; error?: string };

/**
 * @purpose Ask the JWT-gated server for a PaymentIntent client secret (Mālo / exclusive / Drip / booster).
 *   Edge Function `create-payment-intent` first, so an installed build works with no hosted Expo server;
 *   Metro `POST /api/create-payment-intent` only when that function is not deployed. Both run the same
 *   amount and Mālo-freeze checks.
 * @param amount Integer cents charged by PaymentSheet (min 50, enforced server-side).
 * @param playerId `players.id` this charge is for, when there is one (Mālo tip / vault unlock / exclusive
 *   subscribe) — lets the server reject the charge before it happens when that athlete is Mālo-frozen
 *   (LEGAL_BRIEFING.md §8 item 5). Omit for player-agnostic charges (Drip merch, booster sponsorships).
 * @param platformTipCents Optional tip to Tapua'i already included in `amount`; sent for Stripe metadata.
 * @returns Stripe `clientSecret`.
 * @sideEffects `supabase.auth.getSession`; `supabase.functions.invoke('create-payment-intent')`, else
 *   `POST /api/create-payment-intent` with `Authorization: Bearer`.
 */
export async function createPaymentIntent(
  amount: number,
  playerId?: string | null,
  platformTipCents = 0,
  donation?: { giftCents: number; coverFees: boolean; platformTipPercent: number },
  payment?: PaymentActor,
): Promise<string> {
  const accessToken = await requireAccessToken('Sign in to complete payment.', payment?.actor);
  const body = {
    amount,
    ...(playerId ? { playerId } : {}),
    ...(platformTipCents > 0 ? { platformTipCents } : {}),
    ...(donation ? { donation } : {}),
  };

  const { data: fnData, error: fnError } = await (payment?.client ?? supabase).functions.invoke('create-payment-intent', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (payment) assertCurrent(payment.actor);
  const fnPayload = (fnData ?? null) as IntentPayload | null;
  if (fnPayload?.clientSecret) return fnPayload.clientSecret;
  if (fnError && !isMissingEdgeFunction(fnError)) {
    const detail = await readFunctionError(fnError);
    throw new Error(detail ?? fnError.message ?? 'PaymentIntent did not return a clientSecret.');
  }
  if (!fnError && fnPayload?.error) throw new Error(fnPayload.error);

  if (payment) assertCurrent(payment.actor);
  const response = await fetch(apiUrl('/api/create-payment-intent'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as IntentPayload;
  if (payment) assertCurrent(payment.actor);

  if (!response.ok || !data.clientSecret) {
    throw new Error(data.error ?? 'PaymentIntent did not return a clientSecret.');
  }

  return data.clientSecret;
}

/** A non-2xx Edge Function reply (e.g. 403 frozen athlete) carries `{ error }` in its Response body. */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (!context || typeof (context as Response).json !== 'function') return null;
  try {
    const parsed = (await (context as Response).clone().json()) as IntentPayload;
    return typeof parsed.error === 'string' && parsed.error ? parsed.error : null;
  } catch {
    return null;
  }
}
