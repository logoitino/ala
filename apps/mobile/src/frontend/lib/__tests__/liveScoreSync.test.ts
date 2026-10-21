/**
 * SCALE-03 live score merge and refetch decisions: ordering (out-of-order, duplicate, gap), a game the list does not
 * hold, inactive games, reconnect, the Broadcast-refused fallback and the switch-off path. Synthetic rows only; no
 * socket or database.
 */
import {
  applyGameScoreChange,
  createLiveScoreSync,
  GAME_SCORES_INDEX_TOPIC,
  gameScoresTopic,
  parseGameMembershipChange,
  parseGameScoreChange,
  stateFromSnapshot,
  type LiveGameRow,
  type LiveScoreSyncSnapshot,
  type TopicHandlers,
} from '@/lib/liveScoreSync';

function game(id: string, home: string, seq: number | undefined, extra: Partial<LiveGameRow> = {}): LiveGameRow {
  return {
    id,
    home_team: home,
    away_team: 'Visitors',
    home_school: '',
    away_school: '',
    home_score: 0,
    away_score: 0,
    status: 'live',
    venue: '',
    is_active: true,
    ...(seq === undefined ? {} : { live_seq: seq }),
    ...extra,
  };
}

const score = (id: string, seq: number, changes: Record<string, unknown>) => ({ v: 1, id, seq, changes });

describe('parsing', () => {
  it('keeps only known, correctly typed fields', () => {
    const parsed = parseGameScoreChange(
      score('g1', 4, { home_score: 7, away_score: '3', claimed_by: 'u1', quarter: 'Q2', is_clock_running: true }),
    );
    expect(parsed).toEqual({ id: 'g1', seq: 4, changes: { home_score: 7, quarter: 'Q2', is_clock_running: true } });
  });

  it('refuses malformed payloads', () => {
    expect(parseGameScoreChange(null)).toBeNull();
    expect(parseGameScoreChange({ v: 2, id: 'g1', seq: 1, changes: {} })).toBeNull();
    expect(parseGameScoreChange(score('g1', -1, {}))).toBeNull();
    expect(parseGameScoreChange(score('g1', 1.5, {}))).toBeNull();
    expect(parseGameScoreChange(score('bad id;', 1, {}))).toBeNull();
    expect(parseGameScoreChange({ v: 1, id: 'g1', seq: 1, changes: [] })).toBeNull();
    expect(parseGameScoreChange(score('g1', 1, { home_score: Number.NaN }))?.changes).toEqual({});
  });

  it('parses membership messages and topic names', () => {
    expect(parseGameMembershipChange({ v: 1, id: 'g1', op: 'insert' })).toEqual({ id: 'g1', op: 'insert' });
    expect(parseGameMembershipChange({ v: 1, id: 'g1', op: 'drop' })).toBeNull();
    expect(gameScoresTopic('3f2c9a40-0000-4000-8000-000000000001')).toBe('game_scores_3f2c9a40-0000-4000-8000-000000000001');
    expect(gameScoresTopic('x,or=(id.eq.1)')).toBeNull();
  });
});

describe('applyGameScoreChange', () => {
  const base = () => stateFromSnapshot([game('a', 'Alpha', 5), game('b', 'Bravo', 2)]);

  it('applies the next change in place without touching other games', () => {
    const start = base();
    const { state, outcome } = applyGameScoreChange(start, { id: 'a', seq: 6, changes: { home_score: 14 } });
    expect(outcome).toBe('applied');
    expect(state.games[0]).toMatchObject({ id: 'a', home_score: 14, live_seq: 6 });
    expect(state.games[1]).toBe(start.games[1]);
    expect(state.seqs.a).toBe(6);
  });

  it('drops a duplicate delivery', () => {
    const once = applyGameScoreChange(base(), { id: 'a', seq: 6, changes: { home_score: 14 } }).state;
    const twice = applyGameScoreChange(once, { id: 'a', seq: 6, changes: { home_score: 14 } });
    expect(twice.outcome).toBe('duplicate');
    expect(twice.state).toBe(once);
  });

  it('keeps the newer value when changes arrive out of order, and flags the gap', () => {
    const newer = applyGameScoreChange(base(), { id: 'a', seq: 7, changes: { home_score: 21 } });
    expect(newer.outcome).toBe('gap');
    expect(newer.state.games[0].home_score).toBe(21);
    const older = applyGameScoreChange(newer.state, { id: 'a', seq: 6, changes: { home_score: 14 } });
    expect(older.outcome).toBe('stale');
    expect(older.state.games[0].home_score).toBe(21);
  });

  it('asks for a reread when the game is not in the list', () => {
    const result = applyGameScoreChange(base(), { id: 'z', seq: 1, changes: { home_score: 3 } });
    expect(result.outcome).toBe('unknown_game');
    expect(result.state.games).toHaveLength(2);
  });

  it('removes a game that goes inactive, ignores its later changes, and rereads when it comes back', () => {
    const off = applyGameScoreChange(base(), { id: 'b', seq: 3, changes: { is_active: false } });
    expect(off.outcome).toBe('applied');
    expect(off.state.games.map((g) => g.id)).toEqual(['a']);
    const late = applyGameScoreChange(off.state, { id: 'b', seq: 4, changes: { away_score: 9 } });
    expect(late.outcome).toBe('ignored');
    const back = applyGameScoreChange(late.state, { id: 'b', seq: 5, changes: { is_active: true } });
    expect(back.outcome).toBe('unknown_game');
  });

  it('takes the first change for a row read before the migration (no live_seq)', () => {
    const state = stateFromSnapshot([game('a', 'Alpha', undefined)]);
    expect(applyGameScoreChange(state, { id: 'a', seq: 40, changes: { home_score: 1 } }).outcome).toBe('applied');
  });

  it('re-sorts by home team only when the home team changes', () => {
    const { state } = applyGameScoreChange(base(), { id: 'a', seq: 6, changes: { home_team: 'Zulu' } });
    expect(state.games.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

// ---------------------------------------------------------------------------------------------------------------

type Harness = ReturnType<typeof makeHarness>;

function makeHarness(options: { broadcastEnabled?: boolean; maxGameTopics?: number; snapshots?: LiveGameRow[][] } = {}) {
  const topics = new Map<string, TopicHandlers>();
  const left: string[] = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let nextTimer = 1;
  const legacy: { onChange: () => void; left: boolean }[] = [];
  const snapshots = options.snapshots ?? [[game('a', 'Alpha', 5), game('b', 'Bravo', 2)]];
  let fetchCount = 0;
  let release: (() => void) | null = null;
  let hold = false;
  const states: LiveScoreSyncSnapshot[] = [];

  const sync = createLiveScoreSync({
    broadcastEnabled: options.broadcastEnabled ?? true,
    maxGameTopics: options.maxGameTopics,
    fetchGames: async () => {
      const games = snapshots[Math.min(fetchCount, snapshots.length - 1)];
      fetchCount += 1;
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return { games: games.map((g) => ({ ...g })), error: null };
    },
    subscribeTopic: (topic, handlers) => {
      topics.set(topic, handlers);
      return () => {
        topics.delete(topic);
        left.push(topic);
      };
    },
    subscribeLegacy: (onChange) => {
      const entry = { onChange, left: false };
      legacy.push(entry);
      return () => {
        entry.left = true;
      };
    },
    onState: (snapshot) => states.push(snapshot),
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimer: (id) => {
      const index = timers.findIndex((t) => t.id === id);
      if (index >= 0) timers.splice(index, 1);
    },
    random: () => 0.5,
  });

  return {
    sync,
    topics,
    left,
    timers,
    legacy,
    states,
    fetches: () => fetchCount,
    last: () => states[states.length - 1],
    holdFetch: () => {
      hold = true;
    },
    releaseFetch: () => {
      hold = false;
      release?.();
    },
    runTimers: async () => {
      const due = timers.splice(0);
      for (const timer of due) timer.fn();
      await flush();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const send = (h: Harness, topic: string, event: string, payload: unknown) => h.topics.get(topic)?.onMessage(event, payload);
const status = (h: Harness, topic: string, value: string) => h.topics.get(topic)?.onStatus(value);
const topicA = gameScoresTopic('a')!;
const topicB = gameScoresTopic('b')!;

describe('createLiveScoreSync', () => {
  it('with the switch off runs the earlier path: no topics, every change rereads', async () => {
    const h = makeHarness({ broadcastEnabled: false });
    h.sync.start();
    await flush();
    expect(h.topics.size).toBe(0);
    expect(h.legacy).toHaveLength(1);
    expect(h.last().mode).toBe('legacy');
    h.legacy[0].onChange();
    await flush();
    expect(h.fetches()).toBe(2);
    h.sync.stop();
    expect(h.legacy[0].left).toBe(true);
  });

  it('joins the index plus one topic per listed game, and merges a score change without a reread', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    expect([...h.topics.keys()].sort()).toEqual([topicA, topicB, GAME_SCORES_INDEX_TOPIC].sort());
    status(h, GAME_SCORES_INDEX_TOPIC, 'SUBSCRIBED');
    status(h, topicA, 'SUBSCRIBED');
    send(h, topicA, 'score', score('a', 6, { home_score: 7 }));
    expect(h.last().games.find((g) => g.id === 'a')?.home_score).toBe(7);
    expect(h.fetches()).toBe(1);
    expect(h.timers).toHaveLength(0);
  });

  it('ignores a message whose id does not match its topic', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    send(h, topicA, 'score', score('b', 3, { home_score: 99 }));
    expect(h.last().games.find((g) => g.id === 'b')?.home_score).toBe(0);
  });

  it('coalesces one jittered reread for a gap', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    send(h, topicA, 'score', score('a', 9, { home_score: 3 }));
    send(h, topicB, 'score', score('b', 8, { home_score: 1 }));
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(750);
    await h.runTimers();
    expect(h.fetches()).toBe(2);
  });

  it('rereads when a membership message arrives', async () => {
    const h = makeHarness({
      snapshots: [[game('a', 'Alpha', 5)], [game('a', 'Alpha', 5), game('c', 'Charlie', 0)]],
    });
    h.sync.start();
    await flush();
    send(h, GAME_SCORES_INDEX_TOPIC, 'membership', { v: 1, id: 'c', op: 'insert' });
    await h.runTimers();
    expect(h.last().games.map((g) => g.id)).toEqual(['a', 'c']);
    expect(h.topics.has(gameScoresTopic('c')!)).toBe(true);
  });

  it('rereads once after a reconnect, however many topics rejoin', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    for (const topic of [GAME_SCORES_INDEX_TOPIC, topicA, topicB]) status(h, topic, 'SUBSCRIBED');
    for (const topic of [GAME_SCORES_INDEX_TOPIC, topicA, topicB]) status(h, topic, 'CHANNEL_ERROR');
    expect(h.timers).toHaveLength(0);
    for (const topic of [GAME_SCORES_INDEX_TOPIC, topicA, topicB]) status(h, topic, 'SUBSCRIBED');
    expect(h.timers).toHaveLength(1);
    await h.runTimers();
    expect(h.fetches()).toBe(2);
    expect(h.last().mode).toBe('broadcast');
  });

  it('falls back to the earlier path when the private index topic is refused before it ever joins', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    status(h, GAME_SCORES_INDEX_TOPIC, 'CHANNEL_ERROR');
    await flush();
    expect(h.topics.size).toBe(0);
    expect(h.left.sort()).toEqual([topicA, topicB, GAME_SCORES_INDEX_TOPIC].sort());
    expect(h.legacy).toHaveLength(1);
    expect(h.last().mode).toBe('legacy');
    expect(h.fetches()).toBe(2);
  });

  it('replays a change that lands while a reread is in flight', async () => {
    const h = makeHarness({ snapshots: [[game('a', 'Alpha', 5)], [game('a', 'Alpha', 5, { home_score: 0 })]] });
    h.sync.start();
    await flush();
    h.holdFetch();
    void h.sync.refresh(false);
    send(h, topicA, 'score', score('a', 6, { home_score: 10 }));
    h.releaseFetch();
    await flush();
    expect(h.last().games[0]).toMatchObject({ home_score: 10, live_seq: 6 });
  });

  it('leaves the topic of a game that goes inactive', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    send(h, topicB, 'score', score('b', 3, { is_active: false }));
    expect(h.topics.has(topicB)).toBe(false);
    expect(h.last().games.map((g) => g.id)).toEqual(['a']);
  });

  it('caps per-game topics and keeps the rest current with a slow poll', async () => {
    const h = makeHarness({
      maxGameTopics: 1,
      snapshots: [[game('a', 'Alpha', 1), game('b', 'Bravo', 1), game('c', 'Charlie', 1)]],
    });
    h.sync.start();
    await flush();
    expect([...h.topics.keys()].sort()).toEqual([topicA, GAME_SCORES_INDEX_TOPIC].sort());
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(62_500);
  });

  it('leaves every topic and ignores late messages after stop', async () => {
    const h = makeHarness();
    h.sync.start();
    await flush();
    const handlersA = h.topics.get(topicA)!;
    h.sync.stop();
    expect(h.topics.size).toBe(0);
    const before = h.states.length;
    handlersA.onMessage('score', score('a', 6, { home_score: 50 }));
    expect(h.states.length).toBe(before);
  });
});
