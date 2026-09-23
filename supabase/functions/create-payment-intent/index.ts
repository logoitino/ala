import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

/**
 * 2026-09 Round 10 sweep: this function was a stale duplicate of
 * `apps/mobile/src/backend/api/createPaymentIntent.ts` (the Metro API route `stripeIntent.ts`
 * actually calls) — it never got the `playerId` / `malo_target_frozen` pre-charge freeze check
 * added to that route for the Mālo-freeze compliance feature. Unused today (nothing in the app
 * calls this Edge Function), but it is still a live, deployable public endpoint, and an earlier
 * deploy checklist for this repo said to deploy all three `supabase/functions/*` — doing that for
 * this one, unfixed, would have shipped a way to pay a frozen athlete that bypassed the same check
 * every other path enforces. Brought to parity rather than left to drift further.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return json({ error: 'Sign in to complete payment.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      return json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' }, 500);
    }
    if (!stripeSecret) {
      return json({ error: 'Missing STRIPE_SECRET_KEY.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData.user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const body = (await req.json()) as { amount?: number; playerId?: string };
    const amount = Number(body.amount);
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';

    if (!Number.isInteger(amount) || amount < 50) {
      return json({ error: 'amount must be an integer number of cents (min 50).' }, 400);
    }

    if (playerId) {
      if (!UUID_RE.test(playerId)) {
        return json({ error: 'playerId must be a uuid.' }, 400);
      }
      const { data: frozen, error: frozenError } = await userClient.rpc('malo_target_frozen', {
        target_player_id: playerId,
      });
      // Same fail-open-on-lookup-error reasoning as the Metro route: a missing RPC or transient DB
      // issue must not block every checkout, and the RPC-level checks in `add_user_aura` /
      // `increment_backer_count` / `increment_reel_tips` still catch a frozen athlete regardless.
      if (!frozenError && frozen === true) {
        return json({ error: 'This athlete cannot currently receive Mālo.' }, 403);
      }
    }

    const stripe = new Stripe(stripeSecret, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        tapuai_user_id: authData.user.id,
        ...(playerId ? { tapuai_player_id: playerId } : {}),
      },
    });

    return json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 400);
  }
});
