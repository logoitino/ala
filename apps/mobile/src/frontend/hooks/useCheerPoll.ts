/**
 * School Polls: load the active polls, remember which side a fan chose (AsyncStorage) and cast a vote.
 * Database reads, the live channel and the vote call all go through `lib/cheerPoll`.
 * @sideEffects `cheer_polls` read and Realtime; `cast_cheer_vote` RPC (all through lib/).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

import { fetchActiveCheerPollCards } from '@/lib/adminCatalog';
import { castCheerVote, fetchCheerPollRow, subscribeCheerPoll } from '@/lib/cheerPoll';
import { isSupabaseConfigured } from '@/lib/supabase';

export type CheerSide = 'home' | 'away';

export type CheerPoll = {
  slug: string;
  home_label: string;
  away_label: string;
  home_votes: number;
  away_votes: number;
};

const FALLBACK_HOME = 124;
const FALLBACK_AWAY = 98;

function voteKey(slug: string) {
  return `tapuai.cheerVote.${slug}`;
}

function parsePoll(row: Record<string, unknown> | null, fallback: CheerPoll): CheerPoll {
  if (!row) return fallback;
  const homeVotes = Number(row.home_votes);
  const awayVotes = Number(row.away_votes);
  return {
    slug: typeof row.slug === 'string' ? row.slug : fallback.slug,
    home_label: typeof row.home_label === 'string' && row.home_label.trim() ? row.home_label.trim() : fallback.home_label,
    away_label: typeof row.away_label === 'string' && row.away_label.trim() ? row.away_label.trim() : fallback.away_label,
    home_votes: Number.isFinite(homeVotes) ? Math.max(0, homeVotes) : fallback.home_votes,
    away_votes: Number.isFinite(awayVotes) ? Math.max(0, awayVotes) : fallback.away_votes,
  };
}

/**
 * @purpose Load a live `cheer_polls` row, keep the fan's side in AsyncStorage, and cast votes through `cast_cheer_vote`.
 * @param slug Unique poll key (`westlake-lone-peak` or `game-{id}`).
 * @param homeLabel Home school name shown on the card and seeded on first RPC insert.
 * @param awayLabel Away school name shown on the card and seeded on first RPC insert.
 * @returns `{ poll, myVote, vote }` — `vote` is a no-op when the same side is already selected.
 * @sideEffects Supabase SELECT + Realtime on `cheer_polls`, `cast_cheer_vote` RPC, AsyncStorage `tapuai.cheerVote.{slug}`; OfflineQueue when `NetInfo.isConnected === false`.
 */
export function useCheerPoll(slug: string, homeLabel: string, awayLabel: string) {
  const mountedRef = useRef(true);
  const seed = useMemo<CheerPoll>(
    () => ({
      slug,
      home_label: homeLabel,
      away_label: awayLabel,
      home_votes: slug === 'westlake-lone-peak' ? FALLBACK_HOME : 0,
      away_votes: slug === 'westlake-lone-peak' ? FALLBACK_AWAY : 0,
    }),
    [awayLabel, homeLabel, slug],
  );
  const [poll, setPoll] = useState<CheerPoll>(seed);
  const [myVote, setMyVote] = useState<CheerSide | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setPoll((current) => ({
      ...current,
      slug,
      home_label: homeLabel,
      away_label: awayLabel,
    }));
  }, [awayLabel, homeLabel, slug]);

  useEffect(() => {
    void AsyncStorage.getItem(voteKey(slug)).then((value) => {
      if (!mountedRef.current) return;
      if (value === 'home' || value === 'away') setMyVote(value);
    });
  }, [slug]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const load = async () => {
      const row = await fetchCheerPollRow(slug);
      if (!mountedRef.current || !row) return;
      setPoll(parsePoll(row, seed));
    };

    void load();

    return subscribeCheerPoll(slug, (next) => {
      if (!mountedRef.current) return;
      setPoll(parsePoll(next, seed));
    });
  }, [seed, slug]);

  const vote = useCallback(
    async (side: CheerSide) => {
      if (myVote === side) return false;
      const previous = myVote;

      setMyVote(side);
      setPoll((current) => {
        let home = current.home_votes;
        let away = current.away_votes;
        if (previous === 'home') home = Math.max(0, home - 1);
        if (previous === 'away') away = Math.max(0, away - 1);
        if (side === 'home') home += 1;
        else away += 1;
        return { ...current, home_votes: home, away_votes: away };
      });
      void AsyncStorage.setItem(voteKey(slug), side);

      if (!isSupabaseConfigured) return true;

      const payload = {
        type: 'cheer_vote' as const,
        slug,
        side,
        previousSide: previous,
        homeName: homeLabel,
        awayName: awayLabel,
      };
      const { offlineQueue, shouldQueueOffline } = await import('@/services/OfflineQueue');
      if (!(await offlineQueue.isOnline())) {
        await offlineQueue.enqueue(payload);
        return true;
      }

      const { data, error } = await castCheerVote({ slug, side, previousSide: previous, homeName: homeLabel, awayName: awayLabel });

      if (error && shouldQueueOffline(error, offlineQueue.getIsConnected())) {
        await offlineQueue.enqueue(payload);
        return true;
      }

      if (error || !data || typeof data !== 'object') return true;
      const row = data as Record<string, unknown>;
      setPoll((current) => ({
        ...current,
        home_votes: Number(row.home_votes) || current.home_votes,
        away_votes: Number(row.away_votes) || current.away_votes,
      }));
      return true;
    },
    [awayLabel, homeLabel, myVote, slug],
  );

  return { poll, myVote, vote };
}

/**
 * @purpose Active School Polls published from the admin portal (`cheer_polls.is_active`).
 * @returns `{ slug, homeLabel, awayLabel }[]` — empty means Local should keep its game-derived fallback.
 * @sideEffects `cheer_polls` SELECT on focus.
 */
export function usePublishedCheerPolls() {
  const [polls, setPolls] = useState<Array<{ slug: string; homeLabel: string; awayLabel: string }>>([]);

  const refresh = useCallback(async () => {
    try {
      setPolls(await fetchActiveCheerPollCards());
    } catch {
      setPolls([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return polls;
}

/**
 * @purpose Count locally stored cheer-poll votes for Fan engagement on the Profile card.
 * @returns Number of `tapuai.cheerVote.*` keys in AsyncStorage.
 * @sideEffects AsyncStorage `getAllKeys`.
 */
export async function countStoredCheerVotes(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith('tapuai.cheerVote.')).length;
}
