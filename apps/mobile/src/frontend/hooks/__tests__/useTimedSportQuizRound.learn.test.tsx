/** QUIZ-05 Learn-card Start in the round hook: a personal sport round with the athlete hint starts through
 * quiz_learn_start (same request UUID, secret and deadline on retry); a server without it falls back once to the
 * ordinary Start with the same request; other errors never fall back; a normal Start or a non-sport topic never sends
 * the hint. Real hook + SDK validators; synthetic RPC transport only. */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimedSportQuizRound, type TimedQuizRoundInput } from '../useTimedSportQuizRound';
import { roundSnapshot, roundStart } from '@/lib/__fixtures__/triviaRoundFixtures';
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12, '0')}`, getRandomValues: (bytes: Uint8Array) => { bytes.fill(42); return bytes; } }));
type Call = { fn: string; args: Record<string, unknown> };
const ATHLETE = '11111111-2222-3333-4444-555555555555';
const missing = { code: 'PGRST202', message: 'Could not find the function public.quiz_learn_start in the schema cache' };
let learnReply: 'ok' | 'missing' | 'down' = 'ok';
const mockClient = { calls: [] as Call[], async rpc(fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args });
    const request = String(args.p_request_id);
    if (fn === 'quiz_learn_start') return learnReply === 'ok' ? { data: roundStart(request), error: null } : { data: null, error: learnReply === 'missing' ? missing : { message: 'network down' } };
    if (fn === 'quiz_start') return { data: roundStart(request), error: null };
    return { data: null, error: null };
} };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
const base: TimedQuizRoundInput = { identityKey: 'auth-a/profile-a', profileId: 'profile-a', snapshot: roundSnapshot, focused: true, onChanged: jest.fn(async () => { }) };
beforeEach(() => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); mockNonce = 0; mockClient.calls = []; learnReply = 'ok'; });
afterEach(() => jest.restoreAllMocks());

it('the Learn entry starts through quiz_learn_start with the athlete id and opens the round', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.start('sport', 'Basketball', 30, ATHLETE); });
    expect(calls('quiz_start')).toHaveLength(0);
    expect(calls('quiz_learn_start')[0].args).toEqual({ p_athlete_player_id: ATHLETE, p_sport: 'Basketball', p_duration_seconds: 30, p_expected_week: roundSnapshot.week_start,
        p_notice_version: 'timed-trivia-v1-testing', p_request_id: expect.any(String), p_session_secret: '2a'.repeat(32), p_expected_profile_id: 'profile-a' });
    expect(r.result.current.live).not.toBeNull();
    expect(r.result.current.kind).toBe('personal');
});

it('an older server (not switched on) falls back once to the ordinary Start with the same request', async () => {
    learnReply = 'missing';
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.start('sport', 'Basketball', 30, ATHLETE); });
    const learn = calls('quiz_learn_start')[0].args, plain = calls('quiz_start')[0].args;
    expect(plain).toMatchObject({ p_request_id: learn.p_request_id, p_session_secret: learn.p_session_secret, p_sport: 'Basketball' });
    expect(plain).not.toHaveProperty('p_athlete_player_id');
    expect(r.result.current.live).not.toBeNull();
    expect(r.result.current.error).toBeNull();
});

it('another failure never falls back; the retry repeats the same Learn Start exactly', async () => {
    learnReply = 'down';
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.start('sport', 'Basketball', 30, ATHLETE); });
    expect(calls('quiz_start')).toHaveLength(0);
    expect(r.result.current.pendingStart).toBe(true);
    learnReply = 'ok';
    await act(async () => { await r.result.current.retryStart(); });
    const [first, second] = calls('quiz_learn_start').map(c => c.args);
    expect(second).toEqual(first);
    expect(r.result.current.live).not.toBeNull();
});

it('a normal entry, or a non-sport topic, uses the ordinary Start without the hint', async () => {
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await act(async () => { await r.result.current.start('sport', 'Basketball', 30); });
    expect(calls('quiz_learn_start')).toHaveLength(0);
    expect(calls('quiz_start')).toHaveLength(1);
    const science = { ...roundSnapshot, pools: [...roundSnapshot.pools, { topic_category: 'science' as const, sport: 'Science', unseen_count: 5, allowed: true }] };
    const s = await renderHook(() => useTimedSportQuizRound({ ...base, identityKey: 'auth-a/profile-a/science', snapshot: science }));
    await act(async () => { await s.result.current.start('science', null, 30, ATHLETE); });
    expect(calls('quiz_learn_start')).toHaveLength(0);
    expect(calls('quiz_start')).toHaveLength(2);
    expect(calls('quiz_start')[1].args).toMatchObject({ p_topic_category: 'science' });
});
