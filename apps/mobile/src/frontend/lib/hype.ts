/**
 * Seki / Aura / Flex / view counts on an athlete, with a local-first tap record.
 * Counts come from the `players` row. `bumpPlayerHype` records a tap in AsyncStorage (`tapuai.hype.<id>`) so the UI
 * responds at once, then calls the `increment_player_hype` RPC and falls back to updating `players` directly.
 * `HypeKind` is a view or a play reaction id.
 * @sideEffects AsyncStorage; Supabase RPC / `players` update.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { PlayReactionId } from '@/data/players';
import type { Player } from '@/types/database';

export type HypeKind = 'view' | PlayReactionId;

export type PlayerHype = {
  view_count: number;
  aura_count: number;
  flex_count: number;
  seki_count: number;
};

const EMPTY_HYPE: PlayerHype = {
  view_count: 0,
  aura_count: 0,
  flex_count: 0,
  seki_count: 0,
};

function storageKey(playerId: string): string {
  return `tapuai.hype.${playerId}`;
}

export function hypeFromPlayer(player: Player | null | undefined): PlayerHype {
  if (!player) return { ...EMPTY_HYPE };
  return {
    view_count: player.view_count ?? 0,
    aura_count: player.aura_count ?? 0,
    flex_count: player.flex_count ?? 0,
    seki_count: player.seki_count ?? 0,
  };
}

export function mergeHype(a: PlayerHype, b: PlayerHype): PlayerHype {
  return {
    view_count: Math.max(a.view_count, b.view_count),
    aura_count: Math.max(a.aura_count, b.aura_count),
    flex_count: Math.max(a.flex_count, b.flex_count),
    seki_count: Math.max(a.seki_count, b.seki_count),
  };
}

export function applyHypeToPlayer(player: Player, hype: PlayerHype): Player {
  return { ...player, ...hype };
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

async function readLocal(playerId: string): Promise<PlayerHype | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerHype>;
    return {
      view_count: Number(parsed.view_count) || 0,
      aura_count: Number(parsed.aura_count) || 0,
      flex_count: Number(parsed.flex_count) || 0,
      seki_count: Number(parsed.seki_count) || 0,
    };
  } catch {
    return null;
  }
}

async function writeLocal(playerId: string, hype: PlayerHype): Promise<void> {
  await AsyncStorage.setItem(storageKey(playerId), JSON.stringify(hype));
}

export async function hydratePlayerHype(player: Player): Promise<Player> {
  const local = await readLocal(player.id);
  if (!local) return player;
  return applyHypeToPlayer(player, mergeHype(hypeFromPlayer(player), local));
}

function bumpLocally(current: PlayerHype, kind: HypeKind): PlayerHype {
  if (kind === 'view') return { ...current, view_count: current.view_count + 1 };
  if (kind === 'aura') return { ...current, aura_count: current.aura_count + 1 };
  if (kind === 'flex') return { ...current, flex_count: current.flex_count + 1 };
  return { ...current, seki_count: current.seki_count + 1 };
}

function parseRemoteHype(data: unknown): PlayerHype | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    view_count: Number(row.view_count) || 0,
    aura_count: Number(row.aura_count) || 0,
    flex_count: Number(row.flex_count) || 0,
    seki_count: Number(row.seki_count) || 0,
  };
}

export async function bumpPlayerHype(
  player: Player,
  kind: HypeKind,
): Promise<PlayerHype> {
  const seeded = mergeHype(hypeFromPlayer(player), (await readLocal(player.id)) ?? EMPTY_HYPE);
  const optimistic = bumpLocally(seeded, kind);
  await writeLocal(player.id, optimistic);

  if (!isSupabaseConfigured) return optimistic;

  const { data, error } = await supabase.rpc('increment_player_hype', {
    target_player_id: player.id,
    hype_kind: kind,
  });

  if (!error) {
    const remote = parseRemoteHype(data);
    if (remote) {
      const merged = mergeHype(optimistic, remote);
      await writeLocal(player.id, merged);
      return merged;
    }
  }

  const patch =
    kind === 'view'
      ? { view_count: optimistic.view_count }
      : kind === 'aura'
        ? { aura_count: optimistic.aura_count }
        : kind === 'flex'
          ? { flex_count: optimistic.flex_count }
          : { seki_count: optimistic.seki_count };

  await supabase.from('players').update(patch).eq('id', player.id);

  return optimistic;
}
