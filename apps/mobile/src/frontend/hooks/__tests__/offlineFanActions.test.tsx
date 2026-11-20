/** Pending fan reads/writes belong to one account; guest Soft-Wall resume captures the newly authorized account. */
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { offlineQueue } from '@/services/OfflineQueue';
import { fetchReelSaved, saveReelBookmark } from '@/lib/savedReels';
import { useSavedReel } from '@/hooks/useSavedReel';
import { useCheerPoll } from '@/hooks/useCheerPoll';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const REEL = '33333333-3333-4333-8333-333333333333';
let mockUserId: string | null = A;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null }) }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn(async () => ({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null })) },
}));
jest.mock('@/lib/savedReels', () => ({ fetchReelSaved: jest.fn(async () => ({ saved: false, error: null })), saveReelBookmark: jest.fn(), removeReelBookmark: jest.fn() }));
jest.mock('@/lib/cheerPoll', () => ({ fetchCheerPollRow: jest.fn(async () => null), subscribeCheerPoll: jest.fn(() => jest.fn()), castCheerVote: jest.fn() }));
jest.mock('@/lib/adminCatalog', () => ({ fetchActiveCheerPollCards: jest.fn(async () => []) }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: jest.fn(async () => ({})) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null } as NetInfoState);
  await offlineQueue.isOnline();
  await offlineQueue.discardAll();
  await AsyncStorage.clear();
  mockUserId = A;
  offlineQueue.setActor(A);
  jest.mocked(fetchReelSaved).mockReset().mockResolvedValue({ saved: false, error: null });
});
afterAll(() => offlineQueue.dispose());

test('an outgoing bookmark read cannot publish into an incoming account', async () => {
  const old = deferred<Awaited<ReturnType<typeof fetchReelSaved>>>();
  jest.mocked(fetchReelSaved).mockReturnValueOnce(old.promise);
  const { result, rerender } = await renderHook(() => useSavedReel(REEL));
  mockUserId = B;
  offlineQueue.setActor(B);
  await rerender({});
  await act(async () => {});
  expect(result.current.saved).toBe(false);
  await act(async () => old.resolve({ saved: true, error: null }));
  expect(result.current.saved).toBe(false);
});

test('cheer selection is stored and restored per account', async () => {
  await AsyncStorage.setItem(`tapuai.cheerVote.${A}.poll`, 'home');
  await AsyncStorage.setItem(`tapuai.cheerVote.${B}.poll`, 'away');
  const { result, rerender } = await renderHook(() => useCheerPoll('poll', 'H', 'A'));
  await act(async () => {});
  expect(result.current.myVote).toBe('home');
  mockUserId = B;
  offlineQueue.setActor(B);
  await rerender({});
  await act(async () => {});
  expect(result.current.myVote).toBe('away');
});

test('authorized guest resume records its new actor without adopting a legacy guest selection', async () => {
  mockUserId = null;
  offlineQueue.setActor(null);
  await AsyncStorage.setItem('tapuai.cheerVote.poll', 'home');
  const { result } = await renderHook(() => useCheerPoll('poll', 'H', 'A'));
  await act(async () => {});
  const resume = result.current.vote;
  mockUserId = A;
  offlineQueue.setActor(A);
  await act(async () => { expect(await resume('home')).toBe(true); });
  expect(await AsyncStorage.getItem(`tapuai.cheerVote.${A}.poll`)).toBe('home');
  expect(await offlineQueue.snapshot()).toEqual([
    expect.objectContaining({ type: 'cheer_vote', actorUserId: A, previousSide: null }),
  ]);
});

test('guest taps never queue a remote cheer or bookmark', async () => {
  mockUserId = null;
  offlineQueue.setActor(null);
  const cheer = await renderHook(() => useCheerPoll('poll', 'H', 'A'));
  const bookmark = await renderHook(() => useSavedReel(REEL));
  await act(async () => {
    expect(await cheer.result.current.vote('home')).toBe(false);
    await bookmark.result.current.toggle();
  });
  expect(await AsyncStorage.getItem('tapuai.offlineQueue')).toBeNull();
  expect(await AsyncStorage.getItem(`tapuai.savedReel.guest.${REEL}`)).toBe('1');
});

test('a stale same-view bookmark refresh cannot overwrite a newer optimistic toggle', async () => {
  const read = deferred<Awaited<ReturnType<typeof fetchReelSaved>>>();
  jest.mocked(fetchReelSaved).mockReturnValueOnce(read.promise);
  const { result } = await renderHook(() => useSavedReel(REEL));
  await act(async () => { await result.current.toggle(); });
  expect(result.current.saved).toBe(true);
  await act(async () => read.resolve({ saved: false, error: null }));
  expect(result.current.saved).toBe(true);
});

test('a retained bookmark handler cannot mutate a later reel view', async () => {
  const { result, rerender } = await renderHook(({ reel }: { reel: string }) => useSavedReel(reel), { initialProps: { reel: REEL } });
  const toggleOld = result.current.toggle;
  await rerender({ reel: B });
  await act(async () => { await toggleOld(); });
  expect(result.current.saved).toBe(false);
  expect(await AsyncStorage.getItem(`tapuai.savedReel.${A}.${REEL}`)).toBe('0');
});

test('a delayed cheer cache read cannot overwrite a newer local vote', async () => {
  const read = deferred<string | null>();
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => read.promise);
  const { result } = await renderHook(() => useCheerPoll('poll', 'H', 'A'));
  await act(async () => { await result.current.vote('away'); });
  expect(result.current.myVote).toBe('away');
  await act(async () => read.resolve('home'));
  expect(result.current.myVote).toBe('away');
});

test('a refused bookmark from the previous reel cannot change the current reel state', async () => {
  const started = deferred<void>();
  const save = deferred<Awaited<ReturnType<typeof saveReelBookmark>>>();
  jest.mocked(saveReelBookmark).mockImplementationOnce(() => { started.resolve(); return save.promise; });
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: true, isInternetReachable: null, details: null } as NetInfoState);
  const { result, rerender } = await renderHook(({ reel }: { reel: string }) => useSavedReel(reel), { initialProps: { reel: REEL } });
  let toggle!: Promise<void>;
  await act(async () => { toggle = result.current.toggle(); await started.promise; });
  jest.mocked(fetchReelSaved).mockResolvedValueOnce({ saved: true, error: null });
  await rerender({ reel: B });
  expect(result.current.saved).toBe(true);
  const wire = { name: 'PostgrestError', message: 'Permission denied', code: '42501', details: '', hint: '' };
  const error = Object.assign(new Error(wire.message), wire, { toJSON: () => wire });
  await act(async () => { save.resolve({ error }); await toggle; });
  expect(result.current.saved).toBe(true);
  expect(await AsyncStorage.getItem(`tapuai.savedReel.${A}.${B}`)).toBe('1');
});
