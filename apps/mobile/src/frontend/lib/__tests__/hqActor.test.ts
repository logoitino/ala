/** HQ writes use the initiating transport and require stored confirmation; synthetic SDK requests never reach a hosted account. */
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, type OfflineActor } from '@/lib/offlineActor';
import { updateOwnDisplayName } from '@/lib/auth';
import { insertBoosterRoster, updateBoosterJersey, setBoosterVerification } from '@/lib/boosterPortal';
import { createSponsorAd, setSponsorAdActive } from '@/lib/sponsorAds';
const mockGlobalWrite = jest.fn();
jest.mock('@/lib/supabase', () => {
  const query = { update: () => query, insert: () => query, eq: () => query, select: () => query, single: () => mockGlobalWrite(), then: (done: (v: unknown) => unknown) => mockGlobalWrite().then(done) };
  return { isSupabaseConfigured: true, supabase: { auth: { getSession: jest.fn() }, from: jest.fn(() => query), rpc: jest.fn() } };
});
const A = '11111111-1111-4111-8111-111111111111';
const oldFetch = globalThis.fetch, oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live: boolean, actor: OfflineActor, http: jest.Mock;
const roster = [{ name: 'Athlete A', jersey_number: 7, position: '', school_name: '', height: '', backer_count: 0 }];
beforeEach(() => {
  jest.clearAllMocks(); live = true; actor = { userId: A, isCurrent: () => live };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://hq-actor.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: A }, access_token: 'synthetic-token-A' } }, error: null } as never);
  mockGlobalWrite.mockResolvedValue({ data: null, error: null });
  http = jest.fn(async () => new Response(JSON.stringify({ id: A, user_id: A, full_name: 'Athlete A', jersey_number: 7, status: 'verified', is_active: false }), { headers: { 'Content-Type': 'application/json' } })); globalThis.fetch = http;
});
afterEach(() => { globalThis.fetch = oldFetch; if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey; });
it('uses one captured client for all existing HQ mutation kinds', async () => {
  const client = await createOfflineActorClient(actor);
  expect(await updateOwnDisplayName(A, 'Athlete A', client)).toBeNull();
  expect(await updateBoosterJersey(A, 7, client)).toEqual({ ok: true });
  expect(await setBoosterVerification(A, 'verified', client)).toEqual({ ok: true });
  expect(await createSponsorAd({ title: 'Sponsor A', placement: 'sideline-board', rivalry: null }, client)).toEqual({ ok: true });
  expect(await setSponsorAdActive(A, false, client)).toEqual({ ok: true });
  http.mockResolvedValueOnce(new Response(JSON.stringify([{ id: A }]), { headers: { 'Content-Type': 'application/json' } }));
  expect(await insertBoosterRoster(roster, client)).toEqual({ ok: true });
  expect(http).toHaveBeenCalledTimes(6); expect(supabase.from).not.toHaveBeenCalled();
  expect(http.mock.calls.map((call: [unknown, RequestInit]) => new Headers(call[1]?.headers).get('Authorization'))).toEqual(Array(6).fill('Bearer synthetic-token-A'));
});
it('blocks a Sponsor write when the actor leaves during the real SDK token-await gap', async () => {
  const client = await createOfflineActorClient(actor);
  const task = setSponsorAdActive(A, false, client).catch((error: unknown) => error); live = false;
  await task; expect(http).not.toHaveBeenCalled(); expect(supabase.from).not.toHaveBeenCalled();
});
it.each([
  { name: 'profile', run: () => updateOwnDisplayName(A, 'Athlete A') },
  { name: 'jersey', run: () => updateBoosterJersey(A, 7) },
  { name: 'verification', run: () => setBoosterVerification(A, 'verified') },
  { name: 'sponsor', run: () => setSponsorAdActive(A, false) },
])('refuses a zero-row $name update', async ({ name, run }) => {
  const result = await run();
  if (name === 'profile') expect(result).not.toBeNull();
  else expect(result).toMatchObject({ ok: false });
});
it.each([
  { name: 'profile', run: () => updateOwnDisplayName(A, 'Athlete A') },
  { name: 'jersey', run: () => updateBoosterJersey(A, 7) },
  { name: 'verification', run: () => setBoosterVerification(A, 'verified') },
  { name: 'sponsor status', run: () => setSponsorAdActive(A, false) },
  { name: 'roster insert', run: () => insertBoosterRoster(roster) },
  { name: 'sponsor insert', run: () => createSponsorAd({ title: 'Sponsor A', placement: 'sideline-board', rivalry: null }) },
])('retains the real denial for $name without false success', async ({ name, run }) => {
  mockGlobalWrite.mockResolvedValue({ data: null, error: { message: 'Denied' } });
  const result = await run();
  if (name === 'profile') expect(result).toBe('Denied');
  else expect(result).toEqual({ ok: false, message: 'Denied' });
});
it('refuses an unconfirmed roster or sponsor insertion', async () => {
  expect(await insertBoosterRoster(roster)).toMatchObject({ ok: false });
  expect(await createSponsorAd({ title: 'Sponsor A', placement: 'sideline-board', rivalry: null })).toMatchObject({ ok: false });
});
