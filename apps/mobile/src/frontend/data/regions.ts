/**
 * Utah regions used to group the Local tab: each has ZIP prefixes and school keywords that decide which
 * region a game or school belongs to. Add a region here to add a Local filter.
 */

export type UtahRegion = {
  id: string;
  label: string;
  zipPrefixes: string[];
  keywords: string[];
};

export const UTAH_REGIONS: UtahRegion[] = [
  {
    id: 'utah-county',
    label: 'Utah County',
    zipPrefixes: ['84003', '84004', '84042', '84043', '84045', '84057', '84058', '84062', '84097'],
    keywords: ['westlake', 'lone peak', 'skyridge', 'american fork', 'timpview', 'lehi', 'ala', 'pleasant grove'],
  },
  {
    id: 'salt-lake',
    label: 'Salt Lake',
    zipPrefixes: ['84020', '84047', '84070', '84092', '84093', '84094', '84101', '84106', '84117', '84121'],
    keywords: ['alta', 'brighton', 'jordan', 'cottonwood', 'olympus', 'highland'],
  },
  {
    id: 'davis',
    label: 'Davis County',
    zipPrefixes: ['84014', '84015', '84025', '84037', '84040', '84041', '84075'],
    keywords: ['davis', 'farmington', 'syracuse', 'layton', 'bountiful'],
  },
  {
    id: 'weber',
    label: 'Weber County',
    zipPrefixes: ['84401', '84403', '84404', '84405', '84414'],
    keywords: ['weber', 'ogden', 'roy', 'fremont'],
  },
];

export const LOCAL_FILTERS = [
  { id: 'utah-county', label: 'Utah County' },
  { id: 'salt-lake', label: 'Salt Lake' },
  { id: 'rivalry', label: 'Rivalry Games' },
] as const;

export type LocalFilterId = (typeof LOCAL_FILTERS)[number]['id'];

const RIVALRY_PAIRS: Array<[string, string]> = [
  ['westlake', 'lone peak'],
  ['westlake', 'skyridge'],
  ['lone peak', 'american fork'],
  ['ala', 'skyridge'],
  ['american fork', 'pleasant grove'],
  ['alta', 'brighton'],
  ['olympus', 'highland'],
];

export function regionForZip(zip: string): UtahRegion | null {
  const needle = zip.trim();
  if (needle.length < 5) return null;
  return (
    UTAH_REGIONS.find((region) => region.zipPrefixes.some((prefix) => needle.startsWith(prefix))) ??
    null
  );
}

export function gameInRegion(
  game: {
    home_team: string;
    away_team: string;
    home_school: string;
    away_school: string;
    venue: string;
  },
  region: UtahRegion,
): boolean {
  const haystack = [
    game.home_team,
    game.away_team,
    game.home_school,
    game.away_school,
    game.venue,
  ]
    .join(' ')
    .toLowerCase();
  return region.keywords.some((keyword) => haystack.includes(keyword));
}

function gameHaystack(game: {
  home_team: string;
  away_team: string;
  home_school: string;
  away_school: string;
  venue?: string;
}): string {
  return [
    game.home_team,
    game.away_team,
    game.home_school,
    game.away_school,
    game.venue ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function isRivalryGame(game: {
  home_team: string;
  away_team: string;
  home_school: string;
  away_school: string;
  venue?: string;
}): boolean {
  const haystack = gameHaystack(game);
  return RIVALRY_PAIRS.some(
    ([a, b]) => haystack.includes(a) && haystack.includes(b),
  );
}

/**
 * @purpose Pick the first active rivalry for the Home takeover without duplicating Local's rules.
 * @param games Active or scheduled game rows, already ordered by the caller.
 * @returns The first rivalry game, or `null` when rivalry week is quiet.
 */
export function featuredRivalryGame<T extends {
  home_team: string;
  away_team: string;
  home_school: string;
  away_school: string;
  venue?: string;
  is_active?: boolean;
}>(games: T[]): T | null {
  return games.find((game) => game.is_active !== false && isRivalryGame(game)) ?? null;
}
