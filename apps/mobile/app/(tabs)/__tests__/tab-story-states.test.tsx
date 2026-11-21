/** UX-07 route-state tests: truthful pending/filter states retain existing auth, admin and navigation boundaries. SDK58 shared fan presentation reads the route pathname from this boundary. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ActivityItem } from '@/hooks/useActivityFeed';
import type { DripItem } from '@/data/shop';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME } from '@/lib/runtime';
import SpotlightTab from '../spotlight';
import DripTab from '../drip';
import ActivityTab from '../activity';
import LocalTab from '../local';
import BeyondTab from '../beyond';

const mockPush = jest.fn();
let mockSpotlightActions: { onWatch: (reelId: string | null, playerId?: string) => void } | null = null;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockRequireAuth = jest.fn();
const mockTrackFeature = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
let mockCanGoBack = false;
let mockCompose: string | undefined;
let mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
let mockAuth: { user: { id: string } | null; profile: { player_id: string } | null; isAthlete: boolean; isAdmin: boolean };
let mockSpotlight = { awards: [] as unknown[], loading: false, refresh: mockRefresh };
let mockDrip = { items: [] as DripItem[], loading: false, error: null as string | null, refresh: mockRefresh };
let mockActivity = { items: [] as ActivityItem[], loading: false, error: null as string | null, refresh: mockRefresh };
let mockGames = { games: [], loading: false, error: null as string | null, refresh: mockRefresh };

jest.mock('expo-router', () => ({
  usePathname: () => '/local',
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ compose: mockCompose }),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
  router: {
    canGoBack: () => mockCanGoBack,
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
    setParams: (params: unknown) => mockSetParams(params),
  },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: mockLive }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/hooks/useSurfaceUsage', () => ({ useSurfaceUsage: () => ({ onScroll: jest.fn(), trackFeature: mockTrackFeature }) }));
jest.mock('@/hooks/useSpotlightBoard', () => ({ useSpotlightBoard: () => mockSpotlight }));
jest.mock('@/hooks/useLeaderboards', () => ({ useLeaderboards: () => ({ unavailable: true, refresh: mockRefresh }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], applyBackerCount: jest.fn() }) }));
jest.mock('@/hooks/useDripCatalog', () => ({ useDripCatalog: () => mockDrip }));
jest.mock('@/hooks/useActivityFeed', () => ({ useActivityFeed: () => mockActivity }));
// Notification inbox behavior is covered by its own hook/UI fixtures, outside this timeline test.
jest.mock('@/components/Activity/NotificationInbox', () => ({ NotificationInbox: () => null }));
jest.mock('@/hooks/useLiveScores', () => ({ useLiveScores: () => mockGames }));
jest.mock('@/hooks/useCheerPoll', () => ({ usePublishedCheerPolls: () => [] }));
jest.mock('@/hooks/useSponsorships', () => ({ useSponsorships: () => ({ sponsors: [], recordSponsorship: jest.fn() }) }));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/components/Effects/ScrollFx', () => {
  const { View, ScrollView } = require('react-native');
  return { ScrollFxItem: View, ScrollFxParallax: View, ScrollFxScrollView: ScrollView };
});
jest.mock('@/components/Spotlight/SpotlightAwardCard', () => ({ SpotlightAwardCard: () => null }));
jest.mock('@/components/Spotlight/SpotlightModal', () => ({ SpotlightModal: (props: typeof mockSpotlightActions) => { mockSpotlightActions = props; return null; } }));
jest.mock('@/components/Spotlight/LeaderboardsBoard', () => ({ LeaderboardsBoard: () => null }));
jest.mock('@/components/Reels/ReelViewModal', () => ({ ReelViewModal: () => null }));
jest.mock('@/components/TipSheetModal', () => ({ MaloTipModal: () => null }));
jest.mock('@/components/Drip/ProductSheet', () => ({ ProductSheet: () => null }));
jest.mock('@/components/Drip/GearCard', () => {
  const { Text } = require('react-native');
  return { GearCard: ({ item }: { item: DripItem }) => <Text>{item.name}</Text> };
});
jest.mock('@/components/Activity/CrewAlertsCard', () => ({ CrewAlertsCard: () => null }));
jest.mock('@/components/Activity/FriendRequestsCard', () => ({ FriendRequestsCard: () => null }));
jest.mock('@/components/Challenges/ChallengeInbox', () => ({ ChallengeInbox: () => null }));
jest.mock('@/components/Custodial/AthleteMoneyCard', () => ({ AthleteMoneyCard: () => null }));
jest.mock('@/components/Verification/AthleteVerificationCard', () => ({ AthleteVerificationCard: () => null }));
jest.mock('@/components/Verification/TeammateVouchCard', () => ({ TeammateVouchCard: () => null }));
jest.mock('@/components/Local/CheerPollCard', () => ({ CheerPollCard: () => null }));
jest.mock('@/components/Local/TopAuraBoosters', () => ({ TopAuraBoosters: () => null }));
jest.mock('@/components/Local/GameCard', () => ({ GameCard: () => null }));
jest.mock('@/components/Local/SponsorshipModal', () => ({ SponsorshipModal: () => null }));
jest.mock('@/components/Local/SearchResultsOverlay', () => ({ SearchResultsOverlay: () => null }));
jest.mock('@/components/FamilyFun/FamilyFunDiscovery', () => ({ FamilyFunDiscovery: () => null }));
jest.mock('@/components/BeyondGame/LegacyWorkoutList', () => ({ LegacyWorkoutList: () => null }));
jest.mock('@/components/BeyondGame/BeyondGameScreen', () => {
  const { Text, Pressable } = require('react-native');
  return { BeyondGameScreen: ({ startComposing, onComposeStarted }: { startComposing: boolean; onComposeStarted: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel="Existing composer ready" onPress={onComposeStarted}>
      <Text>{startComposing ? 'Composer requested' : 'Discovery requested'}</Text>
    </Pressable>
  ) };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
  mockLive.tabs.spotlight = mockLive.tabs.drip = mockLive.tabs.activity = mockLive.tabs.local = mockLive.tabs.beyond = true;
  mockLive.layouts.leaderboards = false;
  mockAuth = { user: { id: 'viewer' }, profile: null, isAthlete: false, isAdmin: false };
  mockSpotlight = { awards: [], loading: false, refresh: mockRefresh };
  mockDrip = { items: [], loading: false, error: null, refresh: mockRefresh };
  mockActivity = { items: [], loading: false, error: null, refresh: mockRefresh };
  mockGames = { games: [], loading: false, error: null, refresh: mockRefresh };
  mockCanGoBack = false;
  mockCompose = undefined;
});

it('waits for initial Spotlight loading before showing the published empty title', async () => {
  mockSpotlight.loading = true;
  const view = await render(<SpotlightTab />);
  expect(screen.getByText('Loading Spotlights…')).toBeTruthy();
  expect(screen.queryByText(mockLive.copy.spotlightEmpty)).toBeNull();
  mockSpotlight.loading = false;
  await view.rerender(<SpotlightTab />);
  expect(screen.getByText(mockLive.copy.spotlightEmpty)).toBeTruthy();
  expect(screen.queryByText('Loading Spotlights…')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Open Spotlight desk' })).toBeNull();
});

it('keeps the empty Spotlight desk action restricted to admins and on its original route', async () => {
  mockAuth.isAdmin = true;
  await render(<SpotlightTab />);
  await fireEvent.press(screen.getByLabelText('Open Spotlight desk'));
  expect(mockPush).toHaveBeenCalledWith('/admin/spotlight');
});

it('uses the published Drip category in a filtered empty state and existing pills to leave it', async () => {
  mockLive.copy.dripMerchLabel = 'Athlete keepsakes';
  mockDrip.items = [{ id: 'tee', name: 'Team tee', category: 'apparel', priceCents: 2000, inventory: 2, hasSizes: true, icon: 'shirt', blurb: 'Team colors' }];
  await render(<DripTab />);
  expect(screen.getByText('Team tee')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Athlete keepsakes' }));
  expect(screen.getByText('No items in Athlete keepsakes')).toBeTruthy();
  expect(screen.queryByText(mockLive.copy.dripEmpty)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Open Drip desk' })).toBeNull();
  expect(mockTrackFeature).toHaveBeenCalledWith('filter.merch');
  await fireEvent.press(screen.getByRole('tab', { name: mockLive.copy.dripAllLabel }));
  expect(screen.getByText('Team tee')).toBeTruthy();
  expect(screen.queryByText('No items in Athlete keepsakes')).toBeNull();
});

it('preserves whole-catalog copy and separates Drip pending, error and retry states', async () => {
  mockDrip.loading = true;
  const view = await render(<DripTab />);
  expect(screen.getByText('Loading the rack…')).toBeTruthy();
  expect(screen.queryByText(mockLive.copy.dripEmpty)).toBeNull();
  mockDrip.loading = false;
  mockDrip.error = 'Catalog unavailable';
  await view.rerender(<DripTab />);
  expect(screen.getByText('Could not load the rack')).toBeTruthy();
  expect(screen.getByText('Catalog unavailable')).toBeTruthy();
  expect(screen.queryByText(mockLive.copy.dripEmpty)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Retry'));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockDrip.error = null;
  await view.rerender(<DripTab />);
  expect(screen.getByText(mockLive.copy.dripEmpty)).toBeTruthy();
});

it('keeps signed-out Activity private and uses the existing auth gate', async () => {
  mockAuth.user = null;
  mockActivity.items = [{ id: 'private', kind: 'malo_sent', at: '2026-10-20', title: 'Private activity', body: 'Not for a guest' }];
  await render(<ActivityTab />);
  expect(screen.queryByText('Private activity')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'signin' }));
  expect(mockPush).not.toHaveBeenCalled();
});

it('retains complete Activity story text, exact amount and receipt/athlete destinations', async () => {
  const title = 'You gave to a student athlete with a long public display name';
  const body = 'A gift from your family toward the athlete’s upcoming sports costs, with the original source description.';
  mockActivity.items = [
    { id: 'sent', kind: 'malo_sent', at: '2026-10-20', title, body, amountCents: 12345 },
    { id: 'thanks', kind: 'thanks_received', at: '2026-10-20', title: 'An athlete thanked you', body: 'Mālo!', playerId: 'athlete-id' },
    { id: 'unlinked', kind: 'thanks_received', at: '2026-10-20', title: 'A thank-you', body: 'Mālo!' },
  ];
  await render(<ActivityTab />);
  expect(screen.getByText(title).props.numberOfLines).toBeUndefined();
  expect(screen.getByText(body).props.numberOfLines).toBeUndefined();
  expect(screen.getByText('$123.45')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(`${title}. ${body}`));
  expect(mockPush).toHaveBeenLastCalledWith('/receipts');
  await fireEvent.press(screen.getByLabelText('An athlete thanked you. Mālo!'));
  expect(mockPush).toHaveBeenLastCalledWith('/user/athlete-id');
  expect(screen.getByLabelText('A thank-you. Mālo!').props.accessibilityState.disabled).toBe(true);
});

it('keeps Local pending and error states separate from published empty games', async () => {
  mockGames.loading = true;
  const view = await render(<LocalTab />);
  expect(screen.getByText('Loading live scores…')).toBeTruthy();
  expect(screen.queryByText(mockLive.copy.localEmpty)).toBeNull();
  mockGames.loading = false;
  mockGames.error = 'Games unavailable';
  await view.rerender(<LocalTab />);
  expect(screen.getByText('Couldn’t load games')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Try again'));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockGames.error = null;
  await view.rerender(<LocalTab />);
  expect(screen.getByText(mockLive.copy.localEmpty)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Live games' })).toBeNull();
});

it('preserves Beyond history fallback and passes composer requests to the existing readiness owner', async () => {
  mockCompose = '1';
  await render(<BeyondTab />);
  expect(screen.getByText('Composer requested')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back to Highlights'));
  expect(mockReplace).toHaveBeenCalledWith('/');
  mockCanGoBack = true;
  await fireEvent.press(screen.getByLabelText('Back to Highlights'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Existing composer ready'));
  expect(mockSetParams).toHaveBeenCalledWith({ compose: undefined });
});

it.each([
  ['spotlight', SpotlightTab, 'Spotlight is paused'],
  ['drip', DripTab, 'Drip is paused'],
  ['activity', ActivityTab, 'Activity'],
  ['local', LocalTab, 'Local is paused'],
  ['beyond', BeyondTab, 'Beyond the Game is paused'],
] as const)('retains the %s published pause guard', async (tab, Component, title) => {
  mockLive.tabs[tab] = false;
  await render(<Component />);
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.queryByText('Composer requested')).toBeNull();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it('does not navigate from a dismissed Spotlight route after its close delay', async () => {
  jest.useFakeTimers();
  try {
    const view = await render(<SpotlightTab />);
    await act(async () => { mockSpotlightActions!.onWatch(null); });
    await view.unmount();
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(mockPush).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
it('retains the current Spotlight fallback destination after its close delay', async () => {
  jest.useFakeTimers();
  try {
    await render(<SpotlightTab />);
    await act(async () => { mockSpotlightActions!.onWatch(null); jest.advanceTimersByTime(400); });
    expect(mockPush).toHaveBeenCalledWith('/');
  } finally { jest.useRealTimers(); }
});
