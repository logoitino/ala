import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

import {
  CONNECT_FAILURE_MESSAGE,
  ConnectContextError,
  CONNECT_SIGN_IN_MESSAGE,
  runCreateStripeAccount,
} from '../_shared/money/connect.ts';
import { INVALID_SESSION_MESSAGE, errorResult, refuseLiveStripeKey, readBearerLoose, type CoreResult } from '../_shared/money/http.ts';
import { resolveSession } from '../_shared/money/session.ts';

/**
 * Edge Function adapter for Stripe Connect Express set-up (Accounts v2) — the path installed builds use.
 *
 * SCALE-04: the mode, Terms / linked-account gates, account shape, links and stored flags are the shared money core
 * (`../_shared/money/connect.ts`), the same code the Metro route runs. This file keeps only what is Deno-specific:
 * `Deno.env`, `Deno.serve`, CORS, the `esm.sh` SDKs, the service-role context client and this function's order of
 * checks (all configuration before the session). Creating a payee account is money-moving, so the session is
 * always confirmed live with `getUser` — never the local token check, which cannot see a sign-out before expiry.
 * Profile errors/zero-row updates stop the flow; the core confirms the saved binding before minting any link.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = readBearerLoose(authHeader);
    if (!jwt) {
      return respond(errorResult(CONNECT_SIGN_IN_MESSAGE, 401));
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      return respond(errorResult('Missing SUPABASE_URL or SUPABASE_ANON_KEY.', 500));
    }
    if (!stripeSecret) {
      return respond(errorResult('Missing STRIPE_SECRET_KEY.', 500));
    }
    const liveKey = refuseLiveStripeKey(stripeSecret);
    if (liveKey) return respond(liveKey);
    if (!serviceKey) {
      return respond(errorResult('Missing SUPABASE_SERVICE_ROLE_KEY.', 500));
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Money-moving: no `verifyLocally`, so a signed-out session is caught even before its token expires.
    const session = await resolveSession(jwt, {
      getUser: async (token) => {
        const { data, error } = await userClient.auth.getUser(token);
        return { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null, error };
      },
    });
    if (!session.ok) {
      return respond(errorResult(INVALID_SESSION_MESSAGE, 401));
    }

    const body: unknown = await req.json();
    // Built once the request passes validation (first context read), as before.
    const makeAdminDb = () =>
      createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    let admin: ReturnType<typeof makeAdminDb> | null = null;
    const adminDb = () => (admin ??= makeAdminDb());

    return respond(
      await runCreateStripeAccount({
        user: session.user,
        body,
        loadContext: async (userId, playerId) => {
          const { data, error } = await adminDb().rpc('stripe_connect_context', {
            actor_user_id: userId, target_player_id: playerId,
          });
          if (error) throw new ConnectContextError(error.code === '42501');
          return data;
        },
        saveAccount: async (profileId, userId, flags, expectedAccountId, playerId) => {
          // The service-only function rechecks current guardianship/consent after the Stripe await.
          const { data, error } = await adminDb().rpc('save_stripe_connect_account', {
            actor_user_id: userId, target_player_id: playerId, expected_profile_id: profileId,
            expected_account_id: expectedAccountId, account_id: flags.stripe_connect_id,
            onboarding_complete: flags.stripe_onboarding_complete, transfers_enabled: flags.payouts_enabled,
          });
          if (error || data !== flags.stripe_connect_id) throw new Error('Connect account save was not confirmed.');
        },
        stripe: () => new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() }),
      }),
    );
  } catch {
    return respond(errorResult(CONNECT_FAILURE_MESSAGE, 400));
  }
});
