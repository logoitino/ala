// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/sports.ts: DEFAULT_PERIOD_SECONDS, sportBadge.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export const DEFAULT_PERIOD_SECONDS = 12 * 60;

export function sportBadge(config: SportConfig): string {
  return `${config.emoji} ${config.sport}`.trim();
}

