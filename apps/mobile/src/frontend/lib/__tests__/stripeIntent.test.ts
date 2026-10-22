/** Gift declarations survive the shared Edge/Metro boundary; they do not confer server receipt authority. */
import { createPaymentIntent } from '@/lib/stripeIntent';

const mockInvoke = jest.fn();

jest.mock('@/lib/sessionToken', () => ({ requireAccessToken: async () => 'jwt-1' }));
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const fetchMock = jest.fn();
beforeEach(() => {
  mockInvoke.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('createPaymentIntent', () => {
  it('uses the Edge Function so an installed build needs no hosted Expo server', async () => {
    mockInvoke.mockResolvedValue({ data: { clientSecret: 'pi_secret' }, error: null });
    await expect(createPaymentIntent(500, 'player-1')).resolves.toBe('pi_secret');
    expect(mockInvoke).toHaveBeenCalledWith('create-payment-intent', {
      body: { amount: 500, playerId: 'player-1' },
      headers: { Authorization: 'Bearer jwt-1' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the optional tip to Tapua\'i only when the gift sender picked one', async () => {
    mockInvoke.mockResolvedValue({ data: { clientSecret: 'pi_secret' }, error: null });
    await createPaymentIntent(1100, 'player-1', 100);
    expect(mockInvoke).toHaveBeenCalledWith('create-payment-intent', expect.objectContaining({
      body: { amount: 1100, playerId: 'player-1', platformTipCents: 100 },
    }));
    mockInvoke.mockClear();
    await createPaymentIntent(1000, 'player-1', 0);
    expect(mockInvoke.mock.calls[0][1].body).toEqual({ amount: 1000, playerId: 'player-1' });
  });

  it('surfaces the server reason for a rejected charge instead of falling back', async () => {
    const context = new Response(JSON.stringify({ error: 'This athlete cannot currently receive Mālo.' }), {
      status: 403,
    });
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context } });
    await expect(createPaymentIntent(500, 'player-1')).rejects.toThrow('cannot currently receive Mālo');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the Metro route only when the function is not deployed', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Not Found', context: { status: 404 } } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ clientSecret: 'pi_metro' }) });
    await expect(createPaymentIntent(700)).resolves.toBe('pi_metro');
    expect(fetchMock).toHaveBeenCalledWith('/api/create-payment-intent', expect.objectContaining({ method: 'POST' }));
  });
  it('preserves gift gift and fee choice across the Metro fallback', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Not Found', context: { status: 404 } } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ clientSecret: 'pi_metro' }) });
    const donation = { giftCents: 500, coverFees: true, platformTipPercent: 10 };
    await expect(createPaymentIntent(650, 'player-1', 50, donation)).resolves.toBe('pi_metro');
    expect(mockInvoke.mock.calls[0][1].body.donation).toEqual(donation);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).donation).toEqual(donation);
  });
});
