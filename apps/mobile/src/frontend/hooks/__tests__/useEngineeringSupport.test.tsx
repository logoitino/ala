/** Support reads and mutation preflight remain isolated when admin identity/access changes. */
import { act, renderHook } from '@testing-library/react-native';
import { useEngineeringSupport } from '../useEngineeringSupport';
let mockIdentity = 'admin-one'; let mockAdmin = true; let mockFocused = true;
const mockRead = jest.fn(); const mockReview = jest.fn(); const mockSession = jest.fn();
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockIdentity }, profile: { is_admin: mockAdmin }, loading: false }) }));
jest.mock('@/lib/engineeringSupport', () => ({ fetchEngineeringSupport: () => mockRead(), recordSupportReview: (value: unknown, token: string) => mockReview(value, token), registerSupportRelease: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: () => mockSession() } } }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const data = (read_at: string) => ({ snapshot: { read_at }, error: null });
const input = { fingerprint: 'highlights:render_failure:client:test:detect-02', disposition: 'resolved' as const, rationale: 'Verified repair.', reviewedThrough: '2026-10-13T10:00:00Z' };
beforeEach(() => { mockIdentity = 'admin-one'; mockAdmin = true; mockFocused = true; mockRead.mockReset().mockResolvedValue(data('first')); mockReview.mockReset().mockResolvedValue(undefined); mockSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'fixed-session-token', user: { id: 'admin-one' } } } }); });
it('denies fan reads and writes', async () => { mockAdmin = false; const view = await renderHook(useEngineeringSupport); await act(async () => view.result.current.review(input)); expect(mockRead).not.toHaveBeenCalled(); expect(mockReview).not.toHaveBeenCalled(); expect(view.result.current.snapshot).toBeNull(); });
it('drops old admin results after account changes', async () => { const old = deferred<ReturnType<typeof data>>(); const next = deferred<ReturnType<typeof data>>(); mockRead.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise); const view = await renderHook(useEngineeringSupport); mockIdentity = 'admin-two'; await view.rerender(undefined); await act(async () => old.resolve(data('private'))); expect(view.result.current.snapshot).toBeNull(); await act(async () => next.resolve(data('new'))); expect(view.result.current.snapshot?.read_at).toBe('new'); });
it('checks current session before sending a retained review', async () => { const session = deferred<unknown>(); mockSession.mockReturnValueOnce(session.promise); const view = await renderHook(useEngineeringSupport); let pending!: Promise<void>; await act(async () => { pending = view.result.current.review(input); }); mockIdentity = 'admin-two'; await view.rerender(undefined); await act(async () => { session.resolve({ data: { session: { access_token: 'fixed-session-token', user: { id: 'admin-one' } } } }); await pending; }); expect(mockReview).not.toHaveBeenCalled(); expect(view.result.current.message).toBeNull(); });
it('invalidates access/focus and retained refresh callbacks', async () => { const view = await renderHook(useEngineeringSupport); const refresh = view.result.current.refresh; mockAdmin = false; await view.rerender(undefined); const calls = mockRead.mock.calls.length; await act(async () => refresh()); expect(mockRead).toHaveBeenCalledTimes(calls); expect(view.result.current.snapshot).toBeNull(); mockAdmin = true; mockFocused = false; await view.rerender(undefined); expect(view.result.current.loading).toBe(false); });

it('a prior account completion cannot disable or unlock a new account write', async () => {
 const old = deferred<void>(); const next = deferred<void>(); mockReview.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
 const view = await renderHook(useEngineeringSupport); let first!: Promise<void>; let second!: Promise<void>;
 await act(async () => { first = view.result.current.review(input); }); expect(view.result.current.busy).toBe(true);
 mockIdentity = 'admin-two'; mockSession.mockResolvedValue({ data: { session: { access_token: 'fixed-session-token', user: { id: 'admin-two' } } } }); await view.rerender(undefined); expect(view.result.current.busy).toBe(false);
 await act(async () => { second = view.result.current.review(input); }); expect(view.result.current.busy).toBe(true);
 await act(async () => { old.resolve(); await first; }); expect(view.result.current.busy).toBe(true); expect(view.result.current.message).toBeNull();
 await act(async () => { next.resolve(); await second; }); expect(view.result.current.busy).toBe(false);
});

it('pins the preflight session token for the actual mutation', async () => { const view = await renderHook(useEngineeringSupport); await act(async () => view.result.current.review(input)); expect(mockReview).toHaveBeenCalledWith(input, 'fixed-session-token'); });
