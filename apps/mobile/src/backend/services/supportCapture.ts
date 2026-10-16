/**
 * Server-only support capture behind the Supabase auth gate. Store fixed failure codes, never JWTs,
 * request data or raw errors. Capturing is best effort and never changes authorization or retries money.
 * @sideEffects Bounded trusted support RPC using server credentials when configured.
 */
import { createClient } from '@supabase/supabase-js';

type AuthFailureCode = 'auth_expired' | 'auth_invalid' | 'auth_unavailable';

/** Classify provider verification results; missing sign-in and unknown errors are not attack evidence. */
export function classifyVerifiedAuthFailure(error: unknown): AuthFailureCode | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as { code?: unknown; status?: unknown; name?: unknown; message?: unknown };
  if (['jwt_expired', 'token_expired', 'session_not_found', 'refresh_token_not_found'].includes(String(value.code))) return 'auth_expired';
  if (value.code === 'bad_jwt' || value.code === 'invalid_jwt') {
    // Auth sometimes returns expiry under bad_jwt. Inspect only the provider result in memory;
    // never save its message or parse an unverified JWT to claim a verified actor.
    return typeof value.message === 'string' && value.message.length <= 1000 && /\bexpired\b/i.test(value.message)
      ? 'auth_expired' : 'auth_invalid';
  }
  if ((typeof value.status === 'number' && value.status >= 500 && value.status <= 599)
    || value.name === 'AuthRetryableFetchError') return 'auth_unavailable';
  return null;
}

/**
 * @purpose Append a safe auth-gate signal without changing the original auth outcome.
 * @param error Supabase provider verification failure; its message stays in memory.
 * @param supabaseUrl Configured server database URL (never a caller-provided address).
 * @returns Nothing, including on missing migration, rejected capture, or timeout.
 * @sideEffects One server RPC with a 1.5 second abort bound; no retries or log fallback.
 */
export async function captureVerifiedAuthFailure(error: unknown, supabaseUrl: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const code = classifyVerifiedAuthFailure(error);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!code || !serviceKey || !supabaseUrl) return;
    const environment = process.env.SUPPORT_ENVIRONMENT;
    const release = process.env.SUPPORT_RELEASE_ID ?? '';
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 1500);
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await client.rpc('record_trusted_support_signal', {
      p_feature: 'auth', p_code: code,
      p_environment: environment && ['development', 'test', 'preview', 'production'].includes(environment)
        ? environment : process.env.NODE_ENV === 'test' ? 'test' : process.env.NODE_ENV === 'production' ? 'production' : 'development',
      p_release: /^[a-z0-9][a-z0-9._-]{0,79}$/.test(release) ? release : 'unversioned',
      p_source: 'server',
    }).abortSignal(controller.signal);
  } catch {
    // A sensor failure must not turn a rejected session into success or hide the auth failure.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
