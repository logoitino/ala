/** QUIZ-04 visible journeys with the real screen, hooks and SDK validators: the "This week" strip, the personal level,
 * the Life Playbook opt-in (notice version, Turn on / Not now / Turn off), the Life home (only returned chapters, no
 * age or unlock wording, progress as "seen N of M"), a Life round through quiz_life_start, quiet hiding when the Life
 * migration is missing, honest retry wording, history labels / correction notes / erase copy, group pages without
 * Life, and no Donate or money controls on Life screens. Database responses are synthetic.
 */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import { LIFE_READ_ERROR } from '@/hooks/useLifePlaybook';
import { quizHistory, quizNow, quizReceipt } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundSnapshot, roundStart, roundAnswer, roundAttempt, roundPlain, groupPage, myGroups, badgeShelf, seasonRecap } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { TimedQuizSnapshot, TimedQuizHistoryPage, TimedQuizQuestion } from '@shared/timedSportQuiz';
import type { LifeChapter, LifeChapterProgress, LifeSnapshot, TriviaLevel } from '@shared/lifePlaybook';
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
/** A handler may throw (plain error message) or return { __error } to send a PostgREST error code. */
type Handler = (fn: string, args: Record<string, unknown>) => unknown;
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], handler: (() => null) as Handler,
    async rpc(fn: string, args: Record<string, unknown>) {
        this.calls.push({ fn, args });
        try {
            const data = await this.handler(fn, args) as { __error?: { code: string; message: string } } | null;
            return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null };
        }
        catch (e) { return { data: null, error: { message: (e as Error).message } }; }
    } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
const missing = { __error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' } };
const plus = (seconds: number) => new Date(Date.parse(quizNow) + seconds * 1000).toISOString();
const th = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };

const separateSnapshot: TimedQuizSnapshot = { ...roundSnapshot, week_spent_by_kind: { personal: false, group: false, life: false }, active_round_kind: null };
function lifeSnapshot(over: Partial<LifeSnapshot> = {}, optedIn = true): LifeSnapshot {
    return { contract_version: 4, profile_id: 'profile-a', server_now: quizNow, week_start: roundSnapshot.week_start, week_end: roundSnapshot.week_end, testing_only: true,
        availability: optedIn ? 'ready' : 'not_opted_in', notice_version: 'life-playbook-v1-testing',
        preferences: { life_opt_in: optedIn, life_notice_version: optedIn ? 'life-playbook-v1-testing' : null, life_opted_in_at: optedIn ? quizNow : null, life_version: optedIn ? 1 : 0 },
        week_spent: false, attempt: null, active_round_kind: null, default_duration_seconds: 90, round_size: 5, chapters_open: 1, unseen_count: 20, ...over };
}
/** Chapters as the server returns them (all four are 13+ since the 2026-10-15 owner simplification); here the server
 * returns three, so the screen must not name the fourth even when progress mentions it. */
const serverChapters: LifeChapter[] = [
    { id: 'money_huddle', title: 'Money Huddle', framing: 'Calling the play before you spend', position: 1, open: true, unseen_count: 20 },
    { id: 'savings_season', title: 'Savings Season', framing: 'Building your bench', position: 2, open: false, unseen_count: 0 },
    { id: 'scam_defense', title: 'Scam Defense', framing: 'Defense wins', position: 3, open: false, unseen_count: 0 },
];
const chapterProgress = (id: LifeChapterProgress['id'], title: string, over: Partial<LifeChapterProgress> = {}): LifeChapterProgress =>
    ({ id, title, approved_count: 20, seen_count: 5, progress: 0.25, facts: 5, rank: 0, level: 'rookie', level_label: 'Rookie', badge_earned: false, ...over });
const level = (over: Partial<TriviaLevel> = {}): TriviaLevel => ({ contract_version: 4, profile_id: 'profile-a', facts: 16, rank: 1, level: 'varsity', level_label: 'Varsity',
    next_level: 'all_star', next_at: 40, thresholds: th, reached_at: quizNow, ...over });
const lifeQuestion = (position: number): TimedQuizQuestion => ({ id: `life-${position}`, question_key: `life-family-${position}`, version: 1, topic_category: 'life', sport: 'Money Huddle',
    prompt: `Life question ${position}: a budget is a game plan for what?`, options: ['Spending', 'Sleep', 'Travel', 'Music'], question_type: 'choice4' });

type ServerOptions = { snapshot?: TimedQuizSnapshot; life?: LifeSnapshot | typeof missing | 'error'; chapters?: LifeChapter[]; progress?: LifeChapterProgress[];
    levelRead?: TriviaLevel | typeof missing; history?: TimedQuizHistoryPage; mine?: ReturnType<typeof myGroups> };
/** A small in-memory server for trivia, Life and level reads, the opt-in and a Life round. */
function server(o: ServerOptions = {}) {
    let snapshot = o.snapshot ?? separateSnapshot;
    let life = o.life ?? lifeSnapshot();
    return (fn: string, args: Record<string, unknown>): unknown => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return snapshot;
            case 'quiz_history': return o.history ?? quizHistory();
            case 'quiz_groups_mine': return o.mine ?? myGroups();
            case 'quiz_group_page': return groupPage();
            case 'quiz_badge_shelf': return badgeShelf();
            case 'quiz_season_recap': return seasonRecap;
            case 'quiz_level': return o.levelRead ?? level();
            case 'quiz_life_snapshot': if (life === 'error') throw Error('network down'); return life;
            case 'quiz_life_chapters': return { contract_version: 4, profile_id: 'profile-a', chapters: o.chapters ?? serverChapters };
            case 'quiz_life_progress': return { contract_version: 4, profile_id: 'profile-a', thresholds: th, chapters: o.progress ?? [chapterProgress('money_huddle', 'Money Huddle')] };
            case 'quiz_life_preferences': {
                const on = args.p_opt_in === true;
                const prefs = { life_opt_in: on, life_notice_version: on ? 'life-playbook-v1-testing' : 'life-playbook-v1-testing', life_opted_in_at: on ? quizNow : null, life_version: Number(args.p_expected_version) + 1 };
                life = lifeSnapshot({ preferences: prefs, availability: on ? 'ready' : 'not_opted_in' }, on);
                return { contract_version: 4, profile_id: 'profile-a', outcome: 'saved', preferences: prefs };
            }
            case 'quiz_life_start': {
                const seconds = Number(args.p_duration_seconds) as 30 | 90;
                const attempt = roundAttempt({ duration_seconds: seconds, expires_at: plus(seconds), round_kind: 'life' });
                snapshot = { ...snapshot, attempt, active_round_kind: 'life', week_spent_by_kind: { ...snapshot.week_spent_by_kind!, life: true } };
                return { ...roundStart(request), round_kind: 'life', attempt, active_question: lifeQuestion(1), active_item: { position: 1, planned_items: 5, expires_at: plus(seconds) } };
            }
            case 'quiz_answer': return roundAnswer(request, Number(args.p_option), 1, 1);
            case 'quiz_end': return roundPlain('end', request, 'ended');
            default: throw Error(`unexpected ${fn}`);
        }
    };
}
beforeEach(() => { jest.clearAllMocks(); mockNonce = 0; mockClient.calls = []; Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() })); });
afterEach(() => jest.restoreAllMocks());
const NO_AGE = /\bage\b|\bages\b|unlock|16\+|13\+|\bolder\b|years old|\bbirth/i;
const NO_MONEY_UI = /donat|checkout|pay now|\$\s?\d/i;

it('hides every Life piece and the level quietly when the migration is not switched on', async () => {
    mockClient.handler = server({ life: missing, levelRead: missing });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('This week')).toBeTruthy();
    await screen.findByText('Your badges');
    expect(screen.queryByText(/Life Playbook/)).toBeNull();
    expect(screen.queryByText('Your level')).toBeNull();
    expect(screen.queryByText(LIFE_READ_ERROR)).toBeNull();
    expect(screen.queryByText(/not switched on/i)).toBeNull();
    // The strip still has the personal and group rows.
    expect(screen.getByLabelText('Your round: Ready to play')).toBeTruthy();
    expect(screen.getByLabelText('Group round: Ready to play')).toBeTruthy();
});

it('shows no Life teaser at all while trivia.life is off', async () => {
    mockClient.handler = server({ life: lifeSnapshot({ availability: 'off' }, false) });
    await render(<SportQuizScreen/>);
    await screen.findByText('Your badges');
    expect(screen.queryByText(/Life Playbook|real-life skills/i)).toBeNull();
    expect(calls('quiz_life_chapters')).toHaveLength(0);
});

it('a network failure gives honest retry wording that never names Life', async () => {
    mockClient.handler = server({ life: 'error' });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText(LIFE_READ_ERROR)).toBeTruthy();
    expect(LIFE_READ_ERROR).not.toMatch(/life/i);
    expect(screen.queryByText(/Life Playbook/)).toBeNull();
});

it('the strip says each round has its own spot; group play never uses up your own round; states are words', async () => {
    const snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false } };
    mockClient.handler = server({ snapshot, life: lifeSnapshot({ week_spent: true }) });
    await render(<SportQuizScreen/>);
    expect(await screen.findByLabelText('Your round: Played this week')).toBeTruthy();
    expect(screen.getByLabelText('Group round: Ready to play')).toBeTruthy();
    expect(await screen.findByLabelText('Life Playbook round: Played this week')).toBeTruthy();
    expect(screen.getByText(/Group play never uses up your own round/)).toBeTruthy();
    expect(screen.getByText('Play when you like. Missing a week never costs you anything.')).toBeTruthy();
    expect(screen.queryByText(/streak|in a row|don’t miss|hurry/i)).toBeNull();
});

it('the strip leaves the Life row out until Life is turned on, and marks group play paused in words', async () => {
    mockClient.handler = server({ snapshot: { ...separateSnapshot, groups_available: false }, life: lifeSnapshot({}, false) });
    await render(<SportQuizScreen/>);
    expect(await screen.findByLabelText('Group round: Not available right now')).toBeTruthy();
    expect(screen.queryByLabelText(/^Life Playbook round:/)).toBeNull();
});

it('shows one personal level with progress to the next, says levels never go down and compares with nobody', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Varsity')).toBeTruthy();
    expect(screen.getByText('16 facts learned')).toBeTruthy();
    expect(screen.getByText('24 more facts to All-Star')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progress to All-Star' }).props.accessibilityValue).toEqual({ min: 0, max: 100, now: 4 });
    expect(screen.getByText(/Levels never go down/)).toBeTruthy();
    const card = screen.getByText('Varsity').parent!;
    expect(within(card).queryByText(/rank|leaderboard|other players|than (your|other)|top \d|percent of/i)).toBeNull();
});

it('the top level says so instead of a next step', async () => {
    mockClient.handler = server({ levelRead: level({ facts: 170, rank: 4, level: 'hall_of_fame', level_label: 'Hall of Fame', next_level: null, next_at: null }) });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('You’ve reached Hall of Fame, the top level.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
});

it('opt-in card: §4 notice with the trusted-adult line, nothing preselected; Not now writes nothing; Turn on sends the notice version', async () => {
    mockClient.handler = server({ life: lifeSnapshot({}, false) });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Life Playbook: real-life skills, sports style.')).toBeTruthy();
    expect(screen.getByText(/It teaches general ideas, not advice for your situation, and never recommends products\./)).toBeTruthy();
    expect(screen.getByText('For real decisions, talk with a parent, guardian, school counselor or another trusted adult.')).toBeTruthy();
    expect(screen.getByText(/We save your rounds the same way as other trivia/)).toBeTruthy();
    // Separate controls; no checkbox or switch is preselected for the opt-in.
    expect(screen.getByRole('button', { name: 'Turn on Life Playbook' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeEnabled();
    const card = screen.getByText('Life Playbook: real-life skills, sports style.').parent!;
    expect(within(card).queryByRole('checkbox')).toBeNull();
    expect(within(card).queryByRole('switch')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(calls('quiz_life_preferences')).toHaveLength(0);
    expect(screen.queryByText('Life Playbook: real-life skills, sports style.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'About Life Playbook' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on Life Playbook' }));
    expect(calls('quiz_life_preferences')[0].args).toEqual({ p_opt_in: true, p_notice_version: 'life-playbook-v1-testing', p_expected_version: 0, p_expected_profile_id: 'profile-a' });
    expect(await screen.findByText('Money Huddle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn off Life Playbook' })).toBeTruthy();
});

it('Turn off is reachable, says it ends an open Life round and sends no notice', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    const off = await screen.findByRole('button', { name: 'Turn off Life Playbook' });
    expect(screen.getByText(/Turning Life Playbook off ends any open Life Playbook round/)).toBeTruthy();
    await fireEvent.press(off);
    expect(calls('quiz_life_preferences')[0].args).toEqual({ p_opt_in: false, p_notice_version: null, p_expected_version: 1, p_expected_profile_id: 'profile-a' });
    expect(await screen.findByText('Life Playbook: real-life skills, sports style.')).toBeTruthy();
});

it.each(['off', 'paused', 'not_enrolled'] as const)('Turn off stays reachable for an account that opted in while Life is %s (the withdrawal right)', async availability => {
    mockClient.handler = server({ life: lifeSnapshot({ availability }) });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Life Playbook isn’t available right now. Your setting is saved.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Life Playbook round' })).toBeNull();
    expect(calls('quiz_life_chapters')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn off Life Playbook' }));
    expect(calls('quiz_life_preferences')[0].args).toMatchObject({ p_opt_in: false, p_notice_version: null });
    expect(await screen.findByText('Life Playbook is off.')).toBeTruthy();
});

it('on separate weekly rounds Skip names your own round, and its confirmation says the other rounds are untouched', async () => {
    let snapshot: TimedQuizSnapshot = separateSnapshot;
    const base = server();
    mockClient.handler = (fn, args) => {
        if (fn === 'quiz_snapshot') return snapshot;
        if (fn === 'quiz_skip') {
            snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false }, attempt: roundAttempt({ status: 'skipped', round_kind: 'personal' }) };
            return quizReceipt('skip', String(args.p_request_id), 'skipped');
        }
        return base(fn, args);
    };
    await render(<SportQuizScreen/>);
    expect(screen.queryByRole('button', { name: 'Skip this week' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip my round this week' }));
    expect(await screen.findByText('You skipped your round this week. Your other rounds aren’t affected. Come back whenever you like.')).toBeTruthy();
    expect(screen.getByLabelText('Your round: Skipped this week')).toBeTruthy();
    expect(screen.getByLabelText('Group round: Ready to play')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip my round this week' })).toBeNull();
});

it('names only the chapters the server returns, with no age, unlock, credit or tax wording anywhere', async () => {
    // Even if progress carried another chapter, only chapters from the chapter list are named.
    mockClient.handler = server({ progress: [chapterProgress('money_huddle', 'Money Huddle'), chapterProgress('smart_plays', 'Smart Plays')] });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Money Huddle')).toBeTruthy();
    for (const title of ['Savings Season', 'Scam Defense']) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText(/Smart Plays/)).toBeNull();
    expect(screen.queryAllByText(/credit|\btax|loan|CPA/i)).toHaveLength(0);
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
    expect(screen.getByText('Calling the play before you spend')).toBeTruthy();
    expect(screen.getByText('Seen 5 of 20 questions')).toBeTruthy();
    expect(screen.getAllByText('For real decisions, talk with a parent, guardian, school counselor or another trusted adult.').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(NO_AGE)).toHaveLength(0);
});

it('shows a private Life badge on a chapter at Varsity and on the shelf without a groups switch', async () => {
    const shelf = badgeShelf([{ id: 'badge-life', label: 'Money Huddle Playbook', kind: 'life', sport: null, period: 'lifetime', visibility: 'private', issued_at: quizNow }]);
    const base = server({ progress: [chapterProgress('money_huddle', 'Money Huddle', { rank: 1, level: 'varsity', level_label: 'Varsity', badge_earned: true, facts: 15 })] });
    mockClient.handler = (fn, args) => fn === 'quiz_badge_shelf' ? shelf : base(fn, args);
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Money Huddle Playbook badge earned. Only you see it.')).toBeTruthy();
    expect(screen.getByText('Chapter level: Varsity')).toBeTruthy();
    expect(await screen.findByText('Life Playbook chapter badge · Only you see it')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Money Huddle Playbook/ })).toBeNull();
});

it('starts a Life round with quiz_life_start (life kind, chapter, 90 s default) and reuses the round UI; End names life', async () => {
    const snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false } };
    mockClient.handler = server({ snapshot });
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose Money Huddle' }));
    expect(screen.getByRole('button', { name: '90 seconds' }).props.accessibilityState).toMatchObject({ selected: true });
    const start = screen.getByRole('button', { name: 'Start Life Playbook round' });
    expect(start).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'I understand the trivia notice and choose to play Life Playbook', checked: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice and choose to play Life Playbook' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Life Playbook round' }));
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    expect(screen.getByText(/Life question 1/)).toBeTruthy();
    expect(calls('quiz_start')).toHaveLength(0);
    expect(calls('quiz_life_start')[0].args).toMatchObject({ p_chapter: 'money_huddle', p_duration_seconds: 90, p_notice_version: 'life-playbook-v1-testing', p_expected_profile_id: 'profile-a',
        p_expected_week: snapshot.week_start });
    await fireEvent.press(screen.getByRole('button', { name: 'End round' }));
    expect(calls('quiz_end')[0].args).toMatchObject({ p_round_kind: 'life', p_start_request_id: calls('quiz_life_start')[0].args.p_request_id });
    expect(await screen.findByText('Round ended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to this week’s rounds' })).toBeTruthy();
});

it('a 30-second Life round is allowed and "any open chapter" sends a null chapter', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: '30 seconds · quicker' }));
    // The personal round's checkbox is on the same page; the Life one has its own name.
    expect(screen.getByRole('checkbox', { name: 'I understand the trivia notice' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice and choose to play Life Playbook' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Life Playbook round' }));
    await screen.findByText('Question 1 of 5');
    expect(calls('quiz_life_start')[0].args).toMatchObject({ p_chapter: null, p_duration_seconds: 30 });
});

it('Life screens and the Life round never show Donate, checkout or amounts', async () => {
    const snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false } };
    mockClient.handler = server({ snapshot });
    await render(<SportQuizScreen/>);
    await screen.findByText('Money Huddle');
    expect(screen.queryAllByText(NO_MONEY_UI)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice and choose to play Life Playbook' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Life Playbook round' }));
    await screen.findByText('Question 1 of 5');
    expect(screen.queryAllByText(NO_MONEY_UI)).toHaveLength(0);
});

it('Life history sits with own history, labelled, and a voided item shows its correction note', async () => {
    const life = { ...roundAttempt({ id: 'life-round', status: 'completed', round_state: null, closed_at: quizNow, close_reason: 'answered', answered_count: 1 }), round_kind: 'life' as const };
    const history: TimedQuizHistoryPage = { ...quizHistory(), total: 1, history_version: 0, items: [{ attempt: life, question: null, result: null, badge: null, items: [
        { position: 1, status: 'void', question: lifeQuestion(1), result: { answered_option: 0, correct_option: 0, was_correct: null, explanation: 'A budget plans spending.', completed_at: quizNow, position: 1, item_status: 'void' },
            correction_reason: 'An outdated fact was fixed.' }] }] };
    mockClient.handler = server({ history });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText(/Life Playbook round · completed/)).toBeTruthy();
    expect(screen.getByText('Question 1: corrected')).toBeTruthy();
    expect(screen.getByText('Correction: An outdated fact was fixed.')).toBeTruthy();
});

it('clear-history copy covers levels, and Life Playbook levels only when Life is known to the account', async () => {
    mockClient.handler = server();
    const view = await render(<SportQuizScreen/>);
    expect(await screen.findByText(/your level, your Life Playbook chapter levels/)).toBeTruthy();
    expect(screen.getByText(/your round, group round and Life Playbook round\) stay used/)).toBeTruthy();
    await view.unmount();
    mockClient.handler = server({ life: missing });
    await render(<SportQuizScreen/>);
    expect(await screen.findByText(/badges, your level, receipts/)).toBeTruthy();
    expect(screen.queryByText(/Life Playbook/)).toBeNull();
});

it('a group page never shows Life, and its round says group play never uses up your own round', async () => {
    const mine = myGroups([{ group_id: 'group-a', name_key: 'family', theme_sport: null, is_owner: true, members: 2, played_this_week: false, everyone_played: false }]);
    const snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false } };
    mockClient.handler = server({ mine, snapshot });
    await render(<SportQuizScreen/>);
    await screen.findByText('Money Huddle');
    await fireEvent.press(screen.getByRole('button', { name: 'Open Family group' }));
    await screen.findByText('Lani (you) · made the group');
    expect(screen.queryByText('Money Huddle')).toBeNull();
    expect(screen.queryByText('Life Playbook')).toBeNull();
    expect(screen.queryByRole('button', { name: /Life Playbook/ })).toBeNull();
    expect(screen.queryByLabelText(/^Life Playbook round:/)).toBeNull();
    // The personal round is used, but the group round has its own spot.
    await fireEvent.press(screen.getByRole('button', { name: 'Play this week’s group round' }));
    expect(screen.getByText(/This uses this week’s group round\. Group play never uses up your own round\./)).toBeTruthy();
});

it('a first-time account saves the trivia notice before the Life Start (the server needs both notices)', async () => {
    const snapshot = { ...separateSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false },
        preferences: { ...separateSnapshot.preferences, notice_version: null, notice_accepted_at: null } };
    let current: TimedQuizSnapshot = snapshot;
    const base = server({ snapshot });
    mockClient.handler = (fn, args) => {
        if (fn === 'quiz_snapshot') return current;
        if (fn === 'quiz_preferences') {
            current = { ...current, preferences: { ...current.preferences, notice_version: 'timed-trivia-v1-testing', notice_accepted_at: quizNow, version: current.preferences.version + 1 } };
            return { ...roundPlain('preferences', String(args.p_request_id), 'saved'), preferences: current.preferences };
        }
        return base(fn, args);
    };
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I understand the trivia notice and choose to play Life Playbook' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Life Playbook round' }));
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    const order = mockClient.calls.map(c => c.fn);
    expect(order.indexOf('quiz_preferences')).toBeLessThan(order.indexOf('quiz_life_start'));
    expect(calls('quiz_life_start')[0].args.p_notice_version).toBe('life-playbook-v1-testing');
});

it('Turn on is confirmed in a polite live region', async () => {
    mockClient.handler = server({ life: lifeSnapshot({}, false) });
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on Life Playbook' }));
    const notice = await screen.findByText('Life Playbook is on.');
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
});
