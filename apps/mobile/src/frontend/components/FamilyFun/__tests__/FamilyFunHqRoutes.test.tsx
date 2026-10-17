/** Actual HQ routes keep their existing duties while exposing the real optional quiz through its own source. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Parent from '../../../../../app/(parent)/parent';
import Booster from '../../../../../app/(booster)/booster';
import Sponsor from '../../../../../app/(sponsor)/sponsor';
import Operator from '../../../../../app/operator';
import { fanSnapshotFixture, FUN_IDS } from '@/lib/__fixtures__/fanZoneFixtures';
import type { FanZoneSnapshot } from '@shared/fanZone';
import {quizSnapshot,quizReceipt as mockQuizReceipt} from '@/lib/__fixtures__/timedSportQuizFixtures';
import type {TimedQuizSnapshot} from '@shared/timedSportQuiz';
const mockProfileId='00000000-0000-0000-0000-000000000001';
const mockUserId='00000000-0000-0000-0000-000000000002';
let mockQuiz:TimedQuizSnapshot;
let mockNonce=0;
const mockQuizWrites:{fn:string;args:Record<string,unknown>}[]=[];
jest.mock('expo-crypto',()=>({randomUUID:()=>`00000000-0000-0000-0000-${String(++mockNonce+2).padStart(12,'0')}`}));
const emptyFan: FanZoneSnapshot = { ok: true, campaign: null, candidates: [], results: [], entry: null, ballot: null, guardian_queue: [], reflections: [], story: null, eligible: false, can_participate: false };
let mockFan = emptyFan;
const mockReads: string[] = [];
jest.mock('@/services/MediaUploadService', () => ({ bytesFromUri: jest.fn(), compressHighlight: jest.fn() }));
const mockPush = jest.fn();
let mockRole = 'parent';
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUserId }, profile: { id: mockProfileId, user_id: mockUserId, age_blocked_at:null }, role: mockRole, isGuest: false, loading: false }) }));
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
jest.mock('@/lib/operator', () => ({ OPERATOR_TEST_PIN: '0000', fetchOperatorGames: async () => ({ games: [{ id: 'game', home_team: 'Home', away_team: 'Away', venue: 'Venue' }], error: null }), subscribeOperatorGames: () => () => undefined }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  rpc: async (fn:string,args:Record<string,unknown>={}) => {
    mockReads.push(fn);
    if(fn==='fun_snapshot')return{data:mockFan,error:null};
    if(fn==='quiz_snapshot')return{data:mockQuiz,error:null};
    if(fn==='quiz_invitation'){
      mockQuizWrites.push({fn,args});
      const outcome=mockQuiz.preferences.last_invited_week===mockQuiz.week_start?'already_claimed':'claimed';
      mockQuiz={...mockQuiz,preferences:{...mockQuiz.preferences,last_invited_week:mockQuiz.week_start}};
      return{data:{...mockQuizReceipt('invitation',String(args.p_request_id),outcome),profile_id:mockProfileId,week_start:mockQuiz.week_start},error:null};
    }
    throw Error(`Unexpected HQ quiz/Fan action: ${fn}`);
  },
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; }, removeChannel: jest.fn(),
} }));
it.each([
  ['parent', Parent, 'Linked student-athletes'], ['booster', Booster, 'CSV bulk roster upload'],
  ['sponsor', Sponsor, 'Digital stadium ad manager'], ['operator', Operator, 'Operator PIN'],
] as const)('%s HQ exposes root quiz while preserving its own work', async (role, Route, existing) => {
  mockRole = role; mockPush.mockClear();
  await render(<Route />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Ready for trivia' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(mockQuizWrites).toHaveLength(1);
  expect(mockQuizWrites[0].args).toMatchObject({p_expected_week:quizSnapshot.week_start,p_expected_profile_id:mockProfileId});
  expect(mockReads.every(fn=>['fun_snapshot','quiz_snapshot','quiz_invitation'].includes(fn))).toBe(true);
  expect(screen.getByText(existing)).toBeTruthy();
  if (role === 'parent') {
    expect(screen.getByText('Existing guardian supervision')).toBeTruthy();
    expect(screen.getByText('Existing tag queue')).toBeTruthy();
  }
});

beforeEach(() => { mockFan=emptyFan;mockReads.length=0;mockPush.mockClear();mockQuizWrites.length=0;mockNonce=0;mockQuiz={...quizSnapshot,profile_id:mockProfileId,preferences:{...quizSnapshot.preferences,invitation_mode:'weekly'}}; });
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
  expect(mockReads.every(fn => ['fun_snapshot','quiz_snapshot','quiz_invitation'].includes(fn))).toBe(true);
  if (role === 'parent') expect(screen.getByText('Existing guardian supervision')).toBeTruthy();
});

// Default Off does not remove account duties or create a new weekly claim/Start.
it.each([
 ['parent',Parent,'Linked student-athletes'],['booster',Booster,'CSV bulk roster upload'],
 ['sponsor',Sponsor,'Digital stadium ad manager'],['operator',Operator,'Operator PIN'],
] as const)('%s actual HQ keeps default-Off trivia quiet without automatically starting',async(role,Route,existing)=>{
 mockRole=role;mockQuiz={...quizSnapshot,profile_id:mockProfileId};
 await render(<Route/>);
 await waitFor(()=>expect(mockReads).toContain('quiz_snapshot'));
 await act(async()=>{});
 expect(screen.getByText(existing)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Ready for trivia'})).toBeNull();
 expect(mockQuizWrites).toEqual([]);
 expect(mockReads.every(fn=>['fun_snapshot','quiz_snapshot'].includes(fn))).toBe(true);
 if(role==='parent')expect(screen.getByText('Existing guardian supervision')).toBeTruthy();
});
