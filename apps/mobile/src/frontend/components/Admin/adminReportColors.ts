/**
 * Daylight report palette shared by the Expo admin chrome, header and editor primitives (split out of
 * AdminChrome.tsx for R4-03; canvas/border follow the 2026-11 Lovable refresh, matching the portal tokens). Independent of the editable fan theme on purpose, so a
 * Look-desk draft can never make the admin desks unreadable. `AdminChrome` re-exports it for existing desks.
 */

/** Same Daylight report palette as the approved Next portal, independent of editable fan chrome. */
export const ADMIN_REPORT_COLORS = {
  background: '#f7f6f2', surface: '#ffffff', border: '#e3e1d9', text: '#10161a',
  textSoft: '#4a5560', textMuted: '#5b6670', jade: '#00733c', danger: '#b3202f', electricGold: '#8a6400',
};
