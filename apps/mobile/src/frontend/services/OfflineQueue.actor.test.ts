/** Device queue ownership survives account switches/restarts without assigning legacy actions to an incoming user. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { OfflineQueue, type OfflineActionPayload } from './OfflineQueue';

const mockDispatch = jest.fn();
jest.mock('@/lib/offlineActions', () => ({
  dispatchOfflineAction: (...args: unknown[]) => mockDispatch(...args),
}), { virtual: true });
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null })),
  },
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const REEL = '33333333-3333-4333-8333-333333333333';
const SECOND = '44444444-4444-4444-8444-444444444444';
const KEY = 'tapuai.offlineQueue';
let queue: OfflineQueue;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function online(value: boolean) {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: value, isInternetReachable: null, details: null } as NetInfoState);
  await queue.isOnline();
}
function freshQueue() {
  // Separate process lifetime without changing persisted device records.
  queue?.dispose();
  delete (globalThis as typeof globalThis & { __tapuaiOfflineQueue?: OfflineQueue }).__tapuaiOfflineQueue;
  queue = OfflineQueue.getInstance();
}
beforeEach(async () => {
  mockDispatch.mockReset().mockResolvedValue(undefined);
  await AsyncStorage.clear();
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null } as NetInfoState);
  freshQueue();
  await queue.snapshot();
});
afterEach(() => queue.dispose());

test('holds automatic replay until Auth resolves, then replays only its matching actor', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([
    { id: 'old', created_at: '2026-11-20', type: 'report_reel', reelId: REEL },
    { id: 'A', created_at: '2026-11-20', type: 'report_reel', reelId: REEL, actorUserId: A },
  ]));
  freshQueue();
  await online(true);
  await queue.flush();
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(await queue.snapshot()).toEqual([]);
  await online(false);
  queue.setActor(B);
  await online(true);
  await queue.flush();
  expect(mockDispatch).not.toHaveBeenCalled();
  await online(false);
  queue.setActor(A);
  await online(true);
  await queue.flush();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 'A', actorUserId: A }));
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual([expect.objectContaining({ id: 'old' })]);
});

test.each<OfflineActionPayload>([
  { type: 'bookmark', reelId: REEL, userId: A, saved: true },
  { type: 'aura_hype', reelId: REEL, kind: 'aura', grantAura: true, userId: SECOND },
  { type: 'hype_clear', reelId: REEL, kind: 'aura' },
  { type: 'cheer_vote', slug: 'poll', side: 'home', previousSide: null, homeName: 'Home', awayName: 'Away' },
  { type: 'report_reel', reelId: REEL, reason: 'coach_level' },
])('keeps $type attributed to A while B is signed in', async (payload) => {
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  await queue.enqueue(payload, actor);
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)[0].actorUserId).toBe(A);
  queue.setActor(B);
  await online(true);
  await queue.flush();
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(await queue.snapshot()).toEqual([]);
  await online(false);
  queue.setActor(A);
  await online(true);
  await queue.flush();
  expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: A }), expect.objectContaining({ userId: A }));
});

test('same-user refresh preserves a handle; A→B→A and unmount invalidate it', async () => {
  expect(queue.captureActor()).toBeNull();
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  queue.setActor(A);
  expect(actor.isCurrent()).toBe(true);
  expect(queue.captureActor(B)).toBeNull();
  expect(queue.captureActor(null)).toBeNull();
  queue.setActor(B);
  queue.setActor(A);
  expect(actor.isCurrent()).toBe(false);
  queue.suspendActor();
  expect(queue.captureActor()).toBeNull();
});

test('a delayed network probe cannot run or enqueue an outgoing account action', async () => {
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  const probe = deferred<NetInfoState>();
  jest.mocked(NetInfo.fetch).mockReturnValueOnce(probe.promise);
  const task = jest.fn(async () => undefined);
  const result = queue.runOrEnqueue({ type: 'report_reel', reelId: REEL }, task, actor);
  queue.setActor(B);
  probe.resolve({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null } as NetInfoState);
  await expect(result).rejects.toThrow(/account changed/i);
  expect(task).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

test('replacement and undo of B actions preserve A actions on the same target', async () => {
  queue.setActor(A);
  await queue.enqueue({ type: 'cheer_vote', slug: 'poll', side: 'home', previousSide: null, homeName: 'H', awayName: 'A' }, queue.captureActor(A)!);
  await queue.enqueue({ type: 'aura_hype', reelId: REEL, kind: 'aura', grantAura: false }, queue.captureActor(A)!);
  queue.setActor(B);
  await queue.enqueue({ type: 'cheer_vote', slug: 'poll', side: 'away', previousSide: null, homeName: 'H', awayName: 'A' }, queue.captureActor(B)!);
  await queue.enqueue({ type: 'aura_hype', reelId: REEL, kind: 'aura', grantAura: false }, queue.captureActor(B)!);
  expect(await queue.dropPendingHype(REEL, 'aura', queue.captureActor(B)!)).toBe(true);
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual([
    expect.objectContaining({ actorUserId: A, type: 'cheer_vote', side: 'home' }),
    expect.objectContaining({ actorUserId: A, type: 'aura_hype' }),
    expect.objectContaining({ actorUserId: B, type: 'cheer_vote', side: 'away' }),
  ]);
});

test('stale and guest handles cannot add remote actions', async () => {
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  queue.setActor(null);
  await queue.enqueue({ type: 'report_reel', reelId: REEL }, actor);
  await queue.enqueue({ type: 'report_reel', reelId: REEL }, null);
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

test('switch during dispatch stops the remaining outgoing batch without deleting its pending rows', async () => {
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  await queue.enqueue({ type: 'report_reel', reelId: REEL }, actor);
  await queue.enqueue({ type: 'report_reel', reelId: SECOND }, actor);
  const started = deferred<void>();
  const finish = deferred<void>();
  mockDispatch.mockImplementationOnce(() => { started.resolve(); return finish.promise; });
  await online(true);
  const replay = queue.flush();
  await started.promise;
  queue.setActor(B);
  finish.resolve();
  await replay;
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual([expect.objectContaining({ reelId: SECOND, actorUserId: A })]);
});

test('an actor transition during replay schedules the incoming owner once after settlement', async () => {
  queue.setActor(B);
  await queue.enqueue({ type: 'report_reel', reelId: SECOND }, queue.captureActor(B)!);
  queue.setActor(A);
  await queue.enqueue({ type: 'report_reel', reelId: REEL }, queue.captureActor(A)!);
  const started = deferred<void>();
  const finish = deferred<void>();
  mockDispatch.mockImplementationOnce(() => { started.resolve(); return finish.promise; });
  await online(true);
  const replay = queue.flush();
  await started.promise;
  queue.setActor(B);
  finish.resolve();
  await replay;
  await queue.snapshot();
  expect(mockDispatch).toHaveBeenCalledTimes(2);
  expect(mockDispatch.mock.calls[1][0]).toEqual(expect.objectContaining({ actorUserId: B, reelId: SECOND }));
});

test('undo while a hype is issued persists A compensation before an account switch', async () => {
  queue.setActor(A);
  const actor = queue.captureActor(A)!;
  await queue.enqueue({ type: 'aura_hype', reelId: REEL, kind: 'aura', grantAura: false }, actor);
  const started = deferred<void>();
  const finish = deferred<void>();
  mockDispatch.mockImplementationOnce(() => { started.resolve(); return finish.promise; });
  await online(true);
  const replay = queue.flush();
  await started.promise;
  const undo = queue.dropPendingHype(REEL, 'aura', actor);
  await queue.snapshot();
  queue.setActor(B);
  finish.resolve();
  await replay;
  await undo;
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual([
    expect.objectContaining({ type: 'hype_clear', actorUserId: A, reelId: REEL, kind: 'aura' }),
  ]);
  await online(false);
  queue.setActor(A);
  await online(true);
  await queue.flush();
  expect(mockDispatch.mock.calls[1][0]).toEqual(expect.objectContaining({ type: 'hype_clear', actorUserId: A }));
});

test('overlapping cold-start triggers dispatch a hydrated action only once', async () => {
  const read = deferred<string | null>();
  const finish = deferred<void>();
  const started = deferred<void>();
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => read.promise);
  mockDispatch.mockImplementation(() => { started.resolve(); return finish.promise; });
  freshQueue();
  queue.setActor(A);
  await online(true);
  const first = queue.flush();
  const second = queue.flush();
  read.resolve(JSON.stringify([{ id: 'A', created_at: '2026-11-20', type: 'report_reel', reelId: REEL, actorUserId: A }]));
  await started.promise;
  try {
    await Promise.resolve();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  } finally {
    finish.resolve();
    await Promise.all([first, second]);
  }
});
