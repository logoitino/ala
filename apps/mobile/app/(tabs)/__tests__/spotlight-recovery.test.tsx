/** The real Spotlight route exposes its read failure and Retry without hiding accepted awards or claiming emptiness. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SpotlightTab from '../spotlight';
import type { SpotlightAward } from '@/types/database';

const mockFetch = jest.fn();
let mockPullRefresh: () => void;
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, usePathname: () => '/spotlight',
  useFocusEffect: (callback: () => unknown) => {
    const React = require('react'); React.useEffect(callback, [callback]);
  },
}));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({
  live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME,
}) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/lib/spotlight', () => ({
  fetchSpotlightBoard: (...args: unknown[]) => mockFetch(...args),
  hydrateSpotlightPlayer: (award: unknown) => award,
}));
jest.mock('@/hooks/useLeaderboards', () => ({ useLeaderboards: () => ({ unavailable: true, refresh: jest.fn() }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], applyBackerCount: jest.fn() }) }));
jest.mock('@/hooks/useSurfaceUsage', () => ({ useSurfaceUsage: () => ({ onScroll: jest.fn(), trackFeature: jest.fn() }) }));
jest.mock('@/hooks/useViewerSport', () => ({ useViewerSport: () => 'Football' }));
jest.mock('@/components/Effects/ScrollFx', () => ({
  ScrollFxItem: ({ children }: { children: React.ReactNode }) => children,
  ScrollFxParallax: ({ children }: { children: React.ReactNode }) => children,
  ScrollFxScrollView: ({ children, refreshControl }: { children: React.ReactNode; refreshControl: React.ReactElement<{ onRefresh: () => void }> }) => {
    // Native RefreshControl is opaque to this renderer; exercise the actual route-provided callback.
    mockPullRefresh = refreshControl.props.onRefresh;
    return children;
  },
}));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: jest.requireActual('react-native').Pressable }));
jest.mock('@/components/Effects/SportField', () => ({ SportField: () => null }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/components/Spotlight/SpotlightAwardCard', () => ({ SpotlightAwardCard: ({ award }: { award: SpotlightAward }) => {
  const { Text } = jest.requireActual('react-native'); return <Text>{award.headline}</Text>;
} }));
jest.mock('@/components/Spotlight/SpotlightModal', () => ({ SpotlightModal: () => null }));
jest.mock('@/components/Spotlight/LeaderboardsBoard', () => ({ LeaderboardsBoard: () => null }));
jest.mock('@/components/Reels/ReelViewModal', () => ({ ReelViewModal: () => null }));
jest.mock('@/components/TipSheetModal', () => ({ MaloTipModal: () => null }));

beforeEach(() => {
  mockFetch.mockReset();
});

it('shows Retry for initial failure and renders the recovered board after that action', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Read failed')).mockResolvedValueOnce([
    { id: 'real-award', headline: 'Published recognition' } as SpotlightAward,
  ]);
  await render(<SpotlightTab />);
  await waitFor(() => expect(screen.getByRole('header', { name: 'Could not load Spotlights' })).toBeTruthy());
  const empty = jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME.copy.spotlightEmpty;
  expect(screen.queryByText(empty)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Retry'));
  await waitFor(() => expect(screen.getByText('Published recognition')).toBeTruthy());
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Could not load Spotlights')).toBeNull();
});

it('keeps a populated board visible alongside a failed refresh and its Retry', async () => {
  mockFetch.mockResolvedValueOnce([{ id: 'real-award', headline: 'Last accepted award' } as SpotlightAward])
    .mockRejectedValueOnce(new Error('Offline'));
  await render(<SpotlightTab />);
  await waitFor(() => expect(screen.getByText('Last accepted award')).toBeTruthy());
  await act(async () => { mockPullRefresh(); });
  await waitFor(() => expect(screen.getByLabelText('Retry')).toBeTruthy());
  expect(screen.getByText('Last accepted award')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Could not load Spotlights' })).toBeTruthy();
});
