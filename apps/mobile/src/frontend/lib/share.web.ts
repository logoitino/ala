import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { formatGiftUrl, normalizeAthleteHandle, shareQrSubtitle } from '@/data/share';
import { handleFromName } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

import type { GiftQrTarget } from '@/lib/share.types';

export type { GiftQrTarget } from '@/lib/share.types';

/**
 * @purpose Build the public gift link encoded in ShareQrModal (web).
 */
export function giftQrTarget(athleteName: string, username?: string | null): GiftQrTarget {
  const handle = normalizeAthleteHandle(username || handleFromName(athleteName));
  return { handle, url: formatGiftUrl(handle), athleteName: athleteName.trim() || 'this athlete' };
}

/**
 * @purpose Web has no Camera Roll — copy the tipping URL instead.
 */
export async function saveGiftQrToCameraRoll(_svg: unknown, _handle: string): Promise<void> {
  throw new Error('Save the QR flyer from iOS or Android. Copy the donation link here.');
}

/**
 * @purpose Copy `https://tapuai.app/gift/{handle}` on web.
 * @sideEffects `expo-clipboard`.
 */
export async function copyGiftLink(url: string): Promise<void> {
  const ok = await Clipboard.setStringAsync(url);
  if (ok === false) throw new Error('Could not copy the donation link.');
}

/**
 * @purpose Browser share sheet / fallback copy for the gift URL.
 */
export async function shareGiftLink(target: GiftQrTarget): Promise<void> {
  const message = `${shareQrSubtitle(target.athleteName)}\n${target.url}`;
  await Share.share({ message });
}

/**
 * @purpose Resolve a gift-link handle to a claimed roster row for `/gift/[handle]`.
 * @sideEffects `profiles` SELECT by username.
 */
export async function lookupPlayerByHandle(
  rawHandle: string,
): Promise<{ playerId: string | null; name: string; username: string } | null> {
  const handle = normalizeAthleteHandle(rawHandle);
  if (!isSupabaseConfigured) return { playerId: null, name: handle, username: handle };
  const { data } = await supabase
    .from('profiles')
    .select('player_id, full_name, username')
    .ilike('username', handle)
    .maybeSingle();
  if (!data) return { playerId: null, name: handle, username: handle };
  return {
    playerId: typeof data.player_id === 'string' ? data.player_id : null,
    name: typeof data.full_name === 'string' && data.full_name.trim() ? data.full_name.trim() : handle,
    username: typeof data.username === 'string' && data.username.trim() ? data.username.trim() : handle,
  };
}
