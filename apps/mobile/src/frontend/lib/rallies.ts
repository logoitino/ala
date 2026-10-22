/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { isAuraUuid } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { RallyCostKind,  RallyStatus } from '@/types/database';

/**
 * Rally goals (ROADMAP M2, owner 2026-09-29): a family names a real sports cost — season fees, gear,
 * travel, camps, college prep — tells the story in a few lines, and the community donates toward it.
 * The GoFundMe replacement, next to the athlete's highlights. Server rules
 * (`20260929180000_rally_goals_thanks_platform_tip.sql`): one open Rally per athlete; a guardian's
 * Rally goes live at once, an athlete's waits for the guardian unless they already control their own
 * money; donations tagged with `rally_id` move the total and fill it.
 */

export type Rally = {
  id: string;
  playerId: string;
  title: string;
  story: string;
  costKind: RallyCostKind;
  targetCents: number;
  raisedCents: number;
  donationCount: number;
  endsOn: string | null;
  status: RallyStatus;
  filledAt: string | null;
  thanksKey: string | null;
  thanksReelId: string | null;
  thankedAt: string | null;
  createdAt: string;
};

export const RALLY_COST_KINDS: readonly { id: RallyCostKind; label: string; emoji: string }[] = [
  { id: 'season', label: 'Season fees', emoji: '🏟️' },
  { id: 'gear', label: 'Gear', emoji: '👟' },
  { id: 'travel', label: 'Travel', emoji: '🚌' },
  { id: 'camps', label: 'Camps & clinics', emoji: '⛺' },
  { id: 'college_prep', label: 'College prep & recruiting', emoji: '🎓' },
  { id: 'other', label: 'Other sports costs', emoji: '⚡' },
];

export const RALLY_MIN_DOLLARS = 5;
export const RALLY_MAX_DOLLARS = 25_000;
export const RALLY_TITLE_MAX = 60;
export const RALLY_STORY_MAX = 600;
export const RALLY_MAX_DAYS = 180;

const COST_KIND_IDS = new Set<string>(RALLY_COST_KINDS.map((kind) => kind.id));
const STATUSES = new Set<string>(['pending_guardian', 'live', 'filled', 'closed']);

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseRally(raw: unknown): Rally | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  const playerId = asText(row.player_id);
  if (!id || !playerId) return null;
  const costKind = typeof row.cost_kind === 'string' && COST_KIND_IDS.has(row.cost_kind) ? row.cost_kind : 'other';
  const status = typeof row.status === 'string' && STATUSES.has(row.status) ? row.status : 'closed';
  return {
    id,
    playerId,
    title: asText(row.title)?.trim() ?? 'Rally',
    story: typeof row.story === 'string' ? row.story.trim() : '',
    costKind: costKind as RallyCostKind,
    targetCents: asCount(row.target_cents),
    raisedCents: asCount(row.raised_cents),
    donationCount: asCount(row.donation_count),
    endsOn: asText(row.ends_on),
    status: status as RallyStatus,
    filledAt: asText(row.filled_at),
    thanksKey: asText(row.thanks_key),
    thanksReelId: asText(row.thanks_reel_id),
    thankedAt: asText(row.thanked_at),
    createdAt: asText(row.created_at) ?? new Date(0).toISOString(),
  };
}

export function costKindLabel(kind: RallyCostKind): string {
  const found = RALLY_COST_KINDS.find((entry) => entry.id === kind);
  return found ? `${found.emoji} ${found.label}` : 'Sports costs';
}

function dollars(cents: number): string {
  const value = Math.max(0, cents) / 100;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Whole days until `endsOn` (a `YYYY-MM-DD` date), 0 on the last day, null with no end date. */
export function rallyDaysLeft(endsOn: string | null, now = new Date()): number | null {
  if (!endsOn) return null;
  const end = Date.parse(`${endsOn}T23:59:59`);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - now.getTime()) / 86_400_000));
}

/**
 * @purpose Progress numbers for the bar: 0–1 fraction plus "$140 of $250" and "12 donors".
 */
export function rallyProgress(rally: Pick<Rally, 'raisedCents' | 'targetCents' | 'donationCount'>): {
  fraction: number;
  amountLine: string;
  donorsLine: string;
} {
  const fraction = rally.targetCents > 0 ? Math.min(1, rally.raisedCents / rally.targetCents) : 0;
  const donors = rally.donationCount;
  return {
    fraction,
    amountLine: `${dollars(rally.raisedCents)} of ${dollars(rally.targetCents)}`,
    donorsLine: donors === 0 ? 'Be the first to give' : `${donors} ${donors === 1 ? 'gift' : 'gifts'}`,
  };
}

/** Short status for the card chip. Never urgency or guilt (docs/product/VOICE.md). */
export function rallyStatusLine(rally: Pick<Rally, 'status' | 'endsOn'>, now = new Date()): string {
  if (rally.status === 'pending_guardian') return 'Waiting for a parent or guardian to approve';
  if (rally.status === 'filled') return 'Goal reached — thank you, everyone';
  if (rally.status === 'closed') return 'Closed';
  const days = rallyDaysLeft(rally.endsOn, now);
  if (days == null) return 'Open';
  if (days === 0) return 'Last day';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

export type RallyDraft = {
  title: string;
  story: string;
  costKind: RallyCostKind;
  targetDollars: string;
  /** `YYYY-MM-DD`, or empty for no end date. */
  endsOn: string;
};

/**
 * @purpose Check a draft before calling the server. Same limits as the SQL.
 * @returns A plain-English problem, or null when the draft is ready.
 */
export function rallyDraftProblem(draft: RallyDraft, now = new Date()): string | null {
  const title = draft.title.trim();
  if (title.length < 3) return 'Give the Rally a short name, like "New cleats" or "Tournament travel".';
  if (title.length > RALLY_TITLE_MAX) return `Keep the name under ${RALLY_TITLE_MAX} characters.`;
  if (draft.story.length > RALLY_STORY_MAX) return `Keep the story under ${RALLY_STORY_MAX} characters.`;
  const amount = Number(draft.targetDollars.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount < RALLY_MIN_DOLLARS || amount > RALLY_MAX_DOLLARS) {
    return `Pick a goal between $${RALLY_MIN_DOLLARS} and $${RALLY_MAX_DOLLARS.toLocaleString()}.`;
  }
  if (draft.endsOn.trim()) {
    const days = rallyDaysLeft(draft.endsOn.trim(), now);
    if (days == null || !/^\d{4}-\d{2}-\d{2}$/.test(draft.endsOn.trim())) return 'Use a date like 2026-12-01.';
    if (days < 1 || days > RALLY_MAX_DAYS) return 'Pick an end date within the next 6 months.';
  }
  return null;
}

export function rallyTargetCents(targetDollars: string): number {
  return Math.round(Number(targetDollars.replace(/[^0-9.]/g, '')) * 100);
}

/**
 * @purpose The Rally fans see for an athlete: open, or recently filled.
 * @returns Null when there is none, the id isn't a real athlete, or the SQL isn't applied yet.
 */
export async function fetchActiveRally(playerId: string | null | undefined): Promise<Rally | null> {
  if (!playerId || !isAuraUuid(playerId) || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_active_rally', { target_player_id: playerId });
    if (error) return null;
    return parseRally(Array.isArray(data) ? data[0] : data);
  } catch {
    return null;
  }
}

/**
 * @purpose Every Rally the signed-in athlete / guardian can manage, newest first (includes pending).
 * @returns Null when Rallies are unavailable (SQL not applied, not a real athlete, request failed), so
 *   the card can hide its "Start a Rally" invite instead of offering something that will error.
 */
export async function fetchPlayerRallies(playerId: string | null | undefined): Promise<Rally[] | null> {
  if (!playerId || !isAuraUuid(playerId) || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_player_rallies', { target_player_id: playerId });
    if (error || !Array.isArray(data)) return null;
    return data.map(parseRally).filter((row): row is Rally => row !== null);
  } catch {
    return null;
  }
}

export type RallyResult = { ok: true; rally: Rally } | { ok: false; message: string };

async function rallyCall(run: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>, fallback: string): Promise<RallyResult> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Rallies open once the app is connected.' };
  try {
    const { data, error } = await run();
    if (error) return { ok: false, message: error.message || fallback };
    const rally = parseRally(data);
    return rally ? { ok: true, rally } : { ok: false, message: fallback };
  } catch {
    return { ok: false, message: fallback };
  }
}

/**
 * @purpose Start a Rally. Live right away for a guardian (or an adult athlete); otherwise it waits for
 *   the guardian's approval.
 * @sideEffects `create_rally` RPC.
 */
export function createRally(playerId: string, draft: RallyDraft): Promise<RallyResult> {
  return rallyCall(
    () =>
      supabase.rpc('create_rally', {
        target_player_id: playerId,
        rally_title: draft.title.trim(),
        rally_story: draft.story.trim(),
        rally_cost_kind: draft.costKind,
        rally_target_cents: rallyTargetCents(draft.targetDollars),
        rally_ends_on: draft.endsOn.trim() || null,
      }),
    'Could not start the Rally.',
  );
}

/** @sideEffects `approve_rally` RPC (guardian / admin only). */
export function approveRally(rallyId: string): Promise<RallyResult> {
  return rallyCall(() => supabase.rpc('approve_rally', { target_rally_id: rallyId }), 'Could not approve the Rally.');
}

/** @sideEffects `close_rally` RPC. */
export function closeRally(rallyId: string): Promise<RallyResult> {
  return rallyCall(() => supabase.rpc('close_rally', { target_rally_id: rallyId }), 'Could not close the Rally.');
}

/**
 * @purpose Public thank-you on a Rally: a preset message and, optionally, one of the athlete's own clips
 *   showing what the donations paid for.
 * @sideEffects `thank_rally` RPC.
 */
export function thankRally(rallyId: string, messageKey: string, reelId?: string | null): Promise<RallyResult> {
  return rallyCall(
    () =>
      supabase.rpc('thank_rally', {
        target_rally_id: rallyId,
        message_key: messageKey,
        what_it_paid_for_reel: reelId ?? null,
      }),
    'Could not post the thank-you.',
  );
}
