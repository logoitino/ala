/**
 * Status for the Management desk. The page passes numbers the reports and revenue reads already
 * returned. A failed read is an error. A zero is an empty window. A null count (the reports read
 * failed or the key was absent) is "not read", never "nothing happened". `deskLabel` is the one
 * word Home and Departments print on each desk tile (Clear / Check / Failed).
 */

export type DeskTone = 'ok' | 'warn' | 'danger';

export type ManagementSnapshot = {
  reportsError: string | null;
  revenueError: string | null;
  /** Counts from `get_admin_reports`. `null` = not in this read; never treated as 0. */
  donations7dCents: number | null;
  sessions24h: number | null;
  issues24h: number | null;
  openBugs: number | null;
  stalls24h: number | null;
  reconnects24h: number | null;
};

export type DeskStatus = {
  id: 'billing' | 'marketing' | 'support' | 'api' | 'it';
  title: string;
  tone: DeskTone;
  status: string;
};

/**
 * @purpose The one word on a desk tile, shared by Home and Departments so both say the same thing.
 * @param tone The desk's tone from `managementDeskStatus`.
 * @returns "Clear", "Check" (something to check), or "Failed" (a read failed).
 */
export function deskLabel(tone: DeskTone): 'Clear' | 'Check' | 'Failed' {
  return tone === 'danger' ? 'Failed' : tone === 'warn' ? 'Check' : 'Clear';
}

/** App routes this desk names. It does not call them. */
export const APP_API_ROUTES = [
  { path: '/api/create-payment-intent', note: 'Gift checkout. Stripe test mode.' },
  { path: '/api/create-stripe-account', note: 'Connect onboarding. Stripe test mode.' },
  { path: '/api/create-payout', note: 'Payouts stay blocked in this test.' },
] as const;

/**
 * @purpose Sentences for reads that failed, so Billing and IT do not look empty when the server did not answer.
 * @param snapshot Report and revenue errors already returned to the page.
 * @returns One sentence per failed read.
 */
export function managementAlerts(snapshot: ManagementSnapshot): string[] {
  const alerts: string[] = [];
  if (snapshot.reportsError) alerts.push(`Reports did not load. ${snapshot.reportsError}`);
  if (snapshot.revenueError) alerts.push(`Revenue did not load. ${snapshot.revenueError}`);
  return alerts;
}

/**
 * @purpose Status line for each management area from the same snapshot.
 * @param snapshot Counts and read errors for the current page load.
 * @returns Billing, Marketing, Support, API, and IT, in that order.
 */
export function managementDeskStatus(snapshot: ManagementSnapshot): DeskStatus[] {
  const reportsDown = Boolean(snapshot.reportsError);
  const moneyDown = Boolean(snapshot.revenueError);
  const apiTone: DeskTone = reportsDown && moneyDown ? 'danger' : reportsDown || moneyDown ? 'warn' : 'ok';
  const known = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value);
  const { donations7dCents: donations, sessions24h: sessions, issues24h: issues, openBugs: bugs, stalls24h: stalls, reconnects24h: reconnects } = snapshot;

  // Billing's gift count comes from the reports read, not the revenue read. A failed reports
  // read must not turn into "No gifts in 7 days".
  const billing: Pick<DeskStatus, 'tone' | 'status'> = moneyDown
    ? { tone: 'danger', status: 'Revenue read failed' }
    : reportsDown
      ? { tone: 'danger', status: 'Gifts did not load' }
      : !known(donations)
        ? { tone: 'warn', status: 'Gifts not in this read' }
        : donations > 0
          ? { tone: 'ok', status: 'Gifts in this window' }
          : { tone: 'warn', status: 'No gifts in 7 days' };

  const marketing: Pick<DeskStatus, 'tone' | 'status'> = reportsDown
    ? { tone: 'danger', status: 'Tab opens did not load' }
    : !known(sessions)
      ? { tone: 'warn', status: 'Tab opens not in this read' }
      : sessions > 0
        ? { tone: 'ok', status: 'Tabs opened in 24 hours' }
        : { tone: 'warn', status: 'No tab opens in 24 hours' };

  const support: Pick<DeskStatus, 'tone' | 'status'> = reportsDown
    ? { tone: 'danger', status: 'Issues did not load' }
    : !known(issues) || !known(bugs)
      ? { tone: 'warn', status: 'Issues not in this read' }
      : issues > 0 || bugs > 0
        ? { tone: 'warn', status: 'Something needs a check' }
        : { tone: 'ok', status: 'No open issues in this window' };

  const it: Pick<DeskStatus, 'tone' | 'status'> = reportsDown
    ? { tone: 'danger', status: 'Reliability did not load' }
    : !known(stalls) || !known(reconnects)
      ? { tone: 'warn', status: 'Stalls or reconnects not in this read' }
      : stalls > 0 || reconnects > 0
        ? { tone: 'warn', status: 'Stalls or reconnects in 24 hours' }
        : { tone: 'ok', status: 'No stalls or reconnects in 24 hours' };

  return [
    { id: 'billing', title: 'Billing', ...billing },
    { id: 'marketing', title: 'Marketing', ...marketing },
    { id: 'support', title: 'Support', ...support },
    { id: 'api', title: 'API', tone: apiTone, status: apiTone === 'ok' ? 'Portal reads answered' : 'A portal read failed' },
    { id: 'it', title: 'IT', ...it },
  ];
}
