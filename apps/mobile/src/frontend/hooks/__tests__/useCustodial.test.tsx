/** Family-account reads and actions stay bound to one viewer and athlete, including delayed completions and rapid taps. */
import { act, renderHook } from '@testing-library/react-native';
import { useCustodial } from '../useCustodial';
import type { CustodialLoad, CustodialSummary } from '@/lib/custodial';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function summary(playerId = 'player-A'): CustodialSummary {
  return { playerId, viewerRole: 'guardian', athleteName: playerId, guardianLinked: true, guardianName: 'Guardian',
    hasAccount: true, payoutsEnabled: false, bankInAthleteName: null, handoverAge: 18, handoverDate: null,
    athleteControls: false, receivedCents: 1200, familyCents: 1080, requests: [] };
}
let mockAuth = { session: { user: { id: 'user-A' }, access_token: 'test-token' }, user: { id: 'user-A' }, isSessionCurrent: () => true };
const mockFetch = jest.fn();
const mockSetup = jest.fn();
const mockRequest = jest.fn();
const mockDecide = jest.fn();
const mockCancel = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/lib/custodial', () => ({
  fetchCustodialSummary: (id: string) => mockFetch(id), setupCustodialAccount: (...args: unknown[]) => mockSetup(...args),
  requestWithdrawal: (...args: unknown[]) => mockRequest(...args), decideWithdrawal: (...args: unknown[]) => mockDecide(...args),
  cancelWithdrawal: (...args: unknown[]) => mockCancel(...args),
}));
beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { session: { user: { id: 'user-A' }, access_token: 'test-token' }, user: { id: 'user-A' }, isSessionCurrent: () => true };
  mockFetch.mockImplementation((id: string) => Promise.resolve({ state: 'ok', summary: summary(id) }));
  for (const fn of [mockSetup, mockRequest, mockDecide, mockCancel]) fn.mockResolvedValue(undefined);
});

it('masks the previous athlete while the new summary is pending', async () => {
  const hook = await renderHook<ReturnType<typeof useCustodial>, { id: string }>(({ id }) => useCustodial(id), { initialProps: { id: 'player-A' } });
  const next = deferred<CustodialLoad>(); mockFetch.mockReturnValueOnce(next.promise);
  await hook.rerender({ id: 'player-B' });
  expect(hook.result.current.summary).toBeNull();
  expect(hook.result.current.loading).toBe(true);
  await act(async () => next.resolve({ state: 'ok', summary: summary('player-B') }));
  expect(hook.result.current.summary?.playerId).toBe('player-B');
});

it('ignores an old read after switching the signed-in viewer', async () => {
  const old = deferred<CustodialLoad>(); mockFetch.mockReturnValueOnce(old.promise);
  const hook = await renderHook(() => useCustodial('player-A'));
  mockAuth = { ...mockAuth, session: { ...mockAuth.session, user: { id: 'user-B' } }, user: { id: 'user-B' }, isSessionCurrent: () => true };
  mockFetch.mockResolvedValueOnce({ state: 'ok', summary: { ...summary(), guardianName: 'New viewer' } });
  await hook.rerender({});
  await act(async () => old.resolve({ state: 'ok', summary: { ...summary(), guardianName: 'Old viewer' } }));
  expect(hook.result.current.summary?.guardianName).toBe('New viewer');
});

it('does not restore a newer summary from an older refresh finishing last', async () => {
  const hook = await renderHook(() => useCustodial('player-A'));
  const old = deferred<CustodialLoad>(); mockFetch.mockReturnValueOnce(old.promise);
  let task!: Promise<unknown>;
  await act(async () => { task = hook.result.current.refresh(); });
  mockFetch.mockResolvedValueOnce({ state: 'ok', summary: { ...summary(), receivedCents: 2500 } });
  await act(async () => { await hook.result.current.refresh(); });
  await act(async () => { old.resolve({ state: 'ok', summary: { ...summary(), receivedCents: 10 } }); await task; });
  expect(hook.result.current.summary?.receivedCents).toBe(2500);
});

it('clears old account facts when a read returns an error', async () => {
  const hook = await renderHook(() => useCustodial('player-A'));
  mockFetch.mockResolvedValueOnce({ state: 'error', message: 'private server detail' });
  await act(async () => { await hook.result.current.refresh(); });
  expect(hook.result.current.summary).toBeNull();
  expect(hook.result.current.error).toBe('Could not load the family account. Please try again.');
  expect(hook.result.current.loading).toBe(false);
});

it('catches a thrown read without leaving loading stuck or exposing diagnostics', async () => {
  const hook = await renderHook(() => useCustodial('player-A'));
  mockFetch.mockRejectedValueOnce(new Error('private token detail'));
  await act(async () => { await expect(hook.result.current.refresh()).resolves.toBeUndefined(); });
  expect(hook.result.current.summary).toBeNull();
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.error).toBe('Could not load the family account. Please try again.');
});

it('rejects a summary for a different player', async () => {
  mockFetch.mockResolvedValueOnce({ state: 'ok', summary: summary('wrong-player') });
  const hook = await renderHook(() => useCustodial('player-A'));
  expect(hook.result.current.summary).toBeNull();
  expect(hook.result.current.error).toBeTruthy();
});

it('rejects a second action before React renders busy', async () => {
  const action = deferred<void>(); mockRequest.mockReturnValue(action.promise);
  const hook = await renderHook(() => useCustodial('player-A'));
  let first!: Promise<unknown>; let second!: Promise<unknown>;
  await act(async () => { first = hook.result.current.request(400); second = hook.result.current.request(400).catch((error) => error); });
  await act(async () => { action.resolve(undefined); await first; });
  expect(await second).toBeInstanceOf(Error);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(hook.result.current.busy).toBe(false);
});

it('rejects an old callback after player turnover', async () => {
  const hook = await renderHook<ReturnType<typeof useCustodial>, { id: string }>(({ id }) => useCustodial(id), { initialProps: { id: 'player-A' } });
  const request = hook.result.current.request;
  await hook.rerender({ id: 'player-B' });
  await act(async () => { await expect(request(400)).rejects.toThrow('changed'); });
  expect(mockRequest).not.toHaveBeenCalled();
});

it('checks the auth lifetime before a new account render', async () => {
  let current = true; mockAuth.isSessionCurrent = () => current;
  const hook = await renderHook(() => useCustodial('player-A'));
  current = false;
  await act(async () => { await expect(hook.result.current.setup(null, null)).rejects.toThrow('changed'); });
  expect(mockSetup).not.toHaveBeenCalled();
});

it('does not let an old action unlock the incoming account action', async () => {
  const old = deferred<void>(); const next = deferred<void>();
  mockRequest.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const hook = await renderHook<ReturnType<typeof useCustodial>, { id: string }>(({ id }) => useCustodial(id), { initialProps: { id: 'player-A' } });
  let first!: Promise<unknown>; let second!: Promise<unknown>;
  await act(async () => { first = hook.result.current.request(400).catch((error) => error); });
  await hook.rerender({ id: 'player-B' });
  await act(async () => { second = hook.result.current.request(500); });
  await act(async () => old.resolve(undefined));
  expect(await first).toBeInstanceOf(Error);
  expect(hook.result.current.busy).toBe(true);
  await act(async () => { next.resolve(undefined); await second; });
  expect(hook.result.current.busy).toBe(false);
});

it('rejects invalid player actions instead of sending the string null', async () => {
  const hook = await renderHook(() => useCustodial(null));
  await act(async () => { await expect(hook.result.current.request(400)).rejects.toThrow(); });
  expect(mockRequest).not.toHaveBeenCalled();
});

it('preserves the missing-SQL state and blocks actions', async () => {
  mockFetch.mockResolvedValueOnce({ state: 'unavailable' });
  const hook = await renderHook(() => useCustodial('player-A'));
  expect(hook.result.current.available).toBe(false);
  expect(hook.result.current.summary).toBeNull();
  await act(async () => { await expect(hook.result.current.setup(null, null)).rejects.toThrow('not switched on'); });
  expect(mockSetup).not.toHaveBeenCalled();
});

it('does not expose action diagnostics that begin with the readback failure prefix', async () => {
  const hook = await renderHook(() => useCustodial('player-A'));
  mockRequest.mockRejectedValueOnce(new Error('The update could not be confirmed private-token-detail'));
  await act(async () => { await expect(hook.result.current.request(400)).rejects.toThrow('Could not update the family account. Please try again.'); });
  expect(hook.result.current.error).toBe('Could not update the family account. Please try again.');
});

it('rejects a completed mutation if its current summary readback failed', async () => {
  const hook = await renderHook(() => useCustodial('player-A'));
  mockFetch.mockResolvedValueOnce({ state: 'error', message: 'readback unavailable' });
  await act(async () => { await expect(hook.result.current.request(400)).rejects.toThrow('could not be confirmed'); });
  expect(hook.result.current.summary).toBeNull();
  expect(hook.result.current.busy).toBe(false);
});

it('keeps guest reads idle and rejects guest actions', async () => {
  mockAuth.user.id = 'different-from-session';
  const hook = await renderHook(() => useCustodial('player-A'));
  expect(mockFetch).not.toHaveBeenCalled();
  expect(hook.result.current.summary).toBeNull();
  await act(async () => { await expect(hook.result.current.request(400)).rejects.toThrow('Sign in'); });
  expect(mockRequest).not.toHaveBeenCalled();
});
