/**
 * One Seki, one Aura, and one Flex per person on a live play. A second tap clears that one.
 * The player total is credited only the first time a kind turns on for that play.
 * @sideEffects AsyncStorage `tapuai.playVotes.*` for the load and save helpers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlayReactionId } from '@/data/players';

export type PlayVoteFlags = Record<PlayReactionId, boolean>;

export type PlayReactionVotes = {
  selected: PlayVoteFlags;
  /** True after this device already sent `increment_player_hype` for that kind on this play. */
  credited: PlayVoteFlags;
};

const EMPTY_FLAGS: PlayVoteFlags = { seki: false, aura: false, flex: false };

function flags(value: unknown): PlayVoteFlags {
  const row = value && typeof value === 'object' ? (value as Partial<PlayVoteFlags>) : {};
  return {
    seki: Boolean(row.seki),
    aura: Boolean(row.aura),
    flex: Boolean(row.flex),
  };
}

/**
 * @purpose Starting vote map: nothing selected and nothing credited.
 */
export function emptyPlayVotes(): PlayReactionVotes {
  return { selected: { ...EMPTY_FLAGS }, credited: { ...EMPTY_FLAGS } };
}

/**
 * @purpose Turn one live-play reaction on or off. The count this returns is only ever 0 or 1.
 * @param current Votes already stored for this play.
 * @param kind Seki, Aura, or Flex.
 * @returns The next map, whether the player total should be credited, and the visible 0/1 count.
 */
export function togglePlayVote(
  current: PlayReactionVotes,
  kind: PlayReactionId,
): { next: PlayReactionVotes; credit: boolean; count: 0 | 1 } {
  if (current.selected[kind]) {
    return {
      next: { ...current, selected: { ...current.selected, [kind]: false } },
      credit: false,
      count: 0,
    };
  }
  const credit = !current.credited[kind];
  return {
    next: {
      selected: { ...current.selected, [kind]: true },
      credited: credit ? { ...current.credited, [kind]: true } : current.credited,
    },
    credit,
    count: 1,
  };
}

function storageKey(eventId: string): string {
  return `tapuai.playVotes.${eventId}`;
}

/**
 * @purpose Read this device's one-per-kind votes for a live play.
 * @param eventId `game_events.id`.
 * @sideEffects AsyncStorage read.
 */
export async function loadPlayVotes(eventId: string): Promise<PlayReactionVotes> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(eventId));
    if (!raw) return emptyPlayVotes();
    const parsed = JSON.parse(raw) as Partial<PlayReactionVotes>;
    return { selected: flags(parsed.selected), credited: flags(parsed.credited) };
  } catch {
    return emptyPlayVotes();
  }
}

/**
 * @purpose Remember a live-play select or clear so a reload cannot stack another point.
 * @sideEffects AsyncStorage write.
 */
export async function savePlayVotes(eventId: string, votes: PlayReactionVotes): Promise<void> {
  await AsyncStorage.setItem(storageKey(eventId), JSON.stringify(votes));
}
