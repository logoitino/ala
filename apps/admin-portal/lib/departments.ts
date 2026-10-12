/**
 * Status for the Management desk. The page passes numbers the reports and revenue reads already
 * returned. A failed read is an error. A zero is an empty window.
 */

export type DeskTone = 'ok' | 'warn' | 'danger';

export type ManagementSnapshot = {
  reportsError: string | null;
  revenueError: string | null;
  donations7dCents: number;
  sessions24h: number;
  issues24h: number;
  openBugs: number;
  stalls24h: number;
  reconnects24h: number;
};

export type DeskStatus = {
  id: 'billing' | 'marketing' | 'support' | 'api' | 'it';
  title: string;
  tone: DeskTone;
  status: string;
};

/** App routes this desk names. It does not call them. */
export const APP_API_ROUTES = [
  { path: '/api/create-payment-intent', note: 'Donation checkout. Stripe test mode.' },
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
  if (snapshot.revenueError) alerts.push(`Money did not load. ${snapshot.revenueError}`);
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

  return [
    {
      id: 'billing',
      title: 'Billing',
      tone: moneyDown ? 'danger' : snapshot.donations7dCents > 0 ? 'ok' : 'warn',
      status: moneyDown
        ? 'Money read failed'
        : snapshot.donations7dCents > 0
          ? 'Donations in this window'
          : 'No donations in 7 days',
    },
    {
      id: 'marketing',
      title: 'Marketing',
      tone: reportsDown ? 'danger' : snapshot.sessions24h > 0 ? 'ok' : 'warn',
      status: reportsDown ? 'Sessions did not load' : snapshot.sessions24h > 0 ? 'People opened the app' : 'No sessions in 24 hours',
    },
    {
      id: 'support',
      title: 'Support',
      tone: reportsDown ? 'danger' : snapshot.issues24h > 0 || snapshot.openBugs > 0 ? 'warn' : 'ok',
      status: reportsDown
        ? 'Issues did not load'
        : snapshot.issues24h > 0 || snapshot.openBugs > 0
          ? 'Something needs a look'
          : 'No open issues in this window',
    },
    {
      id: 'api',
      title: 'API',
      tone: apiTone,
      status: apiTone === 'ok' ? 'Portal reads answered' : 'A portal read failed',
    },
    {
      id: 'it',
      title: 'IT',
      tone: reportsDown ? 'danger' : snapshot.stalls24h > 0 || snapshot.reconnects24h > 0 ? 'warn' : 'ok',
      status: reportsDown
        ? 'Reliability did not load'
        : snapshot.stalls24h > 0 || snapshot.reconnects24h > 0
          ? 'Stalls or reconnects in 24 hours'
          : 'No stalls or reconnects in 24 hours',
    },
  ];
}
