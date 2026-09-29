import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function rpcMissing(message: string | undefined): boolean {
  return /could not find the function|schema cache|42883|PGRST202/i.test(message ?? '');
}

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function asCount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export type PayoutHoldReason = 'disputed' | 'no_claim' | 'needs_payout_setup';

/** The signed-in athlete's own payout gate (design §9). */
export type MyPayoutStatus = {
  allowed: boolean;
  /** 'school' = confirmed by the school (no cap); 'identity' = Stripe ID check passed (capped until vouched). */
  path: 'school' | 'identity' | null;
  capCents: number | null;
  reason: PayoutHoldReason | null;
  vouches: number;
};

/**
 * @purpose Parse `get_my_payout_status`. Unknown shapes → null (the card then shows nothing extra).
 */
export function parseMyPayoutStatus(raw: unknown): MyPayoutStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const path = row.path === 'school' || row.path === 'identity' ? row.path : null;
  const reason =
    row.reason === 'disputed' || row.reason === 'no_claim' || row.reason === 'needs_payout_setup' ? row.reason : null;
  const cap = typeof row.cap_cents === 'number' && row.cap_cents > 0 ? row.cap_cents : null;
  return { allowed: row.allowed === true, path, capCents: cap, reason, vouches: asCount(row.vouches) };
}

/**
 * @purpose The caller's payout gate: school-confirmed, unlocked by the family's Stripe ID check (with a
 *   cap), or held and why.
 * @returns null when signed out, no claim, or the payout-gate SQL is not applied yet.
 * @sideEffects `get_my_payout_status` RPC.
 */
export async function fetchMyPayoutStatus(): Promise<MyPayoutStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_my_payout_status');
  if (error) return null;
  return parseMyPayoutStatus(data);
}

/**
 * @purpose Whether gifts to this athlete can be paid out now (school confirmed, or the family passed the
 *   Stripe ID check with one undisputed claim). Drives the "held" line on the gift sheet.
 * @returns Unknown → false (the sheet says the gift is held, which is the safe claim).
 * @sideEffects `athlete_payout_allowed` RPC.
 */
export async function fetchPayoutAllowed(playerId: string | null | undefined): Promise<boolean> {
  if (!playerId || !isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('athlete_payout_allowed', { target_player_id: playerId });
  if (error) return false;
  return data === true;
}

export type TeammateToVouch = {
  requestId: string;
  name: string;
  sport: string | null;
  classYear: string | null;
  jersey: string | null;
  vouches: number;
  vouchedByMe: boolean;
};

/**
 * @purpose Parse `get_teammates_to_vouch`. Rows without a request id are dropped.
 */
export function parseTeammatesToVouch(raw: unknown): TeammateToVouch[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const requestId = asText(row.request_id);
    if (!requestId) return [];
    return [
      {
        requestId,
        name: asText(row.name) ?? 'Athlete',
        sport: asText(row.sport),
        classYear: asText(row.class_year),
        jersey: asText(row.jersey),
        vouches: asCount(row.vouches),
        vouchedByMe: row.vouched_by_me === true,
      },
    ];
  });
}

/**
 * @purpose Pending teammates at the caller's school that the caller may vouch for. Empty unless the caller
 *   is school-confirmed or has passed the payout gate themselves.
 * @sideEffects `get_teammates_to_vouch` RPC.
 */
export async function fetchTeammatesToVouch(): Promise<TeammateToVouch[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_teammates_to_vouch');
  if (error) return [];
  return parseTeammatesToVouch(data);
}

/**
 * @purpose Vouch that a pending teammate is on the team. Three vouches lift their payout cap.
 * @returns The teammate's new vouch count.
 * @sideEffects `vouch_for_teammate` RPC (max 10 a day per voucher, server-enforced).
 */
export async function vouchForTeammate(requestId: string): Promise<number> {
  if (!isSupabaseConfigured) throw new Error('Vouching needs the live app.');
  const { data, error } = await supabase.rpc('vouch_for_teammate', { target_request_id: requestId });
  if (error) {
    if (rpcMissing(error.message)) throw new Error('Vouching is not switched on yet.');
    throw new Error(error.message);
  }
  return asCount(data);
}
