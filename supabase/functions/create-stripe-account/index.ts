import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

import {
  CONNECT_PROFILE_COLUMNS,
  CONNECT_SIGN_IN_MESSAGE,
  runCreateStripeAccount,
} from '../_shared/money/connect.ts';
import { INVALID_SESSION_MESSAGE, errorResult, refuseLiveStripeKey, readBearerLoose, thrownMessage, type CoreResult } from '../_shared/money/http.ts';
import { resolveSession } from '../_shared/money/session.ts';

/**
 * Edge Function adapter for Stripe Connect Express set-up (Accounts v2) — the path installed builds use.
 *
 * SCALE-04: the mode, Terms / linked-account gates, account shape, links and stored flags are the shared money core
 * (`../_shared/money/connect.ts`), the same code the Metro route runs. This file keeps only what is Deno-specific:
 * `Deno.env`, `Deno.serve`, CORS, the `esm.sh` SDKs, the service-role profile client and this function's order of
 * checks (all configuration before the session). Creating a payee account is money-moving, so the session is
 * always confirmed live with `getUser` — never the local token check, which cannot see a sign-out before expiry.
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
    // Built once the request passes validation (first profile read), as before.
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
        loadProfile: async (userId) => {
          const { data: profile } = await adminDb()
            .from('profiles')
            .select(CONNECT_PROFILE_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();
          return profile;
        },
        saveFlags: async (profileId, userId, flags) => {
          await adminDb().from('profiles').update(flags).eq('id', profileId).eq('user_id', userId);
        },
        stripe: () => new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() }),
      }),
    );
  } catch (error) {
    return respond(errorResult(thrownMessage(error), 400));
  }
});
