/** GUEST-ACCESS-01 carries the verified anonymous-user flag into the shared account rejection gate.

 * Shared auth gate for the Expo API routes: read the Bearer token and resolve the caller before any Stripe call.
 * Used by the PaymentIntent and payout handlers. The decision itself lives in the runtime-neutral money core
 * (`supabase/functions/_shared/money/session.ts`, SCALE-04) so the Edge Functions make the same one.
 *
 * Two levels: by default the live session is confirmed with `supabase.auth.getUser` (required for anything that
 * moves money — payouts, Connect account creation — because only the auth server knows about a sign-out before the
 * token expires). Checkout opts in to the local WebCrypto token check first and falls back to `getUser` whenever that
 * check cannot decide (HS256 project, unknown key, JWKS unreachable).
 * Verified provider failures emit bounded safe support codes when server capture is configured;
 * missing sign-in is expected, and support delivery cannot change the auth outcome. Tokens are never logged.
 */

import { createClient } from '@supabase/supabase-js';
import { captureVerifiedAuthFailure } from '../services/supportCapture';
import {
  createAccessTokenVerifier,
  type AccessTokenVerifier,
} from '../../../../../supabase/functions/_shared/money/accessToken.ts';
import { INVALID_SESSION_MESSAGE, readBearerStrict } from '../../../../../supabase/functions/_shared/money/http.ts';
import { resolveSession, type SessionUser } from '../../../../../supabase/functions/_shared/money/session.ts';

export type AuthedRequest =
  | { ok: true; jwt: string; user: SessionUser; supabaseUrl: string; anonKey: string }
  | { ok: false; status: 401 | 500; message: string };

/** One local verifier (and JWKS cache) per Supabase project URL for the life of the server process. */
const verifiers = new Map<string, AccessTokenVerifier>();

function localVerifier(supabaseUrl: string, anonKey: string): AccessTokenVerifier {
  let verifier = verifiers.get(supabaseUrl);
  if (!verifier) {
    verifier = createAccessTokenVerifier({
      supabaseUrl,
      apiKey: anonKey,
      fetch: (url, init) => globalThis.fetch(url, init),
      subtle: globalThis.crypto?.subtle,
    });
    verifiers.set(supabaseUrl, verifier);
  }
  return verifier;
}

/**
 * @purpose Read the Supabase access token from `Authorization: Bearer` (PaymentIntent / payouts).
 * @param request Incoming Expo API request.
 * @returns Trimmed JWT or an empty string.
 */
export function readBearerToken(request: Request): string {
  return readBearerStrict(request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '');
}

/**
 * @purpose Resolve `auth.uid()` from the session JWT using the anon key. Live `getUser` by default; checkout may pass
 *   `{ allowLocalVerification: true }`. Money-moving routes must not pass it.
 * @param request Incoming Expo API request.
 * @param signInMessage 401 copy when the Bearer header is missing.
 * @param check `allowLocalVerification` lets a locally verified (or refused) token skip the auth server.
 * @returns Authenticated user + env, or a 401/500 failure (no Stripe calls).
 * @sideEffects At most one JWKS download per cache window (local path) and `supabase.auth.getUser(jwt)` otherwise.
 */
export async function requireAuthedUser(
  request: Request,
  signInMessage: string,
  check: { allowLocalVerification?: boolean } = {},
): Promise<AuthedRequest> {
  const jwt = readBearerToken(request);
  if (!jwt) {
    return { ok: false, status: 401, message: signInMessage };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      status: 500,
      message: 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    };
  }

  const getUser = async (token: string) => {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    return { user: data.user ? { id: data.user.id, email: data.user.email ?? null, ...(data.user.is_anonymous === true ? { is_anonymous: true } : {}) } : null, error };
  };

  let session: Awaited<ReturnType<typeof resolveSession>>;
  try {
    session = await resolveSession(jwt, {
      getUser,
      verifyLocally: check.allowLocalVerification ? localVerifier(supabaseUrl, anonKey) : undefined,
    });
  } catch (error) {
    // Keep the provider's original outcome even if support capture is itself unavailable.
    await captureVerifiedAuthFailure(error, supabaseUrl).catch(() => undefined);
    throw error;
  }
  if (!session.ok) {
    await captureVerifiedAuthFailure(session.error, supabaseUrl).catch(() => undefined);
    return { ok: false, status: 401, message: INVALID_SESSION_MESSAGE };
  }

  return { ok: true, jwt, user: session.user, supabaseUrl, anonKey };
}

/**
 * @purpose Service-role Postgres client when present; otherwise the caller's JWT (user-scoped RLS).
 * @param input URL, anon key, and verified session JWT.
 * @returns Supabase JS client for `profiles` reads (Connect id / payouts flags) and the freeze check.
 * @sideEffects None until a query runs.
 */
export function createAuthedDb(input: { supabaseUrl: string; anonKey: string; jwt: string }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(input.supabaseUrl, serviceKey || input.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: serviceKey ? undefined : { headers: { Authorization: `Bearer ${input.jwt}` } },
  });
}
