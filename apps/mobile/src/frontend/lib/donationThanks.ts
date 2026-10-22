/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { isAuraUuid } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isMissingFunction } from '@/lib/dbErrors';

/**
 * Saying thank you (owner, 2026-09-29: "upon receiving money, athletes are encouraged to say thank you
 * for the donation"). The athlete — or their parent / guardian — picks one of these messages for each
 * donor. Presets only: no free text and no replies, because many athletes are minors and this must
 * never become a private message channel between a kid and an adult (STORY.md guardrails, LEGAL row S).
 * The keys match the SQL CHECK in `20260929180000_rally_goals_thanks_platform_tip.sql`.
 */

export type ThanksKey = 'malo' | 'season' | 'gear' | 'family' | 'work';

export const THANKS_MESSAGES: readonly { key: ThanksKey; text: string }[] = [
  { key: 'malo', text: 'Mālo! Thank you for your gift 🙏' },
  { key: 'season', text: 'Thank you for helping me play this season.' },
  { key: 'gear', text: 'Thank you — this helps with my gear.' },
  { key: 'family', text: 'My family and I thank you.' },
  { key: 'work', text: 'Thank you for believing in me. Back to work 💪' },
];

export function thanksText(key: string | null | undefined): string | null {
  return THANKS_MESSAGES.find((message) => message.key === key)?.text ?? null;
}

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type DonationToThank = {
  tipId: string;
  amountCents: number;
  createdAt: string;
  fanName: string;
  rallyTitle: string | null;
  thankedKey: ThanksKey | null;
};

export function parseDonationsToThank(raw: unknown): DonationToThank[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): DonationToThank | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const tipId = asText(r.tip_id);
      if (!tipId) return null;
      const key = asText(r.thanked_key);
      return {
        tipId,
        amountCents: asCount(r.amount_cents),
        createdAt: asText(r.created_at) ?? new Date(0).toISOString(),
        fanName: asText(r.fan_name) ?? 'A fan',
        rallyTitle: asText(r.rally_title),
        thankedKey: key && thanksText(key) ? (key as ThanksKey) : null,
      };
    })
    .filter((row): row is DonationToThank => row !== null);
}

export type ThanksReceived = {
  tipId: string;
  playerId: string;
  athleteName: string;
  messageKey: ThanksKey;
  amountCents: number;
  thankedAt: string;
};

export type ThanksReceivedResult = {
  rows: ThanksReceived[];
  /** Friendly load failure. Missing/unapplied Rally SQL remains a graceful empty state. */
  error: string | null;
};

export function parseThanksReceived(raw: unknown): ThanksReceived[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): ThanksReceived | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const tipId = asText(r.tip_id);
      const key = asText(r.message_key);
      if (!tipId || !key || !thanksText(key)) return null;
      return {
        tipId,
        playerId: asText(r.player_id) ?? '',
        athleteName: asText(r.athlete_name) ?? 'An athlete',
        messageKey: key as ThanksKey,
        amountCents: asCount(r.amount_cents),
        thankedAt: asText(r.thanked_at) ?? new Date(0).toISOString(),
      };
    })
    .filter((row): row is ThanksReceived => row !== null);
}

/**
 * @purpose Recent donations to this athlete and whether each donor has been thanked.
 * @returns `[]` for anyone but the athlete, their guardian or an admin, or before the SQL is applied.
 */
export async function fetchDonationsToThank(playerId: string | null | undefined): Promise<DonationToThank[]> {
  if (!playerId || !isAuraUuid(playerId) || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.rpc('get_donations_to_thank', { target_player_id: playerId });
    if (error) return [];
    return parseDonationsToThank(data);
  } catch {
    return [];
  }
}

/**
 * @purpose Thank-yous plus a truthful load error for Activity, without treating unapplied Rally SQL as an outage.
 * @returns Parsed rows and a friendly error; missing RPC/configuration resolves to an empty available state.
 * @sideEffects `get_my_donation_thanks` RPC.
 */
export async function fetchMyDonationThanksResult(): Promise<ThanksReceivedResult> {
  if (!isSupabaseConfigured) return { rows: [], error: null };
  try {
    const { data, error } = await supabase.rpc('get_my_donation_thanks', {});
    if (error) {
      const missing = isMissingFunction(error);
      return {
        rows: [],
        error: missing ? null : 'We could not load athlete thank-yous. Check your connection and try again.',
      };
    }
    return { rows: parseThanksReceived(data), error: null };
  } catch {
    return { rows: [], error: 'We could not load athlete thank-yous. Check your connection and try again.' };
  }
}

export type ThankResult = { ok: true } | { ok: false; message: string };

/**
 * @purpose Send one preset thank-you to the donor of `tipId`. Once per donation.
 * @sideEffects `thank_donation` RPC.
 */
export async function thankDonation(tipId: string, key: ThanksKey): Promise<ThankResult> {
  if (!isAuraUuid(tipId) || !isSupabaseConfigured) return { ok: false, message: 'Thank-yous open once this gift is saved.' };
  try {
    const { error } = await supabase.rpc('thank_donation', { target_tip_id: tipId, message_key: key });
    if (error) return { ok: false, message: error.message || 'Could not send the thank-you.' };
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not send the thank-you.' };
  }
}
