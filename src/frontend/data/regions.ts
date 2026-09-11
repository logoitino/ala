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
    label: 'Salt Lake Valley',
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
