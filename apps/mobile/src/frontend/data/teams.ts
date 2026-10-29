/**
 * School / team data: the level chip shown in autocomplete and the title line on the trading card (name plus mascot).
 * Class-year and sport options for the athlete claim also come from here.
 */

export type SchoolTeamLevel = 'high_school' | 'college';

export type SchoolTeam = {
  id: string;
  name: string;
  mascot: string;
  /** `high_school` → `[ High School • UT ]`. `college` → `[ NCAA D1 • Big 12 ]`. */
  level: SchoolTeamLevel;
  /** Display division: `High School`, `NCAA D1`, `NCAA D2`. */
  division: string;
  /** HS state (`UT`) or college conference (`Big 12`). */
  region: string;
  city?: string | null;
  /** Compliance freeze switch (LEGAL_BRIEFING.md §8 item 5). Blocks new Mālo/exclusive money for
   * every athlete at this school. Flip only via the `set_malo_freeze` RPC — see `Admin/SchoolsTool.tsx`. */
  malo_frozen?: boolean;
};

export const ATHLETE_SPORTS = ['Football', 'Basketball', 'Rugby', 'Volleyball', 'Soccer', 'Baseball', 'Softball', 'Wrestling', 'Track & Field', 'Lacrosse', 'Ice Hockey', 'Tennis'] as const;
export type AthleteSport = (typeof ATHLETE_SPORTS)[number];

/** HS seniors through college underclassmen — keep both levels on the claim pills. */
export const ATHLETE_CLASS_YEARS = ['26', '27', '28', '29', '30'] as const;
export type AthleteClassYear = (typeof ATHLETE_CLASS_YEARS)[number];

/** UI chip: `26` → `'26`. */
export function classYearLabel(year: string): string {
  return `'${year.replace(/^'+/, '')}`;
}

export const ATHLETE_ONBOARDING_KEY = 'tapuai.athleteOnboarding';

/**
 * @purpose Visual level chip for the team autocomplete (`[ High School • UT ]` / `[ NCAA D1 • Big 12 ]`).
 * @param team Row from `public.schools_and_teams`.
 */
export function formatTeamBadge(team: Pick<SchoolTeam, 'level' | 'division' | 'region'>): string {
  if (team.level === 'high_school') return `[ High School • ${team.region} ]`;
  return `[ ${team.division} • ${team.region} ]`;
}

/**
 * @purpose Trading-card title: school/university name plus mascot when it is not already in the name.
 */
export function formatTeamTitle(team: Pick<SchoolTeam, 'name' | 'mascot'>): string {
  const mascot = team.mascot.trim();
  if (!mascot) return team.name;
  if (team.name.toLowerCase().includes(mascot.toLowerCase())) return team.name;
  return `${team.name} · ${mascot}`;
}

/** Demo catalog used when Supabase is offline; ids match `supabase/legacy/schools_and_teams.sql`. */
export const DEMO_TEAMS: SchoolTeam[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Westlake High',
    mascot: 'Thunder',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'Saratoga Springs',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    name: 'Lone Peak High',
    mascot: 'Knights',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'Highland',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    name: 'American Leadership Academy',
    mascot: 'Hawks',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'Spanish Fork',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    name: 'Skyridge High',
    mascot: 'Sentinels',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'Lehi',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    name: 'American Fork High',
    mascot: 'Cavemen',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'American Fork',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    name: 'Timpview High',
    mascot: 'Thunderbirds',
    level: 'high_school',
    division: 'High School',
    region: 'UT',
    city: 'Provo',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000011',
    name: 'BYU',
    mascot: 'Cougars',
    level: 'college',
    division: 'NCAA D1',
    region: 'Big 12',
    city: 'Provo',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000012',
    name: 'Utah',
    mascot: 'Utes',
    level: 'college',
    division: 'NCAA D1',
    region: 'Big 12',
    city: 'Salt Lake City',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000013',
    name: 'Utah State',
    mascot: 'Aggies',
    level: 'college',
    division: 'NCAA D1',
    region: 'Mountain West',
    city: 'Logan',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000014',
    name: 'Weber State',
    mascot: 'Wildcats',
    level: 'college',
    division: 'NCAA D1',
    region: 'Big Sky',
    city: 'Ogden',
  },
];
