export const SHARE_FUND_CTA = 'Share & Donate ⚡';
export const SHARE_QR_TITLE = 'Share & Donate ⚡';
export const SHARE_SAVE_LABEL = '📸 Save QR Image to Camera Roll';
export const SHARE_COPY_LABEL = '🔗 Copy Donation Link';
export const SHARE_NATIVE_LABEL = '📱 Share via SMS / Social';
export const TAPUAI_WEB_ORIGIN = 'https://tapuai.app';

/**
 * @purpose Family-facing explainer under the athlete QR.
 * @param athleteName Display name on the profile / wishlist card.
 */
export function shareQrSubtitle(athleteName: string): string {
  const name = athleteName.trim() || 'this athlete';
  return `Scan or share to support ${name}. Friends and family can donate instantly without downloading the app!`;
}

/**
 * @purpose Canonical web gift URL encoded in the QR (`https://tapuai.app/gift/{handle}`).
 * @param rawHandle Profile username or `handleFromName` slug.
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
