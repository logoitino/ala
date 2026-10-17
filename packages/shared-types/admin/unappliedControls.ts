/**
 * Controls whose database update may still be unapplied.
 * Fans do not see that notice. Expo admin Home and the portal Health page
 * list the same rows and point at the Expo desk that owns the control.
 */

export type UnappliedControl = {
  id: string;
  label: string;
  migration: string;
  /** Expo Router path of the desk that owns the control. */
  adminPath: string;
  rpc: string;
  args: Record<string, unknown>;
};

/** A throwaway id so a present function can answer without matching a real account. */
const PROBE_ACTOR = '00000000-0000-0000-0000-000000000001';

export const UNAPPLIED_CONTROLS: readonly UnappliedControl[] = [
  {
    id: 'challenges',
    label: 'Challenge invites',
    migration: '20261016100000_workout_challenges.sql',
    adminPath: '/admin/highlights',
    rpc: 'admin_challenge_status',
    args: { expected_actor_id: PROBE_ACTOR },
  },
  {
    id: 'coach_level',
    label: 'Coach-level move',
    migration: '20261017090000_coach_level_label.sql',
    adminPath: '/admin/highlights',
    rpc: 'coach_label_desk',
    args: {},
  },
  {
    id: 'beyond',
    label: 'Beyond contributions',
    migration: '20261016120000_beyond_game.sql',
    adminPath: '/admin/highlights',
    rpc: 'beyond_status',
    args: { expected_actor_id: PROBE_ACTOR },
  },
  {
    id: 'trivia',
    label: 'Weekly trivia',
    migration: '20261014150000_timed_sport_trivia.sql',
    adminPath: '/admin/sport-quiz',
    rpc: 'quiz_admin_snapshot',
    args: {},
  },
  {
    id: 'life',
    label: 'Life Playbook',
    migration: '20261014180000_life_playbook.sql',
    adminPath: '/admin/sport-quiz',
    rpc: 'quiz_admin_life_snapshot',
    args: {},
  },
];

/**
 * @purpose True only when PostgREST or Postgres says the function is not there yet.
 * A permission error or a bad argument stays a normal failure.
 */
export function missingRpc(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = error.message ?? '';
  return code === 'PGRST202' || code === '42883' || /PGRST202|42883|could not find the function/i.test(message);
}
