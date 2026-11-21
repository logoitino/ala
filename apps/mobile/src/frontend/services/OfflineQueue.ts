/**
 * Process-wide queue for actions taken without a connection: Aura taps, cheer votes, bookmarks and reports.
 * Stored in AsyncStorage while NetInfo says offline, then replayed on reconnect through the lib/ helpers that own each
 * call (reelVotes, savedReels, aura, cheerPoll, reels), so this service never holds a database client (PORT-01).
 * @sideEffects AsyncStorage, NetInfo listener, database calls through lib/ on flush.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type NativeEventSubscription } from 'react-native';

import { dispatchOfflineAction } from '@/lib/offlineActions';
import { isOfflineActorChanged, OfflineActorChangedError, type OfflineActor } from '@/lib/offlineActor';
import { isSupabaseConfigured } from '@/lib/supabase';
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
  /** Originating Auth user, distinct from an Aura award target. Legacy unattributed rows are held. */
  actorUserId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Preserve plain SDK error objects as well as thrown Error/string failures. */
function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
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
  private inFlight: { action: OfflineQueuedAction; settled: Promise<void> } | null = null;
  private hydration: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private actorUserId: string | null = null;
  private actorReady = false;
  private actorGeneration = 0;
  private requestedReplay = false;

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
    this.suspendActor();
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

  /** @purpose Install Auth's resolved owner before async profile work; same-user token refresh retains queued intent. */
  setActor(userId: string | null): void {
    const changed = !this.actorReady || this.actorUserId !== userId;
    if (changed) ++this.actorGeneration;
    if (changed && this.flushing) this.requestedReplay = true;
    this.actorReady = true;
    this.actorUserId = userId;
    // Start outside the Auth callback so the SDK can finish publishing its matching token.
    void Promise.resolve().then(() => this.flush()).catch(() => undefined);
  }

  /** @purpose Invalidate pending UI closures/replay on Auth provider cleanup; stored intent stays owned. */
  suspendActor(): void {
    ++this.actorGeneration;
    this.actorReady = false;
    this.actorUserId = null;
  }

  /** @purpose Capture a signed-in account lifetime synchronously before a network/storage await; null never adopts a later login. */
  captureActor(expectedUserId?: string | null): OfflineActor | null {
    const userId = this.actorUserId;
    if (!this.actorReady || !userId || (expectedUserId !== undefined && expectedUserId !== userId)) return null;
    const generation = this.actorGeneration;
    return {
      userId,
      isCurrent: () => this.actorReady && this.actorUserId === userId && this.actorGeneration === generation,
    };
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

  private hydrate(): Promise<void> {
    // A single storage read prevents late startup reads overwriting actions added by another caller.
    this.hydration ??= this.readStoredItems();
    return this.hydration;
  }

  private async readStoredItems() {
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
    const snapshot = JSON.stringify(this.items);
    // Preserve invocation order even if the native storage bridge resolves writes out of order.
    const write = this.writes.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot));
    this.writes = write;
    await write;
  }

  /**
   * @purpose Drop a Seki / Aura / Flex that has not reached the server yet, so an undo does not replay the tap.
   * @returns True when local cancellation or a durable actor-owned compensating clear owns the undo.
   * @sideEffects AsyncStorage `tapuai.offlineQueue`.
   */
  async dropPendingHype(reelId: string, kind: PlayReactionId, actor: OfflineActor | null): Promise<boolean> {
    if (!this.loaded) await this.hydrate();
    if (!actor?.isCurrent()) return false;
    const issued = this.inFlight?.action;
    const settlement = issued?.type === 'aura_hype' && issued.actorUserId === actor.userId && issued.reelId === reelId && issued.kind === kind
      ? this.inFlight?.settled : null;
    if (settlement) {
      // Persist compensation while this actor is authorized, before waiting or switching accounts.
      this.requestedReplay = true;
      await this.enqueue({ type: 'hype_clear', reelId, kind }, actor);
      await settlement.catch(() => undefined);
      return true;
    }
    const before = this.items.length;
    this.items = this.items.filter(
      (row) => !(row.actorUserId === actor.userId && row.type === 'aura_hype' && row.reelId === reelId && row.kind === kind),
    );
    const removed = this.items.length !== before;
    if (removed) await this.persist();
    return removed;
  }

  /**
   * @purpose Append an optimistic mutation for later RPC replay. Replaces an existing cheer/bookmark/report for the same target.
   */
  async enqueue(payload: OfflineActionPayload, actor: OfflineActor | null): Promise<void> {
    if (!this.loaded) await this.hydrate();
    if (!actor?.isCurrent()) return;
    const next: OfflineQueuedAction = { ...payload, id: newId(), created_at: nowIso(), actorUserId: actor.userId };
    const otherOwner = (row: OfflineQueuedAction) => row.actorUserId !== actor.userId;
    if (payload.type === 'aura_hype') {
      this.items = this.items.filter(
        (row) => otherOwner(row) || !(row.type === 'hype_clear' && row.reelId === payload.reelId && row.kind === payload.kind),
      );
    } else if (payload.type === 'hype_clear') {
      this.items = this.items.filter(
        (row) =>
          otherOwner(row) || !(
            (row.type === 'aura_hype' || row.type === 'hype_clear') &&
            row.reelId === payload.reelId &&
            row.kind === payload.kind
          ),
      );
    } else if (payload.type === 'cheer_vote') {
      this.items = this.items.filter((row) => otherOwner(row) || !(row.type === 'cheer_vote' && row.slug === payload.slug));
    } else if (payload.type === 'bookmark') {
      this.items = this.items.filter(
        (row) => otherOwner(row) || !(row.type === 'bookmark' && row.reelId === payload.reelId && row.userId === payload.userId),
      );
    } else if (payload.type === 'report_reel') {
      this.items = this.items.filter((row) => otherOwner(row) || !(row.type === 'report_reel' && row.reelId === payload.reelId));
    }
    this.items.push(next);
    await this.persist();
  }

  /**
   * @purpose Run `task` when online; otherwise persist `payload`. Network failures also enqueue.
   */
  async runOrEnqueue(payload: OfflineActionPayload, task: () => Promise<void>, actor: OfflineActor): Promise<'ran' | 'queued'> {
    const online = await this.isOnline();
    if (!actor.isCurrent()) throw new OfflineActorChangedError();
    if (!online) {
      await this.enqueue(payload, actor);
      return 'queued';
    }
    try {
      await task();
      return 'ran';
    } catch (caught) {
      const message = errorMessage(caught);
      if (isOfflineActorChanged(caught) || !actor.isCurrent()) throw new OfflineActorChangedError();
      if (shouldQueueOffline({ message }, this.connected)) {
        await this.enqueue(payload, actor);
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
    return this.actorReady && this.actorUserId ? this.items.filter((row) => row.actorUserId === this.actorUserId) : [];
  }

  /** @purpose Count retained other-account/legacy rows for QA without exposing their targets or identities. */
  async getHeldCount(): Promise<number> {
    if (!this.loaded) await this.hydrate();
    return this.items.filter((row) => !this.actorReady || !this.actorUserId || row.actorUserId !== this.actorUserId).length;
  }

  /**
   * @purpose Drop every queued mutation without replaying (QA / Studio reset).
   */
  async discardAll(): Promise<void> {
    if (!this.loaded) await this.hydrate();
    this.items = [];
    await this.persist();
  }

  /** @purpose Replay one pending batch without losing newer actions or resurrecting cancelled ones. */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (!this.loaded) await this.hydrate();
    // Multiple startup triggers may have shared the same pending hydration read.
    if (this.flushing) return;
    if (this.connected === false || this.items.length === 0) return;
    if (!isSupabaseConfigured) return;
    const actor = this.captureActor();
    if (!actor) return;

    this.flushing = true;
    try {
      const pending = this.items.filter((row) => row.actorUserId === actor.userId);
      for (const action of pending) {
        if (!actor.isCurrent()) break;
        // Undo, replacement and Studio reset remain authoritative while another request is in flight.
        if (!this.items.some((row) => row.id === action.id)) continue;
        try {
          const settled = dispatchOfflineAction(action, actor);
          this.inFlight = { action, settled };
          await settled;
        } catch (caught) {
          const message = errorMessage(caught);
          if (isOfflineActorChanged(caught) || !actor.isCurrent() || shouldQueueOffline({ message }, this.connected)) break;
        } finally {
          this.inFlight = null;
        }
        // Remove only this completed/refused request; concurrent additions keep their own IDs.
        this.items = this.items.filter((row) => row.id !== action.id);
      }
      await this.persist();
    } finally {
      this.flushing = false;
      // Coalesce genuine actor transitions and issued-undo compensation, never loop ordinary retries/additions.
      if (this.requestedReplay) {
        this.requestedReplay = false;
        await this.flush();
      }
    }
  }
}

export const offlineQueue = OfflineQueue.getInstance();
