import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * The school crest shown on a school-confirmed athlete. Only ever built from `athlete_school_badge`,
 * which returns data only after the school (or a Tapua'i admin) confirmed the athlete — never from
 * profile fields a user can edit, so a fan account cannot make one appear.
 */
export type SchoolBadge = {
  schoolId: string;
  schoolName: string;
  mascot: string | null;
  logoUrl: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  confirmedAt: string | null;
  confirmedBy: 'athletic_director' | 'coach' | 'tapuai';
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * @purpose Parse `athlete_school_badge`. Drops anything malformed: a non-https logo, a non-hex colour.
 */
export function parseSchoolBadge(raw: unknown): SchoolBadge | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const schoolId = asText(row.school_id);
  const schoolName = asText(row.school_name);
  if (!schoolId || !schoolName) return null;
  const logo = asText(row.logo_url);
  const primary = asText(row.color_primary);
  const secondary = asText(row.color_secondary);
  const by = row.confirmed_by === 'athletic_director' || row.confirmed_by === 'coach' ? row.confirmed_by : 'tapuai';
  return {
    schoolId,
    schoolName,
    mascot: asText(row.mascot),
    logoUrl: logo && logo.startsWith('https://') ? logo : null,
    colorPrimary: primary && HEX.test(primary) ? primary : null,
    colorSecondary: secondary && HEX.test(secondary) ? secondary : null,
    confirmedAt: asText(row.confirmed_at),
    confirmedBy: by,
  };
}

/**
 * @purpose The crest for a `players` row, or null when nobody school-confirmed is linked to it.
 * @sideEffects `athlete_school_badge` RPC (anon-readable). Missing RPC / errors → null.
 */
export async function fetchSchoolBadge(playerId: string | null | undefined): Promise<SchoolBadge | null> {
  if (!playerId || !isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('athlete_school_badge', { target_player_id: playerId });
  if (error) return null;
  return parseSchoolBadge(data);
}

/** Fallback palette when an admin has not set school colours: stable per school, never random. */
const FALLBACK: [string, string][] = [
  ['#0F5C4D', '#E9B949'],
  ['#1D3F8F', '#F2F2F2'],
  ['#8A1C2B', '#F5C542'],
  ['#3B2A7A', '#E8E1FF'],
  ['#12606F', '#FFD166'],
  ['#5A3212', '#F4E3C1'],
];

/**
 * @purpose The two crest colours: the admin's, else a stable fallback picked from the school id.
 */
export function schoolBadgeColors(badge: Pick<SchoolBadge, 'schoolId' | 'colorPrimary' | 'colorSecondary'>): {
  primary: string;
  secondary: string;
} {
  let hash = 0;
  for (const ch of badge.schoolId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [p, s] = FALLBACK[hash % FALLBACK.length]!;
  return { primary: badge.colorPrimary ?? p, secondary: badge.colorSecondary ?? s };
}

/**
 * @purpose Two-letter monogram for the drawn crest: "Lone Peak High" → "LP", "Westlake High" → "WE".
 */
export function schoolMonogram(name: string): string {
  const words = name
    .replace(/\b(high|school|academy|hs|the|of)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}
