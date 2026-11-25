/**
 * GUEST-ACCESS-01 rejects anonymous-auth identities before account API actions on Node and Edge.
 * Money server core (SCALE-04): the one session decision every money handler makes, on Deno and Node. A handler
 * either allows the local token check first (PaymentIntent) or insists on the live session (payouts, Connect
 * account creation). Runtime-neutral: the live lookup (`supabase.auth.getUser`) and the local verifier are injected.
 *
 * Why money-moving actions skip the local check: a valid signature cannot show that the person signed out or that
 * the session was revoked before the token expires. Only the auth server knows that, so routes that move money or
 * create a payee account must call `getUser` every time. Do not pass `verifyLocally` from those routes.
 */

import type { AccessTokenVerifier, LocalRejectReason } from './accessToken.ts';

/** The caller as the money handlers need it: the auth user id, and the email for Connect's contact address. */
export type SessionUser = { id: string; email?: string | null; is_anonymous?: boolean };

/** The live lookup each runtime provides, already mapped from `supabase.auth.getUser`. May throw. */
export type LiveSessionLookup = (jwt: string) => Promise<{ user: SessionUser | null; error: unknown }>;

/** The decision, with how it was reached and, on failure, the provider error (or a synthetic one for a local refusal). */
export type SessionResolution =
  | { ok: true; user: SessionUser; checkedBy: 'local' | 'live' }
  | { ok: false; checkedBy: 'local' | 'live'; error: unknown };

/**
 * @purpose A provider-style error for a token the local check refused, so support capture classifies it the same way
 *   it classifies the auth server's answer (`jwt_expired` → expired, `bad_jwt` → invalid). Carries no token data.
 * @param reason The local refusal reason.
 * @returns `{ code, source: 'local' }`.
 */
export function localRejectionError(reason: LocalRejectReason): { code: 'jwt_expired' | 'bad_jwt'; source: 'local' } {
  return { code: reason === 'expired' ? 'jwt_expired' : 'bad_jwt', source: 'local' };
}

/**
 * @purpose Decide who is calling. With `verifyLocally`, a token the local check verifies or refuses is settled without
 *   the network; every other token, and every call without `verifyLocally`, goes to the live lookup as before.
 * @param jwt The Bearer token (already known to be non-empty).
 * @param deps `getUser` (live lookup, required) and `verifyLocally` (only for routes that do not move money).
 * @returns The resolved user, or a failure with the provider error. A thrown live lookup propagates unchanged.
 * @sideEffects Whatever the injected lookups do (one JWKS download per cache window; one auth server call).
 */
export async function resolveSession(
  jwt: string,
  deps: { getUser: LiveSessionLookup; verifyLocally?: AccessTokenVerifier },
): Promise<SessionResolution> {
  if (deps.verifyLocally) {
    const local = await deps.verifyLocally(jwt);
    if (local.outcome === 'verified') {
      if (local.claims.is_anonymous === true) return { ok: false, checkedBy: 'local', error: { code: 'account_required' } };
      const email = typeof local.claims.email === 'string' ? local.claims.email : null;
      return { ok: true, checkedBy: 'local', user: { id: local.claims.sub, email } };
    }
    if (local.outcome === 'rejected') {
      return { ok: false, checkedBy: 'local', error: localRejectionError(local.reason) };
    }
  }
  const { user, error } = await deps.getUser(jwt);
  if (user?.is_anonymous === true) return { ok: false, checkedBy: 'live', error: { code: 'account_required' } };
  if (error || !user) return { ok: false, checkedBy: 'live', error };
  return { ok: true, checkedBy: 'live', user };
}
