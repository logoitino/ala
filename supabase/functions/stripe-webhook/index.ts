/**
 * NOTIFY-01: verify raw Stripe events and durably observe prepared donation context in one service-only RPC.
 * Donation credit/Aura remains client-owned. Rich metadata alone never writes business rows, claims financial
 * application or emits a receipt. Context producers are unwired; notificationAuthority is hard-constrained false.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';
import { refuseLiveStripeKey } from '../_shared/money/http.ts';
import { runVerifiedPaymentEvent } from '../_shared/money/paymentEvent.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature' };
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!secret || !signingSecret || !url || !serviceKey) return json({ error: 'Payment observation unavailable.' }, 503);
  const liveKey = refuseLiveStripeKey(secret);
  if (liveKey) return json(liveKey.body, liveKey.status);
  const signature = req.headers.get('Stripe-Signature') ?? '';
  if (!signature) return json({ error: 'Missing Stripe-Signature header.' }, 400);
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  let event: Stripe.Event;
  try {
    // Parsing or rewriting JSON before this check would destroy the provider's signature evidence.
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, signingSecret);
  } catch { return json({ error: 'Invalid payment signature.' }, 400); }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await runVerifiedPaymentEvent({ event,
    retrieveIntent: (id) => stripe.paymentIntents.retrieve(id),
    retrieveCharge: (id) => stripe.charges.retrieve(id),
    apply: (observation) => admin.rpc('apply_notification_payment_event', observation),
  });
  return json(result.body, result.status);
});
