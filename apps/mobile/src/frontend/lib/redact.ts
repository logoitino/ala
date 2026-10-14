/**
 * Keeps Social Security numbers out of anything Tapua'i stores or sends (VERIFY-02, owner 2026-10-14: an SSN goes to
 * Stripe only). Replaces SSN-shaped text (three, two and four digits with dashes or spaces, or nine digits in a row)
 * with a marker before telemetry or logs leave the phone. `pnpm security:no-ssn` keeps SSN fields out of the code itself.
 */

const SSN_SHAPE = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
export const REDACTED = '[redacted]';

/** @purpose Text with every SSN-shaped number replaced. */
export function redactSsnText(text: string): string {
  return text.replace(SSN_SHAPE, REDACTED);
}

/** @purpose A copy of a telemetry payload with SSN-shaped text removed from every string (nested up to 4 levels). */
export function redactPayload(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactSsnText(value);
  if (depth >= 4 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactPayload(item, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactPayload(item, depth + 1)]));
}
