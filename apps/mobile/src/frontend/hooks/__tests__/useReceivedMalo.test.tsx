/** Gift totals use a stable current Auth owner fixture; missing/denied reads preserve visible error and empty-state assertions. */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useReceivedMalo } from '@/hooks/useReceivedMalo';

const mockAuthGuard = () => true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer-current' }, isSessionCurrent: mockAuthGuard }) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (userId: string) => ({ userId, isCurrent: mockAuthGuard }) } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
const mockRpc = jest.fn();
const mockTrackIssue = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@/services/TelemetryManager', () => ({
  telemetry: { trackIssue: (...args: unknown[]) => mockTrackIssue(...args) },
}));

describe('useReceivedMalo', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockTrackIssue.mockReset();
  });

  it('shows an unavailable ledger and retries instead of calling a failed read empty', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.get_received_malo' },
    });
    const { result } = await renderHook(() => useReceivedMalo('player-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.totalCents).toBe(0);
    expect(result.current.error).toMatch(/Could not load gifts/);
    mockRpc.mockResolvedValue({ data: [], error: null });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toEqual([]);
    expect(mockTrackIssue).toHaveBeenCalledWith('received_malo_unavailable', 'profile');
  });

  it('sums the gifts that came back', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 't1',
          amount_cents: 500,
          aura_points: 5,
          created_at: '2026-10-01T00:00:00Z',
          origin: 'profile',
          entry: 'in_app',
          source_label: '',
          reel_id: null,
          wishlist_item_id: null,
          fan_name: 'Sina',
        },
      ],
      error: null,
    });
    const { result } = await renderHook(() => useReceivedMalo('player-1'));
    await waitFor(() => expect(result.current.totalCents).toBe(500));
    expect(result.current.error).toBeNull();
    expect(mockTrackIssue).not.toHaveBeenCalled();
  });
});
