/** QUIZ-05 participant round pieces: "Report a problem with this question" (reasons, the private reason only on fun
 * facts, the confirmation, the already-reported / daily-limit / intake-paused states, Next never held), the
 * "Fun fact: {first name}" header and the athlete card (no Donate or money words), `fact_unavailable`, and history's
 * "Removed by the athlete". Sound is mocked; database replies are synthetic. */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SportQuizRound, SportQuizRoundSummary } from '@/components/SportQuiz/SportQuizRound';
import { SportQuizHistory } from '@/components/SportQuiz/SportQuizHistory';
import { QuizFxProvider } from '@/components/SportQuiz/QuizFx';
import { useQuestionReports } from '@/components/SportQuiz/QuestionReport';
import type { TimedQuizRoundState } from '@/hooks/useTimedSportQuizRound';
import type { SportQuizState } from '@/hooks/useSportQuiz';
import { roundQuestion, roundResult } from '@/lib/__fixtures__/triviaRoundFixtures';
import { quizSnapshot } from '@/lib/__fixtures__/timedSportQuizFixtures';
import * as privacy from '@/lib/privacy';
import type { TimedQuizQuestion, TimedQuizResult } from '@shared/timedSportQuiz';

jest.mock('@/lib/quizSound', () => ({ playQuizCue: jest.fn(), armQuizSound: jest.fn(() => () => {}) }));
jest.mock('react-native-confetti-cannon', () => { const { View } = require('react-native'); return () => <View testID="confetti-cannon"/>; });
jest.mock('@/lib/privacy', () => ({ ...jest.requireActual('@/lib/privacy'), getPublicProfiles: jest.fn(async () => []) }));
const mockAddAura = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/lib/aura', () => ({ addUserAura: (...args: unknown[]) => mockAddAura(...args) }));
type Handler = (fn: string, args: Record<string, unknown>) => unknown;
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], handler: (() => null) as Handler,
    async rpc(fn: string, args: Record<string, unknown>) {
        this.calls.push({ fn, args });
        const data = await this.handler(fn, args) as { __error?: unknown } | null;
        return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null };
    } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const publicProfiles = jest.mocked(privacy.getPublicProfiles);
const reportCalls = () => mockClient.calls.filter(c => c.fn === 'quiz_report');
const MONEY = /donat|\$|tip|checkout|pay|fund|back(ing|er)/i;

beforeEach(() => {
    jest.clearAllMocks(); mockClient.calls = []; publicProfiles.mockResolvedValue([]);
    mockClient.handler = (fn, args) => fn === 'quiz_report' ? { contract_version: 5, outcome: 'reported', question_id: args.p_question_id } : null;
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

/** A QUIZ-05 question (it carries `shuffled`); a fun fact has topic 'athlete' and the server's name. */
const fresh = (position: number, over: Partial<TimedQuizQuestion> = {}): TimedQuizQuestion => ({ ...roundQuestion(position, 'choice4'), shuffled: true, ...over });
const fact = (position: number, name: string | null = 'Malia'): TimedQuizQuestion => fresh(position, {
    topic_category: 'athlete', sport: 'Fun fact', prompt: `Which song gets ${name ?? 'this athlete'} hyped before a game?`,
    options: ['Eye of the Tiger', 'Thunderstruck', 'Sweet Caroline', 'Believer'], fun_fact: { first_name: name, prompt_key: 'hype_song' } });
const card = (r: TimedQuizResult): TimedQuizResult => ({ ...r, explanation: 'Shared by Malia as a fun fact.', fun_fact: { first_name: 'Malia', athlete_player_id: 'player-9' } });
const unavailable = (position: number): TimedQuizResult => ({ answered_option: null, correct_option: 0, was_correct: null, explanation: 'Fun fact no longer available.', completed_at: null,
    position, item_status: 'fact_unavailable', answered_position: null, correct_position: null, shown_order: null });

function fakeRound(over: Partial<TimedQuizRoundState> = {}): TimedQuizRoundState {
    return { live: null, remainingSeconds: 0, busy: null, error: null, result: null, ended: false, pendingStart: false, pendingAnswer: null, mode: 'round', item: null, between: null,
        closing: false, pendingNext: null, entries: [], roundSize: 5, planned: 5, shortRound: false, endedEarly: false, unavailableQuestion: false, groupId: null, duration: 30, kind: 'personal',
        answer: jest.fn(async () => null), next: jest.fn(async () => null), leave: jest.fn(), dismiss: jest.fn(), ...over } as unknown as TimedQuizRoundState;
}
const between = (question: TimedQuizQuestion, result: TimedQuizResult, position = 1) => ({ attemptId: 'round-a', position, planned: 5, question, result });
/** The screen's wiring: one report state per account, shared by the reveal and the summary. */
function Harness({ round, summary = false, profileId = 'profile-a' }: { round: TimedQuizRoundState; summary?: boolean; profileId?: string | null }) {
    const reports = useQuestionReports(profileId);
    return <QuizFxProvider focused>{summary ? <SportQuizRoundSummary round={round} reports={reports}/> : <SportQuizRound round={round} busy={false} reports={reports}/>}</QuizFxProvider>;
}
const openSheet = async () => { await fireEvent.press(screen.getByRole('button', { name: 'Report a problem with this question' })); };

describe('Report a problem', () => {
    it('an ordinary question offers three reasons (no free text, no private reason) and confirms plainly', async () => {
        await render(<Harness round={fakeRound({ between: between(fresh(1), roundResult(1, 1)) })}/>);
        await openSheet();
        for (const name of ['Wrong answer', 'Confusing', 'Not okay']) expect(screen.getByRole('button', { name })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Shares something private' })).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Confusing' }));
        expect(await screen.findByText('Thanks. We’ll take a look.')).toBeTruthy();
        expect(reportCalls()).toEqual([{ fn: 'quiz_report', args: { p_question_id: 'question-1', p_reason: 'confusing', p_expected_profile_id: 'profile-a' } }]);
        // Finished: no more reasons; the link says so; Done closes the sheet.
        expect(screen.queryByRole('button', { name: 'Wrong answer' })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
        expect(screen.getByText('Reported. Thanks.')).toBeTruthy();
    });

    it('a fun fact adds "Shares something private"', async () => {
        await render(<Harness round={fakeRound({ between: between(fact(2), card(roundResult(2, 1)), 2) })}/>);
        await openSheet();
        await fireEvent.press(screen.getByRole('button', { name: 'Shares something private' }));
        await waitFor(() => expect(reportCalls()[0]?.args.p_reason).toBe('private'));
    });

    it.each<[string, () => unknown, string]>([
        ['already reported', () => ({ contract_version: 5, outcome: 'already_reported', question_id: 'question-1' }), 'You already reported this question. Thanks, we have it.'],
        ['report intake paused', () => ({ contract_version: 5, outcome: 'paused', question_id: 'question-1' }), 'We’re not taking reports right now. Please try again later.'],
        ['the daily limit', () => ({ __error: { message: 'quiz_report_limit' } }), 'You’ve sent the most reports for today. You can report again tomorrow.'],
        ['a failed send', () => ({ __error: { message: 'network down' } }), 'Your report didn’t send. Check your connection and try again.'],
    ])('%s is said quietly and honestly in a polite live region', async (_label, reply, words) => {
        mockClient.handler = reply as Handler;
        await render(<Harness round={fakeRound({ between: between(fresh(1), roundResult(1, 0)) })}/>);
        await openSheet();
        await fireEvent.press(screen.getByRole('button', { name: 'Wrong answer' }));
        const line = await screen.findByText(words);
        expect(line.props.accessibilityLiveRegion).toBe('polite');
        expect(screen.queryByText('Thanks. We’ll take a look.')).toBeNull();
    });

    it('never holds Next: Next works while a report is still sending', async () => {
        let release: (v: unknown) => void = () => {};
        mockClient.handler = () => new Promise(r => { release = r; });
        const round = fakeRound({ between: between(fresh(1), roundResult(1, 1)) });
        await render(<Harness round={round}/>);
        await openSheet();
        await fireEvent.press(screen.getByRole('button', { name: 'Not okay' }));
        expect(screen.getByText('Sending…')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
        const next = screen.getByRole('button', { name: 'Next' });
        expect(next).toBeEnabled();
        await fireEvent.press(next);
        expect(round.next).toHaveBeenCalledTimes(1);
        await act(async () => { release({ contract_version: 5, outcome: 'reported', question_id: 'question-1' }); });
    });

    it('is not offered on an older server, a corrected question, or without an account', async () => {
        const view = await render(<Harness round={fakeRound({ between: between(roundQuestion(1, 'choice4'), roundResult(1, 1)) })}/>);
        expect(screen.queryByRole('button', { name: 'Report a problem with this question' })).toBeNull();
        await view.rerender(<Harness round={fakeRound({ between: between(fresh(1), roundResult(1, null, 'void')) })}/>);
        expect(screen.queryByRole('button', { name: 'Report a problem with this question' })).toBeNull();
        await view.rerender(<Harness profileId={null} round={fakeRound({ between: between(fresh(1), roundResult(1, 1)) })}/>);
        expect(screen.queryByRole('button', { name: 'Report a problem with this question' })).toBeNull();
    });

    it('the round summary offers it for the last question too', async () => {
        const entries = [{ position: 1, question: fresh(1), result: roundResult(1, 1) }];
        await render(<Harness summary round={fakeRound({ ended: true, entries })}/>);
        await openSheet();
        await fireEvent.press(screen.getByRole('button', { name: 'Wrong answer' }));
        expect(await screen.findByText('Thanks. We’ll take a look.')).toBeTruthy();
    });
});

describe('Fun fact: {first name}', () => {
    it('the live question shows the header instead of the sport line', async () => {
        await render(<Harness round={fakeRound({ live: { question: fact(2), attemptId: 'round-a' }, item: { position: 2, planned: 5 }, remainingSeconds: 25 })}/>);
        expect(screen.getByRole('header', { name: 'Fun fact: Malia' })).toBeTruthy();
        expect(screen.queryByText('Fun fact', { exact: true })).toBeNull();
        expect(screen.getByRole('button', { name: 'Answer 1: Eye of the Tiger' })).toBeTruthy();
        // Screen readers hear the header with the question number, not only by finding it.
        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Question 2 of 5. Fun fact: Malia');
    });

    it('after the reveal: the header and the athlete card (photo, sport, first name) with no money words', async () => {
        publicProfiles.mockResolvedValue([{ id: 'p9', player_id: 'player-9', avatar_url: 'https://example.test/malia.jpg', athlete_sport: 'Volleyball' } as never]);
        await render(<Harness round={fakeRound({ between: between(fact(2), card(roundResult(2, 1)), 2) })}/>);
        expect(screen.getByRole('header', { name: 'Fun fact: Malia' })).toBeTruthy();
        expect(await screen.findByLabelText('Fun fact shared by Malia, Volleyball')).toBeTruthy();
        expect(screen.getByTestId('fun-fact-photo', { includeHiddenElements: true })).toBeTruthy();
        expect(publicProfiles).toHaveBeenCalledWith({ playerIds: ['player-9'] });
        const all = screen.toJSON();
        expect(JSON.stringify(all)).not.toMatch(/Donate|donation|\$\d/);
        expect(screen.queryByRole('button', { name: MONEY })).toBeNull();
    });

    it('initials when there is no photo; no card when the server sends none', async () => {
        const view = await render(<Harness round={fakeRound({ between: between(fact(2), card(roundResult(2, 0)), 2) })}/>);
        expect(await screen.findByTestId('fun-fact-initials', { includeHiddenElements: true })).toBeTruthy();
        await view.rerender(<Harness round={fakeRound({ between: between(fact(3), roundResult(3, 0), 3) })}/>);
        expect(screen.queryByLabelText(/Fun fact shared by/)).toBeNull();
    });

    it('Reduce Motion: the header and card still show, with no confetti', async () => {
        (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.resolve(true));
        await render(<Harness round={fakeRound({ between: between(fact(2), card(roundResult(2, 1)), 2) })}/>);
        await act(async () => { await Promise.resolve(); });
        expect(screen.getByRole('header', { name: 'Fun fact: Malia' })).toBeTruthy();
        expect(await screen.findByLabelText('Fun fact shared by Malia')).toBeTruthy();
        expect(screen.queryByTestId('confetti-cannon', { includeHiddenElements: true })).toBeNull();
    });

    it('fact_unavailable: "This fun fact isn’t available anymore." with no answer, explanation, cheer, card or report', async () => {
        await render(<Harness round={fakeRound({ between: between(fact(2), unavailable(2), 2) })}/>);
        expect(screen.getByText('This fun fact isn’t available anymore.')).toBeTruthy();
        expect(screen.queryByText(/^Answer:/)).toBeNull();
        expect(screen.queryByText('Fun fact no longer available.')).toBeNull();
        expect(screen.queryByText(/Which song gets/)).toBeNull();
        expect(screen.queryByLabelText(/Fun fact shared by/)).toBeNull();
        expect(screen.queryByRole('button', { name: 'Report a problem with this question' })).toBeNull();
        expect(screen.queryByTestId('confetti-cannon', { includeHiddenElements: true })).toBeNull();
        expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
        expect(publicProfiles).not.toHaveBeenCalled();
    });

    it('the summary counts an unavailable fun fact as not available (not a fact learned)', async () => {
        const entries = [{ position: 1, question: fresh(1), result: roundResult(1, 1) }, { position: 2, question: fact(2), result: unavailable(2) }];
        await render(<Harness summary round={fakeRound({ ended: true, entries })}/>);
        expect(screen.getByText('You learned 1 new fact')).toBeTruthy();
        expect(screen.getByText('Question 2: not available')).toBeTruthy();
        expect(screen.getByText('This fun fact isn’t available anymore.')).toBeTruthy();
    });
});

describe('History', () => {
    const quiz = (items: unknown[]) => ({ snapshot: quizSnapshot, history: { items, next_before: null }, historyLoading: false, historyError: null, busy: null, loading: false,
        erasureUncertain: false, refresh: jest.fn(async () => {}), loadHistory: jest.fn(async () => {}), eraseHistory: jest.fn() }) as unknown as SportQuizState;
    const attempt = { id: 'round-a', week_start: '2026-10-12', status: 'completed', round_kind: 'personal', correction_reason: null };
    it('shows the server’s "Removed by the athlete" once, and the unavailable line, with nothing else of the fact', async () => {
        const removedQuestion = fresh(2, { topic_category: 'athlete', sport: 'Fun fact', prompt: 'Removed by the athlete', options: ['Removed by the athlete', 'A', 'B', 'C'] });
        const items = [{ attempt, question: null, result: null, badge: null, items: [
            { position: 1, status: 'answered', question: fresh(1), result: roundResult(1, 1), correction_reason: null },
            { position: 2, status: 'answered', question: removedQuestion, result: { ...roundResult(2, 0), explanation: 'Removed by the athlete.' }, correction_reason: null },
            { position: 3, status: 'void', question: fact(3, null), result: unavailable(3), correction_reason: 'Fun fact no longer available' },
        ] }];
        await render(<SportQuizHistory quiz={quiz(items)} onBeforeErase={jest.fn()}/>);
        expect(screen.getByText('Question 2 (Fun fact): removed')).toBeTruthy();
        expect(screen.getAllByText('Removed by the athlete')).toHaveLength(1);
        expect(screen.queryByText('Removed by the athlete.')).toBeNull();
        expect(screen.getByText('Question 3 (Fun fact): not available')).toBeTruthy();
        expect(screen.getByText('This fun fact isn’t available anymore.')).toBeTruthy();
        expect(screen.queryByText(/Correction: Fun fact/)).toBeNull();
        expect(within(screen.getByText('Question 1: right').parent!).queryByText(/Fun fact/)).toBeNull();
    });
});

describe('Trivia Aura', () => {
    it('a right answer awards Aura once to the signed-in account; a wrong answer awards nothing', async () => {
        const right = fakeRound({ between: between(fresh(1), roundResult(1, 1)) });
        const view = await render(<QuizFxProvider focused><SportQuizRound round={right} busy={false} auraUserId="user-a"/></QuizFxProvider>);
        await view.rerender(<QuizFxProvider focused><SportQuizRound round={right} busy={false} auraUserId="user-a"/></QuizFxProvider>);
        expect(mockAddAura).toHaveBeenCalledTimes(1);
        expect(mockAddAura).toHaveBeenCalledWith('user-a', 5);
        await view.rerender(<QuizFxProvider focused><SportQuizRound round={fakeRound({ between: between(fresh(2), roundResult(2, 0), 2) })} busy={false} auraUserId="user-a"/></QuizFxProvider>);
        expect(mockAddAura).toHaveBeenCalledTimes(1);
    });

    it('the demo round (no account) never awards Aura', async () => {
        await render(<QuizFxProvider focused><SportQuizRound round={fakeRound({ between: between(fresh(1), roundResult(1, 1)) })} busy={false}/></QuizFxProvider>);
        expect(mockAddAura).not.toHaveBeenCalled();
    });
});
