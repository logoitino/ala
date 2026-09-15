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
