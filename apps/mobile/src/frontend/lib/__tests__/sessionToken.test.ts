/**
 * Soft-Wall resume closures may capture a null React auth id; the live session must win.
 */
import { resolveSessionUserId, requireAccessToken } from '@/lib/sessionToken';

const mockGetSession = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

beforeEach(() => {
  mockGetSession.mockReset();
});

describe('resolveSessionUserId', () => {
  it('prefers the live session user over a null Soft-Wall fallback', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'live-fan' } } }, error: null });
    await expect(resolveSessionUserId(null)).resolves.toBe('live-fan');
  });

  it('falls back when getSession has no user yet', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(resolveSessionUserId('closed-over')).resolves.toBe('closed-over');
  });
});

describe('requireAccessToken', () => {
  it('returns the access token when a session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: ' jwt ', user: { id: 'u1' } } },
      error: null,
    });
    await expect(requireAccessToken('Sign in')).resolves.toBe('jwt');
  });

  it('throws the sign-in message when there is no token', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(requireAccessToken('Sign in to continue')).rejects.toThrow('Sign in to continue');
  });
});
