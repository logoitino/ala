/** Own profile menu preserves account actions and gives every signed-in role a root private-quiz history route. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Player, ReelWithPlayer } from '@/types/database';
import Profile from '../profile';
let mockGuest = false;
let mockRole = 'parent';
let mockOwner = 'auth';
let mockPlayerId: string | null = null;
let mockRosterPlayers: Player[] = [];
const mockFetchReels = jest.fn();
let mockSessionGuard = () => true;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true, useFocusEffect: (callback: () => void) => { const { useEffect } = require('react'); useEffect(callback, [callback]); } }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockOwner }, profile: { id: `profile-${mockOwner}`, user_id: mockOwner, full_name: 'Owner', player_id: mockPlayerId }, role: mockRole, roles: [mockRole], activeRole: mockRole, isGuest: mockGuest, isAthlete: Boolean(mockPlayerId), isAdmin: false, signOut: jest.fn(), isSessionCurrent: mockSessionGuard }) }));
jest.mock('@/lib/athleteSports', () => ({ fetchAthleteSports: async () => null }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/UploadSheetContext', () => ({ useOptionalUploadSheet: () => null }));
jest.mock('@/components/Effects/ScrollFx', () => ({ ScrollFxParallax: ({ children }: { children: React.ReactNode }) => children, ScrollFxScrollView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/Profile/AthleteProfileView', () => ({ AthleteProfileView: ({ headerRight, clips }: { headerRight: React.ReactNode; clips: { id: string }[] }) => {
  const { Text } = require('react-native'); return <>{headerRight}<Text>{`Clips: ${clips.map(clip => clip.id).join(',')}`}</Text></>;
} }));
// Menu animation/modal and unrelated editors are independent of the route's actual menu construction.
jest.mock('@/components/Profile/ProfileMenuSheet', () => ({ ProfileMenuSheet: ({ visible, items }: { visible: boolean; items: { id: string; label: string; onPress: () => void }[] }) => {
  const { Pressable, Text, View } = require('react-native');
  return visible ? <View>{items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress}><Text>{item.label}</Text></Pressable>)}</View> : null;
} }));
jest.mock('@/components/Filmers/FilmerCard', () => ({ FilmerCard: () => null }));
jest.mock('@/components/Profile/EditProfileModal', () => ({ EditProfileModal: () => null }));
jest.mock('@/components/Profile/PayoutSetupCard', () => ({ PayoutSetupCard: () => null }));
jest.mock('@/components/Profile/RoleSwitcherModal', () => ({ RoleSwitcherModal: () => null }));
jest.mock('@/components/Profile/VerifyAthleteModal', () => ({ CLAIM_VERIFY_CTA: 'Verify Athlete', VerifyAthleteModal: () => null }));
jest.mock('@/components/Profile/PrivacySettingsSheet', () => ({ PrivacySettingsSheet: () => null }));
// Notification settings have their own owner, source and UI fixtures.
jest.mock('@/components/Profile/NotificationSettingsSheet', () => ({ NotificationSettingsSheet: () => null }));
jest.mock('@/components/Profile/HighlightsFeedSettingsSheet', () => ({ HighlightsFeedSettingsSheet: () => null }));
jest.mock('@/hooks/useFeedPrefs', () => ({
  useFeedPrefs: () => ({
    prefs: { sports: [], schools: [], categoryPref: 'all', personalizationOn: true },
    available: false,
    loading: false,
    error: null,
    promptOpen: false,
    implicit: null,
    refresh: jest.fn(),
    save: jest.fn(),
    skipPrompt: jest.fn(),
    setPersonalizationOn: jest.fn(),
    signedIn: true,
  }),
}));
jest.mock('@/components/Feedback/SuggestionSheet', () => ({ SuggestionSheet: () => null }));
jest.mock('@/components/Legal/LegalModal', () => ({ LegalModal: () => null }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: mockRosterPlayers, applyBackerCount: jest.fn(), applyVaultLocked: jest.fn() }) }));
jest.mock('@/hooks/useFilmerStats', () => ({ useFilmerStats: () => ({ stats: null }) }));
jest.mock('@/hooks/useAthleteStats', () => ({ useAthleteStats: () => ({ stats: {}, loading: false }) }));
jest.mock('@/hooks/useAthleteSubscription', () => ({ useAthleteSubscription: () => ({ subscribed: false, grant: jest.fn() }) }));
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: jest.fn(), busy: false }), readMaloDroppedCount: async () => 0 }));
jest.mock('@/hooks/useCheerPoll', () => ({ countStoredCheerVotes: async () => 0 }));
jest.mock('@/hooks/useSurfaceUsage', () => ({ useSurfaceUsage: () => ({ onScroll: jest.fn(), trackFeature: jest.fn() }) }));
jest.mock('@/lib/teams', () => ({ readAthleteOnboarding: async () => null }));
jest.mock('@/lib/finance', () => ({ fetchRecentTips: async () => [] }));
jest.mock('@/lib/aura', () => ({ handleFromName: () => 'owner', resolveAuraPoints: () => 0, subscribePlayerAura: () => () => {} }));
jest.mock('@/lib/reels', () => ({ fetchReelsForPlayer: (...args: unknown[]) => mockFetchReels(...args), sortClipsNewestFirst: (rows: unknown[]) => rows,
  playerFromReel: jest.requireActual('@/lib/reels').playerFromReel, reelToClip: jest.requireActual('@/lib/reels').reelToClip }));
beforeEach(() => { mockOwner = 'auth'; mockPlayerId = null; mockRosterPlayers = []; mockSessionGuard = () => true; mockFetchReels.mockReset().mockResolvedValue([]); });
it.each(['fan', 'athlete', 'parent', 'operator', 'booster', 'sponsor', 'admin'])('%s keeps private history accessible even without an active weekly invitation', async role => {
  mockRole = role; mockGuest = false; mockPush.mockClear();
  await render(<Profile />, { wrapper: ({ children }) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, bottom: 0, right: 0 } }}>{children}</SafeAreaProvider> });
  await fireEvent.press(screen.getByRole('button', { name: 'Open account settings' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sport Quiz & private history' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Account Capability' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Fan Zone' }));
  expect(mockPush).toHaveBeenCalledWith('/fan-zone');
});
it('does not give guest accounts a private history shortcut', async () => {
  mockGuest = true;
  await render(<Profile />, { wrapper: ({ children }) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, bottom: 0, right: 0 } }}>{children}</SafeAreaProvider> }); await fireEvent.press(screen.getByRole('button', { name: 'Open account settings' }));
  expect(screen.queryByRole('button', { name: 'Sport Quiz & private history' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Fan Zone' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});

it('clears own Highlights immediately after account/subject changes and ignores a late previous fetch', async () => {
  const a = { id: 'athlete-a', name: 'Ana', jersey_number: 1, school_name: '', position: '', height: '', backer_count: 0 };
  const b = { ...a, id: 'athlete-b', name: 'Bea' };
  mockRosterPlayers = [a, b]; mockPlayerId = a.id; mockGuest = false; mockRole = 'athlete';
  mockFetchReels.mockResolvedValueOnce([{ id: 'clip-a', player_id: a.id, players: a, video_url: 'a.mp4' } as ReelWithPlayer]);
  const view = await render(<Profile />, { wrapper: ({ children }) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, bottom: 0, right: 0 } }}>{children}</SafeAreaProvider> }); await act(async () => {});
  expect(screen.getByText('Clips: clip-a')).toBeTruthy();
  let resolve!: (rows: ReelWithPlayer[]) => void;
  mockFetchReels.mockReturnValueOnce(new Promise<ReelWithPlayer[]>(done => { resolve = done; }));
  mockOwner = 'owner-b'; mockPlayerId = b.id;
  await view.rerender(<Profile />);
  expect(screen.getByText('Clips: ')).toBeTruthy();
  await act(async () => resolve([{ id: 'clip-b', player_id: b.id, players: b, video_url: 'b.mp4' } as ReelWithPlayer]));
  expect(screen.getByText('Clips: clip-b')).toBeTruthy();
});
