/**
 * @purpose Tell "this Edge Function is not deployed on this project" apart from a real failure, so a
 *   caller can fall back to the Metro `/api/*` route only in the first case.
 * @param error The `error` returned by `supabase.functions.invoke`.
 * @returns True for a 404 / unreachable function; false for a real error or no error.
 */
export function isMissingEdgeFunction(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status =
    'context' in error ? Number((error as { context?: { status?: number } }).context?.status) : 0;
  const message = (error as { message?: string }).message ?? '';
  return status === 404 || /not found|404|failed to send/i.test(message);
}
