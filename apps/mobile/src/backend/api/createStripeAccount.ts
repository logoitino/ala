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
  CONNECT_PROFILE_COLUMNS,
  CONNECT_SIGN_IN_MESSAGE,
  runCreateStripeAccount,
} from '../../../../../supabase/functions/_shared/money/connect.ts';
import {
  INVALID_SESSION_MESSAGE,
  errorResult, refuseLiveStripeKey,
  readBearerLoose,
  thrownMessage,
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
 *   service role when present, else the caller's session.
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
        errorResult('Missing STRIPE_SECRET_KEY. Add it to .env.local (server only) and restart Expo.', 500),
      );
    }
    const liveKey = refuseLiveStripeKey(secretKey);
    if (liveKey) return respond(liveKey);
    const stripe = new Stripe(secretKey);

    const body: unknown = await request.json();
    // Built once the request passes validation (first profile read), as before.
    const makeProfilesDb = () => {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      return createClient(supabaseUrl, serviceKey || anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: serviceKey ? undefined : { headers: { Authorization: `Bearer ${jwt}` } },
      });
    };
    let profileClient: ReturnType<typeof makeProfilesDb> | null = null;
    const profilesDb = () => (profileClient ??= makeProfilesDb());

    return respond(
      await runCreateStripeAccount({
        user: session.user,
        body,
        loadProfile: async (userId) => {
          const { data: profile } = await profilesDb()
            .from('profiles')
            .select(CONNECT_PROFILE_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();
          return profile;
        },
        saveFlags: async (profileId, userId, flags) => {
          await profilesDb().from('profiles').update(flags).eq('id', profileId).eq('user_id', userId);
        },
        stripe: () => stripe,
      }),
    );
  } catch (error) {
    return respond(errorResult(thrownMessage(error), 400));
  }
}
