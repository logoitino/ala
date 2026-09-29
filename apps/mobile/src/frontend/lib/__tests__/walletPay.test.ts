import { walletPayOptions } from '@/lib/walletPay';

describe('walletPayOptions', () => {
  it('keeps Google Pay in its test environment for a test key', () => {
    expect(walletPayOptions('pk_test_123').googlePay).toEqual({ merchantCountryCode: 'US', testEnv: true });
  });

  it('switches Google Pay to production only for a live key', () => {
    expect(walletPayOptions('pk_live_123').googlePay.testEnv).toBe(false);
  });

  it('treats a missing key as test, never live', () => {
    expect(walletPayOptions('').googlePay.testEnv).toBe(true);
    expect(walletPayOptions(undefined).applePay).toEqual({ merchantCountryCode: 'US' });
  });
});
