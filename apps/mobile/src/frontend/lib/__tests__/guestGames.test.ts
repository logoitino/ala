/** Guest match extraction: feed failures must leave the match usable and late live updates must stop after cleanup. */
import { fetchGuestGameEvent, fetchGuestGameOverview, subscribeToGuestGame } from '@/lib/guestGames';
import { fetchGuestPlayer } from '@/lib/roster';

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();
let mockConfigured = true;

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  nextRealtimeTopic: (topic: string) => topic,
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

function query(result: unknown) {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of ['select', 'eq', 'single', 'order', 'limit']) chain[method] = jest.fn(() => chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = true;
});

it('keeps the game and roster when the play feed fails', async () => {
  const game = { id: 'game-1', home_team: 'Home' };
  const players = [{ id: 'player-1', name: 'Athlete' }];
  mockFrom.mockImplementation((table) => query({
    games: { data: game, error: null },
    players: { data: players, error: null },
    game_events: { data: null, error: { message: 'Feed unavailable' } },
  }[table as 'games' | 'players' | 'game_events']));

  await expect(fetchGuestGameOverview('game-1')).resolves.toEqual({
    game, players, events: [], error: null, feedError: 'Feed unavailable',
  });
});

it('lets the route fall back to its cached athlete when a live play join fails', async () => {
  mockFrom.mockReturnValue(query({ data: null, error: { message: 'Join unavailable' } }));
  await expect(fetchGuestGameEvent('event-1')).resolves.toBeNull();
});

it('ignores another match and stops delivering live updates after channel cleanup', () => {
  const handlers: Array<(payload: { new: unknown }) => void> = [];
  const channel = { on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockImplementation((_event, _filter, callback) => {
    handlers.push(callback);
    return channel;
  });
  channel.subscribe.mockReturnValue(channel);
  mockChannel.mockReturnValue(channel);
  const onGame = jest.fn();
  const onEvent = jest.fn();
  const stop = subscribeToGuestGame('game-1', { onGame, onEvent });
  handlers[0]({ new: { id: 'game-1' } });
  handlers[1]({ new: { id: 'other', game_id: 'game-2' } });
  handlers[1]({ new: { id: 'play', game_id: 'game-1' } });
  expect(onGame).toHaveBeenCalledTimes(1);
  expect(onEvent).toHaveBeenCalledTimes(1);

  stop();
  handlers[0]({ new: { id: 'game-1' } });
  handlers[1]({ new: { id: 'late-play', game_id: 'game-1' } });
  expect(onGame).toHaveBeenCalledTimes(1);
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
});

it('preserves player lookup failures for the guest retry screen', async () => {
  mockFrom.mockReturnValue(query({ data: null, error: { message: 'Player lookup unavailable' } }));
  await expect(fetchGuestPlayer('player-1')).resolves.toEqual({ player: null, error: 'Player lookup unavailable' });
  mockFrom.mockReturnValue(query({ data: null, error: null }));
  await expect(fetchGuestPlayer('player-1')).resolves.toEqual({ player: null, error: 'Player not found.' });
});

it('does not query or subscribe when the client is unconfigured', async () => {
  mockConfigured = false;
  expect((await fetchGuestGameOverview('game-1')).error).toContain('EXPO_PUBLIC_SUPABASE_URL');
  expect((await fetchGuestPlayer('player-1')).error).toContain('EXPO_PUBLIC_SUPABASE_URL');
  subscribeToGuestGame('game-1', { onGame: jest.fn(), onEvent: jest.fn() })();
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockChannel).not.toHaveBeenCalled();
});
