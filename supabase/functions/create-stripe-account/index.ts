import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements', 'defaults'] as const;

type ConnectMode = 'onboarding' | 'dashboard' | 'status';

type ConnectPayload = {
  url: string | null;
  accountId: string;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function flagsFromAccount(account: Stripe.V2.Core.Account): Pick<
  ConnectPayload,
  'stripe_onboarding_complete' | 'payouts_enabled'
> {
  const dueFromUser = (account.requirements?.entries ?? []).some(
    (entry) => entry.awaiting_action_from === 'user',
  );
  const recipient = account.configuration?.recipient;
  const transfers = recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const payouts = recipient?.capabilities?.stripe_balance?.payouts?.status;
  return {
    stripe_onboarding_complete: Boolean(recipient?.applied) && !dueFromUser,
    payouts_enabled: payouts === 'active' || transfers === 'active',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return json({ error: 'Sign in to connect payouts.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      return json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' }, 500);
    }
    if (!stripeSecret) {
      return json({ error: 'Missing STRIPE_SECRET_KEY.' }, 500);
    }
    if (!serviceKey) {
      return json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData.user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const body = (await req.json()) as {
      returnUrl?: string;
      refreshUrl?: string;
      mode?: ConnectMode;
    };
    const mode: ConnectMode =
      body.mode === 'dashboard' || body.mode === 'status' ? body.mode : 'onboarding';
    const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
    const refreshUrl = (typeof body.refreshUrl === 'string' ? body.refreshUrl.trim() : '') || returnUrl;
    if (mode !== 'status' && (!returnUrl || !refreshUrl)) {
      return json({ error: 'returnUrl is required for Connect onboarding.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile } = await admin
      .from('profiles')
      .select('id, stripe_connect_id, legal_terms_accepted_at, legal_terms_version')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    const storedAccountId =
      typeof profile?.stripe_connect_id === 'string' && profile.stripe_connect_id.trim()
        ? profile.stripe_connect_id.trim()
        : null;

    if (mode === 'onboarding' && !storedAccountId && !profile?.legal_terms_accepted_at) {
      return json({ error: 'Agree to Terms of Service & NIL Compliance before connecting a bank.' }, 403);
    }

    if ((mode === 'dashboard' || mode === 'status') && !storedAccountId) {
      return json({ error: 'No Stripe Express account is linked to this athlete yet.' }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const account = storedAccountId
      ? await stripe.v2.core.accounts.retrieve(storedAccountId, {
          include: [...ACCOUNT_INCLUDE],
        })
      : await stripe.v2.core.accounts.create({
          display_name: "Tapua'i Athlete",
          contact_email: authData.user.email?.trim() || 'athlete@tapuai.app',
          dashboard: 'express',
          identity: {
            country: 'us',
            entity_type: 'individual',
          },
          defaults: {
            currency: 'usd',
            responsibilities: {
              fees_collector: 'application',
              losses_collector: 'application',
            },
            profile: {
              product_description: "Tapua'i athlete receiving Mālo tips and subscriptions",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: {
                  stripe_transfers: { requested: true },
                },
              },
            },
          },
          metadata: { tapuai_user_id: authData.user.id },
          include: [...ACCOUNT_INCLUDE],
        });

    const flags = flagsFromAccount(account);
    const payload: ConnectPayload = {
      url: null,
      accountId: account.id,
      ...flags,
    };

    if (mode !== 'status') {
      if (mode === 'dashboard' && flags.stripe_onboarding_complete) {
        try {
          const login = await stripe.accounts.createLoginLink(account.id);
          payload.url = login.url;
        } catch {
          // Fall through to a v2 Account Link.
        }
      }

      if (!payload.url) {
        const link = await stripe.v2.core.accountLinks.create({
          account: account.id,
          use_case: flags.stripe_onboarding_complete
            ? {
                type: 'account_update',
                account_update: {
                  configurations: ['recipient'],
                  return_url: returnUrl,
                  refresh_url: refreshUrl,
                  collection_options: { fields: 'eventually_due' },
                },
              }
            : {
                type: 'account_onboarding',
                account_onboarding: {
                  configurations: ['recipient'],
                  return_url: returnUrl,
                  refresh_url: refreshUrl,
                  collection_options: { fields: 'eventually_due' },
                },
              },
        });
        payload.url = link.url;
      }
    }

    if (profile?.id) {
      await admin
        .from('profiles')
        .update({
          stripe_connect_id: payload.accountId,
          stripe_onboarding_complete: payload.stripe_onboarding_complete,
          payouts_enabled: payload.payouts_enabled,
        })
        .eq('id', profile.id)
        .eq('user_id', authData.user.id);
    }

    return json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 400);
  }
});
