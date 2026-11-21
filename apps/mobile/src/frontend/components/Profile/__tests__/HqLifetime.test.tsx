/** Account remounts clear HQ state, and awaited or retained HQ actions must not run followups for another account. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RoleGate } from '@/context/RoleGate';
import AthleteHome from '../../../../../app/(athlete)/athlete';
import BoosterHome from '../../../../../app/(booster)/booster';
import SponsorHome from '../../../../../app/(sponsor)/sponsor';
let mockUser = 'A', mockEpoch = 0, mockGuard = () => true;
const mockRefresh = jest.fn(), mockName = jest.fn(), mockQueue = jest.fn(), mockUpload = jest.fn(), mockJersey = jest.fn(), mockVerify = jest.fn();
const mockAds = jest.fn(), mockCreateAd = jest.fn(), mockToggleAd = jest.fn();
const mockClient = { captured: true };
const mockActions = new Map<string, () => void>();
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: jest.fn() }), Redirect: () => null }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, profile: { full_name: `Name ${mockUser}`, player_id: `player-${mockUser}` }, role: 'athlete', roles: ['athlete','booster','sponsor'], loading: false, isAdmin: false, isSessionCurrent: mockGuard, refreshProfile: mockRefresh }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { copy: { boosterLede: '', sponsorLede: '' } } }) }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: require('react-native').View }));
jest.mock('@/components/DashboardPanel', () => ({ DashboardPanel: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ScreenHeading', () => ({ ScreenHeading: () => null }));
jest.mock('@/components/FamilyFun/FamilyFunDiscovery', () => ({ FamilyFunDiscovery: () => null }));
jest.mock('@/components/Spotlight/TagConfirmList', () => ({ TagConfirmList: () => null }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: (props: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
  const { Pressable } = require('react-native');
  const element = props.children as React.ReactElement<{ children?: string }>;
  const label = props.accessibilityLabel ?? element?.props?.children;
  if (label && props.onPress) mockActions.set(label, props.onPress);
  return <Pressable {...props} />;
} }));
jest.mock('@/components/UI/Kit', () => ({ KitButton: ({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel?: string; onPress: () => void }) => {
  mockActions.set(accessibilityLabel ?? label, onPress);
  const { Pressable, Text } = require('react-native'); return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress}><Text>{label}</Text></Pressable>;
} }));
jest.mock('@/hooks/usePendingPlayerTags', () => ({ usePendingPlayerTags: () => ({ tags: [], resolve: jest.fn() }) }));
jest.mock('@/hooks/useReceivedMalo', () => ({ useReceivedMalo: () => ({ totalCents: 0, rows: [], loading: false }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], loading: false, error: null, refresh: mockRefresh, setPlayers: jest.fn() }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));
jest.mock('@/lib/auth', () => ({ updateOwnDisplayName: (...args: unknown[]) => mockName(...args) }));
jest.mock('@/lib/finance', () => ({ tipChannelLabel: () => '' }));
jest.mock('@/lib/boosterPortal', () => ({ fetchBoosterVerificationQueue: (...args: unknown[]) => mockQueue(...args), insertBoosterRoster: (...args: unknown[]) => mockUpload(...args), updateBoosterJersey: (...args: unknown[]) => mockJersey(...args), setBoosterVerification: (...args: unknown[]) => mockVerify(...args) }));
jest.mock('@/lib/sponsorAds', () => ({ fetchSponsorAds: (...args: unknown[]) => mockAds(...args), createSponsorAd: (...args: unknown[]) => mockCreateAd(...args), setSponsorAdActive: (...args: unknown[]) => mockToggleAd(...args) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (expected?: string) => {
  if (expected && expected !== mockUser) return null;
  const userId = mockUser, epoch = mockEpoch; return { userId, isCurrent: () => userId === mockUser && epoch === mockEpoch };
} } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => mockClient, assertCurrent: (actor: { isCurrent: () => boolean }) => { if (!actor.isCurrent()) throw new Error('Account changed'); } }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function changeOwner() { mockUser = 'B'; ++mockEpoch; mockGuard = () => true; }
const app = (Screen: typeof AthleteHome) => <RoleGate allow={['athlete','booster','sponsor']}><Screen /></RoleGate>;
beforeEach(() => {
  jest.clearAllMocks(); mockActions.clear(); mockUser = 'A'; mockEpoch = 0; mockGuard = () => true;
  mockName.mockReset().mockResolvedValue(null); mockQueue.mockReset().mockResolvedValue({ rows: [], error: null });
  mockUpload.mockReset().mockResolvedValue({ ok: true }); mockJersey.mockReset().mockResolvedValue({ ok: true }); mockVerify.mockReset().mockResolvedValue({ ok: true });
  mockAds.mockReset().mockResolvedValue({ ads: [], error: null }); mockCreateAd.mockReset().mockResolvedValue({ ok: true }); mockToggleAd.mockReset().mockResolvedValue({ ok: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
it('does not refresh Profile after an outgoing athlete name save settles', async () => {
  const pending = deferred<null>(); mockName.mockReturnValueOnce(pending.promise);
  const view = await render(app(AthleteHome)); await fireEvent.press(screen.getByRole('button', { name: 'Save display name' }));
  await waitFor(() => expect(mockName).toHaveBeenCalled()); changeOwner(); await view.rerender(app(AthleteHome));
  await act(async () => pending.resolve(null)); expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockName.mock.calls[0][2]).toBe(mockClient);
});
it('refuses a retained athlete name-save callback from the preceding HQ', async () => {
  const view = await render(app(AthleteHome)); const old = mockActions.get('Save display name')!;
  changeOwner(); await view.rerender(app(AthleteHome)); await act(async () => old()); expect(mockName).not.toHaveBeenCalled();
});
it('does not announce or refetch an old Booster CSV completion', async () => {
  const pending = deferred<{ ok: true }>(); mockUpload.mockReturnValueOnce(pending.promise);
  const view = await render(app(BoosterHome)); await fireEvent.press(screen.getByRole('button', { name: 'Upload roster' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalled()); changeOwner(); await view.rerender(app(BoosterHome));
  await act(async () => pending.resolve({ ok: true })); expect(mockRefresh).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled(); expect(mockUpload.mock.calls[0][1]).toBe(mockClient);
});
it('does not perform an outgoing Sponsor refetch or retained publish', async () => {
  const pending = deferred<{ ok: true }>(); mockCreateAd.mockReturnValueOnce(pending.promise);
  const view = await render(app(SponsorHome)); const old = mockActions.get('Publish rivalry banner')!;
  await fireEvent.press(screen.getByRole('button', { name: 'Place sideline board ad' })); await waitFor(() => expect(mockCreateAd).toHaveBeenCalled());
  changeOwner(); await view.rerender(app(SponsorHome)); await waitFor(() => expect(mockAds).toHaveBeenCalledTimes(2));
  await act(async () => pending.resolve({ ok: true })); expect(mockAds).toHaveBeenCalledTimes(2);
  await act(async () => old()); expect(mockCreateAd).toHaveBeenCalledTimes(1); expect(mockCreateAd.mock.calls[0][1]).toBe(mockClient);
});
it('clears a loaded verification queue before the incoming account read finishes', async () => {
  mockQueue.mockResolvedValueOnce({ rows: [{ id: 'request-A', full_name: 'Private A', status: 'pending' }], error: null });
  const view = await render(app(BoosterHome)); await waitFor(() => expect(screen.getByText('Private A · pending')).toBeTruthy());
  const pending = deferred<unknown>(); mockQueue.mockReturnValueOnce(pending.promise); changeOwner(); await view.rerender(app(BoosterHome));
  expect(screen.queryByText('Private A · pending')).toBeNull(); await act(async () => pending.resolve({ rows: [], error: null }));
});
