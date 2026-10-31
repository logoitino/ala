/**
 * Session JWT and live user-id helpers for JWT-gated routes and Soft-Wall resume closures.
 * Hooks must call these instead of `supabase.auth.getSession` so vendor boundary stays in `lib/`.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * @purpose Read the signed-in Supabase access token for JWT-gated Stripe API routes.
 * @param signInMessage Error copy when there is no session.
 * @returns Session JWT.
 * @sideEffects `supabase.auth.getSession()`.
 */
export async function requireAccessToken(signInMessage: string): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(signInMessage);
  }
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (error || !token) {
    throw new Error(signInMessage);
  }
  return token;
}

/**
 * @purpose Live Auth user id at call time (Soft-Wall resume may invoke a pre-login checkout / grant closure).
 * @param fallback React-auth id when `getSession` has not hydrated yet.
 * @returns Session user id when present, otherwise `fallback`.
 * @sideEffects `supabase.auth.getSession` when Supabase is configured.
 */
export async function resolveSessionUserId(fallback: string | null): Promise<string | null> {
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id) return data.session.user.id;
  }
  return fallback;
}
