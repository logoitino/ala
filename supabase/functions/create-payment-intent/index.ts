import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const body = (await req.json()) as { amount?: number };
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 50) {
      return json({ error: 'amount must be an integer number of cents (min 50).' }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { tapuai_user_id: authData.user.id },
    });

    return json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 400);
  }
});
