import { createClient, type User } from '@supabase/supabase-js';

export type AuthedRequest =
  | { ok: true; jwt: string; user: User; supabaseUrl: string; anonKey: string }
  | { ok: false; status: 401 | 500; message: string };

/**
 * @purpose Read the Supabase access token from `Authorization: Bearer` (Connect / PaymentIntent / payouts).
 * @param request Incoming Expo API request.
 * @returns Trimmed JWT or an empty string.
 */
export function readBearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

/**
 * @purpose Resolve `auth.uid()` from the session JWT using the anon key (same gate as `createStripeAccount`).
 * @param request Incoming Expo API request.
 * @param signInMessage 401 copy when the Bearer header is missing.
 * @returns Authenticated user + env, or a 401/500 failure (no Stripe calls).
 * @sideEffects `supabase.auth.getUser(jwt)` against the anon client.
 */
export async function requireAuthedUser(
  request: Request,
  signInMessage: string,
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

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  if (authError || !authData.user) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  return { ok: true, jwt, user: authData.user, supabaseUrl, anonKey };
}

/**
 * @purpose Service-role Postgres client when present; otherwise the caller's JWT (user-scoped RLS).
 * @param input URL, anon key, and verified session JWT.
 * @returns Supabase JS client for `profiles` reads (Connect id / payouts flags).
 * @sideEffects None until a query runs.
 */
export function createAuthedDb(input: { supabaseUrl: string; anonKey: string; jwt: string }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(input.supabaseUrl, serviceKey || input.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: serviceKey ? undefined : { headers: { Authorization: `Bearer ${input.jwt}` } },
  });
}
