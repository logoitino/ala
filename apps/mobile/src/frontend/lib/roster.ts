import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * @purpose Which roster rows are claimed (`profiles.player_id` → `players.id`) for athlete Claimed/Unclaimed badges.
 * @param playerIds `players.id` values on the Active Team Roster.
 * @returns Set of claimed player ids.
 * @sideEffects `profiles` SELECT on `player_id`.
 */
export async function fetchClaimedPlayerIds(playerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(playerIds.filter(Boolean))];
  if (ids.length === 0 || !isSupabaseConfigured) return new Set();

  const { data, error } = await supabase.from('profiles').select('player_id').in('player_id', ids);
  if (error || !Array.isArray(data)) return new Set();

  const claimed = new Set<string>();
  for (const row of data) {
    if (typeof row.player_id === 'string' && row.player_id) claimed.add(row.player_id);
  }
  return claimed;
}
