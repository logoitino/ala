/** Actual HQ routes keep their existing duties while exposing the real optional quiz through its own source. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import Parent from '../../../../../app/(parent)/parent';
import Booster from '../../../../../app/(booster)/booster';
import Sponsor from '../../../../../app/(sponsor)/sponsor';
import Operator from '../../../../../app/operator';
import { fanSnapshotFixture, FUN_IDS } from '@/lib/__fixtures__/fanZoneFixtures';
import type { FanZoneSnapshot } from '@shared/fanZone';
const emptyFan: FanZoneSnapshot = { ok: true, campaign: null, candidates: [], results: [], entry: null, ballot: null, guardian_queue: [], reflections: [], story: null, eligible: false, can_participate: false };
let mockFan = emptyFan;
const mockReads: string[] = [];
jest.mock('@/services/MediaUploadService', () => ({ bytesFromUri: jest.fn(), compressHighlight: jest.fn() }));
const mockPush = jest.fn();
let mockRole = 'parent';
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'auth' }, profile: { id: 'profile', user_id: 'auth' }, role: mockRole, isGuest: false, loading: false }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/DashboardPanel', () => ({ DashboardPanel: ({ children, title }: { children: React.ReactNode; title: string }) => { const { Text, View } = require('react-native'); return <View><Text>{title}</Text>{children}</View>; } }));
jest.mock('@/components/Spotlight/TagConfirmList', () => ({ TagConfirmList: () => { const { Text } = require('react-native'); return <Text>Existing tag queue</Text>; } }));
jest.mock('@/components/Custodial/GuardianSupervisionPanel', () => ({ GuardianSupervisionPanel: () => { const { Text } = require('react-native'); return <Text>Existing guardian supervision</Text>; } }));
jest.mock('@/components/Custodial/GuardianCustodialCard', () => ({ GuardianCustodialCard: () => null }));
jest.mock('@/components/Profile/ReceivedMaloPanel', () => ({ ReceivedMaloPanel: () => null }));
jest.mock('@/components/Rally/RallyCard', () => ({ RallyCard: () => null }));
jest.mock('@/components/Operator/PINClaimModal', () => ({ PINClaimModal: () => null }));
jest.mock('@/hooks/usePendingPlayerTags', () => ({ usePendingPlayerTags: () => ({ tags: [], busyId: null, error: null, resolve: jest.fn() }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [], loading: false, error: null, refresh: jest.fn(), setPlayers: jest.fn() }) }));
jest.mock('@/lib/boosterPortal', () => ({ fetchBoosterVerificationQueue: async () => ({ rows: [], error: null }) }));
jest.mock('@/lib/sponsorAds', () => ({ fetchSponsorAds: async () => ({ ads: [], error: null }) }));
jest.mock('@/lib/operator', () => ({ OPERATOR_TEST_PIN: '0000', fetchOperatorGames: async () => ({ games: [{ id: 'game', home_team: 'Home', away_team: 'Away', venue: 'Venue' }], error: null }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  rpc: async (fn: string) => { mockReads.push(fn); return ({ data: fn === 'fun_snapshot' ? mockFan : { availability: 'ready', testing_only: true, week_start: '2026-10-12', week_end: '2026-10-19', status: 'available', sports: ['Basketball'], attempt: null, badges: [], corrections: [] }, error: null }); },
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; }, removeChannel: jest.fn(),
} }));
it.each([
  ['parent', Parent, 'Linked student-athletes'], ['booster', Booster, 'CSV bulk roster upload'],
  ['sponsor', Sponsor, 'Digital stadium ad manager'], ['operator', Operator, 'Operator PIN'],
] as const)('%s HQ exposes root quiz while preserving its own work', async (role, Route, existing) => {
  mockRole = role; mockPush.mockClear();
  await render(<Route />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Open quiz' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(screen.getByText(existing)).toBeTruthy();
  if (role === 'parent') {
    expect(screen.getByText('Existing guardian supervision')).toBeTruthy();
    expect(screen.getByText('Existing tag queue')).toBeTruthy();
  }
});

beforeEach(() => { mockFan = emptyFan; mockReads.length = 0; mockPush.mockClear(); });
it.each([
  ['parent', Parent, 'Linked student-athletes'], ['booster', Booster, 'CSV bulk roster upload'],
  ['sponsor', Sponsor, 'Digital stadium ad manager'], ['operator', Operator, 'Operator PIN'],
] as const)('%s actual HQ exposes campaign-context Fan discovery while preserving its work', async (role, Route, existing) => {
  mockRole = role; const s = fanSnapshotFixture();
  mockFan = { ...s, entry: null, candidates: [] };
  if (role === 'parent') mockFan = { ...mockFan, campaign: { ...s.campaign!, status: 'paused' }, can_participate: false, guardian_queue: [s.entry!] };
  await render(<Route />);
  await fireEvent.press(await screen.findByRole('button', { name: role === 'parent' ? 'Review fan permissions' : 'Open Fan Zone' }));
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}${role === 'parent' ? '&section=permissions' : ''}`);
  expect(screen.getByText(existing)).toBeTruthy();
  expect(mockReads.every(fn => ['fun_snapshot', 'quiz_snapshot'].includes(fn))).toBe(true);
  if (role === 'parent') expect(screen.getByText('Existing guardian supervision')).toBeTruthy();
});
