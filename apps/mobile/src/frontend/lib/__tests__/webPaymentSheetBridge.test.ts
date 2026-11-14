/** Web Payment Element bridge: stash / present / missing host. */
import {
  clearWebPaymentSheetIntent,
  presentStashedWebPaymentSheet,
  registerWebPaymentSheetHost,
  stashWebPaymentSheetIntent,
} from '@/lib/webPaymentSheetBridge';

afterEach(() => {
  registerWebPaymentSheetHost(null);
  clearWebPaymentSheetIntent();
});

describe('webPaymentSheetBridge', () => {
  it('fails present when init was never called', async () => {
    const result = await presentStashedWebPaymentSheet();
    expect(result.error?.code).toBe('Failed');
  });

  it('fails present when the React host is not mounted', async () => {
    stashWebPaymentSheetIntent({
      paymentIntentClientSecret: 'pi_test_secret',
      merchantDisplayName: "Tapua'i",
    });
    const result = await presentStashedWebPaymentSheet();
    expect(result.error?.message).toMatch(/not ready/i);
  });

  it('hands the stashed intent to the registered host', async () => {
    const present = jest.fn(async () => ({}));
    registerWebPaymentSheetHost(present);
    stashWebPaymentSheetIntent({
      paymentIntentClientSecret: 'pi_test_secret',
      merchantDisplayName: "Tapua'i Sports",
    });
    const result = await presentStashedWebPaymentSheet();
    expect(result).toEqual({});
    expect(present).toHaveBeenCalledWith({
      clientSecret: 'pi_test_secret',
      merchantDisplayName: "Tapua'i Sports",
    });
  });
});
