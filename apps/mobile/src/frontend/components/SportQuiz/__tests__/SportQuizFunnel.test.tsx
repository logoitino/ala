/** Trivia funnel through the real screen: Start/answer/Next/complete order and payloads, abandonment without
 * completion, failed Start/answer issues, and missing content counted separately. Retry uses the pending answer's
 * explicit control so uncertainty cannot issue a new answer request. Database responses are synthetic. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import { telemetry } from '@/services/TelemetryManager';
import { quizHistory } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundSnapshot, roundStart, roundAnswer, roundNext, roundPlain, groupPage, myGroups, badgeShelf, seasonRecap } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { UserRole } from '@/types/database';
const mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null as string | null }, role: 'parent' as UserRole, isGuest: false, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { background: '#F3FAF6' } } }) }));
jest.mock('@/context/UploadSheetContext', () => ({ useUploadSheet: () => ({ openUpload: jest.fn() }) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals: { capture: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => '/sport-quiz', useIsFocused: () => true }));
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12, '0')}`, getRandomValues: (bytes: Uint8Array) => { bytes.fill(42); return bytes; } }));
type Handler = (fn: string, args: Record<string, unknown>) => unknown;
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], handler: (() => null) as Handler,
    async rpc(fn: string, args: Record<string, unknown>) { this.calls.push({ fn, args }); try { return { data: await this.handler(fn, args), error: null }; } catch (e) { return { data: null, error: { message: (e as Error).message } }; } } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
/** A small in-memory server: a round of `planned` questions, groups and badges. */
function server({ planned = 5, mine = myGroups(), page = groupPage() } = {}) {
    let snapshot = roundSnapshot; let position = 0; let answered = 0;
    return (fn: string, args: Record<string, unknown>): unknown => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return snapshot;
            case 'quiz_history': return quizHistory();
            case 'quiz_start': position = 1; snapshot = { ...snapshot, week_spent: true }; return roundStart(request, planned);
            case 'quiz_answer': answered += 1; return roundAnswer(request, Number(args.p_option), position, planned, answered);
            case 'quiz_next': position = Number(args.p_expected_position) + 1; return roundNext(request, position, planned);
            case 'quiz_end': return roundPlain('end', request, 'ended');
            case 'quiz_groups_mine': return mine;
            case 'quiz_group_page': return page;
            case 'quiz_badge_shelf': return badgeShelf();
            case 'quiz_season_recap': return seasonRecap;
            default: throw Error(`unexpected ${fn}`);
        }
    };
}
let stepSpy: jest.SpyInstance; let issueSpy: jest.SpyInstance;
beforeEach(() => { jest.clearAllMocks(); mockNonce = 0; mockClient.calls = []; Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() })); stepSpy = jest.spyOn(telemetry, 'trackTriviaStep').mockImplementation(() => { }); issueSpy = jest.spyOn(telemetry, 'trackIssue').mockImplementation(() => { }); });
afterEach(() => jest.restoreAllMocks());
async function prepare(sport = 'Basketball') {
    await fireEvent.press(await screen.findByRole('button', { name: `Choose ${sport}` }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
}
const actions = () => stepSpy.mock.calls.map(([action]) => action);

it('counts start, five answers, four Nexts and one completion with positions and counts', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await prepare();
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer 2: Two' }));
    await screen.findByRole('button', { name: 'Next' });
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'True' }));
    for (const position of [3, 4, 5]) {
        await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText(`Question ${position} of 5`)).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Answer 2: Two' }));
        if (position < 5) await screen.findByRole('button', { name: 'Next' });
    }
    expect(await screen.findByText('Round complete')).toBeTruthy();
    expect(actions()).toEqual(['view_prep', 'press_start', 'start', 'answer', 'next', 'answer', 'next', 'answer', 'next', 'answer', 'next', 'answer', 'complete']);
    expect(stepSpy.mock.calls[0]).toEqual(['view_prep', { kind: 'personal' }]);
    expect(stepSpy.mock.calls[1]).toEqual(['press_start', { kind: 'personal', topic: 'sport' }]);
    expect(stepSpy.mock.calls[2]).toEqual(['start', { kind: 'personal', mode: 'round', topic: 'sport', chapter: null, learn: false, durationMs: expect.any(Number) }]);
    expect(stepSpy.mock.calls.filter(([a]) => a === 'answer').map(([, d]) => d.position)).toEqual([1, 2, 3, 4, 5]);
    expect(stepSpy.mock.calls.filter(([a]) => a === 'next').map(([, d]) => d.position)).toEqual([1, 2, 3, 4]);
    expect(stepSpy.mock.calls.at(-1)).toEqual(['complete', { kind: 'personal', answered: 5, planned: 5, outcome: expect.any(String) }]);
    // No prompt, option or athlete/group text ever enters the funnel.
    expect(JSON.stringify(stepSpy.mock.calls)).not.toMatch(/basketball|Two|Three|True or false|ALTHLETE|group-/i);
    expect(issueSpy).not.toHaveBeenCalled();
});

it('counts abandonment once when End round interrupts an explanation, with no completion', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await prepare();
    await fireEvent.press(await screen.findByRole('button', { name: 'Answer 2: Two' }));
    await screen.findByRole('button', { name: 'Next' });
    await fireEvent.press(screen.getByRole('button', { name: 'End round' }));
    expect(await screen.findByText('Round ended')).toBeTruthy();
    expect(actions()).toEqual(['view_prep', 'press_start', 'start', 'answer', 'abandon']);
    expect(stepSpy.mock.calls.at(-1)).toEqual(['abandon', { kind: 'personal', reason: 'user_end', answered: 1, planned: 5 }]);
    expect(issueSpy).not.toHaveBeenCalled();
});

it('reports a failed Start as an issue after the press, with no confirmed start', async () => {
    const live = server();
    mockClient.handler = (fn, args) => { if (fn === 'quiz_start') throw Error('lost'); return live(fn, args); };
    await render(<SportQuizScreen/>);
    await prepare();
    await screen.findByRole('button', { name: 'Retry original Start' });
    expect(issueSpy).toHaveBeenCalledWith('trivia.start_failed', 'sport-quiz');
    expect(actions()).toEqual(['view_prep', 'press_start']);
});

it('counts a preparation viewed but never started as a view alone', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await screen.findByRole('button', { name: 'Choose Basketball' });
    expect(actions()).toEqual(['view_prep']);
    expect(issueSpy).not.toHaveBeenCalled();
});

it('reports a failed answer as an issue, then counts the retried answer once confirmed', async () => {
    const live = server(); let failed = false;
    mockClient.handler = (fn, args) => { if (fn === 'quiz_answer' && !failed) { failed = true; throw Error('lost'); } return live(fn, args); };
    await render(<SportQuizScreen/>);
    await prepare();
    await fireEvent.press(await screen.findByRole('button', { name: 'Answer 2: Two' }));
    expect(await screen.findByText(/Your answer was not confirmed/)).toBeTruthy();
    expect(issueSpy).toHaveBeenCalledWith('trivia.answer_failed', 'sport-quiz');
    expect(actions()).toEqual(['view_prep', 'press_start', 'start']);
    const pendingArgs = mockClient.calls.filter(call => call.fn === 'quiz_answer').at(-1)!.args;
    expect(screen.getByRole('button', { name: 'Answer 2: Two' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry this answer' }));
    await screen.findByRole('button', { name: 'Next' });
    expect(actions()).toEqual(['view_prep', 'press_start', 'start', 'answer']);
    expect(mockClient.calls.filter(call => call.fn === 'quiz_answer').map(call => call.args)).toEqual([pendingArgs, pendingArgs]);
});

it('counts missing content separately after Start when the question cannot show', async () => {
    const live = server();
    mockClient.handler = (fn, args) => fn === 'quiz_start' ? roundStart(String(args.p_request_id), 5, 'image_choice') : live(fn, args);
    await render(<SportQuizScreen/>);
    await prepare();
    expect(await screen.findByText(/isn’t available, so the round ended safely/)).toBeTruthy();
    expect(actions()).toEqual(['view_prep', 'press_start', 'start', 'unavailable']);
    expect(stepSpy.mock.calls.at(-1)).toEqual(['unavailable', { kind: 'personal', reason: 'user_end', answered: 0, planned: 5 }]);
    expect(issueSpy).not.toHaveBeenCalled();
});
