/**
 * The sport whose field lines decorate the viewer's own screens (UX-08): an athlete sees their own sport on
 * every tab; fans, parents, boosters and guests see the generic field. Reads the signed-in profile only — no
 * new data — and returns null when there is no athlete sport, which `SportField` draws as the generic field.
 */

import * as Auth from '@/context/AuthContext';

/**
 * @purpose Pick the sport for app-wide decorative field lines from the signed-in profile.
 * @returns The athlete's `athlete_sport`, or null for every other viewer.
 */
export function useViewerSport(): string | null {
  // Decorative only: outside AuthProvider, or where a test mocks the auth module without this accessor, fall back
  // to the generic field. The check depends on the module, not render state, so the hook order never changes.
  const viewer = typeof Auth.useOptionalAuth === 'function' ? Auth.useOptionalAuth() : null;
  const sport = viewer?.isAthlete ? viewer.profile?.athlete_sport?.trim() : '';
  return sport || null;
}
