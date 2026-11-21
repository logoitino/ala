/** Reconnect replay must preserve new actions and respect cancellations made while a request is pending. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { sendReelHype, withdrawReelHype } from '@/lib/reelVotes';
import { removeReelBookmark, saveReelBookmark } from '@/lib/savedReels';
import { offlineQueue } from './OfflineQueue';
import type { OfflineActor } from '@/lib/offlineActor';

let actor: OfflineActor;
jest.mock('@/lib/offlineActor', () => ({
  ...jest.requireActual('@/lib/offlineActor'),
  createOfflineActorClient: jest.fn(async () => ({})),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null })),
  },
}));
jest.mock('@/lib/savedReels', () => ({
  saveReelBookmark: jest.fn(),
  removeReelBookmark: jest.fn(),
}));
jest.mock('@/lib/reelVotes', () => ({
  sendReelHype: jest.fn(),
  withdrawReelHype: jest.fn(),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const FIRST = '22222222-2222-4222-8222-222222222222';
const SECOND = '33333333-3333-4333-8333-333333333333';
const THIRD = '44444444-4444-4444-8444-444444444444';
const SUCCESS = { error: null };
type SaveResult = Awaited<ReturnType<typeof saveReelBookmark>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function beginReplay() {
  const started = deferred<void>();
  const result = deferred<SaveResult>();
  jest.mocked(saveReelBookmark).mockImplementationOnce(() => {
    started.resolve();
    return result.promise;
  });
  jest.mocked(NetInfo.fetch).mockResolvedValue({
    type: 'unknown', isConnected: true, isInternetReachable: null, details: null,
  } as NetInfoState);
  await offlineQueue.isOnline();
  const replay = offlineQueue.flush();
  await started.promise;
  return { result, replay };
}

function errorResult(message: string, code: string): SaveResult {
  // Preserve the SDK error shape without importing a backend client outside the data layer.
  const wire = { name: 'PostgrestError', message, code, details: '', hint: '' };
  const error = Object.assign(new Error(message), wire, { toJSON: () => wire });
  return { error };
}

function retryableFailure(): SaveResult {
  return errorResult('Network request failed', '');
}

beforeEach(async () => {
  await offlineQueue.discardAll();
  await AsyncStorage.clear();
  jest.mocked(saveReelBookmark).mockReset().mockResolvedValue(SUCCESS);
  jest.mocked(removeReelBookmark).mockReset().mockResolvedValue(SUCCESS);
  jest.mocked(sendReelHype).mockReset().mockResolvedValue({ error: null });
  jest.mocked(withdrawReelHype).mockReset().mockResolvedValue({ error: null });
  jest.mocked(NetInfo.fetch).mockResolvedValue({
    type: 'unknown', isConnected: false, isInternetReachable: null, details: null,
  } as NetInfoState);
  await offlineQueue.isOnline();
  offlineQueue.setActor(USER);
  actor = offlineQueue.captureActor(USER)!;
});

afterAll(() => { offlineQueue.dispose(); });

test('retains SDK-shaped network failures without an Error prototype for replay', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  result.resolve({ error: { message: 'Network request failed', code: '', details: '', hint: '' } } as SaveResult);
  await replay;
  expect(await offlineQueue.snapshot()).toEqual([expect.objectContaining({ reelId: FIRST })]);
});

test('queues SDK-shaped network failures from an online action', async () => {
  jest.mocked(NetInfo.fetch).mockResolvedValue({
    type: 'unknown', isConnected: true, isInternetReachable: null, details: null,
  } as NetInfoState);
  const payload = { type: 'bookmark' as const, reelId: FIRST, userId: USER, saved: true };
  await expect(offlineQueue.runOrEnqueue(payload, async () => {
    throw { message: 'Network request failed', code: '' };
  }, actor)).resolves.toBe('queued');
  expect(await offlineQueue.snapshot()).toEqual([expect.objectContaining(payload)]);
});

test('undo of an issued hype waits for settlement and replays its durable compensating clear', async () => {
  const started = deferred<void>();
  const result = deferred<{ error: null }>();
  jest.mocked(sendReelHype).mockImplementationOnce(() => {
    started.resolve();
    return result.promise;
  });
  await offlineQueue.enqueue({ type: 'aura_hype', reelId: FIRST, kind: 'aura', grantAura: false }, actor);
  jest.mocked(NetInfo.fetch).mockResolvedValue({
    type: 'unknown', isConnected: true, isInternetReachable: null, details: null,
  } as NetInfoState);
  await offlineQueue.isOnline();
  const replay = offlineQueue.flush();
  await started.promise;
  let settled = false;
  const undo = offlineQueue.dropPendingHype(FIRST, 'aura', actor).then((removed) => {
    settled = true;
    return removed;
  });
  // Let storage settle; an issued mutation must still block its compensating clear.
  await AsyncStorage.getItem('tapuai.offlineQueue');
  await Promise.resolve();
  expect(settled).toBe(false);
  result.resolve({ error: null });
  await replay;
  expect(await undo).toBe(true);
  expect(withdrawReelHype).toHaveBeenCalledWith(FIRST, 'aura', expect.any(Object));
  expect(await offlineQueue.snapshot()).toEqual([]);
});

test('a new bookmark remains saved for replay when an earlier request succeeds', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.enqueue({ type: 'bookmark', reelId: SECOND, userId: USER, saved: true }, actor);
  result.resolve(SUCCESS);
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([
    expect.objectContaining({ type: 'bookmark', reelId: SECOND, userId: USER, saved: true }),
  ]);
  expect(JSON.parse((await AsyncStorage.getItem('tapuai.offlineQueue'))!)).toEqual([
    expect.objectContaining({ reelId: SECOND, saved: true }),
  ]);
  await offlineQueue.flush();
  expect(saveReelBookmark).toHaveBeenLastCalledWith(USER, SECOND, expect.any(Object));
  expect(await offlineQueue.snapshot()).toEqual([]);
});

test('a network failure retains both the retry and the newly queued bookmark in order', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.enqueue({ type: 'bookmark', reelId: SECOND, userId: USER, saved: true }, actor);
  result.resolve(retryableFailure());
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([
    expect.objectContaining({ reelId: FIRST }),
    expect.objectContaining({ reelId: SECOND }),
  ]);
});

test.each([false, true])('an old save cannot replace the newer unsave (network failure: %s)', async (failed) => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: false }, actor);
  result.resolve(failed ? retryableFailure() : SUCCESS);
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([
    expect.objectContaining({ type: 'bookmark', reelId: FIRST, saved: false }),
  ]);
  expect(JSON.parse((await AsyncStorage.getItem('tapuai.offlineQueue'))!)).toEqual([
    expect.objectContaining({ reelId: FIRST, saved: false }),
  ]);
});

test('discarding queued actions during a failed request does not resurrect them', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.discardAll();
  result.resolve(retryableFailure());
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([]);
  expect(JSON.parse((await AsyncStorage.getItem('tapuai.offlineQueue'))!)).toEqual([]);
});

test('an undone hype waiting behind a request is never dispatched', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  await offlineQueue.enqueue({ type: 'aura_hype', reelId: SECOND, kind: 'aura', grantAura: false }, actor);
  const { result, replay } = await beginReplay();
  expect(await offlineQueue.dropPendingHype(SECOND, 'aura', actor)).toBe(true);
  result.resolve(SUCCESS);
  await replay;

  expect(sendReelHype).not.toHaveBeenCalled();
  expect(await offlineQueue.snapshot()).toEqual([]);
});

test('a newer unsave replaces a later pending save before it can be dispatched', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  await offlineQueue.enqueue({ type: 'bookmark', reelId: SECOND, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.enqueue({ type: 'bookmark', reelId: SECOND, userId: USER, saved: false }, actor);
  result.resolve(SUCCESS);
  await replay;

  expect(saveReelBookmark).toHaveBeenCalledTimes(1);
  expect(await offlineQueue.snapshot()).toEqual([
    expect.objectContaining({ reelId: SECOND, saved: false }),
  ]);
  await offlineQueue.flush();
  expect(removeReelBookmark).toHaveBeenCalledWith(USER, SECOND, expect.any(Object));
  expect(await offlineQueue.snapshot()).toEqual([]);
});

test('a terminal refusal drops only the refused action while a new save survives', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  await offlineQueue.enqueue({ type: 'bookmark', reelId: SECOND, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  jest.mocked(saveReelBookmark).mockResolvedValueOnce(errorResult('Permission denied', '42501'));
  await offlineQueue.enqueue({ type: 'bookmark', reelId: THIRD, userId: USER, saved: true }, actor);
  result.resolve(SUCCESS);
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([expect.objectContaining({ reelId: THIRD })]);
});

test.each([false, true])('discard followed by a new save remains authoritative (network failure: %s)', async (failed) => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.discardAll();
  await offlineQueue.enqueue({ type: 'bookmark', reelId: THIRD, userId: USER, saved: true }, actor);
  result.resolve(failed ? retryableFailure() : SUCCESS);
  await replay;

  expect(await offlineQueue.snapshot()).toEqual([expect.objectContaining({ reelId: THIRD })]);
  expect(JSON.parse((await AsyncStorage.getItem('tapuai.offlineQueue'))!)).toEqual([
    expect.objectContaining({ reelId: THIRD }),
  ]);
});

test('a simultaneous flush does not send the same pending request twice', async () => {
  await offlineQueue.enqueue({ type: 'bookmark', reelId: FIRST, userId: USER, saved: true }, actor);
  const { result, replay } = await beginReplay();
  await offlineQueue.flush();
  expect(saveReelBookmark).toHaveBeenCalledTimes(1);
  result.resolve(SUCCESS);
  await replay;
  expect(await offlineQueue.snapshot()).toEqual([]);
});
