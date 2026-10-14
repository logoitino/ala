// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/contentRights.ts: reportHidesNow.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose True when this reason, or an athlete/guardian report, should hide the clip now.
 * @param reason Report reason id.
 * @param fromAthleteOrGuardian Reporter is the tagged athlete or their guardian.
 */
export function reportHidesNow(reason: ReportReasonId, fromAthleteOrGuardian: boolean): boolean {
  return fromAthleteOrGuardian || IMMEDIATE_HIDE_REASONS.includes(reason);
}

