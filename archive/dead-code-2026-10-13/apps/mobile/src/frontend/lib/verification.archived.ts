// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/verification.ts: fetchPlayerVerified.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose Whether the athlete's school has confirmed them (the public badge). For "is money held?"
 *   use `fetchPayoutAllowed` in `lib/payoutGate.ts` — since 2026-09-29 the two can differ.
 * @returns true only when a school-confirmed account is linked to the `players` row. Unknown → false.
 * @sideEffects `athlete_is_varsity_verified` RPC.
 */
export async function fetchPlayerVerified(playerId: string | null | undefined): Promise<boolean> {
  if (!playerId || !isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('athlete_is_varsity_verified', { target_player_id: playerId });
  if (error) return false;
  return data === true;
}

