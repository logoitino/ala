import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

type CreateStripeAccountBody = {
  returnUrl?: string;
  refreshUrl?: string;
  mode?: 'onboarding' | 'dashboard' | 'status';
};

export type StripeConnectPayload = {
  url: string | null;
  accountId: string;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

const ACCOUNT_INCLUDE = [
  'configuration.recipient',
  'requirements',
  'defaults',
] as const;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

function flagsFromAccount(account: Stripe.V2.Core.Account): Pick<
  StripeConnectPayload,
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

async function loadAccount(stripe: Stripe, accountId: string) {
  return stripe.v2.core.accounts.retrieve(accountId, {
    include: [...ACCOUNT_INCLUDE],
  });
}

function readBearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

/**
 * @purpose Create or resume a Stripe Connect Express account (Accounts v2) for the JWT subject and persist flags on `profiles`.
 * @param stripe Stripe SDK (secret key only on the server).
 * @param input Authenticated user + hosted return URLs. Never uses client `accountId` / `profileId`.
 * @returns `{ url, accountId, stripe_onboarding_complete, payouts_enabled }`.
 * @sideEffects Stripe `v2.core.accounts` / Account Links; service-role UPDATE of `profiles.stripe_*`.
 */
export async function runStripeConnectForUser(
  stripe: Stripe,
  input: {
    userId: string;
    email: string;
    storedAccountId: string | null;
    returnUrl: string;
    refreshUrl: string;
    mode: 'onboarding' | 'dashboard' | 'status';
  },
): Promise<StripeConnectPayload> {
  const account = input.storedAccountId
    ? await loadAccount(stripe, input.storedAccountId)
    : await stripe.v2.core.accounts.create({
        display_name: "Tapua'i Athlete",
        contact_email: input.email || 'athlete@tapuai.app',
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
        metadata: { tapuai_user_id: input.userId },
        include: [...ACCOUNT_INCLUDE],
      });

  const flags = flagsFromAccount(account);
  const payload: StripeConnectPayload = {
    url: null,
    accountId: account.id,
    ...flags,
  };

  if (input.mode === 'status') {
    return payload;
  }

  if (input.mode === 'dashboard' && flags.stripe_onboarding_complete) {
    try {
      const login = await stripe.accounts.createLoginLink(account.id);
      payload.url = login.url;
      return payload;
    } catch {
      // Fall through to a v2 Account Link if the Express dashboard login is not ready.
    }
  }

  const returnUrl = input.returnUrl;
  const refreshUrl = input.refreshUrl;
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
  return payload;
}

/**
 * @purpose JWT-gated Stripe Connect Express handler (Metro fallback). Production path is `supabase/functions/create-stripe-account`.
 * @param request JSON `{ returnUrl, refreshUrl, mode }` plus `Authorization: Bearer <access_token>`.
 * @returns `{ url, accountId, stripe_onboarding_complete, payouts_enabled }`.
 * @sideEffects Stripe Accounts v2; `profiles` UPDATE via service role when present.
 */
export async function createStripeAccountHandler(request: Request): Promise<Response> {
  try {
    const jwt = readBearerToken(request);
    if (!jwt) {
      return jsonError('Sign in to connect payouts.', 401);
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return jsonError('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.', 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !authData.user) {
      return jsonError('Invalid or expired session.', 401);
    }

    const stripe = getStripe();
    if (!stripe) {
      return jsonError(
        'Missing STRIPE_SECRET_KEY. Add it to .env.local (server only) and restart Expo.',
        500,
      );
    }

    const body = (await request.json()) as CreateStripeAccountBody;
    const mode = body.mode === 'dashboard' || body.mode === 'status' ? body.mode : 'onboarding';
    const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
    const refreshUrl = (typeof body.refreshUrl === 'string' ? body.refreshUrl.trim() : '') || returnUrl;

    if (mode !== 'status' && (!returnUrl || !refreshUrl)) {
      return jsonError('returnUrl is required for Connect onboarding.', 400);
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db = createClient(supabaseUrl, serviceKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: serviceKey ? undefined : { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: profile } = await db
      .from('profiles')
      .select('id, stripe_connect_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    const storedAccountId =
      typeof profile?.stripe_connect_id === 'string' && profile.stripe_connect_id.trim()
        ? profile.stripe_connect_id.trim()
        : null;

    if ((mode === 'dashboard' || mode === 'status') && !storedAccountId) {
      return jsonError('No Stripe Express account is linked to this athlete yet.', 400);
    }

    const payload = await runStripeConnectForUser(stripe, {
      userId: authData.user.id,
      email: authData.user.email?.trim() ?? '',
      storedAccountId,
      returnUrl,
      refreshUrl,
      mode,
    });

    if (profile?.id) {
      await db
        .from('profiles')
        .update({
          stripe_connect_id: payload.accountId,
          stripe_onboarding_complete: payload.stripe_onboarding_complete,
          payouts_enabled: payload.payouts_enabled,
        })
        .eq('id', profile.id)
        .eq('user_id', authData.user.id);
    }

    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return Response.json({ error: message }, { status: 400 });
  }
}
