/** Existing Auth mutations use the originating client, and onboarding never borrows an incoming account. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, isOfflineActorChanged, type OfflineActor } from '@/lib/offlineActor';
import { confirmReelPlayerTag } from '@/lib/tags';
import { thankDonation } from '@/lib/donationThanks';
import { recordMyBirthMonth } from '@/lib/minors';
import { addUserRoleRemote } from '@/lib/roles';
import { confirmAge13Plus } from '@/lib/auth';
import { saveAthleteOnboardingRemote, readAthleteOnboarding, type AthleteOnboarding } from '@/lib/teams';

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let current: boolean;
let actor: OfflineActor;
let transport: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
const onboard: AthleteOnboarding = {
  team: { id: 'school-A', name: 'School A', mascot: 'Owls', level: 'high_school', division: 'High School', region: 'UT' },
  sport: 'Rugby', jersey: '7', position: 'Wing', classYear: '26',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function response(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
beforeEach(async () => {
  current = true;
  actor = { userId: USER_A, isCurrent: () => current };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://auth-mutations.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.mocked(supabase.auth.getSession).mockReset().mockResolvedValue({
    data: { session: { user: { id: USER_A }, access_token: 'test-token-A' } }, error: null,
  } as never);
  jest.mocked(supabase.rpc).mockReset().mockResolvedValue({ data: null, error: null } as never);
  jest.mocked(supabase.from).mockReset().mockImplementation(() => { throw new Error('Global mutation client was used'); });
  transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => response(null));
  globalThis.fetch = transport as unknown as typeof fetch;
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
});
afterEach(() => {
  globalThis.fetch = originalFetch as unknown as typeof fetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

it('uses the bound actor for age, birth and role mutations, keeping the server block outcome', async () => {
  const client = await createOfflineActorClient(actor);
  transport.mockResolvedValueOnce(response(null, 204)).mockResolvedValueOnce(response({ status: 'blocked' })).mockResolvedValueOnce(response(['fan', 'athlete']));
  await confirmAge13Plus(USER_A, client);
  expect(await recordMyBirthMonth(2020, 2, client)).toBe('blocked');
  expect(await addUserRoleRemote('athlete', client)).toEqual(['fan', 'athlete']);
  expect(transport.mock.calls.map((call) => new Headers(call[1]?.headers).get('Authorization'))).toEqual([
    'Bearer test-token-A', 'Bearer test-token-A', 'Bearer test-token-A',
  ]);
  expect(transport.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))).toEqual([
    { age_confirmed_13_plus: true }, { birth_y: 2020, birth_m: 2 }, { new_role: 'athlete' },
  ]);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it('preserves an actor-change refusal instead of accepting the legacy role fallback', async () => {
  const client = await createOfflineActorClient(actor);
  current = false;
  const error = await addUserRoleRemote('athlete', client).then(() => null, (caught: unknown) => caught);
  expect(isOfflineActorChanged(error)).toBe(true);
  expect(transport).not.toHaveBeenCalled();
});

it('refuses a switched actor before onboarding storage or network work', async () => {
  current = false;
  await expect(saveAthleteOnboardingRemote(USER_A, onboard, actor)).rejects.toThrow(/account changed/);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it('holds A confirmed profile draft in its own key and stops later hops if A switches during storage', async () => {
  const originalSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  const pending = deferred<void>();
  const started = deferred<void>();
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
    await originalSet(key, value);
    started.resolve();
    await pending.promise;
  });
  const task = saveAthleteOnboardingRemote(USER_A, onboard, actor);
  await started.promise;
  current = false;
  pending.resolve();
  const error = await task.then(() => null, (caught: unknown) => caught);
  expect(isOfflineActorChanged(error)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(await readAthleteOnboarding(USER_A)).toEqual(onboard);
  expect(await readAthleteOnboarding(USER_B)).toBeNull();
});

it('never issues name, roster or claim requests after switching during an issued profile update', async () => {
  const issued = deferred<void>();
  const completed = deferred<Response>();
  transport.mockImplementationOnce(() => { issued.resolve(); return completed.promise; });
  const task = saveAthleteOnboardingRemote(USER_A, onboard, actor);
  await issued.promise;
  current = false;
  completed.resolve(response(null, 204));
  const error = await task.then(() => null, (caught: unknown) => caught);
  expect(isOfflineActorChanged(error)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(await readAthleteOnboarding(USER_A)).toBeNull();
  expect(await readAthleteOnboarding(USER_B)).toBeNull();
});

it('uses the same bound client for profile, roster and final athlete claim', async () => {
  transport.mockResolvedValueOnce(response(null, 204))
    .mockResolvedValueOnce(response({ full_name: 'Athlete A' }))
    .mockResolvedValueOnce(response({ id: 'player-A' }))
    .mockResolvedValueOnce(response(null));
  await saveAthleteOnboardingRemote(USER_A, onboard, actor);
  expect(transport).toHaveBeenCalledTimes(4);
  expect(transport.mock.calls.map((call) => new Headers(call[1]?.headers).get('Authorization'))).toEqual([
    'Bearer test-token-A', 'Bearer test-token-A', 'Bearer test-token-A', 'Bearer test-token-A',
  ]);
  expect(String(transport.mock.calls[3][0])).toContain('/rpc/claim_athlete');
  expect(JSON.parse(String(transport.mock.calls[3][1]?.body))).toEqual({ target_player_id: 'player-A', request_notes: null });
});

it('does not adopt the legacy ownerless draft for either signed-in account', async () => {
  await AsyncStorage.setItem('tapuai.athleteOnboarding', JSON.stringify(onboard));
  expect(await readAthleteOnboarding(USER_A)).toBeNull();
  expect(await readAthleteOnboarding(USER_B)).toBeNull();
  expect(await readAthleteOnboarding()).toEqual(onboard);
});

it('keeps guest onboarding in its local-only draft without a configured profile write', async () => {
  await saveAthleteOnboardingRemote(null, onboard);
  expect(await readAthleteOnboarding()).toEqual(onboard);
  expect(transport).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});


it('surfaces a denied profile save and never opens an athlete claim or retains the failed team draft', async () => {
  transport.mockResolvedValueOnce(response({ code: '42501', message: 'Permission denied' }, 403));
  await expect(saveAthleteOnboardingRemote(USER_A, onboard, actor)).rejects.toMatchObject({ message: 'Permission denied' });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(await readAthleteOnboarding(USER_A)).toBeNull();
});

it('preserves the prior same-owner onboarding cache when a new profile save is denied', async () => {
  const previous = { ...onboard, jersey: '22', position: 'Center' };
  await AsyncStorage.setItem(`tapuai.athleteOnboarding.${USER_A}`, JSON.stringify(previous));
  jest.mocked(AsyncStorage.setItem).mockClear();
  transport.mockResolvedValueOnce(response({ code: '42501', message: 'Permission denied' }, 403));
  await expect(saveAthleteOnboardingRemote(USER_A, onboard, actor)).rejects.toMatchObject({ message: 'Permission denied' });
  expect(await readAthleteOnboarding(USER_A)).toEqual(previous);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(1);
});


it('uses the bound actor for tag decisions and blocks the real SDK token-await gap', async () => {
  const client = await createOfflineActorClient(actor);
  await confirmReelPlayerTag('reel-A', 'confirm', client);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(new Headers(transport.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer test-token-A');
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({ target_reel_id: 'reel-A', tag_action: 'confirm' });
  const refused = confirmReelPlayerTag('reel-A', 'reject', client).catch((error: unknown) => error);
  current = false;
  expect(isOfflineActorChanged(await refused)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it('binds preset thank-you decisions and refuses the SDK token-await gap without a new account request', async () => {
  const client = await createOfflineActorClient(actor);
  expect(await thankDonation(USER_B, 'malo', client)).toEqual({ ok: true });
  expect(new Headers(transport.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer test-token-A');
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({ target_tip_id: USER_B, message_key: 'malo' });
  const pending = thankDonation(USER_B, 'gear', client);
  current = false;
  expect(await pending).toMatchObject({ ok: false });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).not.toHaveBeenCalled();
});
