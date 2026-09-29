import { renderHook } from '@testing-library/react-native';

import { useActivityFeed } from '@/hooks/useActivityFeed';

let mockPlayerId: string | null = 'player-me';
let mockTags: { id: string; player_id: string; title: string; created_at: string }[] = [];
let mockErrors: { received: string | null; sent: string | null; tags: string | null } = {
  received: null,
  sent: null,
  tags: null,
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ profile: mockPlayerId ? { player_id: mockPlayerId } : null }),
}));
jest.mock('@/hooks/useReceivedMalo', () => ({
  useReceivedMalo: () => ({ rows: [], loading: false, error: mockErrors.received, refresh: jest.fn() }),
}));
jest.mock('@/hooks/useFanTipHistory', () => ({
  useFanTipHistory: () => ({ receipts: [], loading: false, error: mockErrors.sent, refresh: jest.fn() }),
}));
jest.mock('@/hooks/useDonationThanks', () => ({
  useMyDonationThanks: () => ({ rows: [], loading: false, refresh: jest.fn() }),
}));
jest.mock('@/hooks/usePendingPlayerTags', () => ({
  usePendingPlayerTags: () => ({ tags: mockTags, loading: false, error: mockErrors.tags, refresh: jest.fn() }),
}));

const tag = (id: string, playerId: string) => ({
  id,
  player_id: playerId,
  title: `Clip ${id}`,
  created_at: '2026-09-28T12:00:00Z',
});

beforeEach(() => {
  mockPlayerId = 'player-me';
  mockTags = [];
  mockErrors = { received: null, sent: null, tags: null };
});

describe('useActivityFeed', () => {
  it('only lists pending tags on the viewer’s own player, not every tag an admin may confirm', async () => {
    mockTags = [tag('mine', 'player-me'), tag('other-1', 'player-x'), tag('other-2', 'player-y')];
    const { result } = await renderHook(() => useActivityFeed());
    expect(result.current.items.map((item) => item.id)).toEqual(['tag:mine']);
    expect(result.current.unseenCount).toBe(1);
  });

  it('shows no tags at all for an account with no linked player', async () => {
    mockPlayerId = null;
    mockTags = [tag('other', 'player-x')];
    const { result } = await renderHook(() => useActivityFeed());
    expect(result.current.items).toEqual([]);
    expect(result.current.unseenCount).toBe(0);
  });

  it('reports a source failure instead of looking like an empty feed', async () => {
    mockErrors.sent = 'network down';
    const { result } = await renderHook(() => useActivityFeed());
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('network down');
  });
});
