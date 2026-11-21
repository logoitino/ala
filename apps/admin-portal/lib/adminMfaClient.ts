/**
 * SCALE-01: browser calls for the `/login/mfa` step (Supabase Auth TOTP `listFactors` / `unenroll` / `enroll` /
 * `challenge` / `verify`). Kept in `lib/` so pages and components stay off the vendor client
 * (`scripts/check-app-data-boundaries.mjs`). Every function throws the Supabase Auth error as-is; the form turns
 * it into words with `mfaErrorText`.
 */
import { ADMIN_MFA_ISSUER, unverifiedTotpFactors, verifiedTotpFactors } from '@/lib/adminMfa';
import { authPublication, getSupabaseBrowserClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { resolveBackendConnection } from '@tapuai/shared-types/backendConnection';

export type MfaActor = { readonly userId: string; isCurrent: () => boolean };
function check(actor?: MfaActor) { if (actor && !actor.isCurrent()) throw new Error('The account changed. Sign in again to continue.'); }
let capturedClientSequence = 0;

/** What the setup screen shows: the QR image (an SVG data URI) and the same secret as text. */
export type TotpSetup = { factorId: string; qrCode: string; secret: string };

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local (same project as the Expo app).');
  return supabase;
}

async function actorClient(actor?: MfaActor) {
  const publicClient = client();
  if (!actor) return publicClient;
  check(actor);
  const { data, error } = await publicClient.auth.getSession();
  check(actor);
  const session = data.session;
  const backend = resolveBackendConnection({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  if (!backend.connection || error || session?.user.id !== actor.userId || !session.access_token || !session.refresh_token || !session.expires_at || session.expires_at <= Date.now() / 1000) throw new Error('The account changed. Sign in again to continue.');
  const request = globalThis.fetch.bind(globalThis);
  const bound = createClient(backend.connection.url, backend.connection.publicKey, {
    auth: { storageKey: `mfa-captured-${++capturedClientSequence}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (...args) => { check(actor); const response = await request(...args); check(actor); return response; } },
  });
  const seeded = await bound.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  check(actor);
  if (seeded.error) throw seeded.error;
  if (seeded.data.user?.id !== actor.userId) throw new Error('The account changed. Sign in again to continue.');
  return bound;
}

/**
 * @purpose Start a fresh TOTP setup. A half-finished earlier setup (enrolled, never verified) is removed first,
 *   so a reload does not fail on the repeated name.
 * @sideEffects Supabase Auth `GET /user`, `DELETE /factors/<id>` for each unverified TOTP factor, `POST /factors`.
 */
export async function startTotpSetup(actor?: MfaActor): Promise<TotpSetup> {
  const supabase = await actorClient(actor);
  const listed = await supabase.auth.mfa.listFactors();
  check(actor);
  if (listed.error) throw listed.error;
  for (const factor of unverifiedTotpFactors(listed.data.all)) {
    const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    check(actor);
    if (removed.error) throw removed.error;
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: ADMIN_MFA_ISSUER,
    issuer: ADMIN_MFA_ISSUER,
  });
  check(actor);
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * @purpose The verified TOTP factor to challenge on a returning sign-in, or `null` when there is none.
 * @sideEffects Supabase Auth `GET /user`.
 */
export async function verifiedTotpFactorId(actor?: MfaActor): Promise<string | null> {
  const bound = await actorClient(actor);
  const { data, error } = await bound.auth.mfa.listFactors();
  check(actor);
  if (error) throw error;
  return verifiedTotpFactors(data.all)[0]?.id ?? null;
}

/**
 * @purpose Prove the code and raise this browser session to `aal2`. The new session lands in the cookies, so the
 *   middleware and the `(protected)` layout see it on the next request.
 * @sideEffects Supabase Auth `POST /factors/<id>/challenge` and `/verify`; rewrites the session cookies.
 */
export async function verifyTotpCode(factorId: string, code: string, actor?: MfaActor): Promise<void> {
  const supabase = await actorClient(actor);
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  check(actor);
  if (challenge.error) throw challenge.error;
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  check(actor);
  if (verified.error) throw verified.error;
  if (actor) {
    const installed = await authPublication.run(verified.data.access_token, () => check(actor), () => client().auth.setSession(verified.data));
    check(actor);
    if (installed.error) throw installed.error;
  }
}
