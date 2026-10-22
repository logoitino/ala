/** Public profile navigation keeps the active route identity and passes privacy-filtered sport/school settings. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import UserAthleteProfileScreen from '../user/[id]';
import type { Player, ProfilePublic } from '@/types/database';
import { emptyAthleteStats } from '@/data/athleteStats';
import type { AthleteSportsSnapshot } from '@/lib/athleteSports';

const firstId = '6bdfe860-3579-4eb0-8f80-1cb2bb702521';
const secondId = 'bbc57d92-4cfa-4c7b-ae25-fdfc3948af17';
let mockRouteId = firstId;
const mockPlayers = new Map<string, Promise<{ data: Player | null; error: null }>>();
const mockProfiles = new Map<string, ProfilePublic>();
const mockSports = new Map<string, AthleteSportsSnapshot>();
let mockSessionGuard = () => true;
const mockRenderedNames: string[] = [];
jest.mock('@/lib/athleteSports', () => ({ fetchAthleteSports: async (id: string) => mockSports.get(id) ?? null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockRouteId }),
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  // Other people's profiles come through get_public_profiles (PRIV-01); keyed by athlete id here.
  rpc: (name: string, args: { player_ids?: string[] | null }) => Promise.resolve(name === 'get_public_profiles'
    ? { data: (args.player_ids ?? []).map((id) => mockProfiles.get(id)).filter(Boolean), error: null }
    : { data: null, error: { message: `Unexpected RPC ${name}` } }),
  from: (table: string) => {
  let id = '';
  const query = { select: () => query, eq: (_field: string, value: string) => { id = value; return query; },
    single: () => mockPlayers.get(id) ?? Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: mockProfiles.get(id) ?? null, error: null }) };
  if (!['players', 'profiles_public'].includes(table)) throw new Error(`Unexpected table ${table}`);
  return query;
} } }));
jest.mock('@/lib/hype', () => ({ hydratePlayerHype: async (player: Player) => player }));
jest.mock('@/lib/reels', () => ({ fetchReelsForPlayer: async () => [], sortClipsNewestFirst: (rows: unknown[]) => rows }));
jest.mock('@/lib/verification', () => ({ fetchPlayerVerification: async () => ({
  status: 'unverified', schoolClaimed: false, avatarUrl: null,
}) }));
jest.mock('@/lib/athleteStats', () => ({ fetchAthleteStats: async (_id: string, player: Player, sport: string) => {
  const { emptyAthleteStats } = jest.requireActual('@/data/athleteStats');
  return emptyAthleteStats(player, sport);
} }));
jest.mock('@/lib/aura', () => ({
  ...jest.requireActual('@/lib/aura'), subscribePlayerAura: () => () => {},
}));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAthlete: false, user: { id: 'viewer-a' }, isSessionCurrent: mockSessionGuard }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({
  live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME,
}) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/UploadSheetContext', () => ({ useOptionalUploadSheet: () => null }));
jest.mock('@/hooks/useFilmerStats', () => ({ useFilmerStats: () => ({ stats: null }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], applyBackerCount: jest.fn() }) }));
jest.mock('@/hooks/useAthleteSubscription', () => ({ useAthleteSubscription: () => ({ subscribed: false, grant: jest.fn() }) }));
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: jest.fn(), busy: false }) }));
// Independent media/chrome components are replaced at the route's props boundary; route loading and stats stay real.
jest.mock('@/components/Effects/ScrollFx', () => ({
  ScrollFxParallax: ({ children }: { children: React.ReactNode }) => children,
  ScrollFxScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/Filmers/FilmerCard', () => ({ FilmerCard: () => null }));
jest.mock('@/components/Profile/AthleteProfileView', () => ({ AthleteProfileView: (props: {
  name: string; schoolVisible?: boolean; teamName?: string; bio?: string; stats: ReturnType<typeof emptyAthleteStats>;
  primarySport?: string; displaySport?: string | null; sportEntries?: AthleteSportsSnapshot['sports']; onDisplaySportChange?: (sport: string | null) => void;
}) => {
  const { Text, Pressable } = jest.requireActual('react-native');
  mockRenderedNames.push(props.name);
  return <>
    <Text accessibilityRole="header">{props.name}</Text>
    <Text>{`School visible: ${String(props.schoolVisible)}`}</Text>
    <Text>{`Profile sport: ${props.stats.career.sport}`}</Text>
    <Text>{`Primary sport: ${props.primarySport ?? ''}`}</Text>
    {props.sportEntries?.map(entry => <Pressable key={entry.sport} accessibilityRole="button" accessibilityLabel={`View ${entry.sport}`}
      onPress={() => props.onDisplaySportChange?.(entry.sport)}><Text>{entry.sport}</Text></Pressable>)}
    {props.teamName ? <Text>{props.teamName}</Text> : null}
    {props.bio ? <Text>{props.bio}</Text> : null}
  </>;
} }));

function player(id: string, name: string): Player {
  return { id, name, jersey_number: 0, position: 'Middle Blocker', height: '', school_name: 'North High', backer_count: 0 };
}
function deferredPlayer() {
  let resolve!: (value: { data: Player; error: null }) => void;
  const promise = new Promise<{ data: Player; error: null }>((yes) => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => { mockRouteId = firstId; mockPlayers.clear(); mockProfiles.clear(); mockSports.clear(); mockRenderedNames.length = 0; mockSessionGuard = () => true; });

it('removes the old athlete immediately while another profile loads in the same route', async () => {
  mockPlayers.set(firstId, Promise.resolve({ data: player(firstId, 'Ana First'), error: null }));
  const second = deferredPlayer();
  mockPlayers.set(secondId, second.promise);
  const { rerender } = await render(<UserAthleteProfileScreen />);
  await act(async () => {});
  expect(screen.getByRole('header', { name: 'Ana First' })).toBeTruthy();
  mockRouteId = secondId;
  await rerender(<UserAthleteProfileScreen />);
  expect(screen.queryByRole('header', { name: 'Ana First' })).toBeNull();
  await act(async () => second.resolve({ data: player(secondId, 'Bea Second'), error: null }));
  expect(screen.getByRole('header', { name: 'Bea Second' })).toBeTruthy();
});

it('ignores a late first-profile response after the next profile has finished loading', async () => {
  const first = deferredPlayer();
  mockPlayers.set(firstId, first.promise);
  mockPlayers.set(secondId, Promise.resolve({ data: player(secondId, 'Bea Second'), error: null }));
  const { rerender } = await render(<UserAthleteProfileScreen />);
  mockRouteId = secondId;
  await rerender(<UserAthleteProfileScreen />);
  await act(async () => {});
  expect(screen.getByRole('header', { name: 'Bea Second' })).toBeTruthy();
  await act(async () => first.resolve({ data: player(firstId, 'Ana First'), error: null }));
  expect(screen.getByRole('header', { name: 'Bea Second' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Ana First' })).toBeNull();
});

it('passes hidden-school settings and the chosen public sport without exposing school copy', async () => {
  mockPlayers.set(firstId, Promise.resolve({ data: player(firstId, 'Ana First'), error: null }));
  mockProfiles.set(firstId, { id: 'profile-a', player_id: firstId, username: null,
    full_name: 'Ana First', avatar_url: null, is_verified: false, is_verified_athlete: false,
    school_visible: false, athlete_sport: 'Volleyball', bio: null, social_links: {} });
  await render(<UserAthleteProfileScreen />);
  await act(async () => {});
  expect(screen.getByText('School visible: false')).toBeTruthy();
  expect(screen.getByText('Profile sport: Volleyball')).toBeTruthy();
  expect(screen.queryByText(/North High/)).toBeNull();
});

it('loads secondary sports for the exact privacy-filtered profile and selects their own stats while retaining primary', async () => {
  mockPlayers.set(firstId, Promise.resolve({ data: player(firstId, 'Ana First'), error: null }));
  mockProfiles.set(firstId, { id: 'profile-a', player_id: firstId, username: null,
    full_name: 'Ana First', avatar_url: null, is_verified: false, is_verified_athlete: false,
    school_visible: false, athlete_sport: 'Football', bio: null, social_links: {} });
  mockSports.set('profile-a', { profileId: 'profile-a', revision: 3, primarySport: 'Football', sports: [
    { sport: 'Football', schoolId: null, teamName: null, position: '', jersey: '' },
    { sport: 'Volleyball', schoolId: null, teamName: null, position: '', jersey: '' },
  ] });
  await render(<UserAthleteProfileScreen />); await act(async () => {});
  await fireEvent.press(screen.getByRole('button', { name: 'View Volleyball' }));
  await act(async () => {});
  expect(screen.getByText('Profile sport: Volleyball')).toBeTruthy();
  expect(screen.getByText('Primary sport: Football')).toBeTruthy();
  expect(screen.queryByText(/North High/)).toBeNull();
});

it('does not paint a committed private view after the viewer returns with a new session lifetime', async () => {
  mockPlayers.set(firstId, Promise.resolve({ data: player(firstId, 'Ana First'), error: null }));
  const view = await render(<UserAthleteProfileScreen />); await act(async () => {});
  expect(screen.getByRole('header', { name: 'Ana First' })).toBeTruthy();
  mockRenderedNames.length = 0;
  mockPlayers.set(firstId, new Promise(() => {}));
  mockSessionGuard = () => true;
  await view.rerender(<UserAthleteProfileScreen />);
  expect(mockRenderedNames).not.toContain('Ana First');
  expect(screen.queryByRole('header', { name: 'Ana First' })).toBeNull();
});
