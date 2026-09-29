import { renderHook } from '@testing-library/react-native';

import { useActivityFeed } from '@/hooks/useActivityFeed';

let mockPlayerId: string | null = 'player-me';
let mockTags: { id: string; player_id: string; title: string; created_at: string }[] = [];
let mockThanks: {
  tipId: string;
  playerId: string;
  athleteName: string;
  messageKey: 'malo';
  amountCents: number;
  thankedAt: string;
}[] = [];
let mockErrors: { received: string | null; sent: string | null; tags: string | null; thanks: string | null } = {
  received: null,
  sent: null,
  tags: null,
  thanks: null,
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
  useMyDonationThanks: () => ({ rows: mockThanks, loading: false, error: mockErrors.thanks, refresh: jest.fn() }),
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
  mockThanks = [];
  mockErrors = { received: null, sent: null, tags: null, thanks: null };
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

  it('keeps the athlete id on a received thank-you so Activity can open that profile', async () => {
    mockThanks = [{
      tipId: 'tip-1',
      playerId: 'player-kaleo',
      athleteName: 'Kaleo',
      messageKey: 'malo',
      amountCents: 500,
      thankedAt: '2026-09-29T12:00:00Z',
    }];
    const { result } = await renderHook(() => useActivityFeed());
    expect(result.current.items[0]).toMatchObject({
      id: 'thanks:tip-1',
      kind: 'thanks_received',
      playerId: 'player-kaleo',
    });
  });

  it('includes thank-you failures in the shared retry state', async () => {
    mockErrors.thanks = 'thanks unavailable';
    const { result } = await renderHook(() => useActivityFeed());
    expect(result.current.error).toBe('thanks unavailable');
  });
});
