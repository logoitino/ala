/** Write choices must come from stored active rows and never cross an account lifetime. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoredSportChoices } from '@/hooks/useStoredSportChoices';
const mockFetch = jest.fn();
let mockAccount = 'owner-a';
let mockGuard = () => true;
jest.mock('@/lib/sports', () => ({ fetchStoredSportConfigs: () => mockFetch() }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, isSessionCurrent: mockGuard }) }));
beforeEach(() => { mockFetch.mockReset(); mockAccount = 'owner-a'; mockGuard = () => true; });
it('never supplies starter choices for unavailable or empty storage', async () => {
  mockFetch.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
  const view = await renderHook<ReturnType<typeof useStoredSportChoices>, { enabled: boolean }>(({ enabled }) => useStoredSportChoices(enabled), { initialProps: { enabled: true } });
  await waitFor(() => expect(view.result.current.status).toBe('unavailable'));
  expect(view.result.current.sportNames).toEqual([]);
  await view.rerender({ enabled: false }); await view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  expect(view.result.current.sportNames).toEqual([]);
});
it('offers only active stored rows', async () => {
  mockFetch.mockResolvedValue([{ sport: 'Football', isActive: true }, { sport: 'Volleyball', isActive: false }]);
  const view = await renderHook(() => useStoredSportChoices(), { initialProps: {} });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  expect(view.result.current.sportNames).toEqual(['Football']);
});
it('suppresses a deferred earlier-account catalog', async () => {
  let resolve!: (value: unknown[]) => void;
  mockFetch.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce([]);
  const view = await renderHook(() => useStoredSportChoices(), { initialProps: {} });
  mockAccount = 'owner-b'; mockGuard = () => true;
  await view.rerender({});
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  await act(async () => resolve([{ sport: 'Football', isActive: true }]));
  expect(view.result.current.sportNames).toEqual([]);
});
it('hides prior-visit choices on the first reopened render before the new read resolves', async () => {
  let resolve!: (value: unknown[]) => void;
  mockFetch.mockResolvedValueOnce([{ sport: 'Football', isActive: true }]).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const observed: ReturnType<typeof useStoredSportChoices>[] = [];
  const view = await renderHook<ReturnType<typeof useStoredSportChoices>, { enabled: boolean }>(({ enabled }) => {
    const result = useStoredSportChoices(enabled); observed.push(result); return result;
  }, { initialProps: { enabled: true } });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  await view.rerender({ enabled: false }); observed.length = 0;
  await view.rerender({ enabled: true });
  expect(observed[0]).toEqual(expect.objectContaining({ status: 'loading', sportNames: [] }));
  await act(async () => resolve([{ sport: 'Volleyball', isActive: true }]));
  expect(view.result.current.sportNames).toEqual(['Volleyball']);
});
it('retries unavailable storage in place and suppresses the earlier request delivery', async () => {
  let resolve!: (value: unknown[]) => void;
  mockFetch.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(null).mockResolvedValueOnce([{ sport: 'Volleyball', isActive: true }]);
  const view = await renderHook(() => useStoredSportChoices());
  await act(async () => view.result.current.reload());
  await waitFor(() => expect(view.result.current.status).toBe('unavailable'));
  await act(async () => resolve([{ sport: 'Football', isActive: true }]));
  expect(view.result.current.sportNames).toEqual([]);
  await act(async () => view.result.current.reload());
  await waitFor(() => expect(view.result.current.sportNames).toEqual(['Volleyball']));
});
