/** Optional recorded Highlight sport: only an exact self athlete may borrow the current primary as a draft default.
 * Explicit choices, including no tag, survive athlete changes and Back; old uploaded media is never inferred. */
export type UploadSportDraft = { value: string; explicit: boolean };
/** @purpose Resolve a default only while the uploader has not explicitly chosen a sport annotation. */
export function sportForChosenAthlete(current: UploadSportDraft, playerId: string, ownPlayerId: string | null | undefined,
  primarySport: string | null | undefined, activeSports: string[]): UploadSportDraft {
  if (current.explicit) return current;
  const primary = activeSports.find(sport => sport.toLowerCase() === primarySport?.trim().toLowerCase());
  return { value: playerId && ownPlayerId && playerId === ownPlayerId ? primary ?? '' : '', explicit: false };
}
