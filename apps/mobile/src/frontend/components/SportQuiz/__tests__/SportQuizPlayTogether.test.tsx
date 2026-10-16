/** QUIZ-03 visible journeys with the real screen, hooks and SDK validators: a round of five with Next and its private
 * summary, a short round, leaving during an explanation, groups (create / join / refusal / page / remove by
 * member_ref) and the badge shelf toggle plus season recap. Database responses are synthetic. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState, Share } from 'react-native';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import { TRIVIA_JOIN_REFUSED } from '@/hooks/useTriviaGroups';
import { quizHistory } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundSnapshot, roundStart, roundAnswer, roundNext, roundPlain, groupPage, myGroups, badgeShelf, seasonRecap } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { UserRole } from '@/types/database';
const mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null as string | null }, role: 'parent' as UserRole, isGuest: false, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { background: '#F3FAF6' } } }) }));
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
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
/** A small in-memory server: a round of `planned` questions, groups and badges. */
function server({ planned = 5, mine = myGroups(), page = groupPage(), join = 'joined' as 'joined' | 'refused' } = {}) {
    let snapshot = roundSnapshot; let position = 0; let answered = 0; let currentPage = page;
    return (fn: string, args: Record<string, unknown>): unknown => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return snapshot;
            case 'quiz_history': return quizHistory();
            case 'quiz_start': case 'quiz_group_start': position = 1; snapshot = { ...snapshot, week_spent: true }; return roundStart(request, planned, undefined, fn === 'quiz_group_start' ? String(args.p_group_id) : null);
            case 'quiz_answer': answered += 1; return roundAnswer(request, Number(args.p_option), position, planned, answered);
            case 'quiz_next': position = Number(args.p_expected_position) + 1; return roundNext(request, position, planned);
            case 'quiz_end': return roundPlain('end', request, 'ended');
            case 'quiz_groups_mine': return mine;
            case 'quiz_group_create': return { ...currentPage, code: 'ABCD2345', code_shown: true };
            case 'quiz_group_join': return join === 'joined' ? { contract_version: 3, outcome: 'joined', group: groupPage({}, false) } : { contract_version: 3, outcome: 'refused', group: null };
            case 'quiz_group_page': return currentPage;
            case 'quiz_group_remove_member': currentPage = { ...currentPage, members: currentPage.members.slice(0, 1), totals: { ...currentPage.totals, members: 1 } }; return { ...currentPage, code: 'NEWCQDE2' };
            case 'quiz_badge_shelf': return badgeShelf();
            case 'quiz_season_recap': return seasonRecap;
            case 'quiz_badge_visibility': return { contract_version: 3, ...badgeShelf().badges.find(b => b.id === args.p_badge_id)!, visibility: args.p_visibility };
            default: throw Error(`unexpected ${fn}`);
        }
    };
}
beforeEach(() => { jest.clearAllMocks(); mockNonce = 0; mockClient.calls = []; Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() })); });
afterEach(() => jest.restoreAllMocks());
async function prepare(sport = 'Basketball') {
    await fireEvent.press(await screen.findByRole('button', { name: `Choose ${sport}` }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
}

it('says the round has up to N questions and that leaving during an explanation ends it, before Start', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('Ready for a round of up to 5 questions?')).toBeTruthy();
    expect(screen.getByText(/Leaving during an explanation also ends the round/)).toBeTruthy();
    expect(calls('quiz_start')).toHaveLength(0);
});

it('plays a round of five: Question 2 of 5, true/false buttons, Next, and a private summary without a score', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await prepare();
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    expect(screen.queryByText(/Explanation for fact 1/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer 2: Two' }));
    expect(await screen.findByText('That’s right!')).toBeTruthy();
    expect(screen.getByText(/Explanation for fact 1/)).toBeTruthy();
    expect(screen.getByText(/Leaving this page now ends the round/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Question 2 of 5')).toBeTruthy();
    // True/false renders exactly two big buttons.
    expect(screen.getByRole('button', { name: 'True' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'False' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Answer 1:/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'True' }));
    expect(await screen.findByText('Not quite. Here’s the fact:')).toBeTruthy();
    for (const position of [3, 4, 5]) {
        await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText(`Question ${position} of 5`)).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Answer 2: Two' }));
        if (position < 5) await screen.findByRole('button', { name: 'Next' });
    }
    expect(await screen.findByText('Round complete')).toBeTruthy();
    expect(screen.getByText('You learned 5 new facts')).toBeTruthy();
    expect(screen.getByText('Question 1: right')).toBeTruthy();
    expect(screen.getByText('Question 2: not quite')).toBeTruthy();
    // Never a score, speed or rank.
    expect(screen.queryByText(/\d+\s*(\/|out of)\s*5|seconds to answer|\brank(ed|ing)?\b|your score/i)).toBeNull();
    expect(calls('quiz_next').map(c => c.args.p_expected_position)).toEqual([1, 2, 3, 4]);
    expect(calls('quiz_end')).toHaveLength(0);
});

it('a short round says so honestly', async () => {
    mockClient.handler = server({ planned: 2 });
    await render(<SportQuizScreen/>);
    await prepare();
    expect(await screen.findByText('Question 1 of 2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer 2: Two' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'True' }));
    expect(await screen.findByText('You learned 2 new facts')).toBeTruthy();
    expect(screen.getByText(/This round had 2 questions because that’s all the new ones we have/)).toBeTruthy();
});

it('End round during an explanation ends the round and the summary says why', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    await prepare();
    await fireEvent.press(await screen.findByRole('button', { name: 'Answer 2: Two' }));
    await screen.findByRole('button', { name: 'Next' });
    await fireEvent.press(screen.getByRole('button', { name: 'End round' }));
    expect(await screen.findByText('Round ended')).toBeTruthy();
    expect(screen.getByText('You learned 1 new fact')).toBeTruthy();
    expect(screen.getByText(/A round ends if you leave this page/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(calls('quiz_end')).toHaveLength(1);
    expect(calls('quiz_next')).toHaveLength(0);
});

it('preselects the athlete’s sport from the profile card link', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen initialSport="basketball"/>);
    expect(await screen.findByText('Learning Basketball this week.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
    await screen.findByText('Question 1 of 5');
    expect(calls('quiz_start')[0].args).toMatchObject({ p_topic_category: 'sport', p_sport: 'Basketball' });
});

it('creates a group from preset names only and shows the code once with Share and the safety line', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    expect(await screen.findByText('You’re not in a group yet.')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/name/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Make group' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cousins' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Make group' }));
    expect(calls('quiz_group_create')[0].args).toMatchObject({ p_name_key: 'cousins', p_theme_sport: null, p_expected_profile_id: 'profile-a' });
    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(screen.getAllByText('Share codes only with family or friends you know.').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Share code' }));
    expect(share.mock.calls[0][0]).toMatchObject({ message: expect.stringMatching(/ABCD2345.*family or friends you know/) });
});

it('join by code: a refusal shows the single ordinary message; a join opens the group page', async () => {
    mockClient.handler = server({ join: 'refused' });
    const view = await render(<SportQuizScreen/>);
    await fireEvent.changeText(await screen.findByLabelText('Group code'), 'zzzz-9999');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(await screen.findByText(TRIVIA_JOIN_REFUSED)).toBeTruthy();
    expect(calls('quiz_group_join')[0].args).toMatchObject({ p_code: 'zzzz-9999', p_expected_profile_id: 'profile-a' });
    await view.unmount();
    mockClient.calls = [];
    mockClient.handler = server({ join: 'joined' });
    await render(<SportQuizScreen/>);
    await fireEvent.changeText(await screen.findByLabelText('Group code'), 'ABCD2345');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(await screen.findByText(/You’re in!/)).toBeTruthy();
    expect(screen.getByText('Sione (you)')).toBeTruthy();
    // A member (not the creator) never gets Remove or member refs.
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
});

it('group page: played marks and group totals only, totals hidden when null, remove uses member_ref', async () => {
    const mine = myGroups([{ group_id: 'group-a', name_key: 'family', theme_sport: null, is_owner: true, members: 2, played_this_week: true, everyone_played: false }]);
    mockClient.handler = server({ mine });
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Family group' }));
    expect(await screen.findByText('Lani (you) · made the group')).toBeTruthy();
    expect(screen.getByText('1 of 2 played this week')).toBeTruthy();
    expect(screen.getAllByText('✓ Played this week')).toHaveLength(1);
    expect(screen.getByText('Not yet this week')).toBeTruthy();
    expect(screen.getByText('Badges: Trivia Explorer')).toBeTruthy();
    // Totals are null below three players: nothing about facts, and never per-member counts.
    expect(screen.queryByText(/facts this week/)).toBeNull();
    for (const name of ['Lani (you) · made the group', 'Sione']) expect(within(screen.getByText(name).parent!).queryByText(/fact|answer|right|second|rank/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Play this week’s group round' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Sione' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(calls('quiz_group_remove_member')[0].args).toEqual({ p_group_id: 'group-a', p_member_ref: 'b'.repeat(32), p_expected_profile_id: 'profile-a' });
    expect(await screen.findByText(/old code stopped working/)).toBeTruthy();
    expect(screen.queryByText('Sione')).toBeNull();
});

it('group page shows group fact totals and Everyone played! only when the backend returns them', async () => {
    const mine = myGroups([{ group_id: 'group-a', name_key: 'family', theme_sport: 'Basketball', is_owner: false, members: 3, played_this_week: true, everyone_played: true }]);
    const page = groupPage({ theme_sport: 'Basketball', everyone_played: true, totals: { members: 3, played_this_week: 3, facts_this_week: 10, facts_this_season: 25 } }, false);
    mockClient.handler = server({ mine, page });
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Family group' }));
    expect(await screen.findByText('Everyone played this week!')).toBeTruthy();
    expect(screen.getByText('Together you learned 10+ facts this week')).toBeTruthy();
    expect(screen.getByText('Theme: Basketball')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change theme' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report group' })).toBeTruthy();
});

it('group round starts with quiz_group_start from the group page and uses the same round UI', async () => {
    const mine = myGroups([{ group_id: 'group-a', name_key: 'family', theme_sport: null, is_owner: true, members: 2, played_this_week: false, everyone_played: false }]);
    mockClient.handler = server({ mine });
    await render(<SportQuizScreen/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Family group' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Play this week’s group round' }));
    expect(screen.getByText('Family group round')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start group round' }));
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    expect(calls('quiz_start')).toHaveLength(0);
    expect(calls('quiz_group_start')[0].args).toMatchObject({ p_group_id: 'group-a', p_duration_seconds: 30 });
});

it('badge shelf toggles one badge to groups and shows the private season recap', async () => {
    mockClient.handler = server();
    await render(<SportQuizScreen/>);
    const toggle = await screen.findByRole('switch', { name: 'Show Trivia Explorer to my groups' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole('switch', { name: 'Show Basketball Explorer to my groups' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(toggle);
    expect(calls('quiz_badge_visibility')[0].args).toEqual({ p_badge_id: 'badge-w', p_visibility: 'groups', p_expected_profile_id: 'profile-a' });
    expect((await screen.findByRole('switch', { name: 'Show Trivia Explorer to my groups' })).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('This season you learned 7 facts across 2 sports')).toBeTruthy();
    expect(screen.getByText('Basketball: 5 facts')).toBeTruthy();
    expect(screen.getByText('Rugby: 2 facts')).toBeTruthy();
    expect(screen.getByText(/Only you can see this/)).toBeTruthy();
    expect(within(screen.getByText('Basketball: 5 facts').parent!.parent!).queryByText(/rank|score/i)).toBeNull();
});
