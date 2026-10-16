/** QUIZ-03 round hook: answered → explanation → Next with exact recovery, leaving ends the round, item deadlines,
 * short rounds and the image-question guard. Real hook + SDK validators; synthetic RPC transport only. */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimedSportQuizRound } from '../useTimedSportQuizRound';
import { roundSnapshot, roundStart, roundAnswer, roundNext, roundExpiredReceipt, roundPlain } from '@/lib/__fixtures__/triviaRoundFixtures';
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12, '0')}`, getRandomValues: (bytes: Uint8Array) => { bytes.fill(42); return bytes; } }));
type Call = { fn: string; args: Record<string, unknown> };
const defaultHandler = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    if (fn === 'quiz_start') return roundStart(String(args.p_request_id));
    if (fn === 'quiz_answer') return roundAnswer(String(args.p_request_id), Number(args.p_option), 1);
    if (fn === 'quiz_next') return roundNext(String(args.p_request_id), Number(args.p_expected_position) + 1);
    return roundPlain('end', String(args.p_request_id), 'ended');
};
const mockClient = { calls: [] as Call[], handler: defaultHandler, async rpc(fn: string, args: Record<string, unknown>) { this.calls.push({ fn, args }); return { data: await this.handler(fn, args), error: null }; } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const base = { identityKey: 'auth-a/profile-a', profileId: 'profile-a', snapshot: roundSnapshot, focused: true, onChanged: jest.fn(async () => { }) };
beforeEach(() => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); mockNonce = 0; mockClient.calls = []; mockClient.handler = defaultHandler; });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
type Hook = { result: { current: ReturnType<typeof useTimedSportQuizRound> } };
const begin = async (r: Hook) => { await act(async () => { await r.result.current.start('sport', 'Basketball', 30); }); };
const answer = async (r: Hook, option: number) => { await act(async () => { await r.result.current.answer(option); }); };
const next = async (r: Hook) => { await act(async () => { await r.result.current.next(); }); };

it('an answered item keeps the round open: explanation, then Next issues question 2 with the same secret', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    expect(r.result.current.item).toEqual({ position: 1, planned: 5 });
    await answer(r, 1);
    // The implementer's warning: 'answered' must not be treated as a terminal close.
    expect(calls('quiz_end')).toHaveLength(0);
    expect(r.result.current.ended).toBe(false);
    expect(r.result.current.live).toBeNull();
    expect(r.result.current.between).toMatchObject({ position: 1, planned: 5, result: { was_correct: true, item_status: 'answered' } });
    expect(r.result.current.between?.result?.explanation).toMatch(/fact 1/);
    await next(r);
    const sent = calls('quiz_next')[0].args;
    expect(sent).toMatchObject({ p_attempt_id: 'round-a', p_expected_position: 1, p_session_secret: '2a'.repeat(32), p_expected_profile_id: 'profile-a' });
    expect(sent.p_session_secret).toBe(calls('quiz_start')[0].args.p_session_secret);
    expect(r.result.current.item).toEqual({ position: 2, planned: 5 });
    expect(r.result.current.live?.question.question_type).toBe('true_false');
    expect(r.result.current.entries).toHaveLength(1);
});

it('a lost Next is retried with the exact same request UUID, expected position and secret', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await answer(r, 0);
    let tries = 0;
    mockClient.handler = async (fn, args) => { if (fn === 'quiz_next' && ++tries === 1) throw Error('lost'); return defaultHandler(fn, args); };
    await next(r);
    expect(r.result.current.pendingNext).toEqual({ uncertain: true });
    expect(r.result.current.error).toMatch(/Next wasn’t confirmed/);
    expect(r.result.current.between?.position).toBe(1);
    await next(r);
    const [first, second] = calls('quiz_next');
    expect(second.args).toEqual(first.args);
    expect(r.result.current.item?.position).toBe(2);
    expect(r.result.current.pendingNext).toBeNull();
});

it('leaving during an explanation ends the whole round by the original Start request and keeps the learned fact', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await answer(r, 1);
    await act(async () => { r.result.current.leave('left_page'); });
    const end = calls('quiz_end');
    expect(end).toHaveLength(1);
    expect(end[0].args).toMatchObject({ p_attempt_id: null, p_start_request_id: calls('quiz_start')[0].args.p_request_id, p_reason: 'left_page' });
    expect(end[0].args).not.toHaveProperty('p_session_secret');
    expect(r.result.current.between).toBeNull();
    expect(r.result.current.ended).toBe(true);
    expect(r.result.current.endedEarly).toBe(true);
    expect(r.result.current.entries.map(e => e.position)).toEqual([1]);
    // No automatic second draw: Next and Start do nothing after leaving.
    await next(r);
    await begin(r);
    expect(calls('quiz_next')).toHaveLength(0);
    expect(calls('quiz_start')).toHaveLength(1);
});

it('an item deadline closes only that question, shows its explanation from the receipt, and Next continues', async () => {
    jest.useFakeTimers();
    mockClient.handler = async (fn, args) => fn === 'quiz_receipt' ? roundExpiredReceipt(String(args.p_request_id), 1) : defaultHandler(fn, args);
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await act(async () => { jest.advanceTimersByTime(31000); });
    expect(calls('quiz_end')).toHaveLength(0);
    expect(calls('quiz_receipt')[0].args.p_request_id).toBe(calls('quiz_start')[0].args.p_request_id);
    expect(r.result.current.between).toMatchObject({ position: 1, result: { answered_option: null, item_status: 'expired' } });
    expect(r.result.current.between?.question?.prompt).toMatch(/Question number 1/);
    await next(r);
    expect(r.result.current.item?.position).toBe(2);
});

it('waiting past the Next window at an explanation ends the round', async () => {
    jest.useFakeTimers();
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await answer(r, 1);
    await act(async () => { jest.advanceTimersByTime(150000); });
    expect(calls('quiz_end')).toHaveLength(1);
    expect(r.result.current.ended).toBe(true);
    expect(r.result.current.between).toBeNull();
});

it('a short round (small pool) is flagged honestly and completes after its last planned question', async () => {
    mockClient.handler = async (fn, args) => {
        if (fn === 'quiz_start') return roundStart(String(args.p_request_id), 2);
        if (fn === 'quiz_answer') return roundAnswer(String(args.p_request_id), Number(args.p_option), mockClient.calls.filter(c => c.fn === 'quiz_next').length + 1, 2);
        if (fn === 'quiz_next') return roundNext(String(args.p_request_id), 2, 2);
        return defaultHandler(fn, args);
    };
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    expect(r.result.current.shortRound).toBe(true);
    expect(r.result.current.planned).toBe(2);
    await answer(r, 1);
    await next(r);
    await answer(r, 0);
    expect(r.result.current.ended).toBe(true);
    expect(r.result.current.endedEarly).toBe(false);
    expect(r.result.current.result?.outcome).toBe('completed');
    expect(r.result.current.entries.map(e => [e.position, e.result.was_correct])).toEqual([[1, true], [2, false]]);
    expect(calls('quiz_end')).toHaveLength(0);
});

it('an image question is never shown: the round ends safely and says the question is unavailable', async () => {
    mockClient.handler = async (fn, args) => fn === 'quiz_start' ? roundStart(String(args.p_request_id), 5, 'image_choice') : defaultHandler(fn, args);
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    expect(r.result.current.live).toBeNull();
    expect(r.result.current.unavailableQuestion).toBe(true);
    expect(calls('quiz_end')).toHaveLength(1);
});

it('true/false answers accept only the two shown options', async () => {
    mockClient.handler = async (fn, args) => fn === 'quiz_start' ? roundStart(String(args.p_request_id), 5, 'true_false') : defaultHandler(fn, args);
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await answer(r, 3);
    expect(calls('quiz_answer')).toHaveLength(0);
    await answer(r, 0);
    expect(calls('quiz_answer')[0].args.p_option).toBe(0);
});

it('a group round starts with quiz_group_start from the group and uses the same round flow', async () => {
    mockClient.handler = async (fn, args) => fn === 'quiz_group_start' ? roundStart(String(args.p_request_id), 5, undefined, 'group-a') : defaultHandler(fn, args);
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.startGroup('group-a', 30); });
    expect(calls('quiz_start')).toHaveLength(0);
    expect(calls('quiz_group_start')[0].args).toMatchObject({ p_group_id: 'group-a', p_duration_seconds: 30, p_expected_profile_id: 'profile-a' });
    expect(r.result.current.groupId).toBe('group-a');
    expect(r.result.current.item?.position).toBe(1);
});
