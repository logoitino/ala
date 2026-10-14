// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/adminCoverage.ts: coverageHealth.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose Count live vs paused fan controls for Overview and Coverage.
 */
export function coverageHealth(live: AppRuntimeConfig): { total: number; liveCount: number; paused: number } {
  const paused = COVERAGE_CONTROLS.filter((item) => item.flag && !getRuntimeFlag(live, item.flag)).length;
  return { total: COVERAGE_CONTROLS.length, liveCount: COVERAGE_CONTROLS.length - paused, paused };
}
