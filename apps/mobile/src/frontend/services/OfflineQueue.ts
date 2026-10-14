/**
 * Process-wide queue for actions taken without a connection: Aura taps, cheer votes, bookmarks and reports.
 * Stored in AsyncStorage while NetInfo says offline, then replayed to the matching Supabase RPCs on reconnect.
 * @sideEffects AsyncStorage, NetInfo listener, Supabase RPCs on flush.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type NativeEventSubscription } from 'react-native';

import { parseReportReason } from '@/data/contentRights';
import { addUserAura } from '@/lib/aura';
import { DOUBLE_TAP_AURA_POINTS } from '@/data/highlights';
import { isReelUuid, reportReelRemote } from '@/lib/reels';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { PlayReactionId } from '@/data/players';

const STORAGE_KEY = 'tapuai.offlineQueue';
const GLOBAL_KEY = '__tapuaiOfflineQueue';

export type OfflineAuraAction = {
  type: 'aura_hype';
  reelId: string;
  kind: PlayReactionId;
  grantAura: boolean;
  /** Points to grant on flush. Serve Like Me double-tap is 2; default 1. */
  auraPoints?: number;
  userId?: string | null;
};

export type OfflineHypeClearAction = {
  type: 'hype_clear';
  reelId: string;
  kind: PlayReactionId;
};

export type OfflineCheerAction = {
  type: 'cheer_vote';
  slug: string;
  side: 'home' | 'away';
  previousSide: 'home' | 'away' | null;
  homeName: string;
  awayName: string;
};

export type OfflineBookmarkAction = {
  type: 'bookmark';
  reelId: string;
  userId: string;
  saved: boolean;
};

export type OfflineReportAction = {
  type: 'report_reel';
  reelId: string;
  reason?: string;
};

export type OfflineActionPayload =
  | OfflineAuraAction
  | OfflineHypeClearAction
  | OfflineCheerAction
  | OfflineBookmarkAction
  | OfflineReportAction;

export type OfflineQueuedAction = OfflineActionPayload & {
  id: string;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @purpose Treat `NetInfo.isConnected === false` (or a fetch/network error) as offline.
 * @param error Optional Supabase / fetch failure.
 * @param connected Latest NetInfo flag (`null` counts as unknown/online).
 */
export function shouldQueueOffline(error?: { message?: string } | null, connected: boolean | null = true): boolean {
  if (connected === false) return true;
  const message = error?.message ?? '';
  return /failed to fetch|network request failed|network error|offline|internet|timeout/i.test(message);
}

async function persistBookmark(action: OfflineBookmarkAction): Promise<void> {
  if (!isSupabaseConfigured || !isReelUuid(action.reelId)) return;
  if (action.saved) {
    const { error } = await supabase.from('saved_reels').insert({
      user_id: action.userId,
      reel_id: action.reelId,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
    return;
  }
  const { error } = await supabase
    .from('saved_reels')
    .delete()
    .eq('user_id', action.userId)
    .eq('reel_id', action.reelId);
  if (error) throw error;
}

async function persistCheerVote(action: OfflineCheerAction): Promise<void> {
  if (!isSupabaseConfigured) return;
  let { error } = await supabase.rpc('cast_cheer_vote', {
    poll_slug: action.slug,
    side: action.side,
    previous_side: action.previousSide,
    home_name: action.homeName,
    away_name: action.awayName,
  });
  if (error) {
    const retry = await supabase.rpc('cast_cheer_vote', {
      poll_slug: action.slug,
      side: action.side,
      previous_side: action.previousSide,
    });
    error = retry.error;
  }
  if (error) throw error;
}

async function persistHypeClear(action: OfflineHypeClearAction): Promise<void> {
  if (!isReelUuid(action.reelId) || !isSupabaseConfigured) return;
  const { error } = await supabase.rpc('clear_reel_hype', {
    target_reel_id: action.reelId,
    hype_kind: action.kind,
  });
  if (error) throw error;
}

async function persistAura(action: OfflineAuraAction): Promise<void> {
  if (!isReelUuid(action.reelId) || !isSupabaseConfigured) return;
  const { error } = await supabase.rpc('increment_reel_hype', {
    target_reel_id: action.reelId,
    hype_kind: action.kind,
  });
  if (error) throw error;
  if (action.grantAura && action.userId) {
    await addUserAura(action.userId, action.auraPoints ?? DOUBLE_TAP_AURA_POINTS);
  }
}

async function dispatch(action: OfflineQueuedAction): Promise<void> {
  if (action.type === 'aura_hype') {
    await persistAura(action);
    return;
  }
  if (action.type === 'hype_clear') {
    await persistHypeClear(action);
    return;
  }
  if (action.type === 'cheer_vote') {
    await persistCheerVote(action);
    return;
  }
  if (action.type === 'bookmark') {
    await persistBookmark(action);
    return;
  }
  await reportReelRemote(action.reelId, parseReportReason(action.reason));
}

/**
 * @purpose Persist optimistic Aura taps, cheer votes, bookmarks, and reports while `NetInfo.isConnected === false`, then flush to Supabase RPCs on reconnect.
 * @returns Process-wide singleton. `enqueue` writes AsyncStorage; `flush` replays in order.
 * @sideEffects AsyncStorage `tapuai.offlineQueue`; NetInfo + AppState listeners; `increment_reel_hype` / `clear_reel_hype` / `add_user_aura` / `cast_cheer_vote` / `saved_reels` / `report_reel`.
 */
export class OfflineQueue {
  private items: OfflineQueuedAction[] = [];
  private connected: boolean | null = true;
  private flushing = false;
  private netUnsub: (() => void) | null = null;
  private appSub: NativeEventSubscription | { remove: () => void } | null = null;
  private loaded = false;

  private constructor() {
    void this.hydrate();
    this.netUnsub = NetInfo.addEventListener((state: NetInfoState) => {
      const next = state.isConnected;
      const wasOffline = this.connected === false;
      this.connected = next;
      if (wasOffline && next !== false) void this.flush();
    });
    this.appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void this.flush();
    });
    void NetInfo.fetch().then((state) => {
      this.connected = state.isConnected;
      if (this.connected !== false) void this.flush();
    });
  }

  /** @purpose Release the network and app-state listeners (tests and hot reload); queued actions stay saved. */
  dispose(): void {
    this.netUnsub?.();
    this.netUnsub = null;
    this.appSub?.remove();
    this.appSub = null;
  }

  static getInstance(): OfflineQueue {
    const bag = globalThis as typeof globalThis & Record<string, OfflineQueue | undefined>;
    const existing = bag[GLOBAL_KEY];
    if (existing) return existing;
    const created = new OfflineQueue();
    bag[GLOBAL_KEY] = created;
    return created;
  }

  getIsConnected(): boolean | null {
    return this.connected;
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.connected = state.isConnected;
      return state.isConnected !== false;
    } catch {
      return this.connected !== false;
    }
  }

  private async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          this.items = parsed.filter(
            (row): row is OfflineQueuedAction =>
              Boolean(row) && typeof row === 'object' && typeof (row as OfflineQueuedAction).id === 'string',
          );
        }
      }
    } catch {
      this.items = [];
    } finally {
      this.loaded = true;
    }
  }

  private async persist() {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
  }

  /**
   * @purpose Drop a Seki / Aura / Flex that has not reached the server yet, so an undo does not replay the tap.
   * @returns True when a queued hype tap was removed.
   * @sideEffects AsyncStorage `tapuai.offlineQueue`.
   */
  async dropPendingHype(reelId: string, kind: PlayReactionId): Promise<boolean> {
    if (!this.loaded) await this.hydrate();
    const before = this.items.length;
    this.items = this.items.filter(
      (row) => !(row.type === 'aura_hype' && row.reelId === reelId && row.kind === kind),
    );
    if (this.items.length === before) return false;
    await this.persist();
    return true;
  }

  /**
   * @purpose Append an optimistic mutation for later RPC replay. Replaces an existing cheer/bookmark/report for the same target.
   */
  async enqueue(payload: OfflineActionPayload): Promise<void> {
    if (!this.loaded) await this.hydrate();
    const next: OfflineQueuedAction = { ...payload, id: newId(), created_at: nowIso() };
    if (payload.type === 'aura_hype') {
      this.items = this.items.filter(
        (row) => !(row.type === 'hype_clear' && row.reelId === payload.reelId && row.kind === payload.kind),
      );
    } else if (payload.type === 'hype_clear') {
      this.items = this.items.filter(
        (row) =>
          !(
            (row.type === 'aura_hype' || row.type === 'hype_clear') &&
            row.reelId === payload.reelId &&
            row.kind === payload.kind
          ),
      );
    } else if (payload.type === 'cheer_vote') {
      this.items = this.items.filter((row) => !(row.type === 'cheer_vote' && row.slug === payload.slug));
    } else if (payload.type === 'bookmark') {
      this.items = this.items.filter(
        (row) => !(row.type === 'bookmark' && row.reelId === payload.reelId && row.userId === payload.userId),
      );
    } else if (payload.type === 'report_reel') {
      this.items = this.items.filter((row) => !(row.type === 'report_reel' && row.reelId === payload.reelId));
    }
    this.items.push(next);
    await this.persist();
  }

  /**
   * @purpose Run `task` when online; otherwise persist `payload`. Network failures also enqueue.
   */
  async runOrEnqueue(payload: OfflineActionPayload, task: () => Promise<void>): Promise<'ran' | 'queued'> {
    const online = await this.isOnline();
    if (!online) {
      await this.enqueue(payload);
      return 'queued';
    }
    try {
      await task();
      return 'ran';
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (shouldQueueOffline({ message }, this.connected)) {
        await this.enqueue(payload);
        return 'queued';
      }
      throw caught;
    }
  }

  /**
   * @purpose Snapshot queued Aura / cheer / bookmark / report mutations for the QA desk.
   */
  async snapshot(): Promise<OfflineQueuedAction[]> {
    if (!this.loaded) await this.hydrate();
    return [...this.items];
  }

  /**
   * @purpose Drop every queued mutation without replaying (QA / Studio reset).
   */
  async discardAll(): Promise<void> {
    if (!this.loaded) await this.hydrate();
    this.items = [];
    await this.persist();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (!this.loaded) await this.hydrate();
    if (this.connected === false || this.items.length === 0) return;
    if (!isSupabaseConfigured) return;

    this.flushing = true;
    try {
      const pending = [...this.items];
      const leftover: OfflineQueuedAction[] = [];
      for (const action of pending) {
        try {
          await dispatch(action);
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          if (shouldQueueOffline({ message }, this.connected)) {
            leftover.push(action);
            leftover.push(...pending.slice(pending.indexOf(action) + 1));
            break;
          }
        }
      }
      this.items = leftover;
      await this.persist();
    } finally {
      this.flushing = false;
    }
  }
}

export const offlineQueue = OfflineQueue.getInstance();
