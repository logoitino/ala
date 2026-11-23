/**
 * School and team lookup over `schools_and_teams`: autocomplete for the athlete claim, and the school row shown
 * on the trading card. Saves actor-bound athlete claims and account-keyed local onboarding; configured saves
 * publish the cache only after the profile write succeeds, preserving earlier valid drafts on denial (UX-13).
 * Explicit directory selections use current exact IDs/school text and remain staff-reviewed pending claims (UX-17).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ATHLETE_ONBOARDING_KEY,
  DEMO_TEAMS,
  formatTeamBadge,
  type AthleteClassYear,
  type AthleteSport,
  type SchoolTeam,
} from '@/data/teams';
import { orIlike } from '@/lib/postgrestFilter';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { claimAthlete } from '@/lib/verification';
import { assertCurrent, createOfflineActorClient, OfflineActorChangedError, type OfflineActor } from '@/lib/offlineActor';
import { getDirectorySchool } from '@/lib/schoolDirectory';

export type AthleteOnboarding = {
  team: SchoolTeam;
  /** Any active sport from `sport_configs` (seeded names are the floor, not the ceiling). */
  sport: AthleteSport | string;
  jersey: string;
  position: string;
  classYear: AthleteClassYear | string;
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

    const pattern = orIlike(needle);
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
 * @sideEffects `profiles` UPDATE (`school_id`, `athlete_division`, sport / jersey / position / class year, then `claim_athlete` with a name match — never a direct `player_id` write); AsyncStorage `tapuai.athleteOnboarding`.
 */
export async function saveAthleteOnboardingRemote(
  userId: string | null | undefined,
  onboard: AthleteOnboarding,
  actor?: OfflineActor,
  selectedPlayerId?: string | null,
): Promise<void> {
  if (selectedPlayerId !== undefined && (!actor || !userId || !isSupabaseConfigured)) throw new OfflineActorChangedError();
  if (actor) {
    assertCurrent(actor);
    if (actor.userId !== userId) throw new OfflineActorChangedError();
  }
  const client = actor && isSupabaseConfigured ? await createOfflineActorClient(actor) : supabase;
  if (actor) assertCurrent(actor);
  const validateSelection = async () => {
    const school = await getDirectorySchool(onboard.team.id, client);
    if (actor) assertCurrent(actor);
    if (!school || school.name !== onboard.team.name) throw new Error('School association changed. Choose the current school and retry.');
    if (selectedPlayerId === null) return;
    if (typeof selectedPlayerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedPlayerId)) throw new Error('Roster selection changed. Choose the current athlete and retry.');
    const { data, error } = await client.from('players').select('id,school_name').eq('id', selectedPlayerId).eq('school_name', school.name).maybeSingle();
    if (actor) assertCurrent(actor);
    if (error) throw error;
    if (!data || data.id !== selectedPlayerId || data.school_name !== school.name) throw new Error('Roster selection changed. Choose the current athlete and retry.');
  };
  if (selectedPlayerId !== undefined) await validateSelection();
  if (!userId || !isSupabaseConfigured) {
    await AsyncStorage.setItem(onboardingKey(userId), JSON.stringify(onboard));
    if (actor) assertCurrent(actor);
    return;
  }
  const { error: updateError } = await client
    .from('profiles')
    .update({
      school_id: onboard.team.id,
      athlete_division: onboard.team.division,
      athlete_sport: onboard.sport,
      athlete_jersey: onboard.jersey || null,
      athlete_position: onboard.position || null,
      athlete_class_year: onboard.classYear || null,
    })
    .eq('user_id', userId);
  if (actor) assertCurrent(actor);
  if (updateError) throw updateError;
  await AsyncStorage.setItem(onboardingKey(userId), JSON.stringify(onboard));
  if (actor) assertCurrent(actor);

  if (selectedPlayerId !== undefined) {
    // Admins can correct school/roster labels while the save is in flight. Refuse a changed association before claiming.
    await validateSelection();
    if (actor) assertCurrent(actor);
    const claimed = await claimAthlete(selectedPlayerId, undefined, client);
    if (actor) assertCurrent(actor);
    // A confirmed profile save is not proof that the pending-claim endpoint exists on this backend.
    if (!claimed) throw new Error('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.');
    return;
  }

  // The roster link (`profiles.player_id`) is made only when the school confirms. Here we just
  // open the claim with the best name match so the athletic director sees who the student says
  // they are. `claim_athlete` also flags a second account claiming the same athlete.
  const { data: profileRow } = await client
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (actor) assertCurrent(actor);
  const fullName = typeof profileRow?.full_name === 'string' ? profileRow.full_name.trim() : '';
  let matchId: string | null = null;
  if (fullName) {
    const { data: match } = await client
      .from('players')
      .select('id')
      .ilike('name', fullName)
      .limit(1)
      .maybeSingle();
    if (actor) assertCurrent(actor);
    matchId = typeof match?.id === 'string' ? match.id : null;
  }
  await claimAthlete(matchId, undefined, client);
}

const onboardingKey = (userId?: string | null) => userId ? `${ATHLETE_ONBOARDING_KEY}.${userId}` : ATHLETE_ONBOARDING_KEY;

/**
 * @purpose Restore this account's local onboarding payload when Profile hydrates without a joined team.
 * @sideEffects AsyncStorage read of the owner-keyed draft; ownerless legacy drafts remain guest-only.
 */
export async function readAthleteOnboarding(userId?: string | null): Promise<AthleteOnboarding | null> {
  try {
    // Legacy drafts have no provable owner. Only the guest fallback may read that key.
    const raw = await AsyncStorage.getItem(onboardingKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AthleteOnboarding;
    if (!parsed?.team?.id || !parsed.sport) return null;
    return parsed;
  } catch {
    return null;
  }
}
