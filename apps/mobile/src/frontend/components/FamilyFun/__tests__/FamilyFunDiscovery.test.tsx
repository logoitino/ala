/** Quiz discovery exercises the real invitation/hook/SDK with synthetic RPC responses and external account/navigation boundaries. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { FamilyFunDiscovery } from '../FamilyFunDiscovery';
import type { QuizSnapshot } from '@shared/sportQuiz';
let mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null as string | null }, role: 'fan', isGuest: false, loading: false };
let mockFocused = true;
const mockPush = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => mockFocused }));
const available: QuizSnapshot = { availability: 'ready', testing_only: true, week_start: '2026-10-12', week_end: '2026-10-19', status: 'available', sports: ['Basketball'], attempt: null, badges: [], corrections: [] };
const mockClient = { calls: [] as string[], current: available, handler: null as null | ((fn: string) => Promise<QuizSnapshot>),
  async rpc(fn: string) {
    this.calls.push(fn);
    if (this.handler) return { data: await this.handler(fn), error: null };
    if (fn === 'quiz_skip') this.current = { ...available, status: 'skipped', attempt: { id: 'skip-a', week_start: available.week_start, sport: null, status: 'skipped', question: null, result: null } };
    return { data: this.current, error: null };
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
beforeEach(() => { jest.clearAllMocks(); mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null }, role: 'fan', isGuest: false, loading: false }; mockFocused = true; mockClient.calls = []; mockClient.current = available; mockClient.handler = null; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(['fan', 'athlete', 'parent', 'operator', 'booster', 'sponsor', 'admin'])('offers an optional root quiz to enrolled %s without starting on discovery', async role => {
  mockAuth.role = role;
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Open quiz' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(mockClient.calls.every(fn => fn === 'quiz_snapshot')).toBe(true);
});
it('Not now hides only this identity/week presentation without writing Skip', async () => {
  const view = await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  expect(screen.queryByText('Sport Pop Quiz')).toBeNull();
  expect(mockClient.calls).not.toContain('quiz_skip');
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(screen.queryByRole('button', { name: 'Open quiz' })).toBeNull();
});
it('clears local dismissal on canonical/auth switch, including returning to the previous account', async () => {
  const view = await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  mockAuth = { ...mockAuth, user: { id: 'auth-b' }, profile: { ...mockAuth.profile, id: 'profile-b', user_id: 'auth-b' } };
  await view.rerender(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Open quiz' });
  mockAuth = { ...mockAuth, user: { id: 'auth-a' }, profile: { ...mockAuth.profile, id: 'profile-a', user_id: 'auth-a' } };
  await view.rerender(<FamilyFunDiscovery />); expect(await screen.findByRole('button', { name: 'Open quiz' })).toBeTruthy();
});
it('keeps failed Skip visible with honest notice, independent Refresh and usable local Not now', async () => {
  mockClient.handler = async fn => { if (fn === 'quiz_skip') throw new Error('reply lost'); return available; };
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip this week' }));
  expect(await screen.findByText(/Skip was not confirmed/)).toBeTruthy();
  expect(screen.queryByText(/Skipped for this week/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh quiz' }));
  expect(await screen.findByRole('button', { name: 'Open quiz' })).toBeTruthy();
});
it('claims saved Skip only from authoritative skipped status', async () => {
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip this week' }));
  expect(await screen.findByText('Skipped for this week.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open quiz' })).toBeNull();
});
it('leaves local Not now usable while Skip is in flight, without cancelling or pretending it was saved', async () => {
  let resolve!: (s: QuizSnapshot) => void;
  const pending = new Promise<QuizSnapshot>(done => { resolve = done; });
  mockClient.handler = async fn => fn === 'quiz_skip' ? pending : available;
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip this week' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByText('Sport Pop Quiz')).toBeNull();
  await act(async () => { resolve(available); });
  expect(screen.queryByText('Skipped for this week.')).toBeNull();
  expect(mockClient.calls.filter(fn => fn === 'quiz_skip')).toHaveLength(1);
});
it('shows missing source with Refresh and local exit, without badges, healthy zeros or a new assignment', async () => {
  mockClient.handler = async () => { throw new Error('missing RPC'); };
  await render(<FamilyFunDiscovery />);
  expect(await screen.findByText('Sport Pop Quiz is unavailable.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh quiz' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByText('Sport Pop Quiz is unavailable.')).toBeNull();
  expect(mockClient.calls.every(fn => fn === 'quiz_snapshot')).toBe(true);
});
it('refreshes on return and uses the returned server week to renew local invitation', async () => {
  const view = await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  const count = mockClient.calls.length;
  mockFocused = false; await view.rerender(<FamilyFunDiscovery />);
  mockClient.current = { ...available, week_start: '2026-10-19', week_end: '2026-10-26' };
  mockFocused = true; await view.rerender(<FamilyFunDiscovery />);
  expect(await screen.findByRole('button', { name: 'Open quiz' })).toBeTruthy();
  expect(mockClient.calls.length).toBeGreaterThan(count);
  expect(mockClient.calls.every(fn => fn === 'quiz_snapshot')).toBe(true);
});
it('reads at UTC week boundary without assigning and renews only when the server returns the new week', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-18T23:59:59Z'));
  await render(<FamilyFunDiscovery />); await screen.findByRole('button', { name: 'Open quiz' });
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  const count = mockClient.calls.length;
  mockClient.current = { ...available, week_start: '2026-10-19', week_end: '2026-10-26' };
  await act(async () => { jest.advanceTimersByTime(1100); });
  expect(screen.getByRole('button', { name: 'Open quiz' })).toBeTruthy();
  expect(mockClient.calls.length).toBeGreaterThan(count);
  expect(mockClient.calls.every(fn => fn === 'quiz_snapshot')).toBe(true);
});
it('reads on app return and renews dismissal only from the new server week', async () => {
  let returned!: (state: 'active') => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { returned = listener; return { remove: jest.fn() }; });
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  mockClient.current = { ...available, week_start: '2026-10-19', week_end: '2026-10-26' };
  await act(async () => { returned('active'); });
  expect(screen.getByRole('button', { name: 'Open quiz' })).toBeTruthy();
  expect(mockClient.calls.every(fn => fn === 'quiz_snapshot')).toBe(true);
});
it.each(['paused', 'not_enrolled'] as const)('links actual private history while %s without participation', async availability => {
  mockClient.current = { ...available, availability, status: 'unavailable', badges: [{ id: 'old', attempt_id: 'old', week_start: '2026-10-05', label: 'Sport Learner', visibility: 'private', issued_at: '2026-10-06T00:00:00Z' }] };
  await render(<FamilyFunDiscovery />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Private quiz history' }));
  expect(mockPush).toHaveBeenCalledWith('/sport-quiz');
  expect(screen.queryByRole('button', { name: 'Skip this week' })).toBeNull();
});
it('does not expose a delayed previous-account invitation or failed-Skip notice', async () => {
  let resolve!: (s: QuizSnapshot) => void;
  const prior = new Promise<QuizSnapshot>(done => { resolve = done; });
  mockClient.handler = async () => prior;
  const view = await render(<FamilyFunDiscovery />);
  mockAuth = { ...mockAuth, user: { id: 'auth-b' }, profile: { ...mockAuth.profile, id: 'profile-b', user_id: 'auth-b' } };
  mockClient.handler = async () => ({ ...available, availability: 'not_enrolled', status: 'unavailable' });
  await view.rerender(<FamilyFunDiscovery />);
  await act(async () => { resolve(available); });
  expect(screen.queryByRole('button', { name: 'Open quiz' })).toBeNull();
});
it.each(['guest', 'mismatch', 'blocked'])('does not request or show participant source for %s account setup', async state => {
  if (state === 'guest') mockAuth.isGuest = true;
  if (state === 'mismatch') mockAuth.profile.user_id = 'other-auth';
  if (state === 'blocked') mockAuth.profile.age_blocked_at = '2026-10-14T00:00:00Z';
  await render(<FamilyFunDiscovery />);
  await waitFor(() => expect(screen.queryByText('Sport Pop Quiz')).toBeNull());
  expect(mockClient.calls).toEqual([]);
});
