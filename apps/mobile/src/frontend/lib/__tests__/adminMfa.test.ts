/** SCALE-01: the Expo MFA wrapper makes no call while the switch is off, and fails closed on aal1 when it is on. Synthetic tokens. */
const mockMfa = {
  listFactors: jest.fn(),
  unenroll: jest.fn(),
  enroll: jest.fn(),
  challenge: jest.fn(),
  verify: jest.fn(),
};
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { get mfa() { return mockMfa; } } } }));

import { isAdminMfaRequiredOnApp, readAdminMfaState, startAdminTotpSetup, verifyAdminTotpCode } from '@/lib/adminMfa';

function token(aal: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'ES256' })}.${encode({ sub: 'u', aal })}.sig`;
}
const verified = { id: 'f-1', factor_type: 'totp', status: 'verified' };
const stale = { id: 'f-old', factor_type: 'totp', status: 'unverified' };

const before = process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA;
afterEach(() => {
  if (before === undefined) delete process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA;
  else process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA = before;
  Object.values(mockMfa).forEach((fn) => fn.mockReset());
});

it('switch off by default: step off with no Supabase call', async () => {
  delete process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA;
  expect(isAdminMfaRequiredOnApp()).toBe(false);
  await expect(readAdminMfaState(token('aal1'))).resolves.toEqual({ step: 'off', factorId: null });
  expect(mockMfa.listFactors).not.toHaveBeenCalled();
});

it('switch on: aal2 passes, aal1 must verify or enroll, no token is refused', async () => {
  process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA = 'true';
  mockMfa.listFactors.mockResolvedValue({ data: { all: [verified] }, error: null });
  await expect(readAdminMfaState(token('aal2'))).resolves.toEqual({ step: 'pass', factorId: 'f-1' });
  await expect(readAdminMfaState(token('aal1'))).resolves.toEqual({ step: 'verify', factorId: 'f-1' });
  mockMfa.listFactors.mockResolvedValue({ data: { all: [stale] }, error: null });
  await expect(readAdminMfaState(token('aal1'))).resolves.toEqual({ step: 'enroll', factorId: null });
  mockMfa.listFactors.mockClear();
  await expect(readAdminMfaState(null)).resolves.toEqual({ step: 'enroll', factorId: null });
  expect(mockMfa.listFactors).not.toHaveBeenCalled();
});

it('setup clears a half-finished factor, then enrolls TOTP', async () => {
  mockMfa.listFactors.mockResolvedValue({ data: { all: [verified, stale] }, error: null });
  mockMfa.unenroll.mockResolvedValue({ data: { id: 'f-old' }, error: null });
  mockMfa.enroll.mockResolvedValue({
    data: { id: 'f-new', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC', uri: 'otpauth://x' } },
    error: null,
  });
  await expect(startAdminTotpSetup()).resolves.toEqual({ factorId: 'f-new', qrSvg: '<svg/>', secret: 'ABC' });
  expect(mockMfa.unenroll).toHaveBeenCalledTimes(1);
  expect(mockMfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-old' });
  expect(mockMfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: "Tapua'i Admin", issuer: "Tapua'i Admin" });
});

it('verify challenges then verifies, and passes errors through', async () => {
  mockMfa.challenge.mockResolvedValue({ data: { id: 'c-1' }, error: null });
  mockMfa.verify.mockResolvedValue({ data: {}, error: null });
  await verifyAdminTotpCode('f-1', '123456');
  expect(mockMfa.verify).toHaveBeenCalledWith({ factorId: 'f-1', challengeId: 'c-1', code: '123456' });
  const failure = { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' };
  mockMfa.verify.mockResolvedValue({ data: null, error: failure });
  await expect(verifyAdminTotpCode('f-1', '000000')).rejects.toBe(failure);
});
