/** Private Activity sources mask outgoing data immediately and refuse work from an obsolete Auth lifetime. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFanTipHistory } from '@/hooks/useFanTipHistory';
import { useDonationsToThank, useMyDonationThanks } from '@/hooks/useDonationThanks';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';

let mockOwner: string | null = 'A';
let mockGeneration = 0;
let mockGuard: () => boolean;
const mockSent = jest.fn(), mockThanks = jest.fn(), mockReceived = jest.fn(), mockTags = jest.fn(), mockResolve = jest.fn();
const mockToThank = jest.fn(), mockThank = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockOwner ? { id: mockOwner } : null, isSessionCurrent: mockGuard }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => { require('react').useEffect(effect, [effect]); } }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));
jest.mock('@/lib/donationHistory', () => ({ fetchFanTipHistory: (...args: unknown[]) => mockSent(...args), fetchReceivedMalo: (...args: unknown[]) => mockReceived(...args) }));
jest.mock('@/lib/donationThanks', () => ({
  fetchMyDonationThanksResult: (...args: unknown[]) => mockThanks(...args),
  fetchDonationsToThank: (...args: unknown[]) => mockToThank(...args),
  thankDonation: (...args: unknown[]) => mockThank(...args),
}));
jest.mock('@/lib/tags', () => ({ fetchPendingPlayerTags: (...args: unknown[]) => mockTags(...args), confirmReelPlayerTag: (...args: unknown[]) => mockResolve(...args) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackIssue: jest.fn() } }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (expected?: string) => {
  if (!mockOwner || (expected && expected !== mockOwner)) return null;
  const userId = mockOwner, generation = mockGeneration;
  return { userId, isCurrent: () => mockOwner === userId && mockGeneration === generation };
} } }));
jest.mock('@/lib/offlineActor', () => {
  const real = jest.requireActual('@/lib/offlineActor');
  return { ...real, createOfflineActorClient: async (actor: Parameters<typeof real.assertCurrent>[0]) => { real.assertCurrent(actor); return {}; } };
});
function switchOwner(id: string | null) {
  mockOwner = id; ++mockGeneration;
  const generation = mockGeneration;
  mockGuard = () => generation === mockGeneration;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const receipt = { id: 'sent-A', player_id: 'player-A', athlete_name: 'Athlete A', amount_cents: 700, aura_points: 70, created_at: '2026-01-01' };
const thanks = { tipId: 'thanks-A', playerId: 'player-A', athleteName: 'Athlete A', messageKey: 'malo', amountCents: 700, thankedAt: '2026-01-02' };
const received = { id: 'received-A', amount_cents: 700, fan_name: 'Fan A', created_at: '2026-01-01' };
const tag = { id: 'tag-A', player_id: 'player-A', title: 'Private A clip', created_at: '2026-01-01' };
const toThank = { tipId: 'gift-A', amountCents: 700, createdAt: '2026-01-01', fanName: 'Private donor A', rallyTitle: null, thankedKey: null };
function useSources() {
  return { sent: useFanTipHistory(), thanks: useMyDonationThanks(), received: useReceivedMalo('player-shared'), tags: usePendingPlayerTags() };
}
function expectEmpty(value: ReturnType<typeof useSources>) {
  expect(value.sent.receipts).toEqual([]); expect(value.sent.summary.totalTippedCents).toBe(0);
  expect(value.thanks.rows).toEqual([]); expect(value.received.rows).toEqual([]); expect(value.received.totalCents).toBe(0);
  expect(value.tags.tags).toEqual([]);
}
beforeEach(() => {
  jest.clearAllMocks(); mockGeneration = 0; switchOwner('A');
  mockSent.mockResolvedValue({ receipts: [], error: null }); mockThanks.mockResolvedValue({ rows: [], error: null });
  mockReceived.mockResolvedValue([]); mockTags.mockResolvedValue([]); mockResolve.mockResolvedValue(undefined);
  mockToThank.mockReset().mockResolvedValue([]); mockThank.mockReset().mockResolvedValue({ ok: true });
});
it('masks already loaded A receipts, thank-yous, received gifts and tags while B reads are delayed', async () => {
  mockSent.mockResolvedValueOnce({ receipts: [receipt], error: null }); mockThanks.mockResolvedValueOnce({ rows: [thanks], error: null });
  mockReceived.mockResolvedValueOnce([received]); mockTags.mockResolvedValueOnce([tag]);
  const { result, rerender } = await renderHook(useSources);
  await waitFor(() => expect(result.current.sent.receipts).toHaveLength(1));
  const pending = deferred<never>();
  mockSent.mockReturnValueOnce(pending.promise); mockThanks.mockReturnValueOnce(pending.promise);
  mockReceived.mockReturnValueOnce(pending.promise); mockTags.mockReturnValueOnce(pending.promise);
  switchOwner('B'); await rerender({});
  expectEmpty(result.current);
});
it('never restores delayed A private reads after B and a new A lifetime have loaded', async () => {
  const sent = deferred<unknown>(), thanked = deferred<unknown>(), gifts = deferred<unknown>(), tags = deferred<unknown>();
  mockSent.mockReturnValueOnce(sent.promise); mockThanks.mockReturnValueOnce(thanked.promise);
  mockReceived.mockReturnValueOnce(gifts.promise); mockTags.mockReturnValueOnce(tags.promise);
  const { result, rerender } = await renderHook(useSources);
  switchOwner('B'); await rerender({}); switchOwner('A'); await rerender({});
  await act(async () => {
    sent.resolve({ receipts: [receipt], error: null }); thanked.resolve({ rows: [thanks], error: null }); gifts.resolve([received]); tags.resolve([tag]);
  });
  expectEmpty(result.current);
});
it('refuses retained refresh callbacks before dispatch after an account changes', async () => {
  const { result, rerender } = await renderHook(useSources);
  await waitFor(() => expect(result.current.sent.loading).toBe(false));
  const old = result.current;
  switchOwner('B'); await rerender({});
  const calls = [mockSent.mock.calls.length, mockThanks.mock.calls.length, mockReceived.mock.calls.length, mockTags.mock.calls.length];
  await act(async () => { await Promise.all([old.sent.refresh(), old.thanks.refresh(), old.received.refresh(), old.tags.refresh()]); });
  expect([mockSent.mock.calls.length, mockThanks.mock.calls.length, mockReceived.mock.calls.length, mockTags.mock.calls.length]).toEqual(calls);
  expectEmpty(result.current);
});
it('refuses a retained pending-tag decision before it can dispatch under B', async () => {
  mockTags.mockResolvedValueOnce([tag]);
  const { result, rerender } = await renderHook(() => usePendingPlayerTags());
  await waitFor(() => expect(result.current.tags).toHaveLength(1));
  const oldResolve = result.current.resolve;
  switchOwner('B'); await rerender({});
  await act(async () => { await expect(oldResolve('tag-A', 'confirm')).rejects.toThrow(/account changed/i); });
  expect(mockResolve).not.toHaveBeenCalled();
});
it('does not remove incoming tags when an already issued A decision finishes', async () => {
  mockTags.mockResolvedValueOnce([tag]);
  const pending = deferred<void>(); mockResolve.mockReturnValueOnce(pending.promise);
  const { result, rerender } = await renderHook(() => usePendingPlayerTags());
  await waitFor(() => expect(result.current.tags).toHaveLength(1));
  let task!: Promise<unknown>;
  await act(async () => { task = result.current.resolve('tag-A', 'confirm').catch((error: unknown) => error); });
  mockTags.mockResolvedValueOnce([{ ...tag, title: 'B own review' }]);
  switchOwner('B'); await rerender({});
  await waitFor(() => expect(result.current.tags[0]?.title).toBe('B own review'));
  await act(async () => { pending.resolve(); await task; });
  expect(result.current.tags[0]?.title).toBe('B own review');
  expect(result.current.busyId).toBeNull();
});
it('clears private state and makes no new reads when the incoming viewer is a guest', async () => {
  mockSent.mockResolvedValueOnce({ receipts: [receipt], error: null }); mockThanks.mockResolvedValueOnce({ rows: [thanks], error: null });
  mockReceived.mockResolvedValueOnce([received]); mockTags.mockResolvedValueOnce([tag]);
  const { result, rerender } = await renderHook(useSources);
  await waitFor(() => expect(result.current.sent.receipts).toHaveLength(1));
  const calls = [mockSent.mock.calls.length, mockThanks.mock.calls.length, mockReceived.mock.calls.length, mockTags.mock.calls.length];
  switchOwner(null); await rerender({});
  expectEmpty(result.current);
  expect([mockSent.mock.calls.length, mockThanks.mock.calls.length, mockReceived.mock.calls.length, mockTags.mock.calls.length]).toEqual(calls);
});


it('invalidates loaded private rows when A to B to A is batched into one render', async () => {
  mockSent.mockResolvedValueOnce({ receipts: [receipt], error: null }); mockThanks.mockResolvedValueOnce({ rows: [thanks], error: null });
  mockReceived.mockResolvedValueOnce([received]); mockTags.mockResolvedValueOnce([tag]);
  const { result, rerender } = await renderHook(useSources);
  await waitFor(() => expect(result.current.sent.receipts).toHaveLength(1));
  const pending = deferred<never>();
  mockSent.mockReturnValueOnce(pending.promise); mockThanks.mockReturnValueOnce(pending.promise);
  mockReceived.mockReturnValueOnce(pending.promise); mockTags.mockReturnValueOnce(pending.promise);
  switchOwner('B'); switchOwner('A'); await rerender({});
  expectEmpty(result.current);
});

it('retains current-owner private rows and confirms an issued tag decision', async () => {
  mockSent.mockResolvedValueOnce({ receipts: [receipt], error: null }); mockThanks.mockResolvedValueOnce({ rows: [thanks], error: null });
  mockReceived.mockResolvedValueOnce([received]); mockTags.mockResolvedValueOnce([tag]);
  const { result, rerender } = await renderHook(useSources);
  await waitFor(() => expect(result.current.tags.tags).toHaveLength(1));
  await rerender({});
  expect(result.current.sent.summary.totalTippedCents).toBe(700);
  expect(result.current.received.totalCents).toBe(700);
  expect(result.current.thanks.rows[0].tipId).toBe('thanks-A');
  await act(async () => { await result.current.tags.resolve('tag-A', 'confirm'); });
  expect(result.current.tags.tags).toEqual([]);
  expect(mockResolve).toHaveBeenCalledWith('tag-A', 'confirm', {});
});

it('masks athlete-side donor names and amounts immediately on incoming account and athlete changes', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result, rerender } = await renderHook(({ playerId }: { playerId: string }) => useDonationsToThank(playerId), { initialProps: { playerId: 'player-A' } });
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const pending = deferred<never>(); mockToThank.mockReturnValueOnce(pending.promise);
  switchOwner('B'); await rerender({ playerId: 'player-A' });
  expect(result.current.rows).toEqual([]);
  mockToThank.mockResolvedValueOnce([{ ...toThank, fanName: 'B donor' }]);
  await rerender({ playerId: 'player-B' });
  await waitFor(() => expect(result.current.rows[0]?.fanName).toBe('B donor'));
  mockToThank.mockReturnValueOnce(pending.promise);
  await rerender({ playerId: 'player-C' });
  expect(result.current.rows).toEqual([]);
});

it('refuses athlete-side retained reads and thanks before dispatch under the incoming account', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result, rerender } = await renderHook(() => useDonationsToThank('player-A'));
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const old = result.current;
  switchOwner('B'); await rerender({});
  const reads = mockToThank.mock.calls.length;
  await act(async () => {
    await old.refresh();
    expect(await old.thank('gift-A', 'malo')).toMatchObject({ ok: false });
  });
  expect(mockToThank).toHaveBeenCalledTimes(reads);
  expect(mockThank).not.toHaveBeenCalled();
  expect(result.current.rows).toEqual([]);
});

it('rejects athlete-side delayed reads and issued thanks after A to B to A lifetime changes', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result, rerender } = await renderHook(() => useDonationsToThank('player-A'));
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const read = deferred<typeof toThank[]>(), write = deferred<{ ok: true }>();
  mockToThank.mockReturnValueOnce(read.promise); mockThank.mockReturnValueOnce(write.promise);
  let task!: Promise<unknown>;
  await act(async () => { void result.current.refresh(); task = result.current.thank('gift-A', 'malo'); });
  switchOwner('B'); switchOwner('A');
  mockToThank.mockResolvedValueOnce([{ ...toThank, fanName: 'New A donor' }]);
  await rerender({});
  await waitFor(() => expect(result.current.rows[0]?.fanName).toBe('New A donor'));
  await act(async () => { read.resolve([toThank]); write.resolve({ ok: true }); expect(await task).toMatchObject({ ok: false }); });
  expect(result.current.rows[0]).toMatchObject({ fanName: 'New A donor', thankedKey: null });
});

it('clears athlete-side private donors for guests and refuses new reads and thanks', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result, rerender } = await renderHook(() => useDonationsToThank('player-A'));
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const reads = mockToThank.mock.calls.length;
  switchOwner(null); await rerender({});
  await act(async () => { expect(await result.current.thank('gift-A', 'malo')).toMatchObject({ ok: false }); });
  expect(result.current.rows).toEqual([]); expect(result.current.loading).toBe(false);
  expect(mockToThank).toHaveBeenCalledTimes(reads); expect(mockThank).not.toHaveBeenCalled();
});

it('marks only current-owner confirmed thanks and ignores an older refresh completion', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result } = await renderHook(() => useDonationsToThank('player-A'));
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const pending = deferred<typeof toThank[]>(); mockToThank.mockReturnValueOnce(pending.promise);
  await act(async () => { void result.current.refresh(); expect(await result.current.thank('gift-A', 'malo')).toEqual({ ok: true }); });
  await act(async () => { pending.resolve([toThank]); });
  expect(result.current.rows[0].thankedKey).toBe('malo');
  expect(mockThank).toHaveBeenCalledWith('gift-A', 'malo', {});
  mockThank.mockResolvedValueOnce({ ok: false, message: 'denied' });
  await act(async () => { expect(await result.current.thank('gift-A', 'gear')).toMatchObject({ ok: false }); });
  expect(result.current.rows[0].thankedKey).toBe('malo');
});

it('settles a failed current-owner thank-you without leaving an invalidated read loading forever', async () => {
  mockToThank.mockResolvedValueOnce([toThank]);
  const { result } = await renderHook(() => useDonationsToThank('player-A'));
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  const pending = deferred<typeof toThank[]>(); mockToThank.mockReturnValueOnce(pending.promise);
  mockThank.mockRejectedValueOnce(new Error('network unavailable'));
  await act(async () => { void result.current.refresh(); expect(await result.current.thank('gift-A', 'malo')).toMatchObject({ ok: false }); });
  expect(result.current.loading).toBe(false);
  expect(result.current.rows[0].thankedKey).toBeNull();
  await act(async () => { pending.resolve([toThank]); });
  expect(result.current.loading).toBe(false);
});
