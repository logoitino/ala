/** QUIZ-04 Life Playbook and level hooks: chapters and progress are read only after opting in, a missing migration
 * hides Life and the level quietly (and stops asking), other failures keep honest retry wording, the opt-in sends the
 * notice version with its CAS version, and visibility rules never tease Life while it is off. Synthetic transport. */
import { act, renderHook } from '@testing-library/react-native';
import { useLifePlaybook, lifeVisible, lifeOn, LIFE_READ_ERROR } from '../useLifePlaybook';
import { useTriviaLevel } from '../useTriviaLevel';
import type { LifeSnapshot } from '@shared/lifePlaybook';

const now = '2026-10-14T17:00:00.000Z';
const th = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };
const snap = (over: Partial<LifeSnapshot> = {}): LifeSnapshot => ({ contract_version: 4, profile_id: 'profile-a', server_now: now, week_start: '2026-10-12', week_end: '2026-10-19', testing_only: true,
    availability: 'not_opted_in', notice_version: 'life-playbook-v1-testing', preferences: { life_opt_in: false, life_notice_version: null, life_opted_in_at: null, life_version: 0 },
    week_spent: false, attempt: null, active_round_kind: null, default_duration_seconds: 90, round_size: 5, chapters_open: 1, unseen_count: 20, ...over });
const optedIn = snap({ availability: 'ready', preferences: { life_opt_in: true, life_notice_version: 'life-playbook-v1-testing', life_opted_in_at: now, life_version: 1 } });
type Reply = { data: unknown; error: { code?: string; message: string } | null };
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], reply: (_fn: string, _args: Record<string, unknown>): Reply => ({ data: null, error: null }),
    async rpc(fn: string, args: Record<string, unknown>) { this.calls.push({ fn, args }); return this.reply(fn, args); } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
const missing: Reply = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
beforeEach(() => { mockClient.calls = []; });

it('reads chapters and progress only after opting in', async () => {
    mockClient.reply = fn => fn === 'quiz_life_snapshot' ? { data: snap(), error: null } : { data: null, error: { message: 'unexpected' } };
    const r = await renderHook(() => useLifePlaybook('id-a', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    expect(r.result.current.snapshot?.availability).toBe('not_opted_in');
    expect(calls('quiz_life_chapters')).toHaveLength(0);
    expect(calls('quiz_life_progress')).toHaveLength(0);
});

it('Turn on sends the Life notice version and the expected CAS version, then reads chapters', async () => {
    let current = snap();
    mockClient.reply = (fn, args) => {
        if (fn === 'quiz_life_snapshot') return { data: current, error: null };
        if (fn === 'quiz_life_preferences') { current = optedIn; return { data: { contract_version: 4, profile_id: 'profile-a', outcome: 'saved', preferences: { ...optedIn.preferences!, life_version: Number(args.p_expected_version) + 1 } }, error: null }; }
        if (fn === 'quiz_life_chapters') return { data: { contract_version: 4, profile_id: 'profile-a', chapters: [] }, error: null };
        return { data: { contract_version: 4, profile_id: 'profile-a', thresholds: th, chapters: [] }, error: null };
    };
    const r = await renderHook(() => useLifePlaybook('id-a', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await r.result.current.setOptIn(true); });
    expect(calls('quiz_life_preferences')[0].args).toEqual({ p_opt_in: true, p_notice_version: 'life-playbook-v1-testing', p_expected_version: 0, p_expected_profile_id: 'profile-a' });
    await act(async () => { await Promise.resolve(); });
    expect(calls('quiz_life_chapters').length).toBeGreaterThan(0);
    expect(r.result.current.snapshot?.preferences?.life_opt_in).toBe(true);
});

it('a missing migration hides Life quietly and stops asking; a network error gives retry wording', async () => {
    mockClient.reply = () => missing;
    const r = await renderHook(() => useLifePlaybook('id-a', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    expect(r.result.current.switchedOff).toBe(true);
    expect(r.result.current.error).toBeNull();
    await act(async () => { await r.result.current.refresh(); });
    expect(calls('quiz_life_snapshot')).toHaveLength(1);
    mockClient.calls = [];
    mockClient.reply = () => ({ data: null, error: { message: 'fetch failed' } });
    const n = await renderHook(() => useLifePlaybook('id-b', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    expect(n.result.current.error).toBe(LIFE_READ_ERROR);
    expect(n.result.current.switchedOff).toBe(false);
});

it('the level hook hides on a missing migration and reads the server level otherwise', async () => {
    mockClient.reply = () => missing;
    const r = await renderHook(() => useTriviaLevel('id-a', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    expect(r.result.current.switchedOff).toBe(true);
    expect(r.result.current.error).toBeNull();
    mockClient.reply = () => ({ data: { contract_version: 4, profile_id: 'profile-a', facts: 3, rank: 0, level: 'rookie', level_label: 'Rookie', next_level: 'varsity', next_at: 15, thresholds: th, reached_at: null }, error: null });
    const l = await renderHook(() => useTriviaLevel('id-b', 'profile-a'));
    await act(async () => { await Promise.resolve(); });
    expect(l.result.current.level?.level_label).toBe('Rookie');
});

it('visibility: offered or turned on only; never while off, paused or ineligible unless already turned on', () => {
    expect(lifeVisible(snap())).toBe(true);
    expect(lifeVisible(snap({ availability: 'off' }))).toBe(false);
    expect(lifeVisible(snap({ availability: 'paused' }))).toBe(false);
    expect(lifeVisible(snap({ availability: 'ineligible', profile_id: null, preferences: null }))).toBe(false);
    expect(lifeVisible({ ...optedIn, availability: 'off' })).toBe(true);
    expect(lifeOn({ ...optedIn, availability: 'off' })).toBe(false);
    expect(lifeOn(optedIn)).toBe(true);
    expect(lifeOn({ ...optedIn, availability: 'empty' })).toBe(true);
});
