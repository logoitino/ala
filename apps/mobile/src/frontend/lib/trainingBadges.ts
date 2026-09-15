import {
  evaluateTrainingBadges,
  type TrainingBadgeFacts,
  type TrainingBadgeView,
} from '@tapuai/shared-types';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AthleteTrainingBadgeState = TrainingBadgeFacts & {
  badges: TrainingBadgeView[];
};

/**
 * @purpose Parse `sync_athlete_training_badges` jsonb (or a local fallback payload).
 */
export function parseTrainingBadgeFacts(raw: unknown): TrainingBadgeFacts {
  if (!raw || typeof raw !== 'object') {
    return { playerId: null, confirmedTags: 0, maloCents: 0, rosterClaimed: false, unlocks: [] };
  }
  const row = raw as Record<string, unknown>;
  const unlocksRaw = Array.isArray(row.unlocks) ? row.unlocks : [];
  return {
    playerId: typeof row.player_id === 'string' && row.player_id ? row.player_id : null,
    confirmedTags: asInt(row.confirmed_tags),
    maloCents: asInt(row.malo_cents),
    rosterClaimed: Boolean(row.roster_claimed),
    unlocks: unlocksRaw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const unlock = item as Record<string, unknown>;
        const badgeId = typeof unlock.badge_id === 'string' ? unlock.badge_id : '';
        if (!badgeId) return null;
        return {
          badgeId,
          unlockedAt: typeof unlock.unlocked_at === 'string' ? unlock.unlocked_at : null,
        };
      })
      .filter((item): item is { badgeId: string; unlockedAt: string | null } => Boolean(item)),
  };
}

/**
 * @purpose Load Athlete HQ training badges from the sync RPC, or count live tables if SQL is not applied yet.
 * @param playerId Claimed `profiles.player_id` / `players.id`. Null → all chips locked.
 * @returns Catalog rows with locked vs unlocked + the facts used to evaluate them.
 * @sideEffects `sync_athlete_training_badges`; fallback SELECTs on `reels`, `tips`, `profiles`, `athlete_training_badge_unlocks`.
 */
export async function fetchAthleteTrainingBadges(
  playerId: string | null | undefined,
): Promise<AthleteTrainingBadgeState> {
  const id = playerId?.trim() || null;
  if (!id || !isSupabaseConfigured) {
    const facts: TrainingBadgeFacts = {
      playerId: id,
      confirmedTags: 0,
      maloCents: 0,
      rosterClaimed: Boolean(id),
      unlocks: [],
    };
    return { ...facts, badges: evaluateTrainingBadges(facts) };
  }

  const { data, error } = await supabase.rpc('sync_athlete_training_badges', {
    target_player_id: id,
  });
  if (!error && data) {
    const facts = parseTrainingBadgeFacts(data);
    return { ...facts, badges: evaluateTrainingBadges(facts) };
  }

  const facts = await fallbackTrainingBadgeFacts(id);
  return { ...facts, badges: evaluateTrainingBadges(facts) };
}

/**
 * @purpose Count confirmed tags, Mālo, roster claim, and any unlock rows when the RPC is missing.
 */
async function fallbackTrainingBadgeFacts(playerId: string): Promise<TrainingBadgeFacts> {
  const [tags, tips, roster, unlocks] = await Promise.all([
    supabase
      .from('reels')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('tag_status', 'confirmed')
      .eq('is_removed', false),
    supabase.from('tips').select('amount_cents').eq('player_id', playerId),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('player_id', playerId),
    supabase
      .from('athlete_training_badge_unlocks')
      .select('badge_id, unlocked_at')
      .eq('player_id', playerId),
  ]);

  const tipRows = Array.isArray(tips.data) ? tips.data : [];
  const maloCents = tipRows.reduce((sum, row) => sum + asInt((row as { amount_cents?: number }).amount_cents), 0);
  const unlockRows = Array.isArray(unlocks.data) ? unlocks.data : [];

  return {
    playerId,
    confirmedTags: tags.count ?? 0,
    maloCents,
    rosterClaimed: (roster.count ?? 0) > 0,
    unlocks: unlockRows
      .map((row) => {
        const item = row as { badge_id?: string; unlocked_at?: string | null };
        if (!item.badge_id) return null;
        return { badgeId: item.badge_id, unlockedAt: item.unlocked_at ?? null };
      })
      .filter((item): item is { badgeId: string; unlockedAt: string | null } => Boolean(item)),
  };
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
