/**
 * Metro / Node adapter for Stripe Connect account set-up (`POST /api/create-stripe-account`, Accounts v2). The mode,
 * Terms / linked-account gates, account shape (US individual Express: `country: 'us'`, `entity_type: 'individual'`,
 * kept in `CONNECT_ACCOUNT_IDENTITY`), links and stored flags live in the shared money core
 * (`supabase/functions/_shared/money/connect.ts`, SCALE-04), which the Edge Function `create-stripe-account` also
 * uses; installed builds call that Edge Function. This file keeps only what is Node-specific: `process.env`, the Node
 * Stripe SDK, the Supabase clients and this route's order of checks. Creating a payee account is money-moving, so
 * the session is always confirmed live with `getUser` (no local token check). Secret keys stay server-side.
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import {
  CONNECT_FAILURE_MESSAGE,
  ConnectContextError,
  CONNECT_SIGN_IN_MESSAGE,
  runCreateStripeAccount,
} from '../../../../../supabase/functions/_shared/money/connect.ts';
import {
  INVALID_SESSION_MESSAGE,
  errorResult, refuseLiveStripeKey,
  readBearerLoose,
  type CoreResult,
} from '../../../../../supabase/functions/_shared/money/http.ts';
import { resolveSession } from '../../../../../supabase/functions/_shared/money/session.ts';

function respond(result: CoreResult): Response {
  return Response.json(result.body, { status: result.status });
}

/**
 * @purpose JWT-gated Stripe Connect Express handler (Metro fallback). Production path is `supabase/functions/create-stripe-account`.
 * @param request JSON `{ returnUrl, refreshUrl, mode }` plus `Authorization: Bearer <access_token>`.
 * @returns `{ url, accountId, stripe_onboarding_complete, payouts_enabled }`.
 * @sideEffects `supabase.auth.getUser` (live session, every call); Stripe Accounts v2; `profiles` read and UPDATE via
 *   required service role. Service-only context/save RPCs revalidate ownership and stop before links when persistence is unconfirmed.
 */
export async function createStripeAccountHandler(request: Request): Promise<Response> {
  try {
    const jwt = readBearerLoose(request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '');
    if (!jwt) {
      return respond(errorResult(CONNECT_SIGN_IN_MESSAGE, 401));
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return respond(errorResult('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.', 500));
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Money-moving: no `verifyLocally`, so a signed-out session is caught even before its token expires.
    const session = await resolveSession(jwt, {
      getUser: async (token) => {
        const { data, error } = await authClient.auth.getUser(token);
        return { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null, error };
      },
    });
    if (!session.ok) {
      return respond(errorResult(INVALID_SESSION_MESSAGE, 401));
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return respond(
        errorResult('Missing STRIPE_SECRET_KEY. Load it into the private server process and restart Expo.', 500),
      );
    }
    const liveKey = refuseLiveStripeKey(secretKey);
    if (liveKey) return respond(liveKey);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return respond(errorResult('Missing SUPABASE_SERVICE_ROLE_KEY.', 500));
    const stripe = new Stripe(secretKey);

    const body: unknown = await request.json();
    // Built once the request passes validation (first context read), as before.
    const makeProfilesDb = () => {
      return createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: undefined,
      });
    };
    let profileClient: ReturnType<typeof makeProfilesDb> | null = null;
    const profilesDb = () => (profileClient ??= makeProfilesDb());

    return respond(
      await runCreateStripeAccount({
        user: session.user,
        body,
        loadContext: async (userId, playerId) => {
          const { data, error } = await profilesDb().rpc('stripe_connect_context', {
            actor_user_id: userId, target_player_id: playerId,
          });
          if (error) throw new ConnectContextError(error.code === '42501');
          return data;
        },
        saveAccount: async (profileId, userId, flags, expectedAccountId, playerId) => {
          // The service-only function rechecks current guardianship/consent after the Stripe await.
          const { data, error } = await profilesDb().rpc('save_stripe_connect_account', {
            actor_user_id: userId, target_player_id: playerId, expected_profile_id: profileId,
            expected_account_id: expectedAccountId, account_id: flags.stripe_connect_id,
            onboarding_complete: flags.stripe_onboarding_complete, transfers_enabled: flags.payouts_enabled,
          });
          if (error || data !== flags.stripe_connect_id) throw new Error('Connect account save was not confirmed.');
        },
        // Server-only (is_trusted_server); the core calls it only with Stripe's own answer for the saved account.
        recordKyc: async (accountId, evidence) => profilesDb().rpc('record_stripe_kyc', { account_id: accountId, ...evidence }),
        stripe: () => stripe,
      }),
    );
  } catch {
    return respond(errorResult(CONNECT_FAILURE_MESSAGE, 400));
  }
}
