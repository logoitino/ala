/** Spotlight failures settle and retry without losing accepted awards or accepting departed/older requests. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSpotlightBoard } from '@/hooks/useSpotlightBoard';
import type { SpotlightAward } from '@/types/database';

const mockFetch = jest.fn();
let mockFocused = true;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => unknown) => {
  const React = require('react'); React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
} }));
jest.mock('@/lib/spotlight', () => ({
  fetchSpotlightBoard: (...args: unknown[]) => mockFetch(...args),
  hydrateSpotlightPlayer: (award: unknown) => award,
}));
const award = (id: string) => ({ id } as SpotlightAward);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => { mockFetch.mockReset(); mockFocused = true; });

it('settles a failed initial load and accepts a successful Retry', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Private SDK details')).mockResolvedValueOnce([award('recovered')]);
  const view = await renderHook(() => useSpotlightBoard());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.awards).toEqual([]);
  expect(view.result.current.error).toMatch(/try again/);
  expect(view.result.current.error).not.toMatch(/Private SDK/);
  await act(async () => { await view.result.current.refresh(); });
  expect(view.result.current.error).toBeNull();
  expect(view.result.current.awards).toEqual([award('recovered')]);
});

it('keeps the accepted board when a refresh fails and clears the error on recovery', async () => {
  mockFetch.mockResolvedValueOnce([award('accepted')]).mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce([award('recovered')]);
  const view = await renderHook(() => useSpotlightBoard());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => { await view.result.current.refresh(); });
  expect(view.result.current.awards).toEqual([award('accepted')]);
  expect(view.result.current.error).toMatch(/try again/);
  expect(view.result.current.loading).toBe(false);
  await act(async () => { await view.result.current.refresh(); });
  expect(view.result.current.error).toBeNull();
  expect(view.result.current.awards).toEqual([award('recovered')]);
});

it('refuses an older completion after a newer refresh', async () => {
  const old = deferred<SpotlightAward[]>(), fresh = deferred<SpotlightAward[]>();
  mockFetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const view = await renderHook(() => useSpotlightBoard());
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  let retry!: Promise<void>;
  await act(async () => { retry = view.result.current.refresh(); });
  await act(async () => { fresh.resolve([award('fresh')]); await retry; });
  await act(async () => { old.resolve([award('old')]); });
  expect(view.result.current.awards).toEqual([award('fresh')]);
  expect(view.result.current.loading).toBe(false);
});

it('does not accept a pending read after blur; refocus reloads with a new lifetime', async () => {
  const old = deferred<SpotlightAward[]>();
  mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce([award('refocused')]);
  const view = await renderHook(() => useSpotlightBoard());
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  mockFocused = false;
  await view.rerender(undefined);
  await act(async () => { old.resolve([award('old')]); });
  expect(view.result.current.awards).toEqual([]);
  mockFocused = true;
  await view.rerender(undefined);
  await waitFor(() => expect(view.result.current.awards).toEqual([award('refocused')]));
  expect(view.result.current.loading).toBe(false);
});

it('does not dispatch a retained refresh callback after unmount', async () => {
  mockFetch.mockResolvedValue([award('accepted')]);
  const view = await renderHook(() => useSpotlightBoard());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const refresh = view.result.current.refresh;
  await view.unmount();
  await refresh();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
