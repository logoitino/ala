/** Auth gate support instrumentation preserves successful, absent, expired and rejected session outcomes. */
import { requireAuthedUser } from './session';
const mockGetUser = jest.fn();
const mockCapture = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mockGetUser } }) }));
jest.mock('../services/supportCapture', () => ({ captureVerifiedAuthFailure: (...args: unknown[]) => mockCapture(...args) }));

describe('auth gate support evidence', () => {
  const env = process.env;
  const request = (jwt?: string) => ({ headers: new Headers(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }) as Request;
  beforeEach(() => {
    process.env = { ...env, EXPO_PUBLIC_SUPABASE_URL: 'https://db.example.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test' };
    jest.clearAllMocks(); mockCapture.mockResolvedValue(undefined);
  });
  afterEach(() => { process.env = env; });
  test('missing bearer is expected sign-in with no provider capture', async () => {
    expect(await requireAuthedUser(request(), 'Sign in.')).toEqual({ ok: false, status: 401, message: 'Sign in.' });
    expect(mockGetUser).not.toHaveBeenCalled(); expect(mockCapture).not.toHaveBeenCalled();
  });
  test('successful verified auth is unchanged and not captured', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    expect(await requireAuthedUser(request('private-jwt'), 'Sign in.')).toMatchObject({ ok: true, jwt: 'private-jwt', user: { id: 'verified-user' } });
    expect(mockCapture).not.toHaveBeenCalled();
  });
  test('anonymous-auth user is refused before any account action', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'anonymous-user', is_anonymous: true } }, error: null });
    expect(await requireAuthedUser(request('private-jwt'), 'Sign in.')).toMatchObject({ ok: false, status: 401 });
  });
  test('rejected provider auth emits safe server capture and remains 401', async () => {
    const error = { code: 'bad_jwt' };
    mockGetUser.mockResolvedValue({ data: { user: null }, error });
    expect(await requireAuthedUser(request('private-jwt'), 'Sign in.')).toEqual({ ok: false, status: 401, message: 'Invalid or expired session.' });
    // Expo inlines EXPO_PUBLIC variables using the test setup at transform time.
    expect(mockCapture).toHaveBeenCalledWith(error, process.env.EXPO_PUBLIC_SUPABASE_URL);
  });
  test('capture failure cannot change provider rejection', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    mockCapture.mockRejectedValue(new Error('capture unavailable'));
    expect(await requireAuthedUser(request('private-jwt'), 'Sign in.')).toEqual({ ok: false, status: 401, message: 'Invalid or expired session.' });
  });
  test('provider throw remains the original thrown object', async () => {
    const original = new Error('auth provider unavailable'); mockGetUser.mockRejectedValue(original);
    await expect(requireAuthedUser(request('private-jwt'), 'Sign in.')).rejects.toBe(original);
    expect(mockCapture).toHaveBeenCalledWith(original, process.env.EXPO_PUBLIC_SUPABASE_URL);
  });
});
