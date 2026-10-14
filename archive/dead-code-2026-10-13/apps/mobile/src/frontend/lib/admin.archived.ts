// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/admin.ts: buildAdminHealth, fetchAdminReports, overviewLedeForLens (with their private helpers).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function overviewLedeForLens(lens: AdminLens): string {
  if (lens === 'marketing') return 'Look, copy, and campaign chrome. Draft until Publish to app.';
  if (lens === 'owner') return 'Gross, net, payouts, health, and who needs a decision.';
  if (lens === 'finance') return 'Finance & Books, payouts, prices and the money desks the CFO\'s team works from.';
  if (lens === 'engineer') return 'Flags, catalogs, coverage, and fan suggestions waiting to become a patch.';
  return 'Home for the control plane. Inbox first, then every desk that ships the fan app.';
}

/**
 * @purpose Platform reports for usage, Mālo, content mix, audience, live ops, reliability, and leaders.
 * @sideEffects `get_admin_reports` RPC.
 */
export async function fetchAdminReports(): Promise<AdminReports> {
  if (!isSupabaseConfigured) return EMPTY_REPORTS;
  const { data, error } = await supabase.rpc('get_admin_reports');
  if (error || !data || typeof data !== 'object') return EMPTY_REPORTS;
  const row = data as Record<string, unknown>;
  return {
    generatedAt: asText(row.generated_at) || null,
    engagement: asSection(row.engagement),
    money: asSection(row.money),
    content: asSection(row.content),
    audience: asSection(row.audience),
    live: asSection(row.live),
    reliability: asSection(row.reliability),
    usage: asSection(row.usage),
    tabs: asLeaders(row.tabs),
    features: asLeaders(row.features),
    issues: asLeaders(row.issues),
    scroll: asLeaders(row.scroll),
    leaders: parseLeaders(row.leaders),
    series: parseSeries(row.series),
  };
}

/**
 * @purpose Pass / warn / fail checks across feed, money, content, live ops, usage, and shipping.
 */
export function buildAdminHealth(
  reports: AdminReports,
  extras: { dirty: boolean; pendingCount: number; lowStock: number },
): AdminHealthCheck[] {
  const stalls = reports.reliability.stalls_24h ?? 0;
  const reconnects = reports.reliability.reconnects_24h ?? 0;
  const checkout = reports.reliability.avg_checkout_ms_24h ?? 0;
  const flags = reports.content.flagged ?? 0;
  const payouts = reports.money.queued_payouts ?? 0;
  const verify = reports.audience.pending_verify ?? 0;
  const liveGames = reports.live.live_games ?? 0;
  const drip = reports.live.drip_skus ?? 0;
  const clips24 = reports.engagement.clips_24h ?? 0;
  const spotlight = reports.content.spotlight_live ?? 0;
  const sessions = reports.usage.sessions_24h ?? 0;
  const issues = reports.usage.issues_24h ?? 0;

  const checks: AdminHealthCheck[] = [
    {
      id: 'stalls',
      label: 'Video stalls',
      category: 'Reliability',
      status: band(stalls, 1, 5),
      detail: stalls === 0 ? 'No stalls in 24h.' : `${stalls} stall${stalls === 1 ? '' : 's'} in 24h.`,
      href: '/admin/qa',
    },
    {
      id: 'reconnects',
      label: 'Realtime reconnects',
      category: 'Reliability',
      status: band(reconnects, 1, 10),
      detail: reconnects === 0 ? 'Sockets are quiet.' : `${reconnects} reconnect${reconnects === 1 ? '' : 's'} in 24h.`,
      href: '/admin/qa',
    },
    {
      id: 'checkout',
      label: 'Donation checkout',
      category: 'Money',
      status: checkout >= 8000 ? 'fail' : checkout >= 3000 ? 'warn' : 'ok',
      detail: checkout === 0 ? 'No checkout samples in 24h.' : `Avg ${checkout} ms in 24h.`,
      href: '/admin/money',
    },
    {
      id: 'flags',
      label: 'Open flags',
      category: 'Content',
      status: band(flags, 1, 8),
      detail: flags === 0 ? 'Moderation queue is clear.' : `${flags} flagged clip${flags === 1 ? '' : 's'}.`,
      href: '/admin/moderation',
    },
    {
      id: 'payouts',
      label: 'Queued payouts',
      category: 'Money',
      status: payouts > 0 ? 'warn' : 'ok',
      detail: payouts === 0 ? 'No disbursements waiting.' : `${payouts} queued for mark-paid.`,
      href: '/admin/money',
    },
    {
      id: 'verify',
      label: 'Verify queue',
      category: 'Audience',
      status: verify > 0 ? 'warn' : 'ok',
      detail: verify === 0 ? 'No pending athlete verifies.' : `${verify} waiting on People.`,
      href: '/admin/people',
    },
    {
      id: 'live',
      label: 'Live board',
      category: 'Live ops',
      status: liveGames === 0 ? 'warn' : 'ok',
      detail: liveGames === 0 ? 'No live games on Local.' : `${liveGames} match${liveGames === 1 ? '' : 'es'} live.`,
      href: '/admin/games',
    },
    {
      id: 'drip',
      label: 'Drip rack',
      category: 'Live ops',
      status: drip === 0 || extras.lowStock > 0 ? 'warn' : 'ok',
      detail:
        drip === 0
          ? 'No active Drip SKUs.'
          : extras.lowStock > 0
            ? `${extras.lowStock} low-stock item${extras.lowStock === 1 ? '' : 's'}.`
            : `${drip} SKUs on the rack.`,
      href: '/admin/drip',
    },
    {
      id: 'uploads',
      label: 'Uploads (24h)',
      category: 'Engagement',
      status: clips24 === 0 ? 'warn' : 'ok',
      detail: clips24 === 0 ? 'No new clips in 24h.' : `${clips24} clip${clips24 === 1 ? '' : 's'} uploaded.`,
      href: '/admin/highlights',
    },
    {
      id: 'spotlight',
      label: 'Spotlight window',
      category: 'Content',
      status: spotlight === 0 ? 'warn' : 'ok',
      detail: spotlight === 0 ? 'No live Player of the Week.' : `${spotlight} award${spotlight === 1 ? '' : 's'} in window.`,
      href: '/admin/spotlight',
    },
    {
      id: 'chrome',
      label: 'Unpublished look',
      category: 'Ship',
      status: extras.dirty ? 'warn' : 'ok',
      detail: extras.dirty
        ? `${extras.pendingCount} draft change${extras.pendingCount === 1 ? '' : 's'} wait on Publish to app.`
        : 'Fan chrome matches the last publish.',
      href: '/admin/features',
    },
    {
      id: 'sessions',
      label: 'Tab sessions',
      category: 'Usage',
      status: sessions === 0 ? 'warn' : 'ok',
      detail: sessions === 0 ? 'No tab dwell in 24h yet.' : `${sessions} session${sessions === 1 ? '' : 's'} in 24h.`,
      href: '/admin/reports',
    },
    {
      id: 'ui-issues',
      label: 'Control issues',
      category: 'Usage',
      status: band(issues, 3, 12),
      detail:
        issues === 0
          ? 'No failed controls in 24h.'
          : `${issues} issue${issues === 1 ? '' : 's'} on buttons and tabs in 24h.`,
      href: '/admin/feedback',
    },
  ];
  return checks;
}

// Private helpers used only by the code archived above (second pass).
function asSection(raw: unknown): AdminReportSection {
  if (!raw || typeof raw !== 'object') return {};
  const next: AdminReportSection = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    next[key] = asInt(value);
  }
  return next;
}

function parseLeaders(raw: unknown): AdminReportLeaders {
  const bag = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    malo: asLeaders(bag.malo),
    hype: asLeaders(bag.hype),
    schools: asLeaders(bag.schools),
  };
}

function parseSeries(raw: unknown): AdminReportSeries {
  const bag = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    clips: asLeaders(bag.clips).map((row) => ({ day: row.label, value: row.value })),
    malo: asLeaders(bag.malo).map((row) => ({ day: row.label, value: row.value })),
    stalls: asLeaders(bag.stalls).map((row) => ({ day: row.label, value: row.value })),
    dwell: asLeaders(bag.dwell).map((row) => ({ day: row.label, value: row.value })),
  };
}

const EMPTY_REPORTS: AdminReports = {
  generatedAt: null,
  engagement: {},
  money: {},
  content: {},
  audience: {},
  live: {},
  reliability: {},
  usage: {},
  tabs: [],
  features: [],
  issues: [],
  scroll: [],
  leaders: { malo: [], hype: [], schools: [] },
  series: { clips: [], malo: [], stalls: [], dwell: [] },
};

function band(value: number, warnAt: number, failAt: number): AdminHealthStatus {
  if (value >= failAt) return 'fail';
  if (value >= warnAt) return 'warn';
  return 'ok';
}

function asLeaders(raw: unknown): AdminReportLeader[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const label = asText(item.label);
      if (!label) return null;
      return { label, value: asInt(item.value) };
    })
    .filter((row): row is AdminReportLeader => row !== null);
}
