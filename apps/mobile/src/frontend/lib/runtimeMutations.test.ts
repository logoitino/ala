/** Runtime fallback writes use one captured admin client and never proceed after a server refusal or failed read. */
import { supabase } from '@/lib/supabase';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME, publishAppRuntime, saveAppRuntimeDraft } from './runtime';
import { createOfflineActorClient, isOfflineActorChanged, type OfflineActor } from './offlineActor';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true,
  supabase: require('@supabase/supabase-js').createClient('https://runtime-test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
}));
const owner = '11111111-1111-4111-8111-111111111111';
const originalFetch = globalThis.fetch; const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live: boolean; let actor: OfflineActor; let http: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
function session(id = owner, token = 'test-admin-A') { return { data: { session: { user: { id }, access_token: token } }, error: null }; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function missing() { return response({ code: 'PGRST202', message: 'Could not find function', details: '', hint: '' }, 404); }
function row() { return { draft: cloneAppRuntime(DEFAULT_APP_RUNTIME), published: cloneAppRuntime(DEFAULT_APP_RUNTIME), published_at: null, updated_at: null }; }
function wire() { return http.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, authorization: new Headers(init?.headers).get('Authorization'), method: init?.method })); }
beforeEach(() => { live = true; actor = { userId: owner, isCurrent: () => live }; process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://runtime-test.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.spyOn(supabase.auth, 'getSession').mockResolvedValue(session() as never);
  http = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => response(row())); globalThis.fetch = http as unknown as typeof fetch;
});
afterEach(() => { jest.restoreAllMocks(); globalThis.fetch = originalFetch as unknown as typeof fetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl; if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey; });
it.each(['save', 'publish'])('%s fallback retains original authorization through every hop', async (kind) => {
  const client = await createOfflineActorClient(actor);
  http.mockImplementationOnce(async () => { jest.mocked(supabase.auth.getSession).mockResolvedValue(session('admin-B', 'test-admin-B') as never); return missing(); });
  if (kind === 'save') await saveAppRuntimeDraft(cloneAppRuntime(DEFAULT_APP_RUNTIME), client); else await publishAppRuntime(client);
  expect(wire().map((r) => r.authorization)).toEqual(kind === 'save' ? ['Bearer test-admin-A', 'Bearer test-admin-A'] : ['Bearer test-admin-A', 'Bearer test-admin-A', 'Bearer test-admin-A']);
});
it.each(['save', 'publish'])('%s refuses fallback HTTP when the actor changes', async (kind) => {
  const client = await createOfflineActorClient(actor); http.mockImplementationOnce(async () => { live = false; return missing(); });
  const error = await (kind === 'save' ? saveAppRuntimeDraft(cloneAppRuntime(DEFAULT_APP_RUNTIME), client) : publishAppRuntime(client)).catch((e) => e);
  expect(isOfflineActorChanged(error)).toBe(true); expect(http).toHaveBeenCalledTimes(1);
});
it.each([['save', '42501'], ['save', 'P0001'], ['publish', '42501'], ['publish', 'P0001']])('%s does not fall back after %s refusal', async (kind, code) => {
  const client = await createOfflineActorClient(actor); http.mockResolvedValueOnce(response({ code, message: 'Action refused', details: '', hint: '' }, 403));
  await expect(kind === 'save' ? saveAppRuntimeDraft(cloneAppRuntime(DEFAULT_APP_RUNTIME), client) : publishAppRuntime(client)).rejects.toThrow('Action refused');
  expect(http).toHaveBeenCalledTimes(1);
});
it('does not publish defaults when the bound fallback read fails', async () => {
  const client = await createOfflineActorClient(actor); http.mockResolvedValueOnce(missing()).mockResolvedValueOnce(response({ code: '42501', message: 'Read refused', details: '', hint: '' }, 403));
  await expect(publishAppRuntime(client)).rejects.toThrow('Read refused');
  expect(wire().map((r) => r.method)).toEqual(['POST', 'GET']);
});
