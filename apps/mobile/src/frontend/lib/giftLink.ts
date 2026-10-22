/**
 * Gift link (QR) target and lookup, shared by native and web: the URL the athlete QR encodes and
 * the `/gift/[handle]` resolution back to a donatable athlete.
 * A handle is the athlete's username, or their `players.id` when no username exists — a name slug
 * cannot be looked up, so it is only the last resort when neither is known.
 * @sideEffects `get_public_profiles` RPC and `players` SELECT in `resolveGiftLink`.
 */

import type { Player } from '@/data/players';
import { formatGiftUrl, normalizeAthleteHandle } from '@/data/share';
import { handleFromName, isAuraUuid } from '@/lib/aura';
import { getPublicProfiles } from '@/lib/privacy';
import { fetchGuestPlayer } from '@/lib/roster';
import type { GiftQrTarget } from '@/lib/share.types';
import { isSupabaseConfigured } from '@/lib/supabase';

export type GiftLink =
  | { status: 'found'; handle: string; player: Player; name: string; username: string | null; sport: string | null; schoolVisible: boolean }
  | { status: 'not_found'; handle: string }
  | { status: 'error'; handle: string; message: string };

const LOAD_ERROR = 'Could not load this athlete. Check your connection and try again.';

/**
 * @purpose Build the public gift link encoded in ShareQrModal.
 * @param athleteName Display name for copy + share sheet.
 * @param username Optional `profiles.username`; preferred because it reads well in a text message.
 * @param playerId Optional `players.id`; keeps the link resolvable for athletes without a username (Parent HQ, unclaimed rows).
 */
export function giftQrTarget(athleteName: string, username?: string | null, playerId?: string | null): GiftQrTarget {
  const handle = username?.trim()
    ? normalizeAthleteHandle(username)
    : playerId && isAuraUuid(playerId) ? playerId.toLowerCase() : normalizeAthleteHandle(handleFromName(athleteName));
  return { handle, url: formatGiftUrl(handle), athleteName: athleteName.trim() || 'this athlete' };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * @purpose Resolve a scanned gift handle (username or athlete id) to the athlete a family can donate to.
 * @param raw Route segment from `/gift/[handle]`.
 * @returns `found` with the roster row for the donate sheet, `not_found` for an unknown handle or a fan account, or a retryable `error`.
 */
export async function resolveGiftLink(raw: string | null | undefined): Promise<GiftLink> {
  const handle = normalizeAthleteHandle(raw);
  if (!raw?.trim()) return { status: 'not_found', handle };
  if (!isSupabaseConfigured) return { status: 'error', handle, message: 'Gifts are not set up on this build yet.' };
  try {
    const byId = isAuraUuid(handle);
    // Privacy-applied public rows (PRIV-01); a missing row is not proof the athlete is missing when the link is an id.
    const profile = (await getPublicProfiles(byId ? { playerIds: [handle] } : { handle }))[0] ?? null;
    const playerId = byId ? handle : text(profile?.player_id);
    // A username that belongs to a fan, not an athlete, has nobody to donate to.
    if (!playerId) return { status: 'not_found', handle };
    const loaded = await fetchGuestPlayer(playerId);
    if (!loaded.player) {
      // An id link with no profile and no roster row is unknown; with a profile it is a failed read worth retrying.
      return byId && !profile ? { status: 'not_found', handle } : { status: 'error', handle, message: LOAD_ERROR };
    }
    return {
      status: 'found',
      handle,
      player: loaded.player,
      name: text(profile?.full_name) ?? text(loaded.player.name) ?? 'this athlete',
      username: text(profile?.username),
      // Public athlete sport (PRIV-01 applied); null until the athlete sets it or the column exists.
      sport: text(profile?.athlete_sport),
      // The athlete can hide their school (PRIV-01); the roster row ignores that, so carry the public flag.
      schoolVisible: profile?.school_visible ?? true,
    };
  } catch {
    return { status: 'error', handle, message: LOAD_ERROR };
  }
}
