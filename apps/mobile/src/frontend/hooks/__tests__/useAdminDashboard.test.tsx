/** Admin dashboard data and retained actions belong to one real admin session, not Studio preview. */
import { act, renderHook } from '@testing-library/react-native';
import { useAdminDashboard } from '../useAdminDashboard';
import type { AdminFlagRow, AdminPlatformMetrics } from '@/lib/admin';

const mockAwards = jest.fn(); const mockFlags = jest.fn(); const mockMetrics = jest.fn();
const mockPublish = jest.fn(); const mockModerate = jest.fn(); const mockDismiss = jest.fn();
const metrics: AdminPlatformMetrics = { highlightCount: 2, engagementCount: 8, maloCents: 100, openFlags: 1, telemetryEvents24h: 0 };
const flag: AdminFlagRow = { id: 'reel-A', kind: 'highlight', title: 'Private queue A', subtitle: 'School A', reportCount: 1, openedAt: '2026-11-20', reasonLabel: 'Rights', athleteOrGuardian: 'unchecked' };
function auth(id = 'admin-A', admin = true) { return { session: { user: { id }, access_token: 'test-only' }, user: { id }, profile: { user_id: id, is_admin: admin }, loading: false, isAdmin: true, studioUnlocked: true, isSessionCurrent: () => true }; }
let mockAuth = auth();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [{ id: 'player-A', name: 'Athlete A' }], loading: false }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: async () => ({}) }));
jest.mock('@/lib/admin', () => ({
  fetchAdminSpotlightAwards: () => mockAwards(), fetchAdminFlags: () => mockFlags(), fetchAdminPlatformMetrics: () => mockMetrics(),
  publishSpotlightAward: (...args: unknown[]) => mockPublish(...args), moderateFlaggedReel: (...args: unknown[]) => mockModerate(...args),
  dismissTelemetryIncident: (...args: unknown[]) => mockDismiss(...args), defaultSpotlightWindow: () => ({ start: '', end: '' }),
}));
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { jest.resetAllMocks(); mockAuth = auth(); mockAwards.mockResolvedValue([]); mockFlags.mockResolvedValue([flag]); mockMetrics.mockResolvedValue(metrics); mockModerate.mockResolvedValue(undefined); });

it('keeps Studio preview safely empty and refuses moderation without a real admin profile', async () => {
  mockAuth = auth('fan-B', false);
  const hook = await renderHook(() => useAdminDashboard());
  expect(hook.result.current.flags).toEqual([]); expect(hook.result.current.players).toEqual([]);
  expect(hook.result.current.metrics.openFlags).toBe(0); expect(mockFlags).not.toHaveBeenCalled();
  await act(async () => { await expect(hook.result.current.moderate(flag, 'remove')).rejects.toThrow(); });
  expect(mockModerate).not.toHaveBeenCalled();
});
it('does not trust an outgoing admin profile under a different session', async () => {
  mockAuth = { ...auth('fan-B'), profile: { user_id: 'admin-A', is_admin: true } };
  const hook = await renderHook(() => useAdminDashboard());
  expect(hook.result.current.flags).toEqual([]); expect(mockFlags).not.toHaveBeenCalled();
});
it('masks old admin rows while the incoming admin read is pending', async () => {
  const hook = await renderHook(() => useAdminDashboard());
  const incoming = deferred<AdminFlagRow[]>(); mockFlags.mockReturnValueOnce(incoming.promise);
  mockAuth = auth('admin-B'); await hook.rerender(undefined);
  expect(hook.result.current.flags).toEqual([]);
  await act(async () => incoming.resolve([{ ...flag, id: 'reel-B' }]));
  expect(hook.result.current.flags[0]?.id).toBe('reel-B');
});
it('ignores an outgoing read after switching to a fan', async () => {
  const old = deferred<AdminFlagRow[]>(); mockFlags.mockReturnValueOnce(old.promise);
  const hook = await renderHook(() => useAdminDashboard());
  mockAuth = auth('fan-B', false); await hook.rerender(undefined);
  await act(async () => old.resolve([flag]));
  expect(hook.result.current.flags).toEqual([]); expect(hook.result.current.loading).toBe(false);
});
it('refuses retained moderation and refresh callbacks after account turnover', async () => {
  const hook = await renderHook(() => useAdminDashboard()); const outgoing = hook.result.current;
  mockAuth = auth('admin-B'); await hook.rerender(undefined); const reads = mockFlags.mock.calls.length;
  await act(async () => { await expect(outgoing.moderate(flag, 'remove')).rejects.toThrow('changed'); await outgoing.refresh(); });
  expect(mockModerate).not.toHaveBeenCalled(); expect(mockFlags).toHaveBeenCalledTimes(reads);
});
it('checks the account lifetime before React renders the incoming account', async () => {
  let live = true; mockAuth.isSessionCurrent = () => live;
  const hook = await renderHook(() => useAdminDashboard()); live = false;
  await act(async () => { await expect(hook.result.current.moderate(flag, 'remove')).rejects.toThrow('changed'); });
  expect(mockModerate).not.toHaveBeenCalled();
});
it('refuses a second moderation tap before busy has rendered', async () => {
  const held = deferred<void>(); mockModerate.mockReturnValueOnce(held.promise);
  const hook = await renderHook(() => useAdminDashboard()); let first!: Promise<unknown>; let second!: Promise<unknown>;
  await act(async () => { first = hook.result.current.moderate(flag, 'remove'); second = hook.result.current.moderate(flag, 'dismiss').catch((e) => e); });
  await act(async () => { held.resolve(undefined); await first; });
  expect(await second).toBeInstanceOf(Error); expect(mockModerate).toHaveBeenCalledTimes(1);
});
it('keeps only the latest refresh when responses complete out of order', async () => {
  const hook = await renderHook(() => useAdminDashboard()); const older = deferred<AdminFlagRow[]>(); const newer = deferred<AdminFlagRow[]>();
  mockFlags.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise); let a!: Promise<void>; let b!: Promise<void>;
  await act(async () => { a = hook.result.current.refresh(); b = hook.result.current.refresh(); });
  await act(async () => { newer.resolve([{ ...flag, id: 'newest' }]); await b; });
  await act(async () => { older.resolve([flag]); await a; });
  expect(hook.result.current.flags[0]?.id).toBe('newest');
});
