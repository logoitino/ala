/**
 * Values that go inside a PostgREST filter string. `.eq(column, value)` and `.ilike(column, value)`
 * send the value as a parameter. `.or()` and a Realtime `filter` are one grammar string, so a typed
 * period, comma or parenthesis would start another clause.
 */

const LIKE_META = /[\\%_]/g;
const FILTER_VALUE = /^[A-Za-z0-9-]{1,80}$/;

/** Typed search text with LIKE wildcards removed, capped so a long paste cannot widen the scan. */
export function likeNeedle(raw: string): string {
  return raw.replace(LIKE_META, ' ').trim().slice(0, 80);
}

/**
 * @purpose One quoted `ILIKE` value for `.or('col.ilike.<this>,…')`.
 * @param raw What the person typed.
 * @returns A double-quoted `%needle%` pattern. Quotes inside the text are doubled, which is how PostgREST keeps them inside the value.
 */
export function orIlike(raw: string): string {
  return `"%${likeNeedle(raw).replace(/"/g, '""')}%"`;
}

/**
 * @purpose `column=eq.value` for a Realtime filter, or null when the value is not a plain id or slug.
 * @param column A column this app already names. Never taken from typed text.
 * @param value An id or slug.
 * @returns The filter, or null so the caller does not open the channel.
 */
export function realtimeEq(column: 'id' | 'game_id' | 'slug', value: string): string | null {
  if (!FILTER_VALUE.test(value)) return null;
  return `${column}=eq.${value}`;
}
