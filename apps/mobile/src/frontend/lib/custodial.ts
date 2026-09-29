import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Custodial money rules (owner decision 2026-09-29, `docs/PARENT_PAYEE_CONNECT_DESIGN.md` §7):
 * the guardian holds one payout account per athlete, the athlete sees every gift and approves
 * every guardian withdrawal, and control passes to the athlete at the handover age (default 18).
 * The server enforces all of it (`supabase/custodial_money.sql`); this file only reads and asks.
 */

export type CustodialViewerRole = 'admin' | 'guardian' | 'athlete';

export type WithdrawalStatus = 'pending_athlete' | 'approved' | 'declined' | 'cancelled' | 'paid';

export type CustodialWithdrawal = {
  id: string;
  requestedRole: 'guardian' | 'athlete';
  amountCents: number;
  note: string;
  status: WithdrawalStatus;
  createdAt: string;
  decidedAt: string | null;
};

export type CustodialSummary = {
  viewerRole: CustodialViewerRole;
  playerId: string;
  athleteName: string;
  guardianLinked: boolean;
  guardianName: string;
  hasAccount: boolean;
  payoutsEnabled: boolean;
  bankInAthleteName: boolean | null;
  handoverAge: number;
  /** `YYYY-MM-DD`, or null until the guardian enters a birth date. */
  handoverDate: string | null;
  athleteControls: boolean;
  receivedCents: number;
  requests: CustodialWithdrawal[];
};

/** `unavailable` = the SQL has not been applied to this project yet; the UI hides itself. */
export type CustodialLoad =
  | { state: 'ok'; summary: CustodialSummary | null }
  | { state: 'unavailable' }
  | { state: 'error'; message: string };

const STATUSES: WithdrawalStatus[] = ['pending_athlete', 'approved', 'declined', 'cancelled', 'paid'];

export function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return /could not find the function|schema cache|42883|PGRST202/i.test(`${error.code ?? ''} ${error.message ?? ''}`);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseWithdrawal(row: unknown): CustodialWithdrawal | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const status = text(r.status) as WithdrawalStatus;
  if (!id || !STATUSES.includes(status)) return null;
  return {
    id,
    requestedRole: r.requested_role === 'athlete' ? 'athlete' : 'guardian',
    amountCents: cents(r.amount_cents),
    note: text(r.note),
    status,
    createdAt: text(r.created_at),
    decidedAt: text(r.decided_at) || null,
  };
}

/** @purpose Turn the `get_custodial_summary` JSON into a typed summary; null for anything unusable. */
export function parseCustodialSummary(raw: unknown): CustodialSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const role = text(r.viewer_role);
  if (role !== 'admin' && role !== 'guardian' && role !== 'athlete') return null;
  const age = Number(r.handover_age);
  return {
    viewerRole: role,
    playerId: text(r.player_id),
    athleteName: text(r.athlete_name, 'your athlete'),
    guardianLinked: r.guardian_linked === true,
    guardianName: text(r.guardian_name, 'Your guardian'),
    hasAccount: r.has_account === true,
    payoutsEnabled: r.payouts_enabled === true,
    bankInAthleteName: typeof r.bank_in_athlete_name === 'boolean' ? r.bank_in_athlete_name : null,
    handoverAge: Number.isFinite(age) && age >= 18 ? age : 18,
    handoverDate: text(r.handover_date) || null,
    athleteControls: r.athlete_controls === true,
    receivedCents: cents(r.received_cents),
    requests: Array.isArray(r.requests)
      ? r.requests.map(parseWithdrawal).filter((w): w is CustodialWithdrawal => Boolean(w))
      : [],
  };
}

/** "March 4, 2027" from `2027-03-04`, without a timezone shift. */
export function formatHandoverDate(isoDate: string | null): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * @purpose Accept `YYYY-MM-DD` or `MM/DD/YYYY` from the guardian and return `YYYY-MM-DD`.
 * @returns null when it is not a real calendar date.
 */
export function parseBirthDateInput(input: string): string | null {
  const value = input.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (us) {
    [m, d, y] = [Number(us[1]), Number(us[2]), Number(us[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Dollars typed by a person → cents, or null. */
export function parseDollarInput(input: string): number | null {
  const n = Number(input.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * @purpose The plain-words line an athlete sees about where their money is and who can move it.
 * @remarks Keep in step with STORY.md guardrails: "to the family's account for the athlete",
 * never "cash in your pocket". Copy is LEGAL's to change.
 */
export function athleteMoneyNotice(summary: CustodialSummary): string {
  if (summary.athleteControls) {
    return `You're ${summary.handoverAge}+. The money fans gave you is yours to move — no one else can withdraw it.`;
  }
  if (!summary.guardianLinked) {
    return 'Donations you receive are held for you. A parent or guardian needs to be linked before any of it can be paid out.';
  }
  const until = summary.handoverDate
    ? ` until ${formatHandoverDate(summary.handoverDate)}, when you turn ${summary.handoverAge}`
    : ` until you turn ${summary.handoverAge}`;
  return `Every donation is held for you in ${summary.guardianName}'s custodial account${until}. They can't withdraw any of it without your OK in the app.`;
}

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending_athlete: 'Waiting on the athlete',
  approved: 'Approved — not paid out yet',
  declined: 'Declined by the athlete',
  cancelled: 'Cancelled',
  paid: 'Paid out',
};

export function withdrawalStatusLabel(status: WithdrawalStatus): string {
  return STATUS_LABELS[status];
}

export function pendingRequests(summary: CustodialSummary | null): CustodialWithdrawal[] {
  return summary ? summary.requests.filter((r) => r.status === 'pending_athlete') : [];
}

/**
 * @purpose Load the custodial summary for one athlete.
 * @param playerId `players.id`. The server returns null unless the caller is that athlete
 * (verified), their linked guardian, or an admin.
 * @sideEffects `get_custodial_summary` RPC.
 */
export async function fetchCustodialSummary(playerId: string | null | undefined): Promise<CustodialLoad> {
  if (!playerId || !isSupabaseConfigured) return { state: 'ok', summary: null };
  const { data, error } = await supabase.rpc('get_custodial_summary', { target_player_id: playerId });
  if (isMissingRpc(error)) return { state: 'unavailable' };
  if (error) return { state: 'error', message: error.message || 'Could not load the account.' };
  return { state: 'ok', summary: parseCustodialSummary(data) };
}

type CustodialRpc =
  | 'guardian_setup_custodial'
  | 'request_custodial_withdrawal'
  | 'decide_custodial_withdrawal'
  | 'cancel_custodial_withdrawal';

async function call(fn: CustodialRpc, args: Record<string, unknown>): Promise<void> {
  // Each exported wrapper below pins the exact argument names for its RPC.
  const { error } = await supabase.rpc(fn, args as never);
  if (error) {
    throw new Error(isMissingRpc(error) ? 'This part of the app is not switched on yet.' : error.message);
  }
}

/** Guardian: open the athlete's custodial record (birth date once) and answer the bank question. */
export function setupCustodialAccount(playerId: string, birthDate: string | null, bankInAthleteName: boolean | null) {
  return call('guardian_setup_custodial', {
    target_player_id: playerId,
    athlete_birth_date: birthDate,
    bank_in_athlete_name: bankInAthleteName,
  });
}

/** Guardian (before handover) asks; athlete (after handover) moves their own money. */
export function requestWithdrawal(playerId: string, amountCents: number, note?: string) {
  return call('request_custodial_withdrawal', {
    target_player_id: playerId,
    amount_cents: amountCents,
    note: note?.trim() || null,
  });
}

/** Athlete approves or declines a guardian's request. */
export function decideWithdrawal(requestId: string, approve: boolean) {
  return call('decide_custodial_withdrawal', { request_id: requestId, approve });
}

export function cancelWithdrawal(requestId: string) {
  return call('cancel_custodial_withdrawal', { request_id: requestId });
}
