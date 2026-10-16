/**
 * One reading of "this database change is not applied yet" for every client SDK. Twelve libs each had
 * their own copy of the missing-function check with slightly different codes and phrases (DATA-01 merge,
 * 2026-10-13); they now share these, so a stale schema cache or an unapplied migration is recognised the
 * same way everywhere and the app says "not switched on" instead of showing an outage.
 * Kept out of `lib/supabase.ts` so tests that mock the client still get the real checks.
 */

/** A PostgREST / Postgres error, a bare message, or nothing. */
export type DbErrorLike = { code?: string | null; message?: string | null } | string | null | undefined;

const parts = (error: DbErrorLike) =>
  typeof error === 'string' ? { code: '', message: error } : { code: error?.code ?? '', message: error?.message ?? '' };

/**
 * @purpose The RPC does not exist on this database yet (PostgREST PGRST202, Postgres 42883).
 * @returns False for no error and for every other failure, which must stay a failure.
 */
export function isMissingFunction(error: DbErrorLike): boolean {
  if (!error) return false;
  const { code, message } = parts(error);
  return code === 'PGRST202' || code === '42883' || /PGRST202|42883|could not find the function/i.test(message);
}

/** @purpose A selected or inserted column does not exist yet (PostgREST PGRST204, Postgres 42703). */
export function isMissingColumn(error: DbErrorLike): boolean {
  if (!error) return false;
  const { code, message } = parts(error);
  return code === 'PGRST204' || code === '42703' || /PGRST204|42703|could not find the '.*' column/i.test(message);
}

/** @purpose The table or view does not exist yet (Postgres 42P01, PostgREST PGRST205 / PGRST200). */
export function isMissingRelation(error: DbErrorLike): boolean {
  if (!error) return false;
  const { code, message } = parts(error);
  return ['42P01', 'PGRST205', 'PGRST200'].includes(code) || /42P01|PGRST205|PGRST200|does not exist|could not find the table/i.test(message);
}
