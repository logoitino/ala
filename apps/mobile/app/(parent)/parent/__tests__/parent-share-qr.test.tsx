/** Parent HQ: a guardian can hand family a donate QR for each linked athlete, keyed by athlete id so it resolves without a username. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import Parent from '../index';

const mockShare = jest.fn();
const athlete = { id: '3f2b8c1e-5a4d-4c2b-9e1f-0a1b2c3d4e5f', name: 'Mele Tupou', guardian_id: 'guardian-profile', parental_consent_approved: true };

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: jest.fn() }), useIsFocused: () => true }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'guardian-user' }, profile: { id: 'guardian-profile' }, role: 'parent', isGuest: false, loading: false }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/DashboardPanel', () => ({ DashboardPanel: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/FamilyFun/FamilyFunDiscovery', () => ({ FamilyFunDiscovery: () => null }));
jest.mock('@/components/Spotlight/TagConfirmList', () => ({ TagConfirmList: () => null }));
jest.mock('@/components/Custodial/GuardianSupervisionPanel', () => ({ GuardianSupervisionPanel: () => null }));
jest.mock('@/components/Custodial/GuardianCustodialCard', () => ({ GuardianCustodialCard: () => null }));
jest.mock('@/components/Profile/ReceivedMaloPanel', () => ({ ReceivedMaloPanel: () => null }));
jest.mock('@/components/Rally/RallyCard', () => ({ RallyCard: () => null }));
jest.mock('@/components/Profile/ShareQrModal', () => ({
  ShareQrModal: (props: Record<string, unknown>) => {
    mockShare(props);
    return null;
  },
}));
jest.mock('@/hooks/usePendingPlayerTags', () => ({ usePendingPlayerTags: () => ({ tags: [], busyId: null, error: null, resolve: jest.fn() }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [athlete, { ...athlete, id: 'other', guardian_id: 'someone-else' }], loading: false, error: null, refresh: jest.fn(), setPlayers: jest.fn() }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

it('opens the Share & Donate QR for a linked athlete only', async () => {
  await render(<Parent />);
  expect(screen.getAllByRole('button', { name: /Share & Donate ⚡ for/ })).toHaveLength(1);
  expect(mockShare).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Share & Donate ⚡ for Mele Tupou' }));
  expect(mockShare).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true, athleteName: 'Mele Tupou', playerId: athlete.id }));
});
