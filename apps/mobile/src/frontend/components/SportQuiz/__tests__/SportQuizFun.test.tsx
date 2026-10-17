/** QUIZ-04 fun presentation (2026-10-15): reveal text and cues (right / not quite / time up), cheers from the one list,
 * Reduce Motion (no confetti, wiggle or bounce), the saved Sound switch silencing cues, the summary celebration for
 * right or wrong answers, a one-time level-up, and answer / Next / End never blocked or delayed by effects.
 * Sound is mocked at `lib/quizSound`; confetti renders a marker. Database responses are synthetic. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import { SportQuizRound, SportQuizRoundSummary } from '@/components/SportQuiz/SportQuizRound';
import { QuizFxProvider, QuizSoundToggle, useQuizFx } from '@/components/SportQuiz/QuizFx';
import { ENCOURAGEMENTS, GENERAL_CHEERS, ROUND_CHEERS, SPORT_CHEERS, TIME_UP_CHEER, ZERO_FACTS_LINE, cheerFor } from '@/components/SportQuiz/quizCheers';
import { playQuizCue } from '@/lib/quizSound';
import type { TimedQuizRoundState } from '@/hooks/useTimedSportQuizRound';
import { quizHistory, quizNow } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundAnswer, roundNext, roundPlain, roundQuestion, roundResult, roundSnapshot, roundStart, badgeShelf, seasonRecap, myGroups } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { TriviaLevel } from '@shared/lifePlaybook';
import type { UserRole } from '@/types/database';

jest.mock('@/lib/quizSound', () => ({ playQuizCue: jest.fn(), armQuizSound: jest.fn(() => () => {}) }));
jest.mock('react-native-confetti-cannon', () => { const { View } = require('react-native'); return () => <View testID="confetti-cannon"/>; });
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
    async rpc(fn: string, args: Record<string, unknown>) {
        this.calls.push({ fn, args });
        try { const data = await this.handler(fn, args) as { __error?: unknown } | null; return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null }; }
        catch (e) { return { data: null, error: { message: (e as Error).message } }; }
    } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));

const cue = playQuizCue as jest.Mock;
const cues = () => cue.mock.calls.map(c => c[0]);
const hidden = { includeHiddenElements: true };
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
const missing = { __error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' } };
const th = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };
const level = (over: Partial<TriviaLevel> = {}): TriviaLevel => ({ contract_version: 4, profile_id: 'profile-a', facts: 39, rank: 1, level: 'varsity', level_label: 'Varsity', next_level: 'all_star', next_at: 40, thresholds: th, reached_at: quizNow, ...over });
const reduceMotion = (on: boolean) => (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.resolve(on));

beforeEach(async () => {
    jest.clearAllMocks(); mockNonce = 0; mockClient.calls = []; reduceMotion(false); await AsyncStorage.clear();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => jest.restoreAllMocks());

/** A round state for rendering SportQuizRound directly; only presentation fields matter here. */
function fakeRound(over: Partial<TimedQuizRoundState> = {}): TimedQuizRoundState {
    return { live: null, remainingSeconds: 0, busy: null, error: null, result: null, ended: false, pendingStart: false, pendingAnswer: null, mode: 'round', item: null, between: null,
        closing: false, pendingNext: null, entries: [], roundSize: 5, planned: 5, shortRound: false, endedEarly: false, unavailableQuestion: false, groupId: null, duration: 30, kind: 'personal',
        answer: jest.fn(async () => null), next: jest.fn(async () => null), leave: jest.fn(), dismiss: jest.fn(), ...over } as unknown as TimedQuizRoundState;
}
const between = (option: number | null, position = 1) => ({ attemptId: 'round-a', position, planned: 5, question: roundQuestion(position), result: roundResult(position, option) });
const show = (round: TimedQuizRoundState) => render(<QuizFxProvider focused><SportQuizRound round={round} busy={false}/></QuizFxProvider>);
const basketball = SPORT_CHEERS.find(r => r.match.includes('basketball'))!.cheers;

it('right answer: "That’s right!", a basketball cheer from the list, confetti, the answer glow and the correct cue', async () => {
    await show(fakeRound({ between: between(1) }));
    expect(screen.getByText('That’s right!')).toBeTruthy();
    expect(screen.getByText(cheerFor('Basketball', 1))).toBeTruthy();
    expect(basketball).toContain(cheerFor('Basketball', 1));
    expect(screen.getByText('Explanation for fact 1: it is the second choice.')).toBeTruthy();
    expect(await screen.findByTestId('confetti-cannon', hidden)).toBeTruthy();
    expect(screen.getByTestId('quiz-answer-glow')).toBeTruthy();
    expect(cues()).toEqual(['correct']);
});

it('not quite: the plain verdict stays, an encouragement from the list, a soft wiggle, no confetti, the gentle cue', async () => {
    await show(fakeRound({ between: between(0) }));
    expect(screen.getByText('Not quite. Here’s the fact:')).toBeTruthy();
    expect(ENCOURAGEMENTS.some(line => screen.queryByText(line))).toBe(true);
    expect(screen.getByText('Answer: Two')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('quiz-wiggle')).toBeTruthy());
    expect(screen.queryByTestId('confetti-cannon', hidden)).toBeNull();
    expect(screen.queryByTestId('quiz-answer-glow')).toBeNull();
    expect(cues()).toEqual(['notQuite']);
});

it('time ran out: a friendly "Whistle!", then the fact, and the time-up cue once', async () => {
    const view = await show(fakeRound({ between: between(null) }));
    expect(screen.getByText(TIME_UP_CHEER)).toBeTruthy();
    expect(screen.getByText('Time ran out on this one.')).toBeTruthy();
    expect(screen.getByText(/Explanation for fact 1/)).toBeTruthy();
    await view.rerender(<QuizFxProvider focused><SportQuizRound round={fakeRound({ between: between(null) })} busy={false}/></QuizFxProvider>);
    expect(cues()).toEqual(['timeUp']);
});

it('Reduce Motion: no confetti, wiggle or Next bounce; the words and the verdict stay', async () => {
    reduceMotion(true);
    await show(fakeRound({ between: between(1) }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(cheerFor('Basketball', 1))).toBeTruthy();
    expect(screen.queryByTestId('confetti-cannon', hidden)).toBeNull();
    expect(screen.queryByTestId('quiz-invite-bounce')).toBeNull();
    await screen.rerender(<QuizFxProvider focused><SportQuizRound round={fakeRound({ between: between(0, 2) })} busy={false}/></QuizFxProvider>);
    expect(screen.getByText('Not quite. Here’s the fact:')).toBeTruthy();
    expect(screen.queryByTestId('quiz-wiggle')).toBeNull();
    expect(screen.queryByTestId('confetti-cannon', hidden)).toBeNull();
});

it('an answer is sent on the press itself, even if the sound layer throws; Next is never held by its bounce', async () => {
    cue.mockImplementation(() => { throw Error('audio blew up'); });
    const live = fakeRound({ live: { question: roundQuestion(1), attemptId: 'round-a' }, item: { position: 1, planned: 5 }, remainingSeconds: 8 });
    const view = await show(live);
    expect(screen.getByText('8 seconds left')).toBeTruthy();
    expect(screen.getByTestId('quiz-timer-warm', hidden)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer 3: Three' }));
    expect(live.answer).toHaveBeenCalledWith(2);
    expect(cues()).toEqual(['tap']);
    const reveal = fakeRound({ between: between(1) });
    await view.rerender(<QuizFxProvider focused><SportQuizRound round={reveal} busy={false}/></QuizFxProvider>);
    await waitFor(() => expect(screen.getByTestId('quiz-invite-bounce')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(reveal.next).toHaveBeenCalledTimes(1);
});

it.each([[true, 'right'], [false, 'wrong']])('summary celebrates everyone who answered (all %s → %s): medal, cheer, badge shine, fanfare', async (right) => {
    const entries = [1, 2].map(position => ({ position, question: roundQuestion(position), result: roundResult(position, right ? 1 : 0) }));
    await render(<QuizFxProvider focused><SportQuizRoundSummary round={fakeRound({ ended: true, entries })}/></QuizFxProvider>);
    expect(screen.getByText('You learned 2 new facts')).toBeTruthy();
    expect(ROUND_CHEERS.some(line => screen.queryByText(line))).toBe(true);
    expect(screen.getByText('Trivia Explorer badge')).toBeTruthy();
    expect(screen.getByTestId('quiz-facts-medal', hidden)).toBeTruthy();
    expect(await screen.findByTestId('confetti-cannon', hidden)).toBeTruthy();
    expect(cues()).toEqual(['roundComplete']);
});

it('zero facts: a short friendly line, no confetti and no fanfare', async () => {
    const entries = [{ position: 1, question: roundQuestion(1), result: roundResult(1, null) }];
    await render(<QuizFxProvider focused><SportQuizRoundSummary round={fakeRound({ ended: true, entries })}/></QuizFxProvider>);
    expect(screen.getByText('No new facts this time, and that’s okay.')).toBeTruthy();
    expect(screen.getByText(ZERO_FACTS_LINE)).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('confetti-cannon', hidden)).toBeNull();
    expect(cues()).toEqual([]);
});

function Probe() { const fx = useQuizFx(); return <Pressable accessibilityRole="button" accessibilityLabel="probe" onPress={() => fx.play('correct')}><Text>probe</Text></Pressable>; }
it('Sound off is saved on this device, silences cues, and is remembered next time', async () => {
    const view = await render(<QuizFxProvider focused><QuizSoundToggle/><Probe/></QuizFxProvider>);
    const toggle = screen.getByRole('switch', { name: 'Trivia sound' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('🔊 Sound on')).toBeTruthy();
    await fireEvent.press(toggle);
    expect(screen.getByText('🔇 Sound off')).toBeTruthy();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('tapuai.trivia.sound.v1', 'off');
    await fireEvent.press(screen.getByRole('button', { name: 'probe' }));
    expect(cue).toHaveBeenLastCalledWith('correct', false);
    await view.unmount();
    await render(<QuizFxProvider focused><QuizSoundToggle/></QuizFxProvider>);
    expect(await screen.findByText('🔇 Sound off')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Trivia sound' }).props.accessibilityState).toMatchObject({ checked: false });
});

it('every cheer comes from the one list, per sport where it fits and the general list otherwise', () => {
    expect(cheerFor('American football', 0)).toBe('Touchdown!');
    expect(cheerFor('Basketball', 0)).toBe('Nothing but net!');
    expect(cheerFor('Soccer', 0)).toBe('Goal!');
    expect(cheerFor('Tennis', 0)).toBe('Ace!');
    expect(cheerFor('Baseball', 0)).toBe('Home run!');
    expect(cheerFor('Money Huddle', 0)).toBe('Bullseye!');
    expect(GENERAL_CHEERS).toContain(cheerFor('Science', 7));
    expect(cheerFor('Basketball', 1)).not.toBe(cheerFor('Basketball', 2));
});

it('level up celebrates once after a round (compared with the level before it), and End stays available during a reveal', async () => {
    let levelRead = level();
    mockClient.handler = (fn, args) => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return roundSnapshot;
            case 'quiz_history': return quizHistory();
            case 'quiz_start': return roundStart(request, 2);
            case 'quiz_answer': { const position = calls('quiz_answer').length; if (position === 2) levelRead = level({ facts: 41, level: 'all_star', level_label: 'All-Star', next_level: 'pro', next_at: 80 }); return roundAnswer(request, Number(args.p_option), position, 2); }
            case 'quiz_next': return roundNext(request, Number(args.p_expected_position) + 1, 2);
            case 'quiz_end': return roundPlain('end', request, 'ended');
            case 'quiz_level': return levelRead;
            case 'quiz_groups_mine': return myGroups();
            case 'quiz_badge_shelf': return badgeShelf();
            case 'quiz_season_recap': return seasonRecap;
            default: return missing;
        }
    };
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose Basketball' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Answer 2: Two' }));
    expect(await screen.findByText('That’s right!')).toBeTruthy();
    // End is not held by the confetti or the cue (the next test presses it); here we continue to reach the level-up.
    expect(screen.getByRole('button', { name: 'End round' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'True' }));
    expect(await screen.findByText('Level up: All-Star!')).toBeTruthy();
    expect(screen.getByText('You reached All-Star. Levels never go down.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Trivia sound' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Refresh quiz' }));
    await waitFor(() => expect(calls('quiz_level').length).toBeGreaterThanOrEqual(3));
    expect(screen.getAllByText('Level up: All-Star!')).toHaveLength(1);
    expect(cues().filter(c => c === 'levelUp')).toHaveLength(1);
    expect(cues()).toEqual(expect.arrayContaining(['tap', 'correct', 'roundComplete', 'levelUp']));
});

it('End round during a reveal sends End immediately', async () => {
    mockClient.handler = (fn, args) => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return roundSnapshot;
            case 'quiz_history': return quizHistory();
            case 'quiz_start': return roundStart(request, 5);
            case 'quiz_answer': return roundAnswer(request, Number(args.p_option), 1, 5);
            case 'quiz_end': return roundPlain('end', request, 'ended');
            case 'quiz_groups_mine': return myGroups();
            case 'quiz_badge_shelf': return badgeShelf();
            case 'quiz_season_recap': return seasonRecap;
            default: return missing;
        }
    };
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose Basketball' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Answer 1: One' }));
    expect(await screen.findByText('Not quite. Here’s the fact:')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'End round' }));
    expect(calls('quiz_end')).toHaveLength(1);
    expect(await screen.findByText('Round ended')).toBeTruthy();
});
