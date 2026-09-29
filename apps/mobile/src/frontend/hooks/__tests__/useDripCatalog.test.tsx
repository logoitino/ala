import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDripCatalog } from '@/hooks/useDripCatalog';
import type { DripItem } from '@/data/shop';

const mockFetchLiveDripItems = jest.fn<Promise<DripItem[]>, []>();

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('@/lib/adminCatalog', () => ({
  fetchLiveDripItems: () => mockFetchLiveDripItems(),
}));

describe('useDripCatalog', () => {
  beforeEach(() => {
    mockFetchLiveDripItems.mockReset();
  });

  it('preserves a real empty catalog instead of replacing it with seed products', async () => {
    mockFetchLiveDripItems.mockResolvedValue([]);
    const { result } = await renderHook(() => useDripCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failure and retries', async () => {
    mockFetchLiveDripItems.mockRejectedValueOnce(new Error('Rack offline')).mockResolvedValueOnce([]);
    const { result } = await renderHook(() => useDripCatalog());
    await waitFor(() => expect(result.current.error).toBe('Rack offline'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
  });
});
