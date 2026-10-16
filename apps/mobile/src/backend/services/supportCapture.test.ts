/** Verified auth failure capture: safe fixed codes, bounded server delivery and auth outcome isolation. */
import { classifyVerifiedAuthFailure, captureVerifiedAuthFailure } from './supportCapture';

const mockAbortSignal = jest.fn();
const mockRpc = jest.fn((_name: string, _args: Record<string, string>) => ({ abortSignal: mockAbortSignal }));
const mockCreateClient = jest.fn((_url: string, _key: string, _options: unknown) => ({ rpc: mockRpc }));
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: Parameters<typeof mockCreateClient>) => mockCreateClient(...args) }));

describe('verified auth failure capture', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', SUPPORT_ENVIRONMENT: 'test', SUPPORT_RELEASE_ID: 'test-release' };
    jest.clearAllMocks();
    mockAbortSignal.mockResolvedValue({ error: null });
  });
  afterEach(() => { process.env = originalEnv; });

  test('missing/unknown errors and expected absent auth do not become attacks', () => {
    for (const error of [null, undefined, 'secret raw error', {}, { status: 401 }, { code: 'unknown' }]) expect(classifyVerifiedAuthFailure(error)).toBeNull();
  });
  test('provider expiry and missing session are expected expiry', () => {
    for (const error of [{ code: 'jwt_expired' }, { code: 'session_not_found' }, { code: 'bad_jwt', message: 'Token is expired' }]) expect(classifyVerifiedAuthFailure(error)).toBe('auth_expired');
  });
  test('explicit provider invalid token is a warning code, never a confirmed attack', () => {
    expect(classifyVerifiedAuthFailure({ code: 'bad_jwt', message: 'private request details' })).toBe('auth_invalid');
    expect(classifyVerifiedAuthFailure({ code: 'invalid_jwt' })).toBe('auth_invalid');
  });
  test('provider or network unavailability is operational', () => {
    expect(classifyVerifiedAuthFailure({ status: 503 })).toBe('auth_unavailable');
    expect(classifyVerifiedAuthFailure({ name: 'AuthRetryableFetchError' })).toBe('auth_unavailable');
  });
  test('capture emits no raw message, JWT, IP, actor or request payload', async () => {
    await captureVerifiedAuthFailure({ code: 'bad_jwt', message: 'private token body 127.0.0.1' }, 'https://db.example.test');
    expect(mockRpc.mock.calls[0]).toEqual(['record_trusted_support_signal', { p_feature: 'auth', p_code: 'auth_invalid', p_environment: 'test', p_release: 'test-release', p_source: 'server' }]);
    expect(mockCreateClient.mock.calls[0][1]).toBe('server-test-key');
    expect(mockAbortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });
  test('no server credentials causes no delivery', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await captureVerifiedAuthFailure({ code: 'bad_jwt' }, 'https://db.example.test');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
  test('unknown failure causes no delivery', async () => {
    await captureVerifiedAuthFailure({ code: 'custom-secret' }, 'https://db.example.test');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
  test('delivery rejection cannot escape into auth outcome', async () => {
    mockAbortSignal.mockRejectedValue(new Error('private server error'));
    await expect(captureVerifiedAuthFailure({ code: 'bad_jwt' }, 'https://db.example.test')).resolves.toBeUndefined();
  });
  test('unsafe release and environment config use fixed fallbacks', async () => {
    process.env.SUPPORT_ENVIRONMENT = 'private-IP'; process.env.SUPPORT_RELEASE_ID = '../private-token';
    await captureVerifiedAuthFailure({ code: 'bad_jwt' }, 'https://db.example.test');
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_environment: 'test', p_release: 'unversioned' });
  });
});
