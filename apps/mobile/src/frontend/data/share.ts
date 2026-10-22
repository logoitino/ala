/**
 * Gift link text: the canonical web URL encoded in the athlete QR and the family-facing explainer under it.
 */

export const SHARE_FUND_CTA = 'Share & Donate ⚡';
export const SHARE_QR_TITLE = 'Share & Donate ⚡';
export const SHARE_SAVE_LABEL = '📸 Save QR Image to Camera Roll';
export const SHARE_COPY_LABEL = '🔗 Copy Donation Link';
export const SHARE_NATIVE_LABEL = '📱 Share via SMS / Social';
const DEFAULT_WEB_ORIGIN = 'https://tapuai.app';

/**
 * @purpose Origin of the hosted web app that QR links open; only https, or http on a local machine.
 * @param raw `EXPO_PUBLIC_WEB_ORIGIN`, so a test build can point printed QRs at a hosted preview until tapuai.app serves the web app.
 * @returns The origin without path or trailing slash, or the default when unset or invalid.
 */
export function webOrigin(raw: string | null | undefined): string {
  try {
    const url = new URL((raw ?? '').trim());
    const local = url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
    return url.protocol === 'https:' || local ? url.origin : DEFAULT_WEB_ORIGIN;
  } catch {
    return DEFAULT_WEB_ORIGIN;
  }
}

// Read through the literal env property name so Expo inlines the value at build time.
export const TAPUAI_WEB_ORIGIN = webOrigin(process.env.EXPO_PUBLIC_WEB_ORIGIN);

/**
 * @purpose Family-facing explainer under the athlete QR.
 * @param athleteName Display name on the profile / wishlist card.
 */
export function shareQrSubtitle(athleteName: string): string {
  const name = athleteName.trim() || 'this athlete';
  // No "instantly" / "without the app" promise: donors sign in first, and the web app is not hosted yet (UX-08 review).
  return `Scan or share to support ${name}. Friends and family can donate from the link.`;
}

/**
 * @purpose Canonical web gift URL encoded in the QR (`https://tapuai.app/gift/{handle}` unless `EXPO_PUBLIC_WEB_ORIGIN` is set).
 * @param rawHandle Profile username, athlete id, or `handleFromName` slug.
 */
export function formatGiftUrl(rawHandle: string): string {
  const slug = rawHandle.replace(/^@/, '').trim().toLowerCase() || 'athlete';
  return `${TAPUAI_WEB_ORIGIN}/gift/${encodeURIComponent(slug)}`;
}

/**
 * @purpose Normalize a username for gift URLs (no @, lowercase, URL-safe).
 */
export function normalizeAthleteHandle(raw: string | null | undefined): string {
  const slug = (raw ?? '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'athlete';
}
