/** SCALE-01: Expo admin desks stay closed until the session is aal2 when the switch is on, and are untouched when off. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdminShell } from '@/components/Admin/AdminShell';

let mockAuth: Record<string, unknown> = {};
const mockRead = jest.fn();
const mockStart = jest.fn();
const mockVerify = jest.fn();
let mockRequired = false;

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({
  AdminLensProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));
jest.mock('@/lib/adminMfa', () => {
  const shared = jest.requireActual('@tapuai/shared-types/admin/adminMfa');
  return {
    isAdminMfaRequiredOnApp: () => mockRequired,
    readAdminMfaState: (...args: unknown[]) => mockRead(...args),
    startAdminTotpSetup: (...args: unknown[]) => mockStart(...args),
    verifyAdminTotpCode: (...args: unknown[]) => mockVerify(...args),
    mfaErrorText: shared.mfaErrorText,
    normalizeTotpCode: shared.normalizeTotpCode,
  };
});

const desk = <AdminShell><Text>Private desk controls</Text></AdminShell>;

beforeEach(() => {
  mockRequired = false;
  mockAuth = { isAdmin: true, loading: false, session: { access_token: 'aal1-token' }, signOut: jest.fn() };
  mockRead.mockReset();
  mockStart.mockReset();
  mockVerify.mockReset();
});

it('switch off: desks mount and no MFA read happens', async () => {
  await render(desk);
  expect(screen.getByText('Private desk controls')).toBeTruthy();
  expect(mockRead).not.toHaveBeenCalled();
});

it('switch on: an aal2 session opens the desks', async () => {
  mockRequired = true;
  mockRead.mockResolvedValue({ step: 'pass', factorId: 'f-1' });
  await render(desk);
  expect(await screen.findByText('Private desk controls')).toBeTruthy();
  expect(mockRead).toHaveBeenCalledWith('aal1-token');
});

it('switch on: a non-admin still sees Access Restricted, not the MFA step', async () => {
  mockRequired = true;
  mockAuth = { ...mockAuth, isAdmin: false, user: { id: 'u' }, unlockStudio: jest.fn() };
  await render(desk);
  expect(screen.getByText('Access Restricted')).toBeTruthy();
  expect(mockRead).not.toHaveBeenCalled();
});

it('switch on: aal1 with a factor asks for the code and verifies it', async () => {
  mockRequired = true;
  mockRead.mockResolvedValue({ step: 'verify', factorId: 'f-1' });
  mockVerify.mockResolvedValue(undefined);
  await render(desk);
  expect(await screen.findByText('Enter the 6-digit code from your authenticator app.')).toBeTruthy();
  expect(screen.queryByText('Private desk controls')).toBeNull();

  await fireEvent.changeText(screen.getByLabelText('6-digit code'), '12345');
  await fireEvent.press(screen.getByLabelText('Verify'));
  expect(await screen.findByText('Enter the 6 digits from your authenticator app.')).toBeTruthy();
  expect(mockVerify).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123 456');
  await fireEvent.press(screen.getByLabelText('Verify'));
  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('f-1', '123456'));
  expect(screen.queryByText('Private desk controls')).toBeNull();
});

it('switch on: a wrong code shows plain words and keeps the desks closed', async () => {
  mockRequired = true;
  mockRead.mockResolvedValue({ step: 'verify', factorId: 'f-1' });
  mockVerify.mockRejectedValue({ code: 'mfa_verification_failed' });
  await render(desk);
  await fireEvent.changeText(await screen.findByLabelText('6-digit code'), '000000');
  await fireEvent.press(screen.getByLabelText('Verify'));
  expect(await screen.findByText(/did not match/)).toBeTruthy();
  expect(screen.queryByText('Private desk controls')).toBeNull();
});

it('switch on: no factor offers setup with a QR and a setup key', async () => {
  mockRequired = true;
  mockRead.mockResolvedValue({ step: 'enroll', factorId: null });
  mockStart.mockResolvedValue({ factorId: 'f-new', qrSvg: '<svg/>', secret: 'ABCDEF' });
  await render(desk);
  await fireEvent.press(await screen.findByLabelText('Set up an authenticator app'));
  expect(await screen.findByText('ABCDEF')).toBeTruthy();
  expect(screen.getByLabelText("QR code that adds Tapua'i Admin to your authenticator app")).toBeTruthy();
  expect(screen.getByLabelText('6-digit code')).toBeTruthy();
});

it('switch on: a failed MFA read refuses instead of opening', async () => {
  mockRequired = true;
  mockRead.mockRejectedValue({ code: 'mfa_totp_verify_not_enabled' });
  await render(desk);
  expect(await screen.findByText(/not turned on for this Supabase project/)).toBeTruthy();
  expect(screen.queryByText('Private desk controls')).toBeNull();
});

it('switch on: Studio unlock without an account is refused', async () => {
  mockRequired = true;
  mockAuth = { ...mockAuth, session: null };
  mockRead.mockResolvedValue({ step: 'enroll', factorId: null });
  await render(desk);
  expect(await screen.findByText(/Studio unlock does not open them/)).toBeTruthy();
  expect(screen.queryByLabelText('Set up an authenticator app')).toBeNull();
  expect(screen.queryByText('Private desk controls')).toBeNull();
});
