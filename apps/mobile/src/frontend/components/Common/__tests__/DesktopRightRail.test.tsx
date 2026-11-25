/** Web extras complement the current route and preserve real source calls, flags and destination callbacks. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DesktopRightRail } from '@/components/Common/DesktopRightRail';

const mockPush = jest.fn(), mockRefresh = jest.fn();
const mockScores = jest.fn(), mockBoosters = jest.fn();
let mockPath = '/', mockTabs: Record<string, boolean> = {};
let mockLayouts: Record<string, boolean> = {}, mockButtons: Record<string, boolean> = {};
let mockError: string | null = null;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => mockPath }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { tabs: mockTabs, layouts: mockLayouts, buttons: mockButtons } }) }));
jest.mock('@/hooks/useLiveScores', () => ({ useLiveScores: () => {
  mockScores();
  return { visibleGames: [{ id: 'one', home_team: 'Hawks', away_team: 'Knights', home_score: 21, away_score: 17, status: 'Live', quarter: 'Q3', clock: '12:00' },
    { id: 'two', home_team: 'East', away_team: 'West', home_score: 7, away_score: 3, status: 'Final' }],
    loading: false, error: mockError, refresh: mockRefresh };
} }));
jest.mock('@/hooks/useAuraBoosters', () => ({ useAuraBoosters: () => {
  mockBoosters(); return { boosters: [], loading: false };
} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
beforeEach(() => { mockPath = '/'; mockTabs = {}; mockLayouts = {}; mockButtons = {}; mockError = null; jest.clearAllMocks(); });

it('omits duplicate Local hub content without mounting its data panels', async () => {
  mockPath = '/local';
  await render(<DesktopRightRail />);
  expect(screen.queryByText('Live matchups')).toBeNull();
  expect(screen.queryByText('Top Aura Boosters')).toBeNull();
  expect(mockScores).not.toHaveBeenCalled();
  expect(mockBoosters).not.toHaveBeenCalled();
  expect(screen.getByText('More from Tapua’i')).toBeTruthy();
});

it('honors Local and Profile pauses before mounting data or exposing their shortcuts', async () => {
  mockTabs = { local: false, profile: false, drip: false };
  await render(<DesktopRightRail />);
  expect(mockScores).not.toHaveBeenCalled();
  expect(mockBoosters).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Open Profile for Vault')).toBeNull();
  expect(screen.queryByLabelText('Open Drip')).toBeNull();
  expect(screen.getByLabelText('Open Booster HQ')).toBeTruthy();
});

it('keeps complementary summaries on Schools and excludes the current game on game detail', async () => {
  mockPath = '/local/directory';
  const view = await render(<DesktopRightRail />);
  expect(screen.getByText('Live matchups')).toBeTruthy();
  mockPath = '/local/game/one';
  await view.rerender(<DesktopRightRail />);
  expect(screen.queryByText('Hawks vs Knights')).toBeNull();
  expect(screen.getByText('East vs West')).toBeTruthy();
});

it.each([['/profile', 'Open Profile for Vault'], ['/user/person', 'Open Profile for Vault'], ['/booster', 'Open Booster HQ'], ['/drip', 'Open Drip']])('does not repeat the current %s destination', async (path, label) => {
  mockPath = path;
  await render(<DesktopRightRail />);
  expect(screen.queryByLabelText(label)).toBeNull();
});

it('preserves score navigation and signals the tablet drawer to close', async () => {
  const close = jest.fn();
  await render(<DesktopRightRail drawer onNavigate={close} />);
  await fireEvent.press(screen.getByRole('link', { name: /Hawks vs Knights/ }));
  expect(mockPush).toHaveBeenCalledWith('/local/game/one');
  expect(close).toHaveBeenCalledTimes(1);
});

it('keeps the source failure visible and retries through the existing scoreboard hook', async () => {
  mockError = 'Scoreboard unavailable';
  await render(<DesktopRightRail />);
  expect(screen.getByRole('alert').props.children).toBe('Scoreboard unavailable');
  expect(screen.queryByText('Hawks vs Knights')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry scoreboard' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});


it('honors individual published layout pauses without subscribing to hidden summaries', async () => {
  mockLayouts = { liveMatches: false, topBoosters: false };
  await render(<DesktopRightRail />);
  expect(mockScores).not.toHaveBeenCalled();
  expect(mockBoosters).not.toHaveBeenCalled();
});

it('retains the profile destination without promising a paused Vault', async () => {
  mockButtons = { vault: false };
  await render(<DesktopRightRail />);
  expect(screen.queryByLabelText('Open Profile for Vault')).toBeNull();
  expect(screen.getByLabelText('Open Profile')).toBeTruthy();
});
