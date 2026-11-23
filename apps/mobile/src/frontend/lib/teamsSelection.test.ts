/** Exact roster selections remain pending claims for the captured account, never name guesses or verification. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { saveAthleteOnboardingRemote, type AthleteOnboarding } from './teams';
import type { OfflineActor } from './offlineActor';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() } }));
const USER = '11111111-1111-4111-8111-111111111111';
const SCHOOL = '22222222-2222-4222-8222-222222222222';
const PLAYER = '33333333-3333-4333-8333-333333333333';
const school = { id: SCHOOL, name: 'School A', mascot: 'Owls', level: 'high_school' as const, division: 'Varsity', region: 'UT', city: 'Town' };
const onboard: AthleteOnboarding = { team: school, sport: 'Rugby', jersey: '7', position: 'Wing', classYear: '26' };
const saveSelected = saveAthleteOnboardingRemote as (user: string | null, onboard: AthleteOnboarding, actor: OfflineActor | undefined, selectedId: string | null) => Promise<void>;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let current: boolean;
let actor: OfflineActor;
let transport: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
function response(data: unknown, status = 200) { return new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function wire() { return transport.mock.calls.map(([input, init]) => ({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null, authorization: new Headers(init?.headers).get('Authorization') })); }
beforeEach(async () => {
  current = true; actor = { userId: USER, isCurrent: () => current };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://selection.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.mocked(supabase.auth.getSession).mockReset().mockResolvedValue({ data: { session: { user: { id: USER }, access_token: 'captured-A' } }, error: null } as never);
  transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/schools_and_teams')) return response(school);
    if (path.endsWith('/players')) return response({ id: PLAYER, school_name: school.name });
    if (path.endsWith('/profiles') && init?.method === 'PATCH') return response(null, 204);
    if (path.endsWith('/profiles')) return response({ full_name: 'Someone With Same Name' });
    return response({ ok: true });
  });
  globalThis.fetch = transport as unknown as typeof fetch; await AsyncStorage.clear(); jest.mocked(AsyncStorage.setItem).mockClear();
});
afterEach(() => { globalThis.fetch = originalFetch as unknown as typeof fetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl; if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey; });
it('uses the selected UUID and exact current school instead of a same-name first match', async () => {
  await saveSelected(USER, onboard, actor, PLAYER);
  const requests = wire();
  expect(requests.find((row) => row.url.pathname.endsWith('/rpc/claim_athlete'))?.body).toEqual({ target_player_id: PLAYER, request_notes: null });
  expect(requests.some((row) => row.url.searchParams.has('name'))).toBe(false);
  expect(requests.filter((row) => row.url.pathname.endsWith('/players')).every((row) => row.url.searchParams.get('id') === 'eq.' + PLAYER && row.url.searchParams.get('school_name') === 'eq.School A')).toBe(true);
  expect(requests.filter((row) => row.method === 'PATCH').every((row) => !('player_id' in (row.body ?? {})) && !('is_verified' in (row.body ?? {})))).toBe(true);
  expect(requests.every((row) => row.authorization === 'Bearer captured-A')).toBe(true);
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
});
it('treats explicit no-selection as a pending claim without roster-name inference', async () => {
  await saveSelected(USER, onboard, actor, null);
  expect(wire().find((row) => row.url.pathname.endsWith('/rpc/claim_athlete'))?.body).toEqual({ target_player_id: null, request_notes: null });
  expect(wire().some((row) => row.url.pathname.endsWith('/players') || (row.method === 'GET' && row.url.pathname.endsWith('/profiles')))).toBe(false);
});
it.each([null, { id: PLAYER, school_name: 'School B' }])('refuses missing or cross-school selected identities before any profile/cache write: %j', async (row) => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response(row));
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/changed/i);
  expect(wire().some((request) => request.method !== 'GET')).toBe(false);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
it('refuses a renamed school before saving the new draft', async () => {
  transport.mockResolvedValueOnce(response({ ...school, name: 'Renamed' }));
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/changed/i);
  expect(wire().some((request) => request.method !== 'GET')).toBe(false);
});
it('does not borrow B after account loss during selected-row validation', async () => {
  transport.mockImplementationOnce(async () => { current = false; return response(school); });
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/account changed/i);
  expect(wire()).toHaveLength(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
it('revalidates the school/roster association after saving and refuses a moved row before the pending claim', async () => {
  let rosterReads = 0;
  const original = transport.getMockImplementation()!;
  transport.mockImplementation(async (...args) => {
    if (String(args[0]).includes('/players')) return response(++rosterReads === 1 ? { id: PLAYER, school_name: school.name } : null);
    return original(...args);
  });
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/changed/i);
  expect(wire().some((request) => request.url.pathname.endsWith('/rpc/claim_athlete'))).toBe(false);
});
it('keeps denied selected-row reads recoverable instead of accepting a name fallback', async () => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response({ code: '42501', message: 'Denied' }, 403));
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toMatchObject({ code: '42501' });
  expect(wire().some((request) => request.method !== 'GET')).toBe(false);
});
it('requires a captured owner for an explicit existing-record choice', async () => {
  await expect(saveSelected(USER, onboard, undefined, PLAYER)).rejects.toThrow(/account changed/i);
  expect(transport).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
it('refuses an unavailable pending-claim RPC instead of confirming an uncreated selected claim', async () => {
  const original = transport.getMockImplementation()!;
  transport.mockImplementation(async (...args) => {
    if (String(args[0]).includes('/rpc/claim_athlete')) return response({ code: 'PGRST202', message: 'Missing claim_athlete in schema cache' }, 404);
    return original(...args);
  });
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/claim.*unavailable/i);
  expect(wire().filter((request) => request.url.pathname.endsWith('/rpc/claim_athlete'))).toHaveLength(1);
});
it('retains captured A authorization when the mutable SDK session becomes B between selected-claim hops', async () => {
  const original = transport.getMockImplementation()!;
  transport.mockImplementationOnce(async (...args) => {
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'other-user' }, access_token: 'incoming-B' } }, error: null } as never);
    return original(...args);
  });
  await saveSelected(USER, onboard, actor, PLAYER);
  expect(wire().every((request) => request.authorization === 'Bearer captured-A')).toBe(true);
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
});
it('refuses actor loss after an issued claim response without publishing an outgoing success', async () => {
  const original = transport.getMockImplementation()!;
  transport.mockImplementation(async (...args) => {
    if (String(args[0]).includes('/rpc/claim_athlete')) {
      current = false;
      return response({ ok: true });
    }
    return original(...args);
  });
  await expect(saveSelected(USER, onboard, actor, PLAYER)).rejects.toThrow(/account changed/i);
  expect(wire().every((request) => request.authorization === 'Bearer captured-A')).toBe(true);
  expect(wire().filter((request) => request.url.pathname.endsWith('/rpc/claim_athlete'))).toHaveLength(1);
});
