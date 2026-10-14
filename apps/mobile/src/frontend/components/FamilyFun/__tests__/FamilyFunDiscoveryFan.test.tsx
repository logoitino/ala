/** Fan/Quiz shared discovery with real hooks/SDKs and synthetic source records; no automatic participant actions. */
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FamilyFunDiscovery } from '../FamilyFunDiscovery';
import { fanSnapshotFixture, FUN_IDS } from '@/lib/__tests__/fanZoneFixtures';
import type { FanZoneSnapshot } from '@shared/fanZone';
import type { QuizSnapshot } from '@shared/sportQuiz';
let mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null as string | null }, isGuest: false, loading: false };
let mockFocused = true;
const mockPush = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => mockFocused }));
jest.mock('@/services/MediaUploadService', () => ({ bytesFromUri: jest.fn(), compressHighlight: jest.fn() }));
const quiz: QuizSnapshot = { availability: 'paused', testing_only: true, week_start: '2026-10-12', week_end: '2026-10-19', status: 'unavailable', sports: [], attempt: null, badges: [], corrections: [] };
const empty: FanZoneSnapshot = { ok: true, eligible: true, can_participate: false, campaign: null, entry: null, ballot: null, candidates: [], guardian_queue: [], results: [], reflections: [], story: null };
const mockClient = { fan: empty, quiz, calls: [] as { fn: string; args: unknown }[], handler: null as null | ((fn: string) => Promise<unknown>),
  async rpc(fn: string, args: unknown) {
    this.calls.push({ fn, args });
    if (this.handler) return { data: await this.handler(fn), error: null };
    if (fn === 'fun_snapshot') return { data: this.fan, error: null };
    if (fn === 'quiz_snapshot') return { data: this.quiz, error: null };
    throw new Error('Unexpected automatic mutation');
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
beforeEach(() => { jest.clearAllMocks(); mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null }, isGuest: false, loading: false }; mockFocused = true; mockClient.calls = []; mockClient.fan = empty; mockClient.quiz = quiz; mockClient.handler = null; });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
function guardian(status: 'open' | 'paused' = 'paused') {
  const s = fanSnapshotFixture(); return { ...s, campaign: { ...s.campaign!, status }, can_participate: false, entry: null, candidates: [], guardian_queue: [s.entry!] };
}
const readOnly = () => expect(mockClient.calls.every(c => ['fun_snapshot', 'quiz_snapshot'].includes(c.fn))).toBe(true);

it.each(['open', 'paused'] as const)('unenrolled guardian sees selected-campaign private review while %s', async status => {
  mockClient.fan = guardian(status);
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Review fan permissions' }));
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}&section=permissions`);
  expect(screen.getByText('1 private entry for this campaign.')).toBeTruthy();
  expect(screen.getByText('Selected campaign: Family cheer')).toBeTruthy();
  expect(screen.queryByText(/global inbox|all campaigns|complete history/i)).toBeNull(); readOnly();
});
it('own paused private entry routes to recovery without implying enrollment or submission', async () => {
  const s = fanSnapshotFixture(); mockClient.fan = { ...s, campaign: { ...s.campaign!, status: 'paused' }, can_participate: false, candidates: [] };
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'My fan entry' }));
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}`);
  expect(screen.getByText('Campaign paused.')).toBeTruthy(); readOnly();
});
it('private guardian review takes priority over own entry and ordinary participation', async () => {
  const s = fanSnapshotFixture(); mockClient.fan = { ...s, guardian_queue: [s.entry!] };
  await render(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Review fan permissions' });
  expect(screen.queryByRole('button', { name: 'My fan entry' })).toBeNull(); readOnly();
});
it('admitted campaign CTA opens context without reserving, voting or granting', async () => {
  mockClient.fan = { ...fanSnapshotFixture(), entry: null };
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Open Fan Zone' }));
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}`); readOnly();
});
it('offers a recognition recap only from actual authorized finalized results', async () => {
  const s = fanSnapshotFixture(); mockClient.fan = { ...s, entry: null, campaign: { ...s.campaign!, status: 'finalized', recount_required: false, results: [{ entry_id: FUN_IDS.entry, votes: 2 }] }, results: [{ entry_id: FUN_IDS.entry, votes: 2 }] };
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'View fan recap' }));
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}`); readOnly();
});
it('Fan source failure leaves Quiz invitation and honest Fan refresh independent', async () => {
  mockClient.quiz = { ...quiz, availability: 'ready', status: 'available', sports: ['Basketball'] };
  mockClient.handler = async fn => { if (fn === 'fun_snapshot') throw new Error('private source failed'); return mockClient.quiz; };
  await render(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Open quiz' });
  expect(await screen.findByText('Fan Zone is unavailable.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now for Fan Zone' }));
  expect(screen.getByRole('button', { name: 'Open quiz' })).toBeTruthy(); expect(screen.queryByText('Fan Zone is unavailable.')).toBeNull(); readOnly();
});
it('Quiz source failure leaves current private guardian review visible', async () => {
  mockClient.fan = guardian(); mockClient.handler = async fn => { if (fn === 'quiz_snapshot') throw new Error('missing quiz'); return mockClient.fan; };
  await render(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Review fan permissions' });
  expect(await screen.findByText('Sport Pop Quiz is unavailable.')).toBeTruthy(); readOnly();
});
it('dismissal of participation does not hide a newly returned private guardian request', async () => {
  mockClient.fan = { ...fanSnapshotFixture(), entry: null };
  const view = await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now for Fan Zone' }));
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  mockClient.fan = guardian(); mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(await screen.findByRole('button', { name: 'Review fan permissions' })).toBeTruthy(); readOnly();
});
it('focus refresh preserves a new selected canonical campaign context without pretending it is a global queue', async () => {
  mockClient.fan = guardian(); const view = await render(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Review fan permissions' });
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  const id = '10000000-0000-0000-0000-000000000002'; const g = guardian();
  mockClient.fan = { ...g, campaign: { ...g.campaign!, id, title: 'Next game' }, guardian_queue: [{ ...g.guardian_queue[0], campaign_id: id, consent_scope: { ...g.guardian_queue[0].consent_scope, campaign_id: id } }] };
  mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  await screen.findByText('Selected campaign: Next game');
  await fireEvent.press(screen.getByRole('button', { name: 'Review fan permissions' })); expect(mockPush).toHaveBeenLastCalledWith(`/fan-zone?campaign=${id}&section=permissions`); readOnly();
});
it('foreground return checks Fan state without automatic participant actions', async () => {
  const callbacks: (() => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { callbacks.push(() => listener('active')); return { remove: jest.fn() }; });
  const view = await render(<FamilyFunDiscovery />); await act(async () => {});
  mockClient.fan = guardian(); await act(async () => { callbacks.forEach(c => c()); });
  expect(await screen.findByRole('button', { name: 'Review fan permissions' })).toBeTruthy(); readOnly(); await view.unmount();
});
it('late previous-account private queue cannot leak into the next account', async () => {
  let finish!: (s: FanZoneSnapshot) => void; const prior = new Promise<FanZoneSnapshot>(resolve => { finish = resolve; });
  mockClient.handler = async fn => fn === 'fun_snapshot' ? prior : quiz;
  const view = await render(<FamilyFunDiscovery />);
  mockAuth = { ...mockAuth, user: { id: 'auth-b' }, profile: { ...mockAuth.profile, id: 'profile-b', user_id: 'auth-b' } };
  mockClient.handler = async fn => fn === 'fun_snapshot' ? empty : quiz;
  await view.rerender(<FamilyFunDiscovery />); await act(async () => { finish(guardian()); });
  expect(screen.queryByRole('button', { name: 'Review fan permissions' })).toBeNull(); expect(screen.queryByText('Selected campaign: Family cheer')).toBeNull(); readOnly();
});
it('unavailable source does not fabricate a private queue or completed recap', async () => {
  mockClient.handler = async fn => { if (fn === 'fun_snapshot') throw new Error('not applied'); return quiz; };
  await render(<FamilyFunDiscovery />); await screen.findByText('Fan Zone is unavailable.');
  expect(screen.queryByRole('button', { name: 'Review fan permissions' })).toBeNull(); expect(screen.queryByRole('button', { name: 'View fan recap' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh Fan Zone discovery' })); readOnly();
});
it('guest and mismatched canonical identity show no private discovery or source request', async () => {
  mockAuth.isGuest = true; const view = await render(<FamilyFunDiscovery />); await act(async () => {});
  expect(mockClient.calls).toHaveLength(0);
  mockAuth.isGuest = false; mockAuth.profile.user_id = 'other-auth'; await view.rerender(<FamilyFunDiscovery />);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Review fan permissions' })).toBeNull()); expect(mockClient.calls).toHaveLength(0);
});

it('does not advertise recognition while authorized results still require recount', async () => {
  const s = fanSnapshotFixture(); mockClient.fan = { ...s, campaign: { ...s.campaign!, status: 'finalized', recount_required: true }, entry: null, candidates: [], can_participate: false, results: [{ entry_id: FUN_IDS.entry, votes: 2 }] };
  await render(<FamilyFunDiscovery />); await act(async () => {});
  expect(screen.queryByRole('button', { name: 'View fan recap' })).toBeNull(); readOnly();
});
it('a newly returned exact private revision keeps guardian review visible', async () => {
  mockClient.fan = guardian(); const view = await render(<FamilyFunDiscovery />);
  await screen.findByRole('button', { name: 'Review fan permissions' });
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  const g = guardian(); const entry = g.guardian_queue[0];
  mockClient.fan = { ...g, guardian_queue: [{ ...entry, revision: 3, consent_scope: { ...entry.consent_scope, revision: 3 } }] };
  mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(await screen.findByRole('button', { name: 'Review fan permissions' })).toBeTruthy(); readOnly();
});
it('UTC week return only reads and dismissal renews from the actual returned campaign period', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-18T23:59:59Z'));
  const s = fanSnapshotFixture(); mockClient.fan = { ...s, entry: null, candidates: [] };
  await render(<FamilyFunDiscovery />); await fireEvent.press(await screen.findByRole('button', { name: 'Not now for Fan Zone' }));
  const count = mockClient.calls.filter(call => call.fn === 'fun_snapshot').length;
  mockClient.fan = { ...mockClient.fan, campaign: { ...s.campaign!, entry_opens_at: '2026-10-19T00:00:00Z' } };
  await act(async () => { jest.advanceTimersByTime(1100); });
  expect(screen.getByRole('button', { name: 'Open Fan Zone' })).toBeTruthy();
  expect(mockClient.calls.filter(call => call.fn === 'fun_snapshot').length).toBeGreaterThan(count); readOnly();
});

it('private guardian recovery stays visible without generic participation dismissal', async () => {
  mockClient.fan = { ...fanSnapshotFixture(), entry: null };
  const view = await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now for Fan Zone' }));
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  mockClient.fan = guardian(); mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(await screen.findByRole('button', { name: 'Review fan permissions' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Not now for Fan Zone' })).toBeNull();
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(await screen.findByRole('button', { name: 'Review fan permissions' })).toBeTruthy(); readOnly();
});
