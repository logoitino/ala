/**
 * Account transitions must never show another account's profile or accept an older refresh.
 * Deferred Auth/database/team/storage boundaries exercise the real provider's publication order.
 */
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '@/types/database';
import { AuthProvider, useAuth } from '../AuthContext';
import { offlineQueue } from '@/services/OfflineQueue';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null })),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function sessionFor(id: string): Session {
  return {
    access_token: `token-${id}`, refresh_token: `refresh-${id}`, expires_in: 3600,
    token_type: 'bearer',
    user: { id, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2020-01-01' },
  };
}
function mockProfileFor(id: string, name = id): Profile {
  return {
    id: `profile-${id}`, user_id: id, role: 'fan', full_name: name,
    is_verified: false, age_confirmed_13_plus: true, school_id: null,
  };
}

let mockAuthListener: (_event: string, session: Session | null) => void;
let mockDeepLink: (url: string) => void;
const mockGetSession = jest.fn();
const mockEnsureFanProfile = jest.fn();
const mockReadOnboarding = jest.fn();
const mockFetchTeam = jest.fn();
const mockPasswordSignIn = jest.fn();
const mockCompleteRedirect = jest.fn();
const mockProfileReads = new Map<string, Array<Promise<{ data: Profile | null }>>>();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: typeof mockAuthListener) => {
        mockAuthListener = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
    from: () => ({
      select: () => ({ eq: (_column: string, id: string) => ({
        maybeSingle: () => mockProfileReads.get(id)?.shift() ?? Promise.resolve({ data: mockProfileFor(id) }),
      }) }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));
jest.mock('@/lib/auth', () => ({
  ensureGuestId: () => Promise.resolve('guest'),
  ensureFanProfile: (user: Session['user']) => mockEnsureFanProfile(user),
  subscribeAuthDeepLinks: (callback: typeof mockDeepLink) => { mockDeepLink = callback; return jest.fn(); },
  completeAuthRedirect: () => mockCompleteRedirect(),
  isNewAuthUser: () => false,
  signInWithEmailPassword: (...args: unknown[]) => mockPasswordSignIn(...args),
  signOutRemote: () => Promise.resolve(),
}));
jest.mock('@/lib/teams', () => ({
  readAthleteOnboarding: () => mockReadOnboarding(),
  fetchSchoolTeam: (id: string) => mockFetchTeam(id),
}));
jest.mock('@/lib/minors', () => ({ recordMyBirthMonth: jest.fn() }));
jest.mock('@/lib/aura', () => ({ subscribeProfileAura: () => jest.fn() }));

let api: ReturnType<typeof useAuth>;
const snapshots: Array<{ user: string | null; profile: string | null }> = [];
function Probe() {
  api = useAuth();
  snapshots.push({ user: api.user?.id ?? null, profile: api.profile?.user_id ?? null });
  return <Text>{`${api.user?.id ?? 'guest'}:${api.profile?.full_name ?? 'none'}`}</Text>;
}
async function flush() { await act(async () => {}); }
async function changeUser(id: string | null) {
  await act(async () => { mockAuthListener('SIGNED_IN', id ? sessionFor(id) : null); });
}
function queueRead(id: string, promise: Promise<{ data: Profile | null }>) {
  const reads = mockProfileReads.get(id) ?? [];
  reads.push(promise); mockProfileReads.set(id, reads);
}
async function start(id = 'A') {
  mockGetSession.mockResolvedValue({ data: { session: sessionFor(id) } });
  const view = await render(<AuthProvider><Probe /></AuthProvider>);
  await flush();
  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  snapshots.length = 0;
  mockProfileReads.clear();
  mockEnsureFanProfile.mockResolvedValue(undefined);
  mockReadOnboarding.mockResolvedValue(null);
  mockFetchTeam.mockResolvedValue(null);
});

it('binds replay ownership before a pending profile load and invalidates it at provider cleanup', async () => {
  const view = await start();
  const actor = offlineQueue.captureActor('A')!;
  expect(actor.isCurrent()).toBe(true);
  const pending = deferred<{ data: Profile | null }>();
  queueRead('B', pending.promise);
  await changeUser('B');
  expect(actor.isCurrent()).toBe(false);
  const incoming = offlineQueue.captureActor('B')!;
  expect(incoming.isCurrent()).toBe(true);
  await view.unmount();
  expect(incoming.isCurrent()).toBe(false);
  await act(async () => pending.resolve({ data: mockProfileFor('B') }));
});

it('clears the outgoing profile before rendering an incoming account whose profile is pending', async () => {
  await start();
  const incoming = deferred<{ data: Profile | null }>();
  queueRead('B', incoming.promise);
  await changeUser('B');
  expect(api.user?.id).toBe('B');
  expect(api.profile).toBeNull();
  expect(snapshots).not.toContainEqual({ user: 'B', profile: 'A' });
  await act(async () => incoming.resolve({ data: mockProfileFor('B') }));
  expect(api.profile?.user_id).toBe('B');
});

it('returns null from a pending old-owner refresh after the incoming profile loads', async () => {
  await start();
  const outgoing = deferred<{ data: Profile | null }>();
  queueRead('A', outgoing.promise);
  let result!: Promise<Profile | null>;
  await act(async () => { result = api.refreshProfile(); });
  await changeUser('B');
  await act(async () => outgoing.resolve({ data: mockProfileFor('A', 'old') }));
  expect(await result).toBeNull();
  expect(api.profile?.user_id).toBe('B');
});

it('only publishes the newest refresh when two reads finish in reverse order', async () => {
  await start();
  const older = deferred<{ data: Profile | null }>();
  const newer = deferred<{ data: Profile | null }>();
  queueRead('A', older.promise); queueRead('A', newer.promise);
  let first!: Promise<Profile | null>; let second!: Promise<Profile | null>;
  await act(async () => { first = api.refreshProfile(); second = api.refreshProfile(); });
  await act(async () => newer.resolve({ data: mockProfileFor('A', 'latest') }));
  expect((await second)?.full_name).toBe('latest');
  await act(async () => older.resolve({ data: mockProfileFor('A', 'outdated') }));
  expect(await first).toBeNull();
  expect(api.profile?.full_name).toBe('latest');
});

it('rejects a retained refresh callback across A to B to A', async () => {
  await start();
  const oldRefresh = api.refreshProfile;
  await changeUser('B'); await changeUser('A');
  queueRead('A', Promise.resolve({ data: mockProfileFor('A', 'obsolete callback') }));
  let value: Profile | null = null;
  await act(async () => { value = await oldRefresh(); });
  expect(value).toBeNull();
  expect(api.profile?.full_name).toBe('A');
});

it('discards a refresh that was still hydrating its school when the account changed', async () => {
  await start();
  const school = deferred<null>();
  mockFetchTeam.mockReturnValueOnce(school.promise);
  queueRead('A', Promise.resolve({ data: { ...mockProfileFor('A'), school_id: 'school-A' } }));
  let result!: Promise<Profile | null>;
  await act(async () => { result = api.refreshProfile(); });
  await changeUser('B');
  await act(async () => school.resolve(null));
  expect(await result).toBeNull();
  expect(api.profile?.user_id).toBe('B');
});

it('discards a refresh that was hydrating local onboarding when signed out', async () => {
  await start();
  const local = deferred<null>();
  mockReadOnboarding.mockReturnValueOnce(local.promise);
  let result!: Promise<Profile | null>;
  await act(async () => { result = api.refreshProfile(); });
  await changeUser(null);
  await act(async () => local.resolve(null));
  expect(await result).toBeNull();
  expect(api.profile).toBeNull();
});

it('does not let a late bootstrap session replace a newer auth event', async () => {
  const bootstrap = deferred<{ data: { session: Session | null } }>();
  mockGetSession.mockReturnValue(bootstrap.promise);
  await render(<AuthProvider><Probe /></AuthProvider>); await flush();
  await changeUser('B');
  await act(async () => bootstrap.resolve({ data: { session: sessionFor('A') } }));
  expect(api.user?.id).toBe('B');
  expect(api.profile?.user_id).toBe('B');
  expect(api.loading).toBe(false);
});

it('ignores a delayed profile ensure after a newer account has hydrated', async () => {
  await start();
  const ensure = deferred<void>();
  mockEnsureFanProfile.mockReturnValueOnce(ensure.promise);
  await changeUser('C'); await changeUser('B');
  await act(async () => ensure.resolve(undefined));
  expect(api.user?.id).toBe('B');
  expect(api.profile?.user_id).toBe('B');
});

it('does not reinstall an old completed sign-in after another account arrives', async () => {
  await start();
  const signIn = deferred<Session>();
  mockPasswordSignIn.mockReturnValueOnce(signIn.promise);
  let result!: Promise<void>;
  await act(async () => { result = api.signInWithEmailPassword('a@example.test', 'unused'); });
  await changeUser('B');
  await act(async () => signIn.resolve(sessionFor('A')));
  await result;
  expect(api.user?.id).toBe('B');
  expect(api.profile?.user_id).toBe('B');
});

it('returns null when an outstanding refresh completes after its provider unmounts', async () => {
  const view = await start();
  const outgoing = deferred<{ data: Profile | null }>();
  queueRead('A', outgoing.promise);
  let result!: Promise<Profile | null>;
  await act(async () => { result = api.refreshProfile(); });
  await view.unmount();
  await act(async () => outgoing.resolve({ data: mockProfileFor('A') }));
  expect(await result).toBeNull();
});

it('keeps the current profile visible during a same-owner session refresh', async () => {
  await start();
  const updated = deferred<{ data: Profile | null }>();
  queueRead('A', updated.promise);
  await changeUser('A');
  expect(api.profile?.full_name).toBe('A');
  await act(async () => updated.resolve({ data: mockProfileFor('A', 'updated') }));
  expect(api.profile?.full_name).toBe('updated');
});

it('clears account role overrides while keeping the explicit Studio preview', async () => {
  await start();
  await act(async () => { await api.previewAsRole('operator'); await api.addUserRole('athlete'); });
  expect(api.isAthlete).toBe(true);
  await changeUser('B');
  expect(api.roles).toEqual(['fan', 'operator']);
  expect(api.activeRole).toBe('fan');
  expect(api.studioUnlocked).toBe(true);
  expect(api.role).toBe('operator');
});

it('rejects a profile response whose owner does not match the active account', async () => {
  await start();
  queueRead('A', Promise.resolve({ data: mockProfileFor('B') }));
  let result: Profile | null = null;
  await act(async () => { result = await api.refreshProfile(); });
  expect(result).toBeNull();
  expect(api.profile).toBeNull();
});

it('does not transfer the birth-prompt dismissal to an incoming account', async () => {
  await start();
  queueRead('A', Promise.resolve({ data: { ...mockProfileFor('A'), birth_year: null, age_check_required: false } }));
  await act(async () => { await api.refreshProfile(); api.dismissBirthPrompt(); });
  expect(api.birthPrompt).toBeNull();
  queueRead('B', Promise.resolve({ data: { ...mockProfileFor('B'), birth_year: null, age_check_required: false } }));
  await changeUser('B');
  expect(api.birthPrompt).toBe('optional');
});

it('invalidates a retained account guard across auth turnover batched into one render', async () => {
  await start();
  const oldGuard = api.isSessionCurrent;
  expect(oldGuard?.()).toBe(true);
  await act(async () => {
    mockAuthListener('SIGNED_IN', sessionFor('B'));
    mockAuthListener('SIGNED_IN', sessionFor('A'));
    expect(oldGuard?.()).toBe(false);
  });
  expect(api.user?.id).toBe('A');
  expect(api.isSessionCurrent?.()).toBe(true);
  expect(api.isSessionCurrent).not.toBe(oldGuard);
});

it('preserves the account guard through a same-owner token refresh', async () => {
  await start();
  const guard = api.isSessionCurrent;
  expect(guard?.()).toBe(true);
  await act(async () => mockAuthListener('TOKEN_REFRESHED', {
    ...sessionFor('A'), access_token: 'refreshed-A',
  }));
  expect(guard?.()).toBe(true);
  expect(api.isSessionCurrent).toBe(guard);
  expect(api.session?.access_token).toBe('refreshed-A');
});
