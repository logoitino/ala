/**
 * Web version of `share.ts`: builds the same gift URL, but copies the link instead of saving to a Camera Roll.
 */

import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { shareQrSubtitle } from '@/data/share';

import type { GiftQrTarget } from '@/lib/share.types';

export type { GiftQrTarget } from '@/lib/share.types';
// One platform-neutral link builder; both share variants re-export it so callers keep importing `@/lib/share`.
export { giftQrTarget } from '@/lib/giftLink';

/**
 * @purpose Web has no Camera Roll — copy the tipping URL instead.
 */
export async function saveGiftQrToCameraRoll(_svg: unknown, _handle: string): Promise<void> {
  throw new Error('Save the QR flyer from iOS or Android. Copy the gift link here.');
}

/**
 * @purpose Copy `https://tapuai.app/gift/{handle}` on web.
 * @sideEffects `expo-clipboard`.
 */
export async function copyGiftLink(url: string): Promise<void> {
  const ok = await Clipboard.setStringAsync(url);
  if (ok === false) throw new Error('Could not copy the gift link.');
}

/**
 * @purpose Browser share sheet / fallback copy for the gift URL.
 */
export async function shareGiftLink(target: GiftQrTarget): Promise<void> {
  const message = `${shareQrSubtitle(target.athleteName)}\n${target.url}`;
  await Share.share({ message });
}
