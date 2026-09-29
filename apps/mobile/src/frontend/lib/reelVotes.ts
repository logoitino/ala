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

// Per-key write queue. Every write below is read-modify-write on one AsyncStorage key; run
// unqueued, a quick Seki then Aura (or a vote load landing mid-tap) read the same old map and the
// last write erased the other vote.
const keyQueues = new Map<string, Promise<unknown>>();

function withKey<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (keyQueues.get(key) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  keyQueues.set(key, tail);
  void tail.then(() => {
    if (keyQueues.get(key) === tail) keyQueues.delete(key);
  });
  return run;
}

async function updateVotes(reelId: string, userId: string | null | undefined, patch: Partial<ReelVoteMap>) {
  const key = storageKey(reelId, userId);
  return withKey(key, async () => {
    const next = { ...parseVotes(await AsyncStorage.getItem(key)), ...patch };
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
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

  const fromServer: Partial<ReelVoteMap> = {};
  for (const row of data) {
    if (row.kind === 'seki' || row.kind === 'aura' || row.kind === 'flex') fromServer[row.kind] = true;
  }
  // Merge onto the latest stored map (not the one read before the network call), queued behind
  // any tap that wrote while the SELECT was in flight.
  return updateVotes(reelId, userId, fromServer);
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
  return updateVotes(reelId, userId, { [kind]: true });
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
  return updateVotes(reelId, userId, { [kind]: false });
}
