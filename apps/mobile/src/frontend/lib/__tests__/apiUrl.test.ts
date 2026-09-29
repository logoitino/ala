import { apiUrl } from '@/lib/apiUrl';

describe('apiUrl', () => {
  it('prefixes the hosted origin and ignores a trailing slash', () => {
    expect(apiUrl('/api/create-payment-intent', 'https://ala-sports.expo.app/', true)).toBe(
      'https://ala-sports.expo.app/api/create-payment-intent',
    );
  });

  it('keeps the relative path in development so Metro answers it', () => {
    expect(apiUrl('/api/create-payout', undefined, false)).toBe('/api/create-payout');
    expect(apiUrl('/api/create-payout', '   ', false)).toBe('/api/create-payout');
  });

  it('fails with a readable message in a release build with no origin', () => {
    expect(() => apiUrl('/api/create-payment-intent', undefined, true)).toThrow(/EXPO_PUBLIC_API_ORIGIN/);
  });
});
