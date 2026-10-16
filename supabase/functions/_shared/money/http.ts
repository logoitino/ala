/**
 * Money server core (SCALE-04): the response shape and request helpers every money handler shares, on Deno Edge
 * Functions and on the Node / Metro API routes alike. Runtime-neutral on purpose: no imports, no `Deno` or `process`
 * globals. Each runtime's adapter turns a `CoreResult` into its own `Response` (the Edge adapter adds CORS headers).
 * The underscore folder is the Supabase convention for shared code that is bundled with each function but is not a
 * function itself.
 */

/** A handler outcome before it becomes an HTTP response: the status code and the exact JSON body. */
export type CoreResult = { status: number; body: unknown };

/** Shown when the auth provider (or the local token check) rejects the Bearer token. Same text on every route. */
export const INVALID_SESSION_MESSAGE = 'Invalid or expired session.';

/**
 * @purpose Build the `{ error }` body the PaymentIntent and Connect handlers answer with on every failure.
 * @param message Caller-facing text (never a token, key or raw provider payload).
 * @param status HTTP status code.
 * @returns A `CoreResult` with body `{ error: message }`.
 */
export function errorResult(message: string, status: number): CoreResult {
  return { status, body: { error: message } };
}

/** Wave 0 runs Stripe in test mode only (STATE §0); a live key must never reach these handlers by mistake. */
export const LIVE_KEY_REFUSED_MESSAGE = 'Live payments are not switched on yet (Stripe test mode only).';

/**
 * @purpose Refuse a live Stripe secret key while Wave 0 is test mode (security review P3); config alone enforced it before.
 * @param secretKey The configured Stripe secret key.
 * @returns A 503 `CoreResult` for an `sk_live_` / `rk_live_` key, otherwise null.
 */
export function refuseLiveStripeKey(secretKey: string): CoreResult | null {
  return /^(sk|rk)_live_/.test(secretKey.trim()) ? errorResult(LIVE_KEY_REFUSED_MESSAGE, 503) : null;
}

/**
 * @purpose The message a handler's catch-all reports for a thrown value (unchanged from the original handlers).
 * @param error Anything thrown inside a handler.
 * @returns `error.message` for an `Error`, otherwise `Unexpected error`.
 */
export function thrownMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

/**
 * @purpose Strict Bearer reader used by the Node routes that go through `requireAuthedUser` (PaymentIntent, payout):
 *   only `Bearer <token>` counts, anything else reads as signed out.
 * @param header The `Authorization` header value ('' when absent).
 * @returns The token, or '' when the header is missing or not a Bearer header.
 */
export function readBearerStrict(header: string): string {
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() ?? '';
}

/**
 * @purpose Loose Bearer reader used by the Edge Functions and the Node Connect route: strips a leading `Bearer `
 *   and passes anything else on to the session check (which then rejects it). Kept separate from the strict reader
 *   so each route answers exactly as before; unifying them is a deliberate later change.
 * @param header The `Authorization` header value ('' when absent).
 * @returns The trimmed remainder, or '' for an empty header.
 */
export function readBearerLoose(header: string): string {
  return header.replace(/^Bearer\s+/i, '').trim();
}
