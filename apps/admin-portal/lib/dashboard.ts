/**
 * Home-dashboard math for the admin portal. Percents come only from a prior week that
 * already has a count. Event totals are not treated as people.
 */

export type WeekTone = 'up' | 'down' | 'flat' | 'new';

export type WeekChange = {
  current: number;
  previous: number;
  percent: number | null;
  tone: WeekTone;
};

export type DashboardInput = {
  donations7dCents: number;
  donationsPrev7dCents: number;
  donationCount7d: number;
  avgDonation7dCents: number;
  clips7d: number;
  clipsPrev7d: number;
  sessions24h: number;
  dwellMs7d: number;
  taps24h: number;
  stalls24h: number;
  flagged: number;
  openBugs: number;
  grossCents: number;
  companyNetCents: number;
};

export type HomeKpi = {
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger';
};

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
 * @param label What moved (donations, clips).
 * @param change Result of `weekChange`.
 * @param format Renders a count or a dollar amount.
 * @returns A sentence a teammate can read without a chart.
 */
export function weekSentence(label: string, change: WeekChange, format: (value: number) => string): string {
  if (change.tone === 'new') {
    return `${label} is ${format(change.current)} this week. The prior week was empty, so there is no percent.`;
  }
  if (change.tone === 'flat') {
    return `${label} is flat versus the prior week (${format(change.current)}).`;
  }
  const word = change.tone === 'up' ? 'up' : 'down';
  return `${label} is ${word} ${Math.abs(change.percent ?? 0)}% versus the prior week (${format(change.previous)} to ${format(change.current)}).`;
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
    name: 'Donation conversion',
    why: 'A donation count is gifts, not the share of people who watched a Highlight and then donated.',
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

/**
 * @purpose The eight numbers on the home dashboard, each labeled as what it actually counts.
 * @param input Counts already returned by reports and revenue.
 * @param formatUsd Cents as dollars.
 * @returns Cards for the home grid.
 */
export function homeKpis(input: DashboardInput, formatUsd: (cents: number) => string): HomeKpi[] {
  const donations = weekChange(input.donations7dCents, input.donationsPrev7dCents);
  const clips = weekChange(input.clips7d, input.clipsPrev7d);
  const perOpen = tapsPerOpen(input.taps24h, input.sessions24h);
  const platform = sharePercent(input.companyNetCents, input.grossCents);
  const minutes = Math.round(input.dwellMs7d / 60000);

  return [
    {
      label: 'Donations · 7d',
      value: formatUsd(input.donations7dCents),
      hint: donations.tone === 'new' ? 'No prior week to compare' : donations.percent === 0 ? 'Flat versus the prior week' : `${donations.percent! > 0 ? 'Up' : 'Down'} ${Math.abs(donations.percent!)}% versus the prior week`,
      tone: donations.tone === 'down' ? 'warn' : donations.tone === 'up' ? 'ok' : 'neutral',
    },
    {
      label: 'Average donation · 7d',
      value: formatUsd(input.avgDonation7dCents),
      hint: input.donationCount7d > 0 ? `${input.donationCount7d.toLocaleString()} donations` : 'No donations in this week',
      tone: 'neutral',
    },
    {
      label: 'Clips · 7d',
      value: input.clips7d.toLocaleString(),
      hint: clips.tone === 'new' ? 'No prior week to compare' : clips.percent === 0 ? 'Flat versus the prior week' : `${clips.percent! > 0 ? 'Up' : 'Down'} ${Math.abs(clips.percent!)}% versus the prior week`,
      tone: clips.tone === 'down' ? 'warn' : clips.tone === 'up' ? 'ok' : 'neutral',
    },
    {
      label: 'Tab opens · 24h',
      value: input.sessions24h.toLocaleString(),
      hint: 'Events, not distinct people',
      tone: input.sessions24h > 0 ? 'ok' : 'neutral',
    },
    {
      label: 'Time on tabs · 7d',
      value: `${minutes.toLocaleString()} min`,
      hint: 'Sum of tab time, not time per person',
      tone: 'neutral',
    },
    {
      label: 'Taps per tab open · 24h',
      value: perOpen == null ? '—' : perOpen.toLocaleString(),
      hint: perOpen == null ? 'No tab opens in 24 hours' : 'Feature taps divided by tab opens',
      tone: 'neutral',
    },
    {
      label: 'Video stalls · 24h',
      value: input.stalls24h.toLocaleString(),
      hint: input.stalls24h > 0 ? 'Playback stalled' : 'No stalls in 24 hours',
      tone: input.stalls24h > 0 ? 'warn' : 'ok',
    },
    {
      label: 'Recorded platform share',
      value: platform == null ? '—' : `${platform}%`,
      hint: platform == null ? 'No gross in the ledger' : `Tapua'i keeps ${formatUsd(input.companyNetCents)} of ${formatUsd(input.grossCents)}. Donation policy is still 90 to the family.`,
      tone: 'neutral',
    },
  ];
}

/**
 * @purpose Short trend lines for the team. Flags and open bugs are counts, not a fake week percent.
 * @param input Counts already returned by reports.
 * @param stallPoints Daily stall series.
 * @param formatUsd Cents as dollars.
 * @returns Sentences for the home trend list.
 */
export function teamTrends(
  input: DashboardInput,
  stallPoints: { value: number }[],
  formatUsd: (cents: number) => string,
): string[] {
  const donations = weekChange(input.donations7dCents, input.donationsPrev7dCents);
  const clips = weekChange(input.clips7d, input.clipsPrev7d);
  const days = activeDays(stallPoints);
  const span = stallPoints.length;
  const stallLine =
    span === 0
      ? 'Stall days are missing from this read.'
      : days === 0
        ? `No video stalls on the last ${span} days.`
        : `Video stalls on ${days} of the last ${span} days.`;
  const trust =
    input.flagged + input.openBugs === 0
      ? 'No open flags and no open bug reports.'
      : `${input.flagged.toLocaleString()} flagged ${input.flagged === 1 ? 'clip' : 'clips'} and ${input.openBugs.toLocaleString()} open bug ${input.openBugs === 1 ? 'report' : 'reports'}.`;
  return [
    weekSentence('Donations', donations, formatUsd),
    weekSentence('Clips uploaded', clips, (value) => value.toLocaleString()),
    stallLine,
    trust,
  ];
}
