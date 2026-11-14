/**
 * Home-dashboard math and number formats for the admin portal. Percents come only from a prior
 * week that already has a count. Event totals are not treated as people. A missing key stays
 * null all the way to the tile. Pure module: safe to import from server pages and client boards.
 * Home's ledger tile is a percent, so it is labelled "Tapua'i share of gross, all streams";
 * Departments shows the dollar figure and keeps "Tapua'i share, all streams" (W3-PORTAL, 2026-10-12).
 * Home's overview reads every tile label from `homeKpis`, so the clips tile says
 * "Clips uploaded · 7d" here rather than in the page (Codex Home fixes, 2026-10-12).
 */

export type WeekTone = 'up' | 'down' | 'flat' | 'new';

export type WeekChange = {
  current: number;
  previous: number;
  percent: number | null;
  tone: WeekTone;
};

/**
 * Numbers Home reads. `null` means the key was not in this read (or the read failed), which is
 * not the same as 0: a null renders "—", never "$0.00".
 */
export type DashboardInput = {
  donations7dCents: number | null;
  donationsPrev7dCents: number | null;
  donationCount7d: number | null;
  avgDonation7dCents: number | null;
  clips7d: number | null;
  clipsPrev7d: number | null;
  sessions24h: number | null;
  dwellMs7d: number | null;
  taps24h: number | null;
  stalls24h: number | null;
  flagged: number | null;
  openBugs: number | null;
  grossCents: number | null;
  companyNetCents: number | null;
};

export type HomeKpiId =
  | 'donations'
  | 'avgDonation'
  | 'clips'
  | 'opens'
  | 'dwell'
  | 'tapsPerOpen'
  | 'stalls'
  | 'platformShare';

export type HomeKpi = {
  id: HomeKpiId;
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger';
  /** The key was not in this read. The tile shows "—" and "Not in this read". */
  missing: boolean;
  /** Only gifts and clips have a prior week. Every other tile is null. */
  delta: { current: number; previous: number } | null;
  goodDirection: 'up' | 'down' | 'none';
};

/** True when the value is a real number. Null, undefined, and NaN are "not in this read". */
export function isMeasured(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @purpose One key from a `get_admin_reports` section, or null when the read failed or the key is absent.
 * @param section Parsed section, e.g. `reports.money`.
 * @param key Key inside it, e.g. `malo_cents_7d`.
 * @param readOk False when the read failed or Supabase is not configured.
 * @returns The number, or null. Never a made-up 0.
 */
export function readKey(section: Record<string, number> | undefined, key: string, readOk = true): number | null {
  if (!readOk || !section) return null;
  const value = section[key];
  return isMeasured(value) ? value : null;
}

/** Count with thousands separators. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * @purpose Milliseconds of tab time as minutes. Under a minute but above zero reads "<1 min" so a
 *   short real sample is not shown as 0.
 * @param ms Milliseconds.
 * @returns e.g. "0 min", "<1 min", "1,234 min".
 */
export function formatMinutes(ms: number): string {
  if (ms <= 0) return '0 min';
  if (ms < 60000) return '<1 min';
  return `${Math.round(ms / 60000).toLocaleString('en-US')} min`;
}

/**
 * @purpose A short duration such as a checkout step. Same rule as Trends (`formatDuration` in
 *   lib/reports.ts): under a second reads in ms, a second or more reads in seconds.
 * @param ms Milliseconds.
 * @returns e.g. "850 ms", "1.3 s".
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms).toLocaleString('en-US')} ms`;
  return `${(ms / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} s`;
}

/** A value that is already a percent (0 to 100), e.g. average scroll depth. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const COMPACT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const COMPACT_COUNT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Count as a short gridline label, e.g. "950", "1.2K". */
export function formatCompactCount(value: number): string {
  return COMPACT_COUNT.format(value).replace(/\.0(?=[A-Za-z]|$)/, '');
}

/** Cents as a short dollar label for chart gridlines, e.g. "$40", "$1.2K". */
export function formatCompactUsd(cents: number): string {
  // Some Node ICU builds emit `$40.0` for whole dollars under compact currency; strip a trailing `.0`.
  return COMPACT_USD.format(Math.max(0, cents) / 100).replace(/\.0(?=[A-Za-z]|$)/, '');
}

/**
 * @purpose Week-versus-prior-week change. A prior week of zero does not become a percent.
 * @param current This week's count or cents.
 * @param previous The week before that.
 * @returns The rounded percent, or null when the prior week was empty.
 */
export function weekChange(current: number, previous: number): WeekChange {
  const now = Math.max(0, current);
  const then = Math.max(0, previous);
  if (then === 0 && now === 0) return { current: now, previous: then, percent: 0, tone: 'flat' };
  if (then === 0) return { current: now, previous: then, percent: null, tone: 'new' };
  const percent = Math.round(((now - then) / then) * 100);
  const tone: WeekTone = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  return { current: now, previous: then, percent, tone };
}

/**
 * @purpose One sentence for a week change, using the caller's formatter for the raw numbers.
 * @param label What moved (gifts, clips).
 * @param change Result of `weekChange`.
 * @param format Renders a count or a dollar amount.
 * @returns A sentence a teammate can read without a chart.
 */
export function weekSentence(label: string, change: WeekChange, format: (value: number) => string): string {
  if (change.tone === 'new') {
    return `${label}: ${format(change.current)} this week. The prior week had none, so there is no percent.`;
  }
  if (change.tone === 'flat') {
    return `${label}: flat versus the prior week (${format(change.current)}).`;
  }
  const word = change.tone === 'up' ? 'up' : 'down';
  return `${label}: ${word} ${Math.abs(change.percent ?? 0)}% versus the prior week (${format(change.previous)} to ${format(change.current)}).`;
}

/**
 * @purpose Days in a 7-day series that are above zero.
 * @param points Daily values from `get_admin_reports`.
 * @returns How many of those days had activity.
 */
export function activeDays(points: { value: number }[]): number {
  return points.filter((point) => point.value > 0).length;
}

/**
 * @purpose Taps divided by tab opens. Null when there were no tab opens, so the ratio is not zero by fiction.
 * @param taps Feature taps in the same window.
 * @param sessions Tab-open events in that window.
 * @returns Taps per tab open, to one decimal, or null.
 */
export function tapsPerOpen(taps: number, sessions: number): number | null {
  if (sessions <= 0) return null;
  return Math.round((Math.max(0, taps) / sessions) * 10) / 10;
}

/**
 * @purpose Integer percent of a whole. Null when the whole is zero.
 * @param part The smaller count.
 * @param whole The count it is a share of.
 * @returns A rounded percent, or null.
 */
export function sharePercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((Math.max(0, part) / whole) * 100);
}

/** Industry measures this portal does not have. Showing them as numbers would be a guess. */
export const UNMEASURED = [
  {
    name: 'Daily people',
    why: 'Tab opens are events. The same person can open Home five times and count as five. A daily-active number would overstate the team.',
  },
  {
    name: 'Returning people',
    why: 'There is no day-1 or day-7 return. A retention curve is not in this read.',
  },
  {
    name: 'Gift conversion',
    why: 'The gift count is gifts, not the share of people who watched a Highlight and then gave.',
  },
  {
    name: 'Cost to bring a family in',
    why: 'Acquisition spend is not recorded.',
  },
  {
    name: 'How long a family stays',
    why: 'There is no first-visit to last-visit cohort.',
  },
] as const;

function priorWeek(current: number | null, previous: number | null): { current: number; previous: number } | null {
  return isMeasured(current) && isMeasured(previous) ? { current, previous } : null;
}

/**
 * @purpose The eight numbers on the home dashboard, each labeled as what it actually counts.
 *   Only gifts and clips carry a prior-week delta. A missing key is `missing`, never 0.
 * @param input Counts already returned by reports and revenue.
 * @param formatUsd Cents as dollars.
 * @returns Tiles for the home grid, in display order.
 */
export function homeKpis(input: DashboardInput, formatUsd: (cents: number) => string): HomeKpi[] {
  const perOpen = isMeasured(input.taps24h) && isMeasured(input.sessions24h) ? tapsPerOpen(input.taps24h, input.sessions24h) : null;
  const ledger = isMeasured(input.companyNetCents) && isMeasured(input.grossCents);
  const platform = ledger ? sharePercent(input.companyNetCents as number, input.grossCents as number) : null;
  const donationsDelta = priorWeek(input.donations7dCents, input.donationsPrev7dCents);
  const clipsDelta = priorWeek(input.clips7d, input.clipsPrev7d);

  return [
    {
      id: 'donations',
      label: 'Gifts · 7d',
      value: isMeasured(input.donations7dCents) ? formatUsd(input.donations7dCents) : '—',
      hint: donationsDelta ? 'Recorded gifts, last 7 days' : 'The prior week is not in this read',
      tone: 'neutral',
      missing: !isMeasured(input.donations7dCents),
      delta: donationsDelta,
      goodDirection: 'up',
    },
    {
      id: 'avgDonation',
      label: 'Average gift · 7d',
      value: isMeasured(input.avgDonation7dCents) ? formatUsd(input.avgDonation7dCents) : '—',
      hint: !isMeasured(input.donationCount7d)
        ? 'Gift count not in this read'
        : input.donationCount7d > 0
          ? `Across ${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'gift' : 'gifts'}`
          : 'No gifts in this week',
      tone: 'neutral',
      missing: !isMeasured(input.avgDonation7dCents),
      delta: null,
      goodDirection: 'none',
    },
    {
      id: 'clips',
      label: 'Clips uploaded · 7d',
      value: isMeasured(input.clips7d) ? formatCount(input.clips7d) : '—',
      hint: clipsDelta ? 'Clips uploaded, last 7 days' : 'The prior week is not in this read',
      tone: 'neutral',
      missing: !isMeasured(input.clips7d),
      delta: clipsDelta,
      goodDirection: 'up',
    },
    {
      id: 'opens',
      label: 'Tab opens · 24h',
      value: isMeasured(input.sessions24h) ? formatCount(input.sessions24h) : '—',
      hint: 'Events, not distinct people',
      tone: 'neutral',
      missing: !isMeasured(input.sessions24h),
      delta: null,
      goodDirection: 'none',
    },
    {
      id: 'dwell',
      label: 'Time on tabs · 7d',
      value: isMeasured(input.dwellMs7d) ? formatMinutes(input.dwellMs7d) : '—',
      hint: 'Sum of tab time, not time per person',
      tone: 'neutral',
      missing: !isMeasured(input.dwellMs7d),
      delta: null,
      goodDirection: 'none',
    },
    {
      id: 'tapsPerOpen',
      label: 'Taps per tab open · 24h',
      value: perOpen == null ? '—' : perOpen.toLocaleString('en-US'),
      hint: !isMeasured(input.taps24h) || !isMeasured(input.sessions24h)
        ? 'Taps or tab opens not in this read'
        : perOpen == null
          ? 'No tab opens in 24 hours, so no ratio'
          : 'Feature taps divided by tab opens',
      tone: 'neutral',
      missing: !isMeasured(input.taps24h) || !isMeasured(input.sessions24h),
      delta: null,
      goodDirection: 'none',
    },
    {
      id: 'stalls',
      label: 'Video stalls · 24h',
      value: isMeasured(input.stalls24h) ? formatCount(input.stalls24h) : '—',
      hint: !isMeasured(input.stalls24h) ? '' : input.stalls24h > 0 ? 'Playback stalled. Fewer is better.' : 'No stalls in 24 hours',
      tone: !isMeasured(input.stalls24h) ? 'neutral' : input.stalls24h > 0 ? 'warn' : 'ok',
      missing: !isMeasured(input.stalls24h),
      delta: null,
      goodDirection: 'down',
    },
    {
      id: 'platformShare',
      label: "Tapua'i share of gross, all streams",
      value: platform == null ? '—' : `${platform}%`,
      hint: !ledger
        ? 'Ledger not in this read'
        : platform == null
          ? 'No gross in the ledger yet'
          : `The ledger records ${formatUsd(input.companyNetCents as number)} for Tapua'i out of ${formatUsd(input.grossCents as number)} gross across every stream. New gifts allocate the full gift to the family account with no Tapua'i gift cut. Historical allocations are retained.`,
      tone: 'neutral',
      missing: !ledger,
      delta: null,
      goodDirection: 'none',
    },
  ];
}

/**
 * @purpose Short trend lines for the team. Flags and open bugs are counts, not a fake week percent.
 *   A missing number says so instead of reading as zero.
 * @param input Counts already returned by reports.
 * @param stallPoints Daily stall series. Empty means the series was not in this read.
 * @param formatUsd Cents as dollars.
 * @returns Sentences for the home trend list.
 */
export function teamTrends(
  input: DashboardInput,
  stallPoints: { value: number }[],
  formatUsd: (cents: number) => string,
): string[] {
  const donations = priorWeek(input.donations7dCents, input.donationsPrev7dCents);
  const clips = priorWeek(input.clips7d, input.clipsPrev7d);
  const days = activeDays(stallPoints);
  const span = stallPoints.length;
  const stallLine =
    span === 0
      ? 'Stall days are missing from this read.'
      : days === 0
        ? `No video stalls on the last ${span} days.`
        : `Video stalls on ${days} of the last ${span} days.`;
  let trust: string;
  if (!isMeasured(input.flagged) || !isMeasured(input.openBugs)) {
    trust = 'Open flags or open bug reports are not in this read.';
  } else if (input.flagged + input.openBugs === 0) {
    trust = 'No open flags and no open bug reports.';
  } else {
    trust = `${formatCount(input.flagged)} flagged ${input.flagged === 1 ? 'clip' : 'clips'} and ${formatCount(input.openBugs)} open bug ${input.openBugs === 1 ? 'report' : 'reports'}.`;
  }
  return [
    donations
      ? weekSentence('Gifts', weekChange(donations.current, donations.previous), formatUsd)
      : 'Gifts: this week or the prior week is not in this read.',
    clips
      ? weekSentence('Clips uploaded', weekChange(clips.current, clips.previous), formatCount)
      : 'Clips uploaded: this week or the prior week is not in this read.',
    stallLine,
    trust,
  ];
}
