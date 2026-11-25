/** Search never reuses stale results or restores cleared history during hydration. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLocalSearch, useRecentLocalSearches } from '@/hooks/useLocalSearch';
import type { LocalSearchHit } from '@/types/database';
const mockSearch = jest.fn();
jest.mock('@/lib/localSearch', () => ({ searchLocalEntities: (...args: unknown[]) => mockSearch(...args) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));
beforeEach(() => mockSearch.mockReset());
it.each(['', 'a'])('refuses an issued old result after query becomes %j', async (short) => {
  let release!: (rows: unknown[]) => void;
  mockSearch.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const { result, rerender } = await renderHook(({query}: { query: string }) => useLocalSearch(query, 'all'), { initialProps: {query:'Kaleo'} });
  await waitFor(() => expect(mockSearch).toHaveBeenCalled());
  await rerender({ query: short });
  await act(async () => release([{ id:'old', label:'Kaleo', kind:'athlete' }]));
  expect(result.current.hits).toEqual([]);
  expect(result.current.loading).toBe(false);
});
it('settles a thrown reader without leaving the drawer loading', async () => {
  mockSearch.mockRejectedValue(new Error('Network unavailable'));
  const { result } = await renderHook(() => useLocalSearch('Kaleo', 'all'));
  await waitFor(() => expect(mockSearch).toHaveBeenCalled());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.hits).toEqual([]);
});

it('hides settled rows immediately when switching filters and replaces them when the new read settles', async () => {
  const athlete: LocalSearchHit = { entity_type: 'athlete', entity_id: 'a1', title: 'Kaleo', subtitle: '' };
  const school: LocalSearchHit = { entity_type: 'school', entity_id: 's1', title: 'Kaleo Academy', subtitle: '' };
  mockSearch.mockResolvedValueOnce([athlete]).mockResolvedValueOnce([school]);
  const { result, rerender } = await renderHook(
    ({ kind }: { kind: 'athlete' | 'school' }) => useLocalSearch('  Kaleo  ', kind),
    { initialProps: { kind: 'athlete' } },
  );
  await waitFor(() => expect(result.current.hits).toEqual([athlete]));
  await rerender({ kind: 'school' });
  expect(result.current).toEqual({ hits: [], loading: true });
  await waitFor(() => expect(result.current).toEqual({ hits: [school], loading: false }));
  expect(mockSearch).toHaveBeenLastCalledWith('Kaleo', 'school');
});

it('shares recent history across drawers and ignores history that loads after Clear all', async () => {
  let release!: (raw: string) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const home = await renderHook(useRecentLocalSearches);
  const local = await renderHook(useRecentLocalSearches);
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);

  const pending = home.result.current.remember('Outdated');
  await act(async () => { await local.result.current.clearRecent(); release('["Earlier search"]'); await pending; });
  expect(home.result.current.recent).toEqual([]);
  expect(local.result.current.recent).toEqual([]);

  await act(async () => {
    await home.result.current.remember('Kaleo');
    await local.result.current.remember('Kahuku');
    await local.result.current.remember('  kaleo  ');
  });
  expect(home.result.current.recent).toEqual(['kaleo', 'Kahuku']);
  expect(local.result.current.recent).toEqual(['kaleo', 'Kahuku']);
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('tapuai.localSearchRecent', '["kaleo","Kahuku"]');
});
