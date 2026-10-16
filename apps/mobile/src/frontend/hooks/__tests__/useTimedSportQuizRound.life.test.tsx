/** QUIZ-04 round hook: a Life round starts only through quiz_life_start with the Life notice, chapter and duration,
 * only while the Life snapshot is ready and unspent; End names the life kind; a group round checks only the group
 * spot; a Life round survives the personal pools running out but ends when Life is switched off; dismiss() lets the
 * next kind start without sending another End. Real hook + SDK validators; synthetic RPC transport only. */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimedSportQuizRound, type TimedQuizRoundInput } from '../useTimedSportQuizRound';
import { quizNow } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundSnapshot, roundStart, roundAttempt, roundAnswer, roundPlain } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { LifeSnapshot } from '@shared/lifePlaybook';
import type { TimedQuizSnapshot } from '@shared/timedSportQuiz';
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12, '0')}`, getRandomValues: (bytes: Uint8Array) => { bytes.fill(42); return bytes; } }));
type Call = { fn: string; args: Record<string, unknown> };
const plus = (seconds: number) => new Date(Date.parse(quizNow) + seconds * 1000).toISOString();
const handler = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const request = String(args.p_request_id);
    if (fn === 'quiz_life_start') {
        const seconds = Number(args.p_duration_seconds) as 30 | 90;
        const attempt = roundAttempt({ duration_seconds: seconds, expires_at: plus(seconds), round_kind: 'life' });
        return { ...roundStart(request), round_kind: 'life', attempt, active_question: { ...roundStart(request).active_question!, topic_category: 'life', sport: 'Money Huddle' },
            active_item: { position: 1, planned_items: 5, expires_at: plus(seconds) } };
    }
    if (fn === 'quiz_group_start') return roundStart(request, 5, undefined, String(args.p_group_id));
    if (fn === 'quiz_start') return roundStart(request);
    if (fn === 'quiz_answer') return roundAnswer(request, Number(args.p_option), 1, 1);
    return roundPlain('end', request, 'ended');
};
const mockClient = { calls: [] as Call[], async rpc(fn: string, args: Record<string, unknown>) { this.calls.push({ fn, args }); return { data: await handler(fn, args), error: null }; } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
const separate: TimedQuizSnapshot = { ...roundSnapshot, week_spent: true, week_spent_by_kind: { personal: true, group: false, life: false }, active_round_kind: null };
const life: LifeSnapshot = { contract_version: 4, profile_id: 'profile-a', server_now: quizNow, week_start: roundSnapshot.week_start, week_end: roundSnapshot.week_end, testing_only: true,
    availability: 'ready', notice_version: 'life-playbook-v1-testing', preferences: { life_opt_in: true, life_notice_version: 'life-playbook-v1-testing', life_opted_in_at: quizNow, life_version: 1 },
    week_spent: false, attempt: null, active_round_kind: null, default_duration_seconds: 90, round_size: 5, chapters_open: 1, unseen_count: 20 };
const base: TimedQuizRoundInput = { identityKey: 'auth-a/profile-a', profileId: 'profile-a', snapshot: separate, focused: true, onChanged: jest.fn(async () => { }), life };
beforeEach(() => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); mockNonce = 0; mockClient.calls = []; });
afterEach(() => jest.restoreAllMocks());

it('starts a Life round through quiz_life_start with the Life notice, the chapter and 90 seconds; End names life', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.startLife('money_huddle', 90); });
    expect(calls('quiz_start')).toHaveLength(0);
    expect(calls('quiz_life_start')[0].args).toEqual({ p_expected_week: separate.week_start, p_request_id: expect.any(String), p_session_secret: '2a'.repeat(32),
        p_expected_profile_id: 'profile-a', p_notice_version: 'life-playbook-v1-testing', p_chapter: 'money_huddle', p_duration_seconds: 90 });
    expect(r.result.current.kind).toBe('life');
    expect(r.result.current.live?.question.sport).toBe('Money Huddle');
    await act(async () => { r.result.current.leave('user_end'); });
    expect(calls('quiz_end')[0].args).toMatchObject({ p_round_kind: 'life' });
});

it('never starts Life while the Life snapshot is not ready, spent, or not opted in', async () => {
    for (const l of [{ ...life, availability: 'off' as const }, { ...life, week_spent: true }, { ...life, preferences: { ...life.preferences!, life_opt_in: false } }, null]) {
        const r = await renderHook(() => useTimedSportQuizRound({ ...base, life: l }));
        await act(async () => { await r.result.current.startLife(null, 90); });
    }
    expect(calls('quiz_life_start')).toHaveLength(0);
});

it('a group round checks only the group spot, so a used personal round does not block it', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.startGroup('group-a', 30); });
    expect(calls('quiz_group_start')).toHaveLength(1);
    await act(async () => { r.result.current.leave('user_end'); });
    expect(calls('quiz_end')[0].args).toMatchObject({ p_round_kind: 'group' });
    // And the personal round stays used.
    const p = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await p.result.current.start('sport', 'Basketball', 30); });
    expect(calls('quiz_start')).toHaveLength(0);
});

it('a Life round survives the personal pools running out, but ends when Life is switched off', async () => {
    const r = await renderHook((props: TimedQuizRoundInput) => useTimedSportQuizRound(props), { initialProps: base });
    await act(async () => { await r.result.current.startLife(null, 90); });
    const open = { ...separate, availability: 'unavailable' as const, attempt: roundAttempt({ duration_seconds: 90, round_kind: 'life' }), active_round_kind: 'life' as const };
    await act(async () => { r.rerender({ ...base, snapshot: open }); });
    expect(r.result.current.live).not.toBeNull();
    expect(calls('quiz_end')).toHaveLength(0);
    await act(async () => { r.rerender({ ...base, snapshot: open, life: { ...life, availability: 'off' } }); });
    expect(r.result.current.live).toBeNull();
    expect(calls('quiz_end')[0].args).toMatchObject({ p_round_kind: 'life' });
});

it('an ended personal attempt on the snapshot does not end a Life round', async () => {
    const r = await renderHook((props: TimedQuizRoundInput) => useTimedSportQuizRound(props), { initialProps: base });
    await act(async () => { await r.result.current.startLife(null, 90); });
    await act(async () => { r.rerender({ ...base, snapshot: { ...separate, attempt: roundAttempt({ status: 'ended', round_kind: 'personal' }) } }); });
    expect(r.result.current.live).not.toBeNull();
});

it('dismiss() after a finished round clears it without another End, so the next kind can start', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.startGroup('group-a', 30); });
    await act(async () => { await r.result.current.answer(1); });
    expect(r.result.current.ended).toBe(true);
    await act(async () => { r.result.current.dismiss(); });
    expect(r.result.current.ended).toBe(false);
    expect(r.result.current.entries).toEqual([]);
    expect(calls('quiz_end')).toHaveLength(0);
    await act(async () => { await r.result.current.startLife(null, 90); });
    expect(calls('quiz_life_start')).toHaveLength(1);
});

it('dismiss() does nothing while a round is open', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.startLife(null, 90); });
    await act(async () => { r.result.current.dismiss(); });
    expect(r.result.current.live).not.toBeNull();
});
