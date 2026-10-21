/** NOTIFY-01 verified provider adapter: persist observations only; money and receipt producers remain unavailable. */
import type { CoreResult } from './http.ts';
import { errorResult } from './http.ts';

type ProviderObject = {
  id: string; amount: number; currency: string; livemode: boolean;
  amount_received?: number; amount_refunded?: number; payment_intent?: string | { id: string } | null;
  charge?: string | { id: string } | null; metadata?: Record<string, string>;
};
export type VerifiedPaymentEvent = { id: string; type: string; livemode: boolean; data: { object: unknown } };
export type PaymentObservation = {
  provider_event_id: string; provider_intent_id: string; observation_kind: 'success' | 'refund' | 'dispute';
  provider_livemode: false; currency_code: 'usd'; total_cents: number; refunded_cents: number;
  context_metadata: Record<string, string>;
};
const unavailable = (): CoreResult => ({ status: 200, body: { received: true, notification: 'unavailable' } });
const failure = (): CoreResult => errorResult('Payment observation unavailable.', 503);
const referenceId = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;
const wholeCents = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Runtime signature verification precedes this function. All affected provider objects must match before the one SQL commit. */
export async function runVerifiedPaymentEvent(input: {
  event: VerifiedPaymentEvent;
  retrieveIntent: (id: string) => Promise<unknown>;
  retrieveCharge: (id: string) => Promise<unknown>;
  apply: (observation: PaymentObservation) => PromiseLike<{ data: unknown; error: unknown }>;
}): Promise<CoreResult> {
  const event = input.event;
  if (event.livemode !== false) return failure();
  if (!['payment_intent.succeeded', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'].includes(event.type)) {
    return { status: 200, body: { received: true, notification: 'not_applicable' } };
  }
  try {
    if (!/^evt_[a-zA-Z0-9_]+$/.test(event.id)) return failure();
    let object = event.data.object as ProviderObject;
    let kind: PaymentObservation['observation_kind'] = 'success';
    let charge: ProviderObject | undefined;
    let refund = 0;
    if (event.type !== 'payment_intent.succeeded') {
      kind = event.type === 'charge.refunded' ? 'refund' : 'dispute';
      if (kind === 'dispute') {
        const chargeId = referenceId(object.charge);
        if (!chargeId || object.livemode !== false || object.currency !== 'usd') return failure();
        charge = await input.retrieveCharge(chargeId) as ProviderObject;
        if (charge.id !== chargeId || !wholeCents(object.amount) || object.amount > charge.amount
          || object.currency !== charge.currency) return failure();
      } else charge = object;
      const intentId = referenceId(charge.payment_intent);
      if (!intentId || charge.livemode !== false) return failure();
      object = await input.retrieveIntent(intentId) as ProviderObject;
      if (object.id !== intentId || charge.amount !== object.amount || charge.currency !== object.currency) return failure();
      if (kind === 'refund') {
        if (!wholeCents(charge.amount_refunded) || charge.amount_refunded > object.amount) return failure();
        refund = charge.amount_refunded;
      }
    }
    if (!/^pi_[a-zA-Z0-9_]+$/.test(object.id) || object.livemode !== false || object.currency !== 'usd'
      || !wholeCents(object.amount) || object.amount < 50
      || (kind === 'success' && object.amount_received !== object.amount)) return failure();
    // A shared player ID, old tip_kind or a client tips row provides no receipt authority and makes no event claim.
    if (!object.metadata?.tapuai_context_id) return unavailable();
    const result = await input.apply({ provider_event_id: event.id, provider_intent_id: object.id,
      observation_kind: kind, provider_livemode: false, currency_code: 'usd', total_cents: object.amount,
      refunded_cents: refund, context_metadata: object.metadata });
    const value = result.data as { status?: unknown; notification?: unknown } | null;
    // This adapter accepts only the prepared, explicitly unavailable contract. A future business writer requires review.
    if (result.error || !value || value.status !== 'source_unavailable' || value.notification !== 'unavailable') return failure();
    return unavailable();
  } catch { return failure(); }
}
