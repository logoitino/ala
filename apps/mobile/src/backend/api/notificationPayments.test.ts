/** NOTIFY-01: real shared checkout logic must never confuse a client declaration with committed money authority. */
import { runCreatePaymentIntent, type PaymentIntentParams } from '../../../../../supabase/functions/_shared/money/paymentIntent.ts';

const donorId = '00000000-0000-0000-0000-000000000001';
const athleteId = '00000000-0000-0000-0000-000000000002';
const context = { id: '00000000-0000-0000-0000-000000000003', donorId, athleteId,
  purpose: 'donation', giftCents: 500, coverFeeCents: 100, platformTipCents: 50, totalCents: 650,
  currency: 'usd', livemode: false, notificationAuthority: false } as const;
const body = { amount: 650, playerId: athleteId, platformTipCents: 50,
  donation: { giftCents: 500, coverFees: true, platformTipPercent: 10 } };

function setup(overrides: Record<string, unknown> = {}) {
  const create = jest.fn(async (_params: PaymentIntentParams) => ({ id: 'pi_local', client_secret: 'pi_secret', livemode: false }));
  const persist = jest.fn(async () => ({ data: true, error: null }));
  const input = { userId: donorId, body, isTargetFrozen: async () => ({ data: false, error: null }),
    getStripe: () => ({ paymentIntents: { create } }),
    donationContext: { quote: async () => context, persist }, ...overrides } as Parameters<typeof runCreatePaymentIntent>[0];
  return { create, persist, input };
}

describe('bounded server donation context', () => {
  it('binds server purpose and gift separately from fee coverage and platform tip', async () => {
    const { input, create, persist } = setup();
    expect(await runCreatePaymentIntent(input)).toEqual({ status: 200, body: { clientSecret: 'pi_secret' } });
    expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ amount: 650, metadata: expect.objectContaining({
      tapuai_context_id: context.id, tapuai_purpose: 'donation', tapuai_gift_cents: '500',
      tapuai_cover_fee_cents: '100', tapuai_platform_tip_cents: '50', tapuai_notification_authority: 'false',
    }) }));
    expect(persist).toHaveBeenCalledWith(context, 'pi_local');
  });
  it.each([
    ['donor', { donorId: athleteId }], ['athlete', { athleteId: donorId }], ['purpose', { purpose: 'exclusive' }],
    ['currency', { currency: 'eur' }], ['gift', { giftCents: 501 }], ['fee', { coverFeeCents: 1.5 }],
    ['add-on', { platformTipCents: 49 }], ['total', { totalCents: 700 }], ['mode', { livemode: true }],
    ['authority', { notificationAuthority: true }],
  ])('rejects an inconsistent server %s context before creating a charge', async (_field, patch) => {
    const { input, create } = setup({ donationContext: { quote: async () => ({ ...context, ...patch }), persist: jest.fn() } });
    expect((await runCreatePaymentIntent(input)).status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
  it('does not release a payable secret when context persistence fails', async () => {
    const { input } = setup({ donationContext: { quote: async () => context,
      persist: async () => ({ data: null, error: { code: '40001' } }) } });
    expect(await runCreatePaymentIntent(input)).toEqual({ status: 503, body: { error: 'Payment context unavailable.' } });
  });
  it('preserves checkout when notification context is not configured and labels it unavailable', async () => {
    const { input, create, persist } = setup({ donationContext: undefined });
    expect((await runCreatePaymentIntent(input)).status).toBe(200);
    expect(persist).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ metadata: expect.objectContaining({
      tapuai_purpose: 'donation', tapuai_notification_authority: 'false',
    }) }));
    expect(create.mock.calls[0][0].metadata).not.toHaveProperty('tapuai_context_id');
  });
  it('does not use a donation adapter for a shared non-donation purchase', async () => {
    const { input, persist } = setup({ body: { amount: 500, playerId: athleteId } });
    expect((await runCreatePaymentIntent(input)).status).toBe(200);
    expect(persist).not.toHaveBeenCalled();
  });
  it('does not request a donation quote before a confirmed target freeze is checked', async () => {
    const quote = jest.fn(async () => context);
    const { input, create } = setup({ isTargetFrozen: async () => ({ data: true, error: null }), donationContext: { quote, persist: jest.fn() } });
    expect((await runCreatePaymentIntent(input)).status).toBe(403);
    expect(quote).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
