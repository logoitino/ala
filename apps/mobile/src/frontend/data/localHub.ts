/**
 * Local tab matching helpers: school names with their mascots, the featured rivalry check, school pills built
 * from the games list, boosters that belong to a game, and the extra school / booster search hits.
 * Pure functions over already-loaded rows (split out of app/(tabs)/local/index.tsx for R4-03; behaviour unchanged).
 */

import type { Game, LocalSearchHit, Sponsorship } from '@/types/database';

const MASCOTS: Record<string, string> = {
  westlake: 'Thunder',
  'lone peak': 'Knights',
};

export function withMascot(name: string | null | undefined): string {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return '';
  const lower = value.toLowerCase();
  for (const [key, mascot] of Object.entries(MASCOTS)) {
    if (lower.includes(key) && !lower.includes(mascot.toLowerCase())) {
      return `${value} ${mascot}`;
    }
  }
  return value;
}

export function isWestlakeLonePeak(home: string, away: string, homeSchool: string, awaySchool: string) {
  const blob = `${home} ${away} ${homeSchool} ${awaySchool}`.toLowerCase();
  return blob.includes('westlake') && blob.includes('lone peak');
}

export function schoolOptionsFromGames(games: Game[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const game of games) {
    for (const raw of [game.home_team, game.away_team, game.home_school, game.away_school]) {
      const name = withMascot(raw);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export function sponsorsForGame(game: Game, sponsors: Sponsorship[]): Sponsorship[] {
  const blob = `${game.home_team} ${game.away_team} ${game.home_school} ${game.away_school}`.toLowerCase();
  return sponsors.filter((sponsor) => {
    const tag = sponsor.school_team.trim().toLowerCase();
    if (!tag) return false;
    if (blob.includes(tag)) return true;
    return tag.split(/\s+/).some((token) => token.length > 3 && blob.includes(token));
  });
}

export function blobMatchesSchool(blob: string, school: string): boolean {
  const hay = blob.toLowerCase();
  const needle = school.trim().toLowerCase();
  if (!needle) return false;
  if (hay.includes(needle) || needle.includes(hay)) return true;
  return needle.split(/\s+/).some((token) => token.length > 3 && hay.includes(token));
}

export function extraLocalHits(query: string, sponsors: Sponsorship[], schools: string[]): LocalSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length <= 1) return [];
  const hits: LocalSearchHit[] = [];
  for (const school of schools) {
    if (!school.toLowerCase().includes(needle)) continue;
    hits.push({
      entity_type: 'school',
      entity_id: school,
      title: school,
      subtitle: 'High school',
    });
  }
  for (const sponsor of sponsors) {
    if (
      !sponsor.business_name.toLowerCase().includes(needle) &&
      !sponsor.school_team.toLowerCase().includes(needle)
    ) {
      continue;
    }
    hits.push({
      entity_type: 'booster',
      entity_id: sponsor.id,
      title: sponsor.business_name,
      subtitle: sponsor.school_team,
    });
  }
  return hits;
}
