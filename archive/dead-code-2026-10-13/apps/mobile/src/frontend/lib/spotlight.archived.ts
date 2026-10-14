// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/spotlight.ts: utcMonthStart, utcYearStart.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose First of the month UTC, matching Postgres `date_trunc('month', now())`.
 */
export function utcMonthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * @purpose January 1 UTC, matching Postgres `date_trunc('year', now())`.
 */
export function utcYearStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

