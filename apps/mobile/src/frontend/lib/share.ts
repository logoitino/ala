/**
 * Gift link and QR flyer helpers (native): build the public gift URL and save the QR as a PNG to the Camera Roll.
 * The web build uses `share.web.ts`.
 */

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { formatGiftUrl, normalizeAthleteHandle, shareQrSubtitle } from '@/data/share';
import { handleFromName } from '@/lib/aura';
import type { GiftQrTarget } from '@/lib/share.types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getPublicProfiles } from '@/lib/privacy';

export type { GiftQrTarget } from '@/lib/share.types';

type SvgDataUrlRef = {
  toDataURL?: (callback: (data: string) => void) => void;
};

/**
 * @purpose Build the public gift link encoded in ShareQrModal.
 * @param athleteName Display name for copy + share sheet.
 * @param username Optional `profiles.username`; falls back to `handleFromName`.
 */
export function giftQrTarget(athleteName: string, username?: string | null): GiftQrTarget {
  const handle = normalizeAthleteHandle(username || handleFromName(athleteName));
  return { handle, url: formatGiftUrl(handle), athleteName: athleteName.trim() || 'this athlete' };
}

function stripBase64(raw: string): string {
  const marker = 'base64,';
  const index = raw.indexOf(marker);
  return (index >= 0 ? raw.slice(index + marker.length) : raw).replace(/\s+/g, '');
}

function base64ToBytes(b64: string): Uint8Array {
  const decode = globalThis.atob;
  if (typeof decode !== 'function') {
    throw new Error('Could not encode the QR image.');
  }
  const binary = decode(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function captureQrPng(svg: SvgDataUrlRef | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!svg?.toDataURL) {
      reject(new Error('QR is not ready yet.'));
      return;
    }
    svg.toDataURL((data) => {
      if (!data) {
        reject(new Error('Could not render the QR image.'));
        return;
      }
      resolve(stripBase64(data));
    });
  });
}

async function downloadPngOnWeb(base64: string, handle: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Saving the QR flyer is available on iOS and Android.');
  }
  const anchor = document.createElement('a');
  anchor.href = `data:image/png;base64,${base64}`;
  anchor.download = `tapuai-${handle}-qr.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * @purpose Capture the on-screen QR SVG and save a flyer-ready PNG to Camera Roll (or download on web).
 * @param svg `react-native-qrcode-svg` getRef (react-native-svg `toDataURL`).
 * @param handle Athlete slug used in the filename.
 * @sideEffects `expo-file-system` cache write; `expo-media-library` `Asset.create` (write-only permission); web `<a download>`.
 */
export async function saveGiftQrToCameraRoll(svg: SvgDataUrlRef | null, handle: string): Promise<void> {
  const base64 = await captureQrPng(svg);
  if (Platform.OS === 'web') {
    await downloadPngOnWeb(base64, handle);
    return;
  }

  const [{ File, Paths }, { Asset, requestPermissionsAsync }] = await Promise.all([
    import('expo-file-system'),
    import('expo-media-library'),
  ]);
  const file = new File(Paths.cache, `tapuai-${handle}-qr.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(base64ToBytes(base64));

  const permission = await requestPermissionsAsync(true);
  if (permission.status !== 'granted') {
    throw new Error('Allow photo access to save this QR flyer.');
  }
  await Asset.create(file.uri);
}

/**
 * @purpose Copy `https://tapuai.app/gift/{handle}` and fire a confirmation haptic.
 * @sideEffects `expo-clipboard` `setStringAsync`; `Haptics.notificationAsync(Success)`.
 */
export async function copyGiftLink(url: string): Promise<void> {
  const ok = await Clipboard.setStringAsync(url);
  if (Platform.OS === 'web' && ok === false) {
    throw new Error('Could not copy the donation link.');
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Native share sheet for SMS / social with the web gift URL.
 * @sideEffects React Native `Share.share`.
 */
export async function shareGiftLink(target: GiftQrTarget): Promise<void> {
  const message = `${shareQrSubtitle(target.athleteName)}\n${target.url}`;
  await Share.share(
    Platform.OS === 'ios' ? { url: target.url, message } : { message },
  );
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
  // An exact-handle lookup that applies privacy (PRIV-01); name and username stay public.
  const data = (await getPublicProfiles({ handle }))[0] ?? null;
  if (!data) return { playerId: null, name: handle, username: handle };
  return {
    playerId: typeof data.player_id === 'string' ? data.player_id : null,
    name: typeof data.full_name === 'string' && data.full_name.trim() ? data.full_name.trim() : handle,
    username: typeof data.username === 'string' && data.username.trim() ? data.username.trim() : handle,
  };
}
