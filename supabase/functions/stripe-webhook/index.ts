import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

/**
 * BACKEND — server-side Stripe payment verification.
 *
 * Why this exists: today `add_user_aura` / `tips` / `subscriptions` are written by the CLIENT
 * right after `presentPaymentSheet()` resolves (see `apps/mobile/src/frontend/hooks/useTipCheckout.ts`).
 * That means a modified client (or a raw REST call with the anon key) can insert a fabricated
 * `tips` row or call `add_user_aura` without any Stripe charge ever happening. RLS/RPC grants were
 * tightened in the same change that added this function (see `apps/mobile/src/backend/db/schema.sql`),
 * but the *only* real fix is a source of truth that a charge genuinely succeeded — this webhook.
 *
 * Deploy checklist (none of this can be done from here — it needs the project owner's Stripe + Supabase access):
 *   1. `supabase functions deploy stripe-webhook`
 *   2. Stripe Dashboard → Developers → Webhooks → Add endpoint →
 *      `https://<project-ref>.functions.supabase.co/stripe-webhook`, subscribe to `payment_intent.succeeded`.
 *   3. Copy the "Signing secret" Stripe shows for that endpoint and set it as a function secret:
 *      `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref <project-ref>`
 *      (never hardcode it; it is read from env below).
 *   4. This function also needs `SUPABASE_SERVICE_ROLE_KEY` set (Supabase sets this automatically for
 *      Edge Functions in most projects — confirm it's present, since the service role is what lets this
 *      function write `tips` / `subscriptions` / Aura directly, bypassing the (now-tightened) client RLS).
 *
 * Current scope of what this function does today: verifies the signature, and — because
 * `createPaymentIntentHandler` (`apps/mobile/src/backend/api/createPaymentIntent.ts`) only stamps
 * `metadata.tapuai_user_id` on the PaymentIntent right now, with no player/reel/kind/amount-purpose
 * context — it can confirm *that a real charge for a real signed-in user succeeded* and records that
 * fact, but it cannot yet safely attribute the charge to a specific athlete/reel/wishlist item and
 * write `tips` / `subscriptions` / award Aura on its own without risking double-crediting or crediting
 * the wrong target. Once COMMERCE adds `tip_player_id` / `tip_reel_id` / `tip_kind` / `tip_aura_points`
 * (and, for Drip, `tip_product_id`) to the PaymentIntent metadata at creation time, the block below
 * (`if (richMetadataPresent)`) performs the authoritative, server-verified ledger write and Aura award —
 * uncapped, unlike the client-facing `add_user_aura` RPC, because a webhook event IS the proof of payment.
 * COMMERCE STILL NEEDS TO: (a) add that metadata in `createPaymentIntentHandler`, and (b) once this has
 * been running clean for a bit, stop the client-side `tips` INSERT / `add_user_aura` calls in
 * `useTipCheckout.ts` so this webhook becomes the only writer. Left in place intentionally for now —
 * removing the client write path is a COMMERCE-owned behavior change, not a BACKEND one.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!stripeSecret) return json({ error: 'Missing STRIPE_SECRET_KEY.' }, 500);
  if (!webhookSecret) return json({ error: 'Missing STRIPE_WEBHOOK_SECRET.' }, 500);
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }

  const signature = req.headers.get('Stripe-Signature') ?? req.headers.get('stripe-signature') ?? '';
  if (!signature) {
    return json({ error: 'Missing Stripe-Signature header.' }, 400);
  }

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  // Signature verification MUST run against the raw request body, before any JSON parsing —
  // this is what actually proves the event came from Stripe and was not fabricated/replayed
  // with a tampered payload.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid signature';
    console.error('[stripe-webhook] signature verification failed', message);
    return json({ error: `Webhook signature verification failed: ${message}` }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const metadata = intent.metadata ?? {};
      const tapuaiUserId = typeof metadata.tapuai_user_id === 'string' ? metadata.tapuai_user_id : null;

      // Idempotency: Stripe retries webhooks, and the same PaymentIntent can legitimately fire
      // `succeeded` more than once. Always key any ledger write off `intent.id`, never just "we
      // got an event", so a retry cannot double-credit Aura or double-insert a tip.
      const alreadyProcessed = await admin
        .from('telemetry_logs')
        .select('id')
        .eq('event_type', 'stripe_webhook_payment_succeeded')
        .contains('payload', { payment_intent_id: intent.id })
        .maybeSingle();

      if (alreadyProcessed.data?.id) {
        return json({ received: true, duplicate: true });
      }

      const richPlayerId = typeof metadata.tip_player_id === 'string' ? metadata.tip_player_id : null;
      const richKind = typeof metadata.tip_kind === 'string' ? metadata.tip_kind : null;
      const richAuraPoints = Number(metadata.tip_aura_points);
      const richMetadataPresent = Boolean(tapuaiUserId && richPlayerId && richKind);

      if (richMetadataPresent && richPlayerId && tapuaiUserId) {
        // Authoritative, server-verified write. Trusted because this code only runs after
        // `constructEventAsync` above proved Stripe actually charged the card — unlike the
        // client-facing `add_user_aura` RPC, no per-call cap is needed here.
        const auraPoints = Number.isFinite(richAuraPoints) && richAuraPoints > 0 ? Math.round(richAuraPoints) : 0;

        if (richKind === 'malo') {
          await admin.from('tips').insert({
            player_id: richPlayerId,
            amount_cents: intent.amount_received || intent.amount,
            fan_id: tapuaiUserId,
            reel_id: typeof metadata.tip_reel_id === 'string' ? metadata.tip_reel_id : null,
            aura_points: auraPoints,
          });
        }

        if (auraPoints > 0) {
          await admin.rpc('add_user_aura', { target_user_id: tapuaiUserId, points_to_add: auraPoints });
          if (richPlayerId !== tapuaiUserId) {
            await admin.rpc('add_user_aura', { target_user_id: richPlayerId, points_to_add: auraPoints });
          }
        }
      }

      await admin.from('telemetry_logs').insert({
        event_type: 'stripe_webhook_payment_succeeded',
        payload: {
          payment_intent_id: intent.id,
          tapuai_user_id: tapuaiUserId,
          amount_cents: intent.amount_received || intent.amount,
          rich_metadata_applied: richMetadataPresent,
        },
      });
    }

    return json({ received: true });
  } catch (error) {
    // Return 500 so Stripe retries the event instead of silently dropping a verified payment.
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[stripe-webhook] handler error', message);
    return json({ error: message }, 500);
  }
});
