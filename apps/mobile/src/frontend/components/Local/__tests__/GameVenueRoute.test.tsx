/** LOCAL-02: a slow overview/roster read must not restore an old destination after a live correction or address clear. */
import { act, render, screen } from '@testing-library/react-native';
import GameOverviewScreen from '../../../../../app/(guest)/game/[id]';
import { fetchGuestGameOverview, subscribeToGuestGame } from '@/lib/guestGames';
import type { Game } from '@/types/database';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => ({ id: 'g1' }), Stack: { Screen: () => null } }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/Reels/LiveMatchBanner', () => ({ LiveMatchBanner: () => null }));
jest.mock('@/components/PlayCard', () => ({ PlayCard: () => null, resolveEventPlayer: () => null }));
jest.mock('@/components/Local/PlayerListItem', () => ({ PlayerListItem: () => null }));
jest.mock('@/services/TelemetryManager', () => ({ TelemetryManager: { getInstance: () => ({ trackFeature: jest.fn(), trackIssue: jest.fn() }) } }));
jest.mock('@/lib/guestGames', () => ({ fetchGuestGameOverview: jest.fn(), subscribeToGuestGame: jest.fn(), fetchGuestGameEvent: jest.fn() }));
jest.mock('@/lib/favorites', () => ({ loadFavoritePlayerIds: async () => [], saveFavoritePlayerIds: jest.fn() }));

const game: Game = { id: 'g1', home_team: 'Home', away_team: 'Away', home_school: 'Home School', away_school: 'Away School', home_score: 0, away_score: 0, status: 'live', venue: 'Tournament Gym', venue_school: 'Neutral School', venue_address: 'Old address', is_active: true };

it.each(['Corrected address', ''])('keeps the live venue %s when an older overview finishes later', async (address) => {
  let finish!: (value: Awaited<ReturnType<typeof fetchGuestGameOverview>>) => void;
  let onGame!: (row: Game) => void;
  jest.mocked(fetchGuestGameOverview).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  jest.mocked(subscribeToGuestGame).mockImplementation((_id, callbacks) => { onGame = callbacks.onGame; return () => {}; });
  await render(<GameOverviewScreen />);
  await act(async () => onGame({ ...game, venue_address: address }));
  await act(async () => finish({ game, players: [], events: [], error: null, feedError: null }));
  expect(screen.getByText(address || 'Address TBA')).toBeTruthy();
  expect(screen.queryByText('Old address')).toBeNull();
  if (!address) expect(screen.queryByRole('button', { name: 'Get directions' })).toBeNull();
});
