/** Own profile menu preserves account actions and gives every signed-in role a root private-quiz history route. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import Profile from '../profile';
let mockGuest = false;
let mockRole = 'parent';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: (callback: () => void) => { const { useEffect } = require('react'); useEffect(callback, [callback]); } }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'auth' }, profile: { id: 'profile', user_id: 'auth', full_name: 'Owner' }, role: mockRole, roles: [mockRole], activeRole: mockRole, isGuest: mockGuest, isAthlete: false, isAdmin: false, signOut: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/UploadSheetContext', () => ({ useOptionalUploadSheet: () => null }));
jest.mock('@/components/Effects/ScrollFx', () => ({ ScrollFxParallax: ({ children }: { children: React.ReactNode }) => children, ScrollFxScrollView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/Profile/AthleteProfileView', () => ({ AthleteProfileView: ({ headerRight }: { headerRight: React.ReactNode }) => headerRight }));
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
jest.mock('@/components/Feedback/SuggestionSheet', () => ({ SuggestionSheet: () => null }));
jest.mock('@/components/Legal/LegalModal', () => ({ LegalModal: () => null }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], applyBackerCount: jest.fn(), applyVaultLocked: jest.fn() }) }));
jest.mock('@/hooks/useFilmerStats', () => ({ useFilmerStats: () => ({ stats: null }) }));
jest.mock('@/hooks/useAthleteStats', () => ({ useAthleteStats: () => ({ stats: {}, loading: false }) }));
jest.mock('@/hooks/useAthleteSubscription', () => ({ useAthleteSubscription: () => ({ subscribed: false, grant: jest.fn() }) }));
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: jest.fn(), busy: false }), readMaloDroppedCount: async () => 0 }));
jest.mock('@/hooks/useCheerPoll', () => ({ countStoredCheerVotes: async () => 0 }));
jest.mock('@/hooks/useSurfaceUsage', () => ({ useSurfaceUsage: () => ({ onScroll: jest.fn(), trackFeature: jest.fn() }) }));
jest.mock('@/lib/teams', () => ({ readAthleteOnboarding: async () => null }));
jest.mock('@/lib/finance', () => ({ fetchRecentTips: async () => [] }));
jest.mock('@/lib/aura', () => ({ handleFromName: () => 'owner', resolveAuraPoints: () => 0, subscribePlayerAura: () => () => {} }));
jest.mock('@/lib/reels', () => ({ fetchReelsForPlayer: async () => [], sortClipsNewestFirst: (rows: unknown[]) => rows }));
it.each(['fan', 'athlete', 'parent', 'operator', 'booster', 'sponsor', 'admin'])('%s keeps private history accessible even without an active weekly invitation', async role => {
  mockRole = role; mockGuest = false; mockPush.mockClear();
  await render(<Profile />);
  await fireEvent.press(screen.getByRole('button', { name: 'Open account settings' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sport Quiz & private history' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Account Capability' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Fan Zone' })).toBeNull();
});
it('does not give guest accounts a private history shortcut', async () => {
  mockGuest = true;
  await render(<Profile />); await fireEvent.press(screen.getByRole('button', { name: 'Open account settings' }));
  expect(screen.queryByRole('button', { name: 'Sport Quiz & private history' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});
