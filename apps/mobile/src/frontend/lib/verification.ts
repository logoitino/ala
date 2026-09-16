import {
  DEMO_TEAM_CODES,
  parseTeamCode,
  resolveVerificationStatus,
  type VerificationStatus,
} from '@/data/verification';
import { DEMO_TEAMS } from '@/data/teams';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type RedeemTeamCodeResult = {
  ok: boolean;
  verification_status: VerificationStatus;
  school_id?: string | null;
  school_name?: string | null;
  sport?: string | null;
  already?: boolean;
};

function rpcMissing(message: string | undefined): boolean {
  const text = message ?? '';
  return /could not find the function|schema cache|42883|PGRST202/i.test(text);
}

function asStatus(raw: unknown): VerificationStatus {
  return resolveVerificationStatus({
    is_verified: raw === 'verified',
    verification_status: typeof raw === 'string' ? raw : null,
  });
}

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * @purpose Redeem a coach-issued team code for ⚡ VERIFIED VARSITY (school claim + Varsity badge).
 * @param rawCode e.g. `WSTLK-RUG-2026`.
 * @returns Status + school after a successful redeem.
 * @sideEffects `redeem_team_code` RPC; fallback `schools_and_teams` lookup + `profiles` UPDATE; demo catalog when offline.
 */
export async function redeemTeamCode(rawCode: string): Promise<RedeemTeamCodeResult> {
  const parsed = parseTeamCode(rawCode);
  if (!parsed.normalized) {
    throw new Error('Enter a team code (e.g. WSTLK-RUG-2026).');
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('redeem_team_code', { raw_code: parsed.normalized });
    if (!error && data && typeof data === 'object') {
      const row = data as Record<string, unknown>;
      return {
        ok: row.ok !== false,
        verification_status: asStatus(row.verification_status ?? 'verified'),
        school_id: asText(row.school_id),
        school_name: asText(row.school_name),
        sport: asText(row.sport) ?? parsed.sport,
      };
    }
    if (error && !rpcMissing(error.message)) {
      throw new Error(friendlyVerifyError(error.message));
    }

    const { data: school } = await supabase
      .from('schools_and_teams')
      .select('id, name, division, team_code')
      .or(`team_code.ilike.${parsed.normalized},team_code.ilike.${parsed.schoolKey}`)
      .maybeSingle();

    if (school && typeof school.id === 'string') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          school_id: school.id,
          athlete_division: typeof school.division === 'string' ? school.division : undefined,
          athlete_sport: parsed.sport ?? undefined,
          is_verified: true,
          verification_status: 'verified',
          role: 'athlete',
          active_role: 'athlete',
        })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
      if (updateError) throw new Error(friendlyVerifyError(updateError.message));
      return {
        ok: true,
        verification_status: 'verified',
        school_id: school.id,
        school_name: typeof school.name === 'string' ? school.name : null,
        sport: parsed.sport,
      };
    }
  }

  const schoolId = DEMO_TEAM_CODES[parsed.schoolKey] ?? DEMO_TEAM_CODES[parsed.normalized];
  const team = DEMO_TEAMS.find((item) => item.id === schoolId);
  if (!team) {
    throw new Error('Unknown team code. Ask your coach for this season’s code, or request approval below.');
  }
  if (isSupabaseConfigured) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from('profiles').update({
        school_id: team.id,
        athlete_division: team.division,
        athlete_sport: parsed.sport ?? undefined,
        is_verified: true,
        verification_status: 'verified',
        role: 'athlete',
        active_role: 'athlete',
      }).eq('user_id', userId);
    }
  }
  return {
    ok: true,
    verification_status: 'verified',
    school_id: team.id,
    school_name: team.name,
    sport: parsed.sport,
  };
}

/**
 * @purpose Queue a coach/parent Varsity request without a team code. Profile stays public.
 * @param notes Optional message for People / booster queue.
 * @sideEffects `request_athlete_verification` RPC; fallback `verification_requests` INSERT + `profiles.verification_status`.
 */
export async function requestAthleteVerification(notes?: string): Promise<RedeemTeamCodeResult> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('request_athlete_verification', {
      request_notes: notes?.trim() || undefined,
    });
    if (!error && data && typeof data === 'object') {
      const row = data as Record<string, unknown>;
      return {
        ok: row.ok !== false,
        verification_status: asStatus(row.verification_status ?? 'pending'),
        school_id: asText(row.school_id),
        already: row.already === true,
      };
    }
    if (error && !rpcMissing(error.message)) {
      throw new Error(friendlyVerifyError(error.message));
    }

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, player_id, school_id, is_verified, verification_status')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile?.is_verified || profile?.verification_status === 'verified') {
        return { ok: true, verification_status: 'verified', already: true, school_id: asText(profile.school_id) };
      }
      await supabase.from('profiles').update({ verification_status: 'pending' }).eq('user_id', userId);
      await supabase.from('verification_requests').insert({
        player_id: profile?.player_id ?? null,
        full_name: typeof profile?.full_name === 'string' ? profile.full_name : 'Athlete',
        status: 'pending',
        notes: notes?.trim() || 'Coach / parent approval requested',
        requester_user_id: profile?.id ?? null,
        school_id: profile?.school_id ?? null,
      });
      return { ok: true, verification_status: 'pending', school_id: asText(profile?.school_id) };
    }
  }
  return { ok: true, verification_status: 'pending' };
}

/**
 * @purpose Load the claimed-profile Varsity state for a public athlete sheet (`players.id`).
 * @sideEffects `profiles` SELECT by `player_id` then name match.
 */
export async function fetchPlayerVerification(
  playerId: string,
  playerName?: string | null,
): Promise<{ status: VerificationStatus; schoolClaimed: boolean; schoolId: string | null }> {
  const empty = { status: 'unverified' as const, schoolClaimed: false, schoolId: null };
  if (!playerId || !isSupabaseConfigured) return empty;
  const { data: byPlayer } = await supabase
    .from('profiles')
    .select('is_verified, verification_status, school_id, player_id, full_name')
    .eq('player_id', playerId)
    .maybeSingle();
  let match = byPlayer;
  if (!match && playerName?.trim()) {
    const { data: byName } = await supabase
      .from('profiles')
      .select('is_verified, verification_status, school_id, player_id, full_name')
      .ilike('full_name', playerName.trim())
      .limit(1)
      .maybeSingle();
    match = byName;
  }
  if (!match) return empty;
  return {
    status: resolveVerificationStatus(match),
    schoolClaimed: Boolean(match.school_id),
    schoolId: typeof match.school_id === 'string' ? match.school_id : null,
  };
}

function friendlyVerifyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('legal')) return 'Agree to Terms of Service & NIL Compliance first.';
  if (text.includes('unknown team code')) {
    return 'Unknown team code. Ask your coach for this season’s code, or request approval below.';
  }
  if (text.includes('sign in')) return 'Sign in to claim your Varsity badge.';
  if (text.includes('team code required')) return 'Enter a team code (e.g. WSTLK-RUG-2026).';
  return message;
}
