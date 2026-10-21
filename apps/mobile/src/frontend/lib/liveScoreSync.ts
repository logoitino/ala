/**
 * SCALE-03 live scoreboard sync: merges per-game Broadcast changes into the Local scoreboard list without a full
 * refetch, and decides when a refetch is still needed (reconnect, sequence gap, a game the list does not hold, a game
 * added or removed). The server side is migration `20261018120000_live_score_broadcast.sql` (unapplied); until it is
 * applied, or while `EXPO_PUBLIC_LIVE_SCORES_BROADCAST` is not `true`, the controller runs today's behaviour
 * (`postgres_changes` on `games` → refetch). The merge functions are pure so ordering cases are unit-tested; the
 * controller takes its fetch, channel and timer functions as arguments so reconnect handling is tested without a socket.
 * @sideEffects None here; the caller supplies every network and timer function.
 */
import type { Game } from '@/types/database';

/** A `games` row as the scoreboard holds it. `live_seq` exists only once the SCALE-03 migration is applied. */
export type LiveGameRow = Game & { live_seq?: number | null };

/** Columns a score message may carry, with the type each must have. Anything else in a payload is dropped. */
const CHANGE_FIELDS = {
  home_score: 'number',
  away_score: 'number',
  quarter: 'string',
  status: 'string',
  clock: 'string',
  is_clock_running: 'boolean',
  is_active: 'boolean',
  home_team: 'string',
  away_team: 'string',
  home_school: 'string',
  away_school: 'string',
  venue: 'string',
  sport: 'string',
  updated_at: 'string',
} as const;

type ChangeField = keyof typeof CHANGE_FIELDS;
export type GameScoreChanges = Partial<Pick<LiveGameRow, ChangeField>>;

/** One `score` message on `game_scores_{id}`: the fields that changed, and the row's new `live_seq`. */
export type GameScoreChange = { id: string; seq: number; changes: GameScoreChanges };

/** One `membership` message on `game_scores_index`: a game was added, removed, or switched active / inactive. */
export type GameMembershipChange = { id: string; op: 'insert' | 'delete' | 'active' };

export type LiveScoreState = { games: LiveGameRow[]; seqs: Record<string, number> };

/**
 * - `applied`: next in sequence (or the first seen for that game).
 * - `gap`: applied, but at least one earlier change was missed, so the caller should refetch.
 * - `duplicate` / `stale`: already seen or older than what is shown; ignored.
 * - `unknown_game`: the list does not hold this game (or it came back active); the caller should refetch.
 * - `ignored`: a change for a game the list removed as inactive.
 */
export type ApplyOutcome = 'applied' | 'gap' | 'duplicate' | 'stale' | 'unknown_game' | 'ignored';

export const GAME_SCORES_INDEX_TOPIC = 'game_scores_index';
const TOPIC_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * @purpose Name the private Broadcast topic for one game; matches the migration's `realtime.messages` policy.
 * @returns `game_scores_{id}`, or null for an id that is not a plain id (never build a topic from free text).
 */
export function gameScoresTopic(gameId: string): string | null {
  return TOPIC_ID.test(gameId) ? `game_scores_${gameId}` : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @purpose Validate a `score` Broadcast payload.
 * @returns The change with only known, correctly typed fields, or null for anything malformed.
 */
export function parseGameScoreChange(payload: unknown): GameScoreChange | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const { id, seq, changes } = payload;
  if (typeof id !== 'string' || !TOPIC_ID.test(id)) return null;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0) return null;
  if (!isRecord(changes)) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(CHANGE_FIELDS)) {
    if (!(key in changes)) continue;
    const value = changes[key];
    if (typeof value !== kind) continue;
    if (kind === 'number' && !Number.isFinite(value as number)) continue;
    clean[key] = value;
  }
  return { id, seq, changes: clean as GameScoreChanges };
}

/** @purpose Validate a `membership` Broadcast payload. @returns The change, or null for anything malformed. */
export function parseGameMembershipChange(payload: unknown): GameMembershipChange | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const { id, op } = payload;
  if (typeof id !== 'string' || !TOPIC_ID.test(id)) return null;
  if (op !== 'insert' && op !== 'delete' && op !== 'active') return null;
  return { id, op };
}

/**
 * @purpose Build merge state from a fresh read. Rows without `live_seq` (database before the migration) have no
 *   known sequence, so their next change is taken as-is.
 */
export function stateFromSnapshot(games: LiveGameRow[]): LiveScoreState {
  const seqs: Record<string, number> = {};
  for (const game of games) {
    if (typeof game.live_seq === 'number' && Number.isSafeInteger(game.live_seq)) seqs[String(game.id)] = game.live_seq;
  }
  return { games, seqs };
}

const byHomeTeam = (a: LiveGameRow, b: LiveGameRow) => a.home_team.localeCompare(b.home_team);

/**
 * @purpose Merge one change into the list. Changes carry absolute values (not deltas), so applying a later change
 *   after a gap is right for its own fields; the gap outcome tells the caller the other fields may be behind.
 * @returns The next state (the same object when nothing changed) and what happened.
 */
export function applyGameScoreChange(
  state: LiveScoreState,
  change: GameScoreChange,
): { state: LiveScoreState; outcome: ApplyOutcome } {
  const known = state.seqs[change.id];
  if (known !== undefined && change.seq === known) return { state, outcome: 'duplicate' };
  if (known !== undefined && change.seq < known) return { state, outcome: 'stale' };

  const index = state.games.findIndex((game) => String(game.id) === change.id);
  if (index < 0) {
    // Removed earlier as inactive: only a switch back to active matters, and the list must be reread for it.
    if (known !== undefined) {
      if (change.changes.is_active === true) return { state, outcome: 'unknown_game' };
      return { state: { ...state, seqs: { ...state.seqs, [change.id]: change.seq } }, outcome: 'ignored' };
    }
    return { state, outcome: 'unknown_game' };
  }

  const outcome: ApplyOutcome = known === undefined || change.seq === known + 1 ? 'applied' : 'gap';
  const merged: LiveGameRow = { ...state.games[index], ...change.changes, live_seq: change.seq };
  let games = state.games.slice();
  if (merged.is_active === false) games.splice(index, 1);
  else {
    games[index] = merged;
    if (change.changes.home_team !== undefined) games = games.sort(byHomeTeam);
  }
  return { state: { games, seqs: { ...state.seqs, [change.id]: change.seq } }, outcome };
}

// ---------------------------------------------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------------------------------------------

export type TopicHandlers = {
  onMessage: (event: string, payload: unknown) => void;
  onStatus: (status: string) => void;
};

export type LiveScoreSyncMode = 'broadcast' | 'legacy';

export type LiveScoreSyncSnapshot = {
  games: LiveGameRow[];
  loading: boolean;
  /** Raw failure text for logging; the hook shows friendly copy instead. */
  error: string | null;
  mode: LiveScoreSyncMode;
};

export type LiveScoreSyncDeps = {
  broadcastEnabled: boolean;
  fetchGames: () => Promise<{ games: LiveGameRow[]; error: string | null }>;
  /** Join one private Broadcast topic. Returns leave. */
  subscribeTopic: (topic: string, handlers: TopicHandlers) => () => void;
  /** Today's path: any `games` change → callback. Returns leave. */
  subscribeLegacy: (onChange: () => void) => () => void;
  onState: (snapshot: LiveScoreSyncSnapshot) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  random?: () => number;
  /** Per-game topics joined at most; games past this are kept current by a slow poll. */
  maxGameTopics?: number;
  /** Poll interval while some listed games have no topic. */
  overflowPollMs?: number;
};

export const DEFAULT_MAX_GAME_TOPICS = 40;
export const DEFAULT_OVERFLOW_POLL_MS = 60_000;
const FAILED = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

/**
 * @purpose Keep the Local scoreboard current. Broadcast mode joins `game_scores_index` plus one topic per listed
 *   game and merges each change; it refetches only after a reconnect, a gap, an unknown game or a membership change,
 *   coalesced and spread with jitter so a whole stadium does not reread at once. If the index topic fails before it
 *   ever joins (switch on but migration not applied, so the private-channel policy refuses it), the controller drops
 *   to legacy mode: today's `postgres_changes` → refetch.
 * @returns `start`, `stop` and `refresh(showSpinner)`.
 */
export function createLiveScoreSync(deps: LiveScoreSyncDeps) {
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const random = deps.random ?? Math.random;
  const maxTopics = deps.maxGameTopics ?? DEFAULT_MAX_GAME_TOPICS;
  const overflowPollMs = deps.overflowPollMs ?? DEFAULT_OVERFLOW_POLL_MS;

  let mode: LiveScoreSyncMode = deps.broadcastEnabled ? 'broadcast' : 'legacy';
  let state: LiveScoreState = { games: [], seqs: {} };
  let loading = true;
  let error: string | null = null;
  let stopped = true;
  let generation = 0;
  let fetching = false;
  /** Score changes received while a read is in flight; replayed over the snapshot when it lands. */
  let pending: GameScoreChange[] = [];
  let refetchTimer: unknown = null;
  let pollTimer: unknown = null;
  let leaveLegacy: (() => void) | null = null;
  let leaveIndex: (() => void) | null = null;
  const gameTopics = new Map<string, { leave: () => void; joined: boolean; dropped: boolean }>();
  let indexJoined = false;
  let indexDropped = false;

  const emit = () => deps.onState({ games: state.games, loading, error, mode });

  async function refresh(showSpinner = true) {
    if (stopped) return;
    const mine = ++generation;
    if (showSpinner) {
      loading = true;
      error = null;
      emit();
    }
    fetching = true;
    pending = [];
    const result = await deps.fetchGames();
    if (stopped || mine !== generation) return;
    fetching = false;
    loading = false;
    if (result.error) {
      error = result.error;
      state = { games: [], seqs: {} };
    } else {
      error = null;
      state = stateFromSnapshot(result.games);
      // A change that landed during the read may be newer than the snapshot; the seq check drops the rest.
      for (const change of pending) state = applyGameScoreChange(state, change).state;
    }
    pending = [];
    emit();
    syncGameTopics();
  }

  function requestRefetch(baseMs: number, spreadMs: number) {
    if (stopped || refetchTimer !== null) return; // an earlier pending reread already covers this one
    refetchTimer = setTimer(() => {
      refetchTimer = null;
      void refresh(false);
    }, baseMs + Math.floor(random() * spreadMs));
  }

  function onScore(change: GameScoreChange) {
    if (fetching) pending.push(change);
    const result = applyGameScoreChange(state, change);
    if (result.state !== state) {
      state = result.state;
      emit();
    }
    if (result.outcome === 'gap' || result.outcome === 'unknown_game') requestRefetch(250, 1000);
    // A game that went inactive left the list: leave its topic (and give a capped-out game its slot).
    if (!state.games.some((game) => String(game.id) === change.id) && gameTopics.has(change.id)) syncGameTopics();
  }

  function joinGameTopic(id: string, topic: string) {
    const entry = { leave: () => {}, joined: false, dropped: false };
    gameTopics.set(id, entry);
    entry.leave = deps.subscribeTopic(topic, {
      onMessage: (event, payload) => {
        if (stopped || event !== 'score') return;
        const change = parseGameScoreChange(payload);
        if (change && change.id === id) onScore(change);
      },
      onStatus: (status) => {
        if (stopped || mode !== 'broadcast') return;
        if (status === 'SUBSCRIBED') {
          // Rejoined after a drop: anything sent meanwhile was missed.
          if (entry.dropped) requestRefetch(250, 2000);
          entry.joined = true;
          entry.dropped = false;
        } else if (FAILED.has(status) && entry.joined) {
          entry.dropped = true;
        }
      },
    });
  }

  function syncGameTopics() {
    if (stopped || mode !== 'broadcast') return;
    const wanted = new Map<string, string>();
    for (const game of state.games) {
      if (wanted.size >= maxTopics) break;
      const topic = gameScoresTopic(String(game.id));
      if (topic) wanted.set(String(game.id), topic);
    }
    for (const [id, entry] of gameTopics) {
      if (!wanted.has(id)) {
        entry.leave();
        gameTopics.delete(id);
      }
    }
    for (const [id, topic] of wanted) if (!gameTopics.has(id)) joinGameTopic(id, topic);
    schedulePoll(state.games.length > wanted.size);
  }

  function schedulePoll(needed: boolean) {
    if (!needed) {
      if (pollTimer !== null) clearTimer(pollTimer);
      pollTimer = null;
      return;
    }
    if (pollTimer !== null) return;
    pollTimer = setTimer(() => {
      pollTimer = null;
      void refresh(false);
    }, overflowPollMs + Math.floor(random() * 5000));
  }

  function leaveBroadcast() {
    leaveIndex?.();
    leaveIndex = null;
    for (const entry of gameTopics.values()) entry.leave();
    gameTopics.clear();
    schedulePoll(false);
  }

  function startLegacy() {
    mode = 'legacy';
    leaveLegacy = deps.subscribeLegacy(() => {
      void refresh(false);
    });
  }

  function fallBackToLegacy() {
    leaveBroadcast();
    startLegacy();
    emit();
    void refresh(false);
  }

  function startBroadcast() {
    leaveIndex = deps.subscribeTopic(GAME_SCORES_INDEX_TOPIC, {
      onMessage: (event, payload) => {
        if (stopped || event !== 'membership' || !parseGameMembershipChange(payload)) return;
        requestRefetch(250, 1500);
      },
      onStatus: (status) => {
        if (stopped || mode !== 'broadcast') return;
        if (status === 'SUBSCRIBED') {
          if (indexDropped) requestRefetch(250, 2000);
          indexJoined = true;
          indexDropped = false;
        } else if (FAILED.has(status)) {
          if (!indexJoined) fallBackToLegacy();
          else indexDropped = true;
        }
      },
    });
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      if (mode === 'broadcast') startBroadcast();
      else startLegacy();
      void refresh(true);
    },
    stop() {
      stopped = true;
      generation += 1;
      if (refetchTimer !== null) clearTimer(refetchTimer);
      refetchTimer = null;
      leaveBroadcast();
      leaveLegacy?.();
      leaveLegacy = null;
    },
    refresh,
    /** For tests and diagnostics: the topics joined right now. */
    joinedTopicCount: () => gameTopics.size + (leaveIndex ? 1 : 0),
    mode: () => mode,
  };
}
