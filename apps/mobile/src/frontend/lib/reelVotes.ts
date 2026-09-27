import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlayReactionId } from '@/data/players';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ReelVoteMap = Record<PlayReactionId, boolean>;

const EMPTY: ReelVoteMap = { seki: false, aura: false, flex: false };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function storageKey(reelId: string, userId?: string | null): string {
  return userId ? `tapuai.reelVotes.${userId}.${reelId}` : `tapuai.reelVotes.guest.${reelId}`;
}

function parseVotes(raw: string | null): ReelVoteMap {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<ReelVoteMap>;
    return {
      seki: Boolean(parsed.seki),
      aura: Boolean(parsed.aura),
      flex: Boolean(parsed.flex),
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * @purpose Load this fan’s one-vote-per-kind flags for a Highlight (local first, then `reel_hype_votes`).
 * @param reelId `reels.id` or seeded `hl-*`.
 * @param userId Signed-in `auth.uid()` when known.
 * @returns `{ seki, aura, flex }` booleans.
 * @sideEffects AsyncStorage `tapuai.reelVotes.*`; `reel_hype_votes` SELECT for UUID clips.
 */
export async function loadReelVotes(reelId: string, userId?: string | null): Promise<ReelVoteMap> {
  const local = parseVotes(await AsyncStorage.getItem(storageKey(reelId, userId)));
  if (!userId || !isUuid(reelId) || !isSupabaseConfigured) return local;

  const { data, error } = await supabase
    .from('reel_hype_votes')
    .select('kind')
    .eq('user_id', userId)
    .eq('reel_id', reelId);
  if (error || !data) return local;

  const next: ReelVoteMap = { ...local };
  for (const row of data) {
    if (row.kind === 'seki' || row.kind === 'aura' || row.kind === 'flex') next[row.kind] = true;
  }
  await AsyncStorage.setItem(storageKey(reelId, userId), JSON.stringify(next));
  return next;
}

/**
 * @purpose Persist that this fan already dropped this hype kind on the clip.
 * @sideEffects AsyncStorage write.
 */
export async function markReelVote(
  reelId: string,
  kind: PlayReactionId,
  userId?: string | null,
): Promise<ReelVoteMap> {
  const current = parseVotes(await AsyncStorage.getItem(storageKey(reelId, userId)));
  const next = { ...current, [kind]: true };
  await AsyncStorage.setItem(storageKey(reelId, userId), JSON.stringify(next));
  return next;
}

/**
 * @purpose Forget this fan's Seki / Aura / Flex on a clip so a second tap can light it again.
 * @sideEffects AsyncStorage `tapuai.reelVotes.*`.
 */
export async function clearReelVote(
  reelId: string,
  kind: PlayReactionId,
  userId?: string | null,
): Promise<ReelVoteMap> {
  const current = parseVotes(await AsyncStorage.getItem(storageKey(reelId, userId)));
  const next = { ...current, [kind]: false };
  await AsyncStorage.setItem(storageKey(reelId, userId), JSON.stringify(next));
  return next;
}
