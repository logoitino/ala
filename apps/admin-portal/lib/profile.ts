/**
 * Profile hierarchy oversight for the Next admin portal (Clean Profile + Look chrome).
 */

import { PROFILE_CHROME_FLAGS, type ProfileOversight } from '@tapuai/shared-types';

import { getSupabaseServerClient } from '@/lib/supabase.server';

type RuntimeProfile = {
  showCard?: boolean;
  showCrew?: boolean;
  showStats?: boolean;
  showVault?: boolean;
  actionsOnTop?: boolean;
  statsFirst?: boolean;
};

type RuntimeBag = {
  profile?: RuntimeProfile;
};

function asBool(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * @purpose Load Profile chrome + claim stats from `app_runtime_config` + `profiles` for web oversight.
 * @sideEffects Supabase SELECT on runtime config and profiles (claimed / athlete counts).
 */
export async function fetchProfileOversight(): Promise<ProfileOversight> {
  const empty: ProfileOversight = {
    configured: false,
    claimedAthletes: 0,
    athleteProfiles: 0,
    publishedAt: null,
    showCard: true,
    showCrew: true,
    showStats: true,
    showVault: true,
    actionsOnTop: false,
    statsFirst: false,
    chromeFlags: PROFILE_CHROME_FLAGS,
  };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty;

  const [runtimeRes, claimedRes, athleteRes] = await Promise.all([
    supabase.from('app_runtime_config').select('published, published_at').eq('id', 'default').maybeSingle(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).not('player_id', 'is', null),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('role.eq.athlete,roles.cs.{athlete},active_role.eq.athlete'),
  ]);

  const published = (runtimeRes.data?.published ?? {}) as RuntimeBag;
  const profile = published.profile ?? {};

  return {
    configured: true,
    claimedAthletes: asInt(claimedRes.count),
    athleteProfiles: asInt(athleteRes.count),
    publishedAt: typeof runtimeRes.data?.published_at === 'string' ? runtimeRes.data.published_at : null,
    showCard: asBool(profile.showCard, true),
    showCrew: asBool(profile.showCrew, true),
    showStats: asBool(profile.showStats, true),
    showVault: asBool(profile.showVault, true),
    actionsOnTop: asBool(profile.actionsOnTop, false),
    statsFirst: asBool(profile.statsFirst, false),
    chromeFlags: PROFILE_CHROME_FLAGS,
  };
}
