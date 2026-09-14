import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ATHLETE_ONBOARDING_KEY,
  DEMO_TEAMS,
  formatTeamBadge,
  type AthleteClassYear,
  type AthleteSport,
  type SchoolTeam,
} from '@/data/teams';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AthleteOnboarding = {
  team: SchoolTeam;
  sport: AthleteSport;
  jersey: string;
  position: string;
  classYear: AthleteClassYear;
};

function ilikeSafe(raw: string): string {
  return raw.replace(/[\\%_,]/g, ' ').trim();
}

function asTeam(row: Record<string, unknown> | null | undefined): SchoolTeam | null {
  if (!row) return null;
  const id = typeof row.id === 'string' ? row.id : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const level = row.level === 'college' ? 'college' : row.level === 'high_school' ? 'high_school' : null;
  if (!id || !name || !level) return null;
  return {
    id,
    name,
    mascot: typeof row.mascot === 'string' ? row.mascot : '',
    level,
    division: typeof row.division === 'string' && row.division.trim() ? row.division : level === 'college' ? 'NCAA D1' : 'High School',
    region: typeof row.region === 'string' && row.region.trim() ? row.region : level === 'college' ? 'Big 12' : 'UT',
    city: typeof row.city === 'string' ? row.city : null,
  };
}

function filterDemo(needle: string): SchoolTeam[] {
  const q = needle.toLowerCase();
  if (!q) return [];
  return DEMO_TEAMS.filter((team) =>
    [team.name, team.mascot, team.division, team.region, team.city, formatTeamBadge(team)]
      .join(' ')
      .toLowerCase()
      .includes(q),
  ).slice(0, 20);
}

/**
 * @purpose Fuzzy team autocomplete over `public.schools_and_teams` (`ILIKE %query%` on name / mascot / division / region).
 * @param rawQuery Athlete-typed school or university string.
 * @returns Matching High School and NCAA rows, demo catalog if the table is missing.
 * @sideEffects `search_schools_and_teams` RPC, then table ILIKE, then `DEMO_TEAMS`.
 */
export async function searchSchoolsAndTeams(rawQuery: string): Promise<SchoolTeam[]> {
  const needle = ilikeSafe(rawQuery);
  if (needle.length < 1) return [];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('search_schools_and_teams', { search_query: needle });
    if (!error && Array.isArray(data)) {
      const rows = data
        .map((row) => (row && typeof row === 'object' ? asTeam(row as Record<string, unknown>) : null))
        .filter((row): row is SchoolTeam => Boolean(row));
      if (rows.length > 0) return rows;
    }

    const pattern = `%${needle}%`;
    const { data: tableRows, error: tableError } = await supabase
      .from('schools_and_teams')
      .select('id, name, mascot, level, division, region, city')
      .or(`name.ilike.${pattern},mascot.ilike.${pattern},division.ilike.${pattern},region.ilike.${pattern},city.ilike.${pattern}`)
      .limit(20);

    if (!tableError && Array.isArray(tableRows)) {
      const rows = tableRows
        .map((row) => asTeam(row as Record<string, unknown>))
        .filter((row): row is SchoolTeam => Boolean(row));
      if (rows.length > 0) return rows;
    }
  }

  return filterDemo(needle);
}

/**
 * @purpose Load one `schools_and_teams` row for the trading card (`profiles.school_id`).
 */
export async function fetchSchoolTeam(schoolId: string | null | undefined): Promise<SchoolTeam | null> {
  if (!schoolId) return null;
  const demo = DEMO_TEAMS.find((item) => item.id === schoolId);
  if (!isSupabaseConfigured) return demo ?? null;
  const { data, error } = await supabase
    .from('schools_and_teams')
    .select('id, name, mascot, level, division, region, city')
    .eq('id', schoolId)
    .maybeSingle();
  if (error || !data) return demo ?? null;
  return asTeam(data as Record<string, unknown>) ?? demo ?? null;
}

/**
 * @purpose Persist HS/college roster fields on `profiles` after the athlete picks a team.
 * @param userId `auth.users.id` when signed in.
 * @param onboard Team + sport + jersey + position + class year.
 * @sideEffects `profiles` UPDATE (`school_id`, `athlete_division`, sport / jersey / position / class year, optional `player_id` name match); AsyncStorage `tapuai.athleteOnboarding`.
 */
export async function saveAthleteOnboardingRemote(
  userId: string | null | undefined,
  onboard: AthleteOnboarding,
): Promise<void> {
  await AsyncStorage.setItem(ATHLETE_ONBOARDING_KEY, JSON.stringify(onboard));
  if (!userId || !isSupabaseConfigured) return;
  await supabase
    .from('profiles')
    .update({
      school_id: onboard.team.id,
      athlete_division: onboard.team.division,
      athlete_sport: onboard.sport,
      athlete_jersey: onboard.jersey,
      athlete_position: onboard.position,
      athlete_class_year: onboard.classYear,
    })
    .eq('user_id', userId);

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  const fullName = typeof profileRow?.full_name === 'string' ? profileRow.full_name.trim() : '';
  if (profileRow?.id && fullName) {
    const { data: match } = await supabase
      .from('players')
      .select('id')
      .ilike('name', fullName)
      .limit(1)
      .maybeSingle();
    if (match?.id) {
      await supabase.from('profiles').update({ player_id: match.id }).eq('id', profileRow.id);
    }
  }
}

/**
 * @purpose Restore last onboarding payload when Profile hydrates without a joined team.
 */
export async function readAthleteOnboarding(): Promise<AthleteOnboarding | null> {
  try {
    const raw = await AsyncStorage.getItem(ATHLETE_ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AthleteOnboarding;
    if (!parsed?.team?.id || !parsed.sport) return null;
    return parsed;
  } catch {
    return null;
  }
}
