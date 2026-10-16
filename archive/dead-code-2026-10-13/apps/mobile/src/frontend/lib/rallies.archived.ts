// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/rallies.ts: rallyShareMessage.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/** Share text for the gift link / QR. */
export function rallyShareMessage(athleteName: string, rally: Pick<Rally, 'title' | 'raisedCents' | 'targetCents'>): string {
  return `Help ${athleteName.trim() || 'this athlete'} with "${rally.title}" — ${rallyProgress({ ...rally, donationCount: 0 }).amountLine} so far. Watch the highlights and donate on Tapua'i.`;
}

