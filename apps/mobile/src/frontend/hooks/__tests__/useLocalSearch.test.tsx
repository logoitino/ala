/** Clearing/shortening search invalidates in-flight results; thrown reads settle the current spinner. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLocalSearch } from '@/hooks/useLocalSearch';
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
