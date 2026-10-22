import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

import { createAccessTokenVerifier, type AccessTokenVerifier } from '../_shared/money/accessToken.ts';
import { INVALID_SESSION_MESSAGE, errorResult, refuseLiveStripeKey, readBearerLoose, thrownMessage, type CoreResult } from '../_shared/money/http.ts';
import { PAYMENT_SIGN_IN_MESSAGE, runCreatePaymentIntent } from '../_shared/money/paymentIntent.ts';
import { resolveSession } from '../_shared/money/session.ts';
import { serverDonationContextAdapter } from '../_shared/money/serverDonationContext.ts';

/**
 * Edge Function adapter for gift and purchase checkout — the primary checkout path: `lib/stripeIntent.ts` invokes this
 * function first and only falls back to the Metro route when it is not deployed, because an installed EAS build has
 * no Metro server to answer `/api/*`. Deploy it to every project testers use.
 *
 * SCALE-04: the validation, freeze check and PaymentIntent shape are the shared money core
 * (`../_shared/money/paymentIntent.ts`), the same code the Metro route runs, so the two can no longer drift (the
 * 2026-09 Round 10 sweep found this copy missing the `malo_target_frozen` pre-charge check). This file keeps only what
 * is Deno-specific: `Deno.env`, `Deno.serve`, CORS, the `esm.sh` SDKs and this function's order of checks
 * (configuration before the session). The session uses the local WebCrypto token check first and falls back to
 * `getUser`; checkout creates an intent but moves no money.
 */

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

function respond(result: CoreResult): Response {
  return json(result.body, result.status);
}

/** One local verifier (and JWKS cache) per isolate, rebuilt only if the project URL changes. */
let verifier: { supabaseUrl: string; verify: AccessTokenVerifier } | null = null;
function localVerifier(supabaseUrl: string, anonKey: string): AccessTokenVerifier {
  if (verifier?.supabaseUrl !== supabaseUrl) {
    verifier = {
      supabaseUrl,
      verify: createAccessTokenVerifier({
        supabaseUrl,
        apiKey: anonKey,
        fetch: (url, init) => fetch(url, init),
        subtle: globalThis.crypto?.subtle,
      }),
    };
  }
  return verifier.verify;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = readBearerLoose(authHeader);
    if (!jwt) {
      return respond(errorResult(PAYMENT_SIGN_IN_MESSAGE, 401));
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      return respond(errorResult('Missing SUPABASE_URL or SUPABASE_ANON_KEY.', 500));
    }
    if (!stripeSecret) {
      return respond(errorResult('Missing STRIPE_SECRET_KEY.', 500));
    }
    const liveKey = refuseLiveStripeKey(stripeSecret);
    if (liveKey) return respond(liveKey);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const session = await resolveSession(jwt, {
      getUser: async (token) => {
        const { data, error } = await userClient.auth.getUser(token);
        return { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null, error };
      },
      verifyLocally: localVerifier(supabaseUrl, anonKey),
    });
    if (!session.ok) {
      return respond(errorResult(INVALID_SESSION_MESSAGE, 401));
    }

    const body: unknown = await req.json();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    return respond(
      await runCreatePaymentIntent({
        userId: session.user.id,
        body,
        isTargetFrozen: (playerId) => userClient.rpc('malo_target_frozen', { target_player_id: playerId }),
        getStripe: () => new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() }),
        // Service-only quote admission is shared with Node; a missing key cannot become client authority.
        donationContext: serverDonationContextAdapter(serviceKey
          ? (name, args) => createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          }).rpc(name, args)
          : undefined),
      }),
    );
  } catch (error) {
    return respond(errorResult(thrownMessage(error), 400));
  }
});
