/** Sport participation reads stay bound to the subject and viewer account, including late responses. */
import { act, renderHook } from '@testing-library/react-native';
import { useAthleteSports } from '@/hooks/useAthleteSports';
import type { AthleteSportsSnapshot } from '@/lib/athleteSports';

const mockFetch = jest.fn();
let mockAccount = 'account-a';
const mockSessionCurrent = () => true;
jest.mock('@/lib/athleteSports', () => ({ fetchAthleteSports: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, isSessionCurrent: mockSessionCurrent }) }));
const snapshot = (profileId: string): AthleteSportsSnapshot => ({ profileId, primarySport: 'Football', revision: 2,
  sports: [{ sport: 'Football', schoolId: null, teamName: null, position: 'QB', jersey: '8' }] });
function deferred() {
  let resolve!: (value: AthleteSportsSnapshot | null) => void;
  const promise = new Promise<AthleteSportsSnapshot | null>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { mockAccount = 'account-a'; mockFetch.mockReset(); });

it('clears the old subject immediately and discards their delayed response', async () => {
  const a = deferred(); const b = deferred();
  mockFetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { result, rerender } = await renderHook(({ id }: { id: string }) => useAthleteSports(id), { initialProps: { id: 'profile-a' } });
  await rerender({ id: 'profile-b' });
  expect(result.current.snapshot).toBeNull();
  await act(async () => b.resolve(snapshot('profile-b')));
  await act(async () => a.resolve(snapshot('profile-a')));
  expect(result.current.snapshot?.profileId).toBe('profile-b');
});

it('rejects a server snapshot carrying the wrong subject identity', async () => {
  mockFetch.mockResolvedValue(snapshot('someone-else'));
  const { result } = await renderHook(() => useAthleteSports('profile-a'));
  await act(async () => {});
  expect(result.current.snapshot).toBeNull();
  expect(result.current.status).toBe('unavailable');
});

it('clears a private read after a viewer account switch', async () => {
  const a = deferred(); const b = deferred();
  mockFetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { result, rerender } = await renderHook(() => useAthleteSports('profile-a'));
  await act(async () => a.resolve(snapshot('profile-a')));
  mockAccount = 'account-b'; await rerender({});
  expect(result.current.snapshot).toBeNull();
  await act(async () => b.resolve(null));
  expect(result.current.status).toBe('unavailable');
});

it('never exposes data after the read is disabled and does not fetch without a subject', async () => {
  mockFetch.mockResolvedValue(snapshot('profile-a'));
  const { result, rerender } = await renderHook(({ id, enabled }: { id: string | null; enabled: boolean }) => useAthleteSports(id, enabled),
    { initialProps: { id: 'profile-a', enabled: true } });
  await act(async () => {});
  await rerender({ id: null, enabled: false });
  expect(result.current.snapshot).toBeNull(); expect(result.current.status).toBe('idle');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
