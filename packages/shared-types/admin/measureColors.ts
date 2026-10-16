/**
 * One chart colour per measure for the whole admin portal (ADM-01i). Home, Trends, Audience,
 * Revenue, Health, Analytics, and Departments read this map so the same measure is the same
 * colour on every page. Values are `ChartColor` names from the chart kit, which map to the
 * `--chart-*` tokens in `app/globals.css`. Owner: PORTAL. Change a colour here, not on a page.
 *
 * Choices:
 * - `bad` is only for stalls, errors, and failures (`stalls`, `issues`).
 * - Scroll depth is gold, not violet, so it never matches feature taps (violet) when the two
 *   sit on one chart (Health, Analytics). Time on tabs is also gold; the portal never draws time
 *   and scroll depth on one chart (minutes vs percent), so the pair cannot be confused.
 * - The money split matches the ledger: payee (family, operator) jade, Tapua'i gold.
 * - Clip formats: Game Day jade, Train Like Me cyan, Serve Like Me gold.
 * - Games: Live jade, Parked muted (not a failure, so not `bad`).
 * - Hype: Seki jade, Aura violet, Flex gold; the combined hype ranking is violet.
 * - Schools rankings are cyan on Audience, Trends, and Analytics.
 */
// Renderers map these neutral accents to web CSS tokens or native colours.
export type ChartColor = 'jade' | 'cyan' | 'gold' | 'violet' | 'bad' | 'muted';

export type MeasureKey =
  | 'donations'
  | 'clips'
  | 'timeOnTabs'
  | 'stalls'
  | 'issues'
  | 'featureTaps'
  | 'scrollDepth'
  | 'payeeShare'
  | 'tapuaiShare'
  | 'gameDay'
  | 'trainLikeMe'
  | 'serveLikeMe'
  | 'live'
  | 'parked'
  | 'seki'
  | 'aura'
  | 'flex'
  | 'hype'
  | 'schools';

export const MEASURE_COLORS: Readonly<Record<MeasureKey, ChartColor>> = Object.freeze({
  donations: 'jade',
  clips: 'cyan',
  timeOnTabs: 'gold',
  stalls: 'bad',
  issues: 'bad',
  featureTaps: 'violet',
  scrollDepth: 'gold',
  payeeShare: 'jade',
  tapuaiShare: 'gold',
  gameDay: 'jade',
  trainLikeMe: 'cyan',
  serveLikeMe: 'gold',
  live: 'jade',
  parked: 'muted',
  seki: 'jade',
  aura: 'violet',
  flex: 'gold',
  hype: 'violet',
  schools: 'cyan',
});

/** The chart colour for one measure. */
export function measureColor(key: MeasureKey): ChartColor {
  return MEASURE_COLORS[key];
}
