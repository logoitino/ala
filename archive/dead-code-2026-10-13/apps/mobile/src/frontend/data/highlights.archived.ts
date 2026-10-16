// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/highlights.ts: taggedReelsForAthlete.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function taggedReelsForAthlete(athleteName: string, school?: string): HighlightClip[] {
  const name = athleteName.trim().toLowerCase();
  const catalog = HIGHLIGHT_CLIPS;
  const tagged = catalog.filter((clip) => clip.athleteName.toLowerCase() === name);
  if (tagged.length >= 6) return tagged;

  const schoolNeedle = (school ?? '').trim().toLowerCase();
  const schoolmates = catalog.filter(
    (clip) =>
      clip.athleteName.toLowerCase() !== name &&
      Boolean(schoolNeedle) &&
      clip.school.toLowerCase().includes(schoolNeedle),
  );

  return [...tagged, ...schoolmates];
}

