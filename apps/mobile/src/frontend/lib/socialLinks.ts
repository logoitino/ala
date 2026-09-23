import type { ProfileSocialLinks } from '@/types/database';

const PLATFORM_BASE_URL: Record<string, string> = {
  instagram: 'https://instagram.com/',
  twitter: 'https://x.com/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/',
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

/** Resolves a stored handle/URL to an openable link. A full `http(s)://` value passes through
 * unchanged; a bare handle (with or without a leading `@`) is expanded against the platform's
 * base URL. Unknown platform keys fall back to the raw value as-is. */
export function resolveSocialLinkUrl(platform: string, value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = PLATFORM_BASE_URL[platform];
  if (!base) return trimmed;
  return `${base}${trimmed.replace(/^@/, '')}`;
}

export function socialLinkLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/** `{ instagram: '', twitter: '  ' }` → `[]`; strips empties so display code never renders a blank chip. */
export function nonEmptySocialLinks(links: ProfileSocialLinks | null | undefined): [string, string][] {
  if (!links) return [];
  return Object.entries(links).filter(([, value]) => value.trim().length > 0);
}
