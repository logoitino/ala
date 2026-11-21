/** Real SDK admin writes retain their captured actor across legacy fallbacks and report server refusals. */
import { supabase } from '@/lib/supabase';
import { dismissTelemetryIncident, moderateFlaggedReel, publishSpotlightAward, type PublishSpotlightInput } from './admin';
import { createOfflineActorClient, isOfflineActorChanged, type OfflineActor } from './offlineActor';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true,
  supabase: require('@supabase/supabase-js').createClient('https://admin-test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
}));
const owner = '11111111-1111-4111-8111-111111111111';
const player = '33333333-3333-4333-8333-333333333333';
const input: PublishSpotlightInput = { playerId: player, headline: 'Test headline', periodKind: 'week', startDate: '2026-11-16', endDate: '2026-11-22' };
const originalFetch = globalThis.fetch; const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live: boolean; let actor: OfflineActor; let http: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
function session(id = owner, token = 'test-admin-A') { return { data: { session: { user: { id }, access_token: token } }, error: null }; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function missing() { return response({ code: 'PGRST202', message: 'Could not find function', details: '', hint: '' }, 404); }
function wire() { return http.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, authorization: new Headers(init?.headers).get('Authorization'), method: init?.method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null })); }
beforeEach(() => { live = true; actor = { userId: owner, isCurrent: () => live }; process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://admin-test.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.spyOn(supabase.auth, 'getSession').mockResolvedValue(session() as never);
  http = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => response({ id: 'award-1', player_id: player })); globalThis.fetch = http as typeof fetch;
});
afterEach(() => { jest.restoreAllMocks(); globalThis.fetch = originalFetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl; if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey; });
it('keeps a missing-function Spotlight fallback authorized as captured admin A', async () => {
  const client = await createOfflineActorClient(actor);
  http.mockImplementationOnce(async () => { jest.mocked(supabase.auth.getSession).mockResolvedValue(session('admin-B', 'test-admin-B') as never); return missing(); });
  await publishSpotlightAward(input, client);
  expect(wire().map((r) => r.authorization)).toEqual(['Bearer test-admin-A', 'Bearer test-admin-A']);
  expect(wire().map((r) => r.path)).toEqual(['/rest/v1/rpc/publish_spotlight_award', '/rest/v1/spotlight_awards']);
});
it('blocks fallback transport after the captured admin leaves', async () => {
  const client = await createOfflineActorClient(actor);
  http.mockImplementationOnce(async () => { live = false; return missing(); });
  const error = await publishSpotlightAward(input, client).catch((e) => e);
  expect(isOfflineActorChanged(error)).toBe(true); expect(http).toHaveBeenCalledTimes(1);
});
it.each(['42501', 'P0001'])('keeps a %s server refusal terminal without a raw insert fallback', async (code) => {
  const client = await createOfflineActorClient(actor); http.mockResolvedValueOnce(response({ code, message: 'Admin action refused', details: '', hint: '' }, 403));
  await expect(publishSpotlightAward(input, client)).rejects.toThrow('Admin action refused');
  expect(http).toHaveBeenCalledTimes(1);
});
it('sends moderation with the original actor rather than the mutable global session', async () => {
  const client = await createOfflineActorClient(actor); jest.mocked(supabase.auth.getSession).mockResolvedValue(session('admin-B', 'test-admin-B') as never);
  await moderateFlaggedReel('reel-1', 'remove', client);
  expect(wire()[0]).toMatchObject({ authorization: 'Bearer test-admin-A', path: '/rest/v1/rpc/moderate_flagged_reel', body: { target_reel_id: 'reel-1', moderation_action: 'remove' } });
});
it('reports a refused telemetry dismissal instead of dropping the visible row', async () => {
  const client = await createOfflineActorClient(actor); http.mockResolvedValueOnce(response({ code: '42501', message: 'Not allowed', details: '', hint: '' }, 403));
  await expect(dismissTelemetryIncident('log-1', client)).rejects.toThrow('Not allowed');
});
