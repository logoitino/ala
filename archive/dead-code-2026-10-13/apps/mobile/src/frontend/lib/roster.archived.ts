// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/roster.ts: isOwnAthleteSheet.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose True when this sheet is the signed-in person's claimed / named roster row — hide Join Crew, Mālo, Subscribe.
 */
export function isOwnAthleteSheet(
  profile: Pick<Profile, 'player_id' | 'full_name'> | null | undefined,
  player: { id: string; name: string } | null | undefined,
): boolean {
  if (!profile || !player?.id) return false;
  if (profile.player_id && profile.player_id === player.id) return true;
  const name = profile.full_name?.trim().toLowerCase();
  return Boolean(name && name === player.name.trim().toLowerCase());
}

