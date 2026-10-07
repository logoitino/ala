/** A slower previous match must never replace the current match or end its loading state. */
import { act, render, screen } from '@testing-library/react-native';
import GameOverviewScreen from '../[id]';
import type { fetchGuestGameOverview } from '@/lib/guestGames';

let mockGameId = 'game-a';
const mockOverview = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockGameId }),
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/guestGames', () => ({
  fetchGuestGameOverview: (...args: unknown[]) => mockOverview(...args),
  fetchGuestGameEvent: jest.fn(),
  subscribeToGuestGame: () => () => {},
}));
jest.mock('@/lib/favorites', () => ({ loadFavoritePlayerIds: async () => [], saveFavoritePlayerIds: jest.fn() }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: require('react-native').Pressable }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: require('react-native').View }));
jest.mock('@/components/PlayCard', () => ({ PlayCard: () => null, resolveEventPlayer: () => null }));
jest.mock('@/components/Reels/LiveMatchBanner', () => ({
  LiveMatchBanner: ({ gameId }: { gameId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`match:${gameId}`}</Text>;
  },
}));
jest.mock('@/components/Local/NotificationPrefsBar', () => ({ NotificationPrefsBar: () => null }));
jest.mock('@/components/Local/PlayerListItem', () => ({ PlayerListItem: () => null }));
jest.mock('@/components/Local/TabSwitcher', () => ({ TabSwitcher: () => null }));

type Overview = Awaited<ReturnType<typeof fetchGuestGameOverview>>;
function pendingOverview() {
  let resolve!: (result: Overview) => void;
  const promise = new Promise<Overview>((finish) => { resolve = finish; });
  return { promise, resolve };
}
function overview(id: string): Overview {
  return { game: { id } as NonNullable<Overview['game']>, players: [], events: [], error: null, feedError: null };
}

beforeEach(() => {
  mockGameId = 'game-a';
  mockOverview.mockReset();
});

it('keeps the new match loading when the previous match fails late', async () => {
  const old = pendingOverview();
  const current = pendingOverview();
  mockOverview.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const view = await render(<GameOverviewScreen />);
  mockGameId = 'game-b';
  await view.rerender(<GameOverviewScreen />);
  await act(async () => { old.resolve({ ...overview('game-a'), game: null, error: 'Old match failure' }); });
  expect(screen.getByText('Loading game…')).toBeTruthy();
  expect(screen.queryByText('Old match failure')).toBeNull();
  await act(async () => { current.resolve(overview('game-b')); });
  expect(screen.getByText('match:game-b')).toBeTruthy();
});

it('keeps the new match when the previous match succeeds late', async () => {
  const old = pendingOverview();
  const current = pendingOverview();
  mockOverview.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const view = await render(<GameOverviewScreen />);
  mockGameId = 'game-b';
  await view.rerender(<GameOverviewScreen />);
  await act(async () => { current.resolve(overview('game-b')); });
  await act(async () => { old.resolve(overview('game-a')); });
  expect(screen.getByText('match:game-b')).toBeTruthy();
  expect(screen.queryByText('match:game-a')).toBeNull();
});
