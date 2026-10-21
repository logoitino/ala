/** Connect replies remain owned by their initiating account; cache never grants another account's status. */
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { useStripeConnect } from '@/hooks/useStripeConnect';
const mockInvoke = jest.fn(), mockOpen = jest.fn(), mockLegal = jest.fn(), mockRefresh = jest.fn(), mockFetch = jest.fn();
let mockAuth: ReturnType<typeof auth>;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock('@/lib/legal', () => ({ hasLegalAck: (...args: unknown[]) => mockLegal(...args) }));
jest.mock('@/lib/apiUrl', () => ({ apiUrl: (path: string) => `http://localhost:8081${path}` }));
jest.mock('expo-linking', () => ({ createURL: (_path: string, options?: { queryParams?: { playerId?: string } }) => 'alasports://stripe-connect' + (options?.queryParams?.playerId ? `?playerId=${options.queryParams.playerId}` : '') }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), warmUpAsync: jest.fn(async () => {}), coolDownAsync: jest.fn(async () => {}), openAuthSessionAsync: (...args: unknown[]) => mockOpen(...args) }));
function auth(id: string) {
 return { isSessionCurrent: undefined as (() => boolean) | undefined, user: { id }, session: { user: { id }, access_token: `jwt-${id}` }, profile: { id: `profile-${id}`, user_id: id, stripe_connect_id: `acct_${id}`, stripe_onboarding_complete: false, payouts_enabled: false, legal_terms_accepted_at: null, legal_terms_version: null } as Record<string, unknown> | null, refreshProfile: mockRefresh };
}
function payload(accountId = 'acct_a', complete = true) {
 return { accountId, stripe_onboarding_complete: complete, payouts_enabled: complete, url: 'https://connect.stripe.com/setup/test' };
}
function deferred<T>() {
 let resolve!: (value: T) => void;
 const promise = new Promise<T>(yes => { resolve = yes; });
 return { promise, resolve };
}
async function start(result: { current: ReturnType<typeof useStripeConnect> }) {
 await act(async () => { await result.current.createStripeExpressAccount(); });
}
beforeEach(async () => {
 jest.clearAllMocks(); await AsyncStorage.clear(); mockAuth = auth('a');
 mockLegal.mockResolvedValue(true); mockRefresh.mockResolvedValue(null);
 mockInvoke.mockImplementation(async () => ({ data: payload(`acct_${mockAuth.user.id}`), error: null }));
 mockOpen.mockResolvedValue({ type: 'cancel' }); mockFetch.mockReset(); global.fetch = mockFetch;
 jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
describe('Connect status ownership', () => {
 it('keeps explicit profile false authoritative over cached true', async () => {
  await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify(payload()));
  const { result } = await renderHook(() => useStripeConnect());
  expect(result.current.stripeOnboardingComplete).toBe(false); expect(result.current.payoutsEnabled).toBe(false);
 });
 it('does not borrow a cached completed account while the current profile is unavailable', async () => {
  mockAuth.profile = null; await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify(payload()));
  const { result } = await renderHook(() => useStripeConnect());
  expect(result.current.stripeOnboardingComplete).toBe(false); await start(result);
  expect(mockLegal).toHaveBeenCalledWith('a', undefined, undefined); expect(mockInvoke.mock.calls[0][1].body.mode).toBe('onboarding');
 });
 it('clears outgoing status when the next account has no cache or profile', async () => {
  mockAuth.profile = null; const hook = await renderHook(() => useStripeConnect()); await start(hook.result);
  expect(hook.result.current.stripeOnboardingComplete).toBe(true);
  mockAuth = auth('b'); mockAuth.profile = null; await hook.rerender({});
  expect(hook.result.current.stripeOnboardingComplete).toBe(false); expect(hook.result.current.payoutsEnabled).toBe(false);
 });
 it('ignores the previous account profile and its legal fields', async () => {
  const outgoing = { ...auth('a').profile, stripe_onboarding_complete: true, payouts_enabled: true, legal_terms_accepted_at: '2026-01-01', legal_terms_version: 'old' };
  mockAuth = auth('b'); mockAuth.profile = outgoing;
  const { result } = await renderHook(() => useStripeConnect());
  expect(result.current.stripeOnboardingComplete).toBe(false); expect(result.current.payoutsEnabled).toBe(false);
  await start(result); expect(mockLegal).toHaveBeenCalledWith('b', undefined, undefined);
 });
 it('refuses mismatched session and user before any authenticated request', async () => {
  mockAuth.session.user.id = 'b'; const { result } = await renderHook(() => useStripeConnect()); await start(result);
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockOpen).not.toHaveBeenCalled();
 });
 it('does not coerce cached string flags into a completed account', async () => {
  mockAuth.profile = { user_id: 'a', stripe_connect_id: 'acct_a' };
  await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify({ accountId: 'acct_a', stripe_onboarding_complete: 'false', payouts_enabled: 'false' }));
  const { result } = await renderHook(() => useStripeConnect());
  expect(result.current.stripeOnboardingComplete).toBe(false); expect(result.current.payoutsEnabled).toBe(false);
 });
 it('does not use a cache bound to a different Stripe account', async () => {
  mockAuth.profile = { user_id: 'a', stripe_connect_id: 'acct_current' };
  await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify(payload('acct_old')));
  const { result } = await renderHook(() => useStripeConnect()); expect(result.current.stripeOnboardingComplete).toBe(false);
 });
});
describe('Connect request lifecycle', () => {
 it('acquires busy before legal lookup and permits only one rapid tap', async () => {
  const legal = deferred<boolean>(); mockLegal.mockReturnValue(legal.promise); const { result } = await renderHook(() => useStripeConnect());
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { first = result.current.createStripeExpressAccount(); second = result.current.createStripeExpressAccount(); });
  try { expect(result.current.busy).toBe(true); }
  finally { await act(async () => { legal.resolve(true); await Promise.all([first, second]); }); }
  expect(mockInvoke).toHaveBeenCalledTimes(2); expect(mockOpen).toHaveBeenCalledTimes(1); expect(result.current.busy).toBe(false);
 });
 it('stops before the API when account changes during legal lookup', async () => {
  const legal = deferred<boolean>(); mockLegal.mockReturnValue(legal.promise); const hook = await renderHook(() => useStripeConnect()); let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
  mockAuth = auth('b'); await hook.rerender({});
  await act(async () => { legal.resolve(true); await task; });
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockOpen).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
 });
 it('does not publish or open a late create reply for the incoming account', async () => {
  const reply = deferred<{ data: ReturnType<typeof payload>; error: null }>(); mockInvoke.mockReturnValue(reply.promise);
  const hook = await renderHook(() => useStripeConnect()); let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
  mockAuth = auth('b'); mockAuth.profile = null; await hook.rerender({});
  await act(async () => { reply.resolve({ data: payload('acct_a'), error: null }); await task; });
  expect(hook.result.current.stripeOnboardingComplete).toBe(false); expect(mockOpen).not.toHaveBeenCalled(); expect(mockRefresh).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('tapuai.stripeConnect.b')).toBeNull();
 });
 it('does not revalidate the outgoing token after switching accounts in the browser', async () => {
  const browser = deferred<{ type: 'cancel' }>(); mockOpen.mockReturnValue(browser.promise);
  const hook = await renderHook(() => useStripeConnect()); let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); }); expect(mockOpen).toHaveBeenCalledTimes(1);
  mockAuth = auth('b'); await hook.rerender({});
  await act(async () => { browser.resolve({ type: 'cancel' }); await task; });
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(hook.result.current.payoutsEnabled).toBe(false);
 });
 it('ignores A to B to A replies from the earlier A session', async () => {
  const reply = deferred<{ data: ReturnType<typeof payload>; error: null }>(); mockInvoke.mockReturnValue(reply.promise);
  const hook = await renderHook(() => useStripeConnect()); let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
  mockAuth = auth('b'); await hook.rerender({}); mockAuth = auth('a'); await hook.rerender({});
  await act(async () => { reply.resolve({ data: payload(), error: null }); await task; });
  expect(mockOpen).not.toHaveBeenCalled(); expect(hook.result.current.stripeOnboardingComplete).toBe(false);
 });
 it('keeps the new account busy when the old account finally finishes', async () => {
  mockOpen.mockResolvedValue({ type: 'locked' });
  const old = deferred<{ data: ReturnType<typeof payload>; error: null }>(), current = deferred<{ data: ReturnType<typeof payload>; error: null }>();
  mockInvoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const hook = await renderHook(() => useStripeConnect()); let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { first = hook.result.current.createStripeExpressAccount(); });
  mockAuth = auth('b'); await hook.rerender({}); await act(async () => { second = hook.result.current.createStripeExpressAccount(); });
  await act(async () => { old.resolve({ data: payload('acct_a'), error: null }); await first; });
  try { expect(hook.result.current.busy).toBe(true); }
  finally { await act(async () => { current.resolve({ data: payload('acct_b'), error: null }); await second; }); }
  expect(hook.result.current.busy).toBe(false); expect(mockOpen).toHaveBeenCalledTimes(1);
 });
 it('stops side effects after unmount while create is pending', async () => {
  const reply = deferred<{ data: ReturnType<typeof payload>; error: null }>(); mockInvoke.mockReturnValue(reply.promise);
  const hook = await renderHook(() => useStripeConnect()); let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); }); await hook.unmount();
  await act(async () => { reply.resolve({ data: payload(), error: null }); await task; });
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockRefresh).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
 });
 it('does not let delayed initial cache hydration overwrite fresh server status', async () => {
  const cache = deferred<string | null>(); jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(cache.promise); mockAuth.profile = null;
  const hook = await renderHook(() => useStripeConnect()); await start(hook.result); expect(hook.result.current.stripeOnboardingComplete).toBe(true);
  await act(async () => { cache.resolve(JSON.stringify(payload('acct_a', false))); await cache.promise; });
  expect(hook.result.current.stripeOnboardingComplete).toBe(true);
 });
});
describe('Connect API validation', () => {
 it('rejects an error response even when it contains an account id', async () => {
  mockInvoke.mockResolvedValue({ data: payload(), error: { message: 'Save failed', context: { status: 503 } } });
  const { result } = await renderHook(() => useStripeConnect()); await start(result);
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalledWith('Stripe Connect', expect.any(String));
 });
 it('rejects malformed flags without replaying a successful Edge reply elsewhere', async () => {
  mockInvoke.mockResolvedValue({ data: { ...payload(), stripe_onboarding_complete: 'false' }, error: null });
  const { result } = await renderHook(() => useStripeConnect()); await start(result);
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalledWith('Stripe Connect', expect.any(String));
 });
 it('preserves missing-function fallback with authenticated create and status requests', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'not found', context: { status: 404 } } });
  mockFetch.mockResolvedValue({ ok: true, json: async () => payload() }); const { result } = await renderHook(() => useStripeConnect()); await start(result);
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-a'); expect(JSON.parse(mockFetch.mock.calls[1][1].body).mode).toBe('status');
 });
});

describe('Connect recovery and preserved behavior', () => {
 it('keeps the terms requirement when a same-binding legacy cache reports completion', async () => {
  mockAuth.profile = { user_id: 'a', stripe_connect_id: 'acct_a' };
  await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify(payload()));
  mockLegal.mockResolvedValue(false);
  const { result } = await renderHook(() => useStripeConnect());
  await start(result);
  expect(mockLegal).toHaveBeenCalledWith('a', undefined, undefined);
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
 });
 it('shows explicit server completion and requests the dashboard without another first-onboarding check', async () => {
  mockAuth.profile = { ...mockAuth.profile, stripe_onboarding_complete: true, payouts_enabled: true };
  const { result } = await renderHook(() => useStripeConnect());
  expect(result.current.stripeOnboardingComplete).toBe(true);
  expect(result.current.payoutsEnabled).toBe(true);
  await start(result);
  expect(mockLegal).not.toHaveBeenCalled();
  expect(mockInvoke.mock.calls[0][1].body.mode).toBe('dashboard');
 });
 it('opens the confirmed server link when the local cache write is unavailable', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage unavailable'));
  const { result } = await renderHook(() => useStripeConnect());
  await start(result);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
 });
 it('continues onboarding when cache reads are unavailable', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage unavailable'));
  const { result } = await renderHook(() => useStripeConnect());
  await start(result);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(false);
 });
 it('does not misreport a refresh failure as a failed server account creation', async () => {
  mockRefresh.mockRejectedValue(new Error('Profile unavailable'));
  const { result } = await renderHook(() => useStripeConnect());
  await start(result);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
 });
 it('keeps the locked-browser notice without issuing a status request', async () => {
  mockOpen.mockResolvedValue({ type: 'locked' });
  const { result } = await renderHook(() => useStripeConnect());
  await start(result);
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Stripe Connect', expect.stringContaining('already open'));
  expect(result.current.busy).toBe(false);
 });
 it('ignores a late status reply after the current account changes', async () => {
  const status = deferred<{ data: ReturnType<typeof payload>; error: null }>();
  mockInvoke.mockResolvedValueOnce({ data: payload('acct_a', false), error: null }).mockReturnValueOnce(status.promise);
  const hook = await renderHook(() => useStripeConnect());
  let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
  expect(mockInvoke).toHaveBeenCalledTimes(2);
  mockAuth = auth('b'); mockAuth.profile = null; await hook.rerender({});
  await act(async () => { status.resolve({ data: payload('acct_a'), error: null }); await task; });
  expect(hook.result.current.stripeOnboardingComplete).toBe(false);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('tapuai.stripeConnect.b')).toBeNull();
 });
 it('does not use the HTTP fallback after switching accounts during a missing Edge response', async () => {
  const missing = deferred<{ data: null; error: { message: string; context: { status: number } } }>();
  mockInvoke.mockReturnValue(missing.promise);
  const hook = await renderHook(() => useStripeConnect());
  let task!: Promise<void>;
  await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
  mockAuth = auth('b'); await hook.rerender({});
  await act(async () => { missing.resolve({ data: null, error: { message: 'not found', context: { status: 404 } } }); await task; });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
 });
 it('rejects a retained outgoing callback before performing a legal or API request', async () => {
  const hook = await renderHook(() => useStripeConnect());
  const outgoing = hook.result.current.createStripeExpressAccount;
  mockAuth = auth('b'); await hook.rerender({});
  await act(async () => { await outgoing(); });
  expect(mockLegal).not.toHaveBeenCalled();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(hook.result.current.busy).toBe(false);
 });
});

it('does not attach a fresh response to a replaced same-owner Stripe binding', async () => {
 mockAuth.profile = null;
 mockInvoke.mockResolvedValue({ data: payload('acct_old'), error: null });
 const hook = await renderHook(() => useStripeConnect());
 await start(hook.result);
 expect(hook.result.current.stripeOnboardingComplete).toBe(true);
 mockAuth.profile = { user_id: 'a', stripe_connect_id: 'acct_new' };
 await hook.rerender({});
 expect(hook.result.current.stripeOnboardingComplete).toBe(false);
 expect(hook.result.current.payoutsEnabled).toBe(false);
});

it('rejects old work when auth switches away and back inside one render batch', async () => {
 let current = true;
 mockAuth.isSessionCurrent = () => current;
 const reply = deferred<{ data: ReturnType<typeof payload>; error: null }>();
 mockInvoke.mockReturnValue(reply.promise);
 const hook = await renderHook(() => useStripeConnect());
 let task!: Promise<void>;
 await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
 current = false; // The provider invalidated this guard at the intervening account event.
 mockAuth.isSessionCurrent = () => true;
 await hook.rerender({}); // The consumer sees only the final A session.
 await act(async () => { reply.resolve({ data: payload(), error: null }); await task; });
 expect(mockOpen).not.toHaveBeenCalled();
 expect(mockRefresh).not.toHaveBeenCalled();
 expect(hook.result.current.busy).toBe(false);
});

it('checks the provider guard before the consumer has rendered the new account epoch', async () => {
 let current = true;
 mockAuth.isSessionCurrent = () => current;
 const reply = deferred<{ data: ReturnType<typeof payload>; error: null }>();
 mockInvoke.mockReturnValue(reply.promise);
 const hook = await renderHook(() => useStripeConnect());
 let task!: Promise<void>;
 await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
 current = false;
 mockAuth.isSessionCurrent = () => true;
 await act(async () => { reply.resolve({ data: payload(), error: null }); await task; });
 expect(mockOpen).not.toHaveBeenCalled();
 expect(mockRefresh).not.toHaveBeenCalled();
 expect(hook.result.current.busy).toBe(false);
});

it('preserves the browser journey across a same-owner token refresh', async () => {
 const currentSession = () => true;
 mockAuth.isSessionCurrent = currentSession;
 const browser = deferred<{ type: 'cancel' }>();
 mockOpen.mockReturnValue(browser.promise);
 const hook = await renderHook(() => useStripeConnect());
 let task!: Promise<void>;
 await act(async () => { task = hook.result.current.createStripeExpressAccount(); });
 mockAuth.session.access_token = 'jwt-a-refreshed';
 await hook.rerender({});
 await act(async () => { browser.resolve({ type: 'cancel' }); await task; });
 expect(mockOpen).toHaveBeenCalledTimes(1);
 expect(mockInvoke).toHaveBeenCalledTimes(2);
 expect(mockInvoke.mock.calls[1][1].body.mode).toBe('status');
 expect(hook.result.current.busy).toBe(false);
});

it('uses an immutably replaced same-owner session token for browser-return status', async () => {
 const currentSession = () => true;
 mockAuth.isSessionCurrent = currentSession;
 const browser = deferred<{ type: 'cancel' }>(); mockOpen.mockReturnValue(browser.promise);
 const h = await renderHook(() => useStripeConnect()); let pending!: Promise<void>;
 await act(async () => { pending = h.result.current.createStripeExpressAccount(); });
 expect(mockInvoke.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-a');
 mockAuth = { ...mockAuth, session: { ...mockAuth.session, access_token: 'jwt-a-refreshed', user: { ...mockAuth.session.user } } };
 await h.rerender({});
 await act(async () => { browser.resolve({ type: 'cancel' }); await pending; });
 expect(mockInvoke.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt-a-refreshed');
 expect(h.result.current.busy).toBe(false);
});

it('rejects an explicit error in an otherwise valid successful HTTP fallback response', async () => {
 mockInvoke.mockResolvedValue({ data: null, error: { message: 'not found', context: { status: 404 } } });
 mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...payload(), error: 'Account save incomplete' }) });
 const { result } = await renderHook(() => useStripeConnect());
 await start(result);
 expect(mockOpen).not.toHaveBeenCalled();
 expect(Alert.alert).toHaveBeenCalledWith('Stripe Connect', 'Bank setup could not be completed. Try again.');
 expect(result.current.busy).toBe(false);
});

const PLAYER_A = '11111111-1111-4111-8111-111111111111';
const PLAYER_B = '22222222-2222-4222-8222-222222222222';
describe('guardian bank setup target and status', () => {
 it('reads only the requested athlete and never borrows or persists the guardian profile bank', async () => {
  mockAuth.profile = { ...mockAuth.profile, stripe_onboarding_complete: true, payouts_enabled: true };
  await AsyncStorage.setItem('tapuai.stripeConnect.a', JSON.stringify(payload('acct_profile')));
  mockInvoke.mockImplementation(async (_name, { body }) => ({ data: { ...payload('acct_child', false), playerId: body.playerId }, error: null }));
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  expect(mockInvoke.mock.calls[0][1].body).toEqual({ mode: 'status', playerId: PLAYER_A });
  expect(h.result.current.stripeOnboardingComplete).toBe(false);
  await start(h.result);
  expect(mockInvoke.mock.calls[1][1].body.playerId).toBe(PLAYER_A);
  expect(mockInvoke.mock.calls[1][1].body.returnUrl).toBe('alasports://stripe-connect?playerId=11111111-1111-4111-8111-111111111111');
  expect(await AsyncStorage.getItem('tapuai.stripeConnect.a')).toBe(JSON.stringify(payload('acct_profile')));
  expect(mockRefresh).not.toHaveBeenCalled();
 });
 it('treats the server missing-link code as an ordinary unlinked test bank', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 400, json: async () => ({ playerId: PLAYER_A, code: 'connect_not_linked', error: 'No Stripe Express account is linked to this athlete yet.' }) } } });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  expect(h.result.current.linked).toBe(false);
  expect(h.result.current.statusReady).toBe(true);
  expect(h.result.current.error).toBeNull(); expect(Alert.alert).not.toHaveBeenCalled();
 });
 it('surfaces ineligible status safely and blocks it from becoming linked', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 403, json: async () => ({ code: 'connect_ineligible', error: 'private diagnostics 123' }) } } });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  expect(h.result.current.linked).toBeNull();
  expect(h.result.current.error).toMatch(/not eligible/); expect(h.result.current.error).not.toContain('private diagnostics');
 });
 it('drops an old athlete read when selecting a different athlete', async () => {
  const old = deferred<{ data: ReturnType<typeof payload> & { playerId: string }; error: null }>();
  mockInvoke.mockReturnValueOnce(old.promise).mockResolvedValue({ data: { ...payload('acct_b', false), playerId: PLAYER_B }, error: null });
  const h = await renderHook<ReturnType<typeof useStripeConnect>, { playerId: string }>(({ playerId }) => useStripeConnect({ playerId }), { initialProps: { playerId: PLAYER_A } });
  await h.rerender({ playerId: PLAYER_B });
  await act(async () => old.resolve({ data: { ...payload('acct_a'), playerId: PLAYER_A }, error: null }));
  expect(h.result.current.stripeOnboardingComplete).toBe(false);
  expect(h.result.current.payoutsEnabled).toBe(false);
 });
 it('rejects a successful response referring to another athlete', async () => {
  mockInvoke.mockResolvedValue({ data: { ...payload(), playerId: PLAYER_B }, error: null });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  expect(h.result.current.linked).toBeNull(); expect(h.result.current.error).not.toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
 });
 it('refuses invalid player ids without any server request', async () => {
  const h = await renderHook(() => useStripeConnect({ playerId: '../someone' })); await start(h.result);
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockOpen).not.toHaveBeenCalled();
 });
 it('rechecks server status on an explicit refresh without opening Stripe', async () => {
  mockInvoke.mockImplementation(async (_name, { body }) => ({ data: { ...payload('acct_child', false), playerId: body.playerId }, error: null }));
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  await act(async () => { await h.result.current.refresh(); });
  expect(mockInvoke).toHaveBeenCalledTimes(2); expect(mockOpen).not.toHaveBeenCalled();
 });
});

describe('safe bank browser launch', () => {
 it.each(['https://connect.stripe.com.evil.test/account','javascript:alert(1)','http://connect.stripe.com/account','https://user@connect.stripe.com/account'])('never opens untrusted server URL %s', async url => {
  mockInvoke.mockResolvedValue({ data: { ...payload(), url }, error: null });
  const h = await renderHook(() => useStripeConnect()); await start(h.result);
  expect(mockOpen).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalledWith('Stripe Connect', 'Bank setup could not be completed. Try again.');
 });
 it('uses full page navigation on web after async minting instead of a popup', async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window'); const assign = jest.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { assign } } });
  jest.replaceProperty(Platform, 'OS', 'web');
  try {
   const h = await renderHook(() => useStripeConnect()); await start(h.result);
   expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/test');
   expect(mockOpen).not.toHaveBeenCalled(); expect(mockInvoke).toHaveBeenCalledTimes(1);
  } finally { if (prior) Object.defineProperty(globalThis, 'window', prior); else delete (globalThis as { window?: unknown }).window; }
 });
 it('locks the shared native browser across different athlete cards', async () => {
  const browser = deferred<{ type: 'cancel' }>(); mockOpen.mockReturnValue(browser.promise);
  mockInvoke.mockImplementation(async (_name, { body }) => ({ data: { ...payload(`acct_${body.playerId}`, false), playerId: body.playerId }, error: null }));
  const a = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  const b = await renderHook(() => useStripeConnect({ playerId: PLAYER_B }));
  let pending!: Promise<void>, competing!: Promise<void>;
  await act(async () => { pending = a.result.current.createStripeExpressAccount(); });
  await act(async () => { competing = b.result.current.createStripeExpressAccount(); });
  try { expect(mockOpen).toHaveBeenCalledTimes(1); }
  finally { await act(async () => { browser.resolve({ type: 'cancel' }); await Promise.all([pending, competing]); }); }
 });
});

describe('guardian deployment compatibility', () => {
 it('invalidates a retained create callback immediately when a later status read fails', async () => {
  mockInvoke.mockResolvedValueOnce({ data: { ...payload('acct_child', false), playerId: PLAYER_A }, error: null });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A }));
  const retained = h.result.current.createStripeExpressAccount;
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 503 }, message: 'private failure' } });
  await act(async () => { await h.result.current.refresh(); await retained(); });
  expect(mockInvoke).toHaveBeenCalledTimes(2); expect(mockOpen).not.toHaveBeenCalled();
 });
 it('never replays a compatible Edge guardian creation on a different server after 404', async () => {
  mockInvoke.mockResolvedValueOnce({ data: { ...payload('acct_child', false), playerId: PLAYER_A }, error: null })
   .mockResolvedValue({ data: null, error: { context: { status: 404 }, message: 'not found' } });
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => payload('acct_guardian_profile') });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockOpen).not.toHaveBeenCalled();
 });
 it('pins a compatible Node status to direct Node creation when Edge is absent', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 404 }, message: 'not found' } });
  mockFetch.mockImplementation(async (_url, options) => {
   const body = JSON.parse(options.body);
   return body.mode === 'status' ? { ok: false, status: 400, json: async () => ({ code: 'connect_not_linked', playerId: PLAYER_A }) }
    : { ok: true, status: 200, json: async () => ({ ...payload('acct_child', false), playerId: PLAYER_A }) };
  });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual(expect.objectContaining({ mode: 'onboarding', playerId: PLAYER_A }));
  expect(mockOpen).toHaveBeenCalledTimes(1);
 });
 it('never creates through an older Edge status that omits the athlete target', async () => {
  mockInvoke.mockResolvedValue({ data: payload('acct_guardian_profile'), error: null });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockOpen).not.toHaveBeenCalled();
  expect(h.result.current.statusReady).toBe(false);
 });
 it('does not accept an unlinked handshake for an unbound target', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 400, json: async () => ({ code: 'connect_not_linked' }) } } });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(h.result.current.statusReady).toBe(false);
 });
 it('does not replay creation after an older Edge status refusal', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 400, json: async () => ({ error: 'No Stripe Express account is linked to this athlete yet.' }) } } });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockFetch).not.toHaveBeenCalled();
 });
 it('permits test creation after a compatible target-bound unlinked status', async () => {
  mockInvoke.mockImplementation(async (_name, { body }) => body.mode === 'status'
    ? { data: null, error: { context: { status: 400, json: async () => ({ code: 'connect_not_linked', playerId: PLAYER_A }) } } }
    : { data: { ...payload('acct_child', false), playerId: PLAYER_A }, error: null });
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  expect(mockInvoke.mock.calls[1][1].body).toEqual(expect.objectContaining({ mode: 'onboarding', playerId: PLAYER_A }));
  expect(mockOpen).toHaveBeenCalledTimes(1);
 });
 it('cannot create while the first status handshake is pending', async () => {
  const status = deferred<{ data: ReturnType<typeof payload> & { playerId: string }; error: null }>();
  mockInvoke.mockReturnValue(status.promise);
  const h = await renderHook(() => useStripeConnect({ playerId: PLAYER_A })); await start(h.result);
  try { expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockOpen).not.toHaveBeenCalled(); }
  finally { await act(async () => status.resolve({ data: { ...payload('acct_child'), playerId: PLAYER_A }, error: null })); }
 });
});
