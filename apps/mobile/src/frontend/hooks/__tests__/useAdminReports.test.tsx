/** ADM-02: admin report reads cannot survive loss of access, identity changes or newer refreshes. */
import { act, renderHook } from '@testing-library/react-native';
import { useAdminReports } from '@/hooks/useAdminReports';
import { emptyAdminReportData } from '@/lib/adminReports';

let mockIdentity = 'admin-one';
let mockAdmin = true;
let mockAuthLoading = false;
let mockFocused = true;
const mockFetch = jest.fn();
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockIdentity ? { id: mockIdentity } : null, profile: { is_admin: mockAdmin }, loading: mockAuthLoading }),
}));
jest.mock('@/lib/adminReports', () => ({
  ...jest.requireActual('@/lib/adminReports'),
  fetchAdminReportData: (...args: unknown[]) => mockFetch(...args),
}));

function deferred() {
  let resolve!: (value: ReturnType<typeof emptyAdminReportData>) => void;
  const promise = new Promise<ReturnType<typeof emptyAdminReportData>>((done) => { resolve = done; });
  return { promise, resolve };
}
function snapshot(marker: string) {
  const data = emptyAdminReportData();
  data.reports.generatedAt = marker;
  data.reports.configured = true;
  return data;
}
beforeEach(() => {
  mockIdentity = 'admin-one'; mockAdmin = true; mockAuthLoading = false; mockFocused = true;
  mockFetch.mockReset(); mockFetch.mockResolvedValue(snapshot('initial'));
});

it('explains disabled report access without treating Studio or a fan as a report admin', async () => {
  mockAuthLoading = true;
  const view = await renderHook(() => useAdminReports());
  expect(view.result.current.enabled).toBe(false);
  expect(view.result.current.disabledReason).toBeNull();
  mockAuthLoading = false; mockIdentity = '';
  await view.rerender(undefined);
  expect(view.result.current.disabledReason).toBe('Sign in with an admin account to load reports.');
  mockIdentity = 'studio-user'; mockAdmin = false;
  await view.rerender(undefined);
  expect(view.result.current.disabledReason).toBe('Reports require an authenticated admin account. Studio preview does not grant report access.');
  expect(mockFetch).not.toHaveBeenCalled();
  mockAdmin = true;
  await view.rerender(undefined);
  expect(view.result.current.enabled).toBe(true);
  expect(view.result.current.disabledReason).toBeNull();
});

it('does not read reports while auth loads or a fan owns the session', async () => {
  mockAuthLoading = true;
  const view = await renderHook(() => useAdminReports());
  expect(mockFetch).not.toHaveBeenCalled();
  mockAuthLoading = false; mockAdmin = false;
  await view.rerender(undefined);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(view.result.current.reports.generatedAt).toBeNull();
});

it('clears old data immediately and rejects an old account response after identity changes', async () => {
  const first = deferred(); const second = deferred();
  mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view = await renderHook(() => useAdminReports());
  mockIdentity = 'admin-two'; await view.rerender(undefined);
  expect(view.result.current.reports.generatedAt).toBeNull();
  await act(async () => first.resolve(snapshot('old admin')));
  expect(view.result.current.reports.generatedAt).toBeNull();
  await act(async () => second.resolve(snapshot('new admin')));
  expect(view.result.current.reports.generatedAt).toBe('new admin');
});

it('only adopts the newest refresh when responses arrive out of order', async () => {
  const view = await renderHook(() => useAdminReports());
  const older = deferred(); const newer = deferred();
  mockFetch.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  let olderRefresh!: Promise<void>; let newerRefresh!: Promise<void>;
  await act(async () => { olderRefresh = view.result.current.refresh(); newerRefresh = view.result.current.refresh(); });
  await act(async () => { newer.resolve(snapshot('newest')); await newerRefresh; });
  await act(async () => { older.resolve(snapshot('obsolete')); await olderRefresh; });
  expect(view.result.current.reports.generatedAt).toBe('newest');
});

it('invalidates an in-flight report when admin access is revoked', async () => {
  const pending = deferred(); mockFetch.mockReturnValueOnce(pending.promise);
  const view = await renderHook(() => useAdminReports());
  mockAdmin = false; await view.rerender(undefined);
  await act(async () => pending.resolve(snapshot('private')));
  expect(view.result.current.reports.generatedAt).toBeNull();
  expect(view.result.current.loading).toBe(false);
});

it('does not revive a prior snapshot when the same account regains admin access', async () => {
  const view = await renderHook(() => useAdminReports());
  expect(view.result.current.reports.generatedAt).toBe('initial');
  mockAdmin = false; await view.rerender(undefined);
  const fresh = deferred(); mockFetch.mockReturnValueOnce(fresh.promise);
  mockAdmin = true; await view.rerender(undefined);
  expect(view.result.current.reports.generatedAt).toBeNull();
  await act(async () => fresh.resolve(snapshot('fresh authorization')));
  expect(view.result.current.reports.generatedAt).toBe('fresh authorization');
});

it('a retained refresh callback cannot read after logout', async () => {
  const view = await renderHook(() => useAdminReports());
  const previousRefresh = view.result.current.refresh;
  const calls = mockFetch.mock.calls.length;
  mockIdentity = ''; await view.rerender(undefined);
  await act(async () => previousRefresh());
  expect(mockFetch).toHaveBeenCalledTimes(calls);
  expect(view.result.current.reports.generatedAt).toBeNull();
});

it('ignores a response after the report loses focus', async () => {
  const pending = deferred(); mockFetch.mockReturnValueOnce(pending.promise);
  const view = await renderHook(() => useAdminReports());
  mockFocused = false; await view.rerender(undefined);
  await act(async () => pending.resolve(snapshot('background')));
  expect(view.result.current.reports.generatedAt).toBeNull();
  expect(view.result.current.loading).toBe(false);
});
