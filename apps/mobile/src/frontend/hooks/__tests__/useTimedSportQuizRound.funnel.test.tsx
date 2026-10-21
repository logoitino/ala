/** Trivia funnel through the round hook's timer-driven paths: an explanation that never loads after every
 * retry, and an uncertain answer confirmed through its receipt. Synthetic RPC transport only. */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimedSportQuizRound } from '../useTimedSportQuizRound';
import { telemetry } from '@/services/TelemetryManager';
import { roundSnapshot, roundStart, roundAnswer, roundNext, roundPlain } from '@/lib/__fixtures__/triviaRoundFixtures';
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
let stepSpy: jest.SpyInstance; let issueSpy: jest.SpyInstance;
beforeEach(() => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); mockNonce = 0; mockClient.calls = []; mockClient.handler = defaultHandler; stepSpy = jest.spyOn(telemetry, 'trackTriviaStep').mockImplementation(() => { }); issueSpy = jest.spyOn(telemetry, 'trackIssue').mockImplementation(() => { }); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
type Hook = { result: { current: ReturnType<typeof useTimedSportQuizRound> } };
const begin = async (r: Hook) => { await act(async () => { await r.result.current.start('sport', 'Basketball', 30); }); };

it('reports an explanation that never loads after every retry, and the round continues without it', async () => {
    jest.useFakeTimers();
    mockClient.handler = async (fn, args) => { if (fn === 'quiz_receipt') throw Error('lost'); return defaultHandler(fn, args); };
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await act(async () => { jest.advanceTimersByTime(31000); });
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
    expect(mockClient.calls.filter(c => c.fn === 'quiz_receipt')).toHaveLength(5);
    expect(issueSpy).toHaveBeenCalledWith('trivia.explanation_failed', 'sport-quiz');
    expect(r.result.current.error).toMatch(/explanation/);
    expect(r.result.current.between?.result).toBeNull();
    await act(async () => { await r.result.current.next(); });
    expect(r.result.current.item?.position).toBe(2);
});

it('counts an uncertain answer confirmed through its receipt, after reporting the lost attempt', async () => {
    let lost = false;
    mockClient.handler = async (fn, args) => {
        if (fn === 'quiz_answer' && !lost) { lost = true; throw Error('lost'); }
        if (fn === 'quiz_receipt') return roundAnswer(String(args.p_request_id), 1, 1);
        return defaultHandler(fn, args);
    };
    const r = await renderHook(() => useTimedSportQuizRound(base));
    await begin(r);
    await act(async () => { await r.result.current.answer(1); });
    expect(issueSpy).toHaveBeenCalledWith('trivia.answer_failed', 'sport-quiz');
    expect(stepSpy.mock.calls.map(([action]) => action)).toEqual(['start']);
    await act(async () => { await r.result.current.recoverAnswer(); });
    expect(stepSpy.mock.calls.map(([action]) => action)).toEqual(['start', 'answer']);
    expect(stepSpy.mock.calls[1]).toEqual(['answer', { kind: 'personal', position: 1 }]);
    expect(r.result.current.entries[0]?.result?.was_correct).toBe(true);
});
