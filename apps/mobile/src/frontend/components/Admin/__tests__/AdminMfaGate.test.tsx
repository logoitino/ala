/** SCALE-01: Expo admin desks stay closed until the session is aal2 when the switch is on, and are untouched when off. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdminMfaGate } from '@/components/Admin/AdminMfaGate';
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
  mockAuth = { isAdmin: true, loading: false, user: { id: 'admin-A' }, session: { user: { id: 'admin-A' }, access_token: 'aal1-token' }, signOut: jest.fn() };
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
  expect(mockRead).toHaveBeenCalledWith('aal1-token', expect.objectContaining({ userId: 'admin-A' }));
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
  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('f-1', '123456', expect.objectContaining({ userId: 'admin-A' })));
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

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function switchToB() { mockAuth = { ...mockAuth, user: { id: 'admin-B' }, session: { user: { id: 'admin-B' }, access_token: 'B-token' } }; }
it('removes outgoing enrollment secret and factor immediately after account change', async () => {
  mockRequired = true; mockRead.mockResolvedValue({ step: 'enroll', factorId: null });
  mockStart.mockResolvedValue({ factorId: 'A-factor', qrSvg: '<svg/>', secret: 'A-PRIVATE-SETUP' });
  const view = await render(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>); await fireEvent.press(await screen.findByLabelText('Set up an authenticator app'));
  expect(screen.getByText('A-PRIVATE-SETUP')).toBeTruthy();
  switchToB(); await view.rerender(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>);
  expect(screen.queryByText('A-PRIVATE-SETUP')).toBeNull();
  expect(screen.queryByLabelText('6-digit code')).toBeNull();
});
it('does not publish an outgoing enrollment secret delivered after account change', async () => {
  mockRequired = true; mockRead.mockResolvedValue({ step: 'enroll', factorId: null });
  const pending = deferred<unknown>(); mockStart.mockReturnValueOnce(pending.promise);
  const view = await render(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>); await fireEvent.press(await screen.findByLabelText('Set up an authenticator app'));
  switchToB(); await view.rerender(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>);
  await act(async () => pending.resolve({ factorId: 'A-factor', qrSvg: '<svg/>', secret: 'A-PRIVATE-SETUP' }));
  expect(screen.queryByText('A-PRIVATE-SETUP')).toBeNull();
});
it('keeps keyboard verification single-flight before busy renders', async () => {
  mockRequired = true; mockRead.mockResolvedValue({ step: 'verify', factorId: 'A-factor' });
  const pending = deferred<void>(); mockVerify.mockReturnValueOnce(pending.promise);
  await render(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>); const input = await screen.findByLabelText('6-digit code');
  await fireEvent.changeText(input, '123456');
  await act(async () => { input.props.onSubmitEditing(); input.props.onSubmitEditing(); });
  expect(mockVerify).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(undefined));
});
it('does not reuse a completed aal2 gate after a different account renders', async () => {
  mockRequired = true; mockRead.mockResolvedValueOnce({ step: 'pass', factorId: 'A-factor' });
  const view = await render(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>); expect(await screen.findByText('Private desk controls')).toBeTruthy();
  const pending = deferred<unknown>(); mockRead.mockReturnValueOnce(pending.promise);
  switchToB(); await view.rerender(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>);
  expect(screen.queryByText('Private desk controls')).toBeNull();
  await act(async () => pending.resolve({ step: 'verify', factorId: 'B-factor' }));
});
it('clears setup on sign-out and shows a failed sign-out without trapping the gate', async () => {
  mockRequired = true; mockRead.mockResolvedValue({ step: 'enroll', factorId: null });
  mockStart.mockResolvedValue({ factorId: 'A-factor', qrSvg: '<svg/>', secret: 'A-PRIVATE-SETUP' });
  mockAuth = { ...mockAuth, signOut: jest.fn().mockRejectedValue(new Error('Synthetic sign-out failure')) };
  await render(<AdminMfaGate><Text>Private desk controls</Text></AdminMfaGate>);
  await fireEvent.press(await screen.findByLabelText('Set up an authenticator app'));
  await fireEvent.press(screen.getByLabelText('Sign out'));
  expect(screen.queryByText('A-PRIVATE-SETUP')).toBeNull();
  expect(await screen.findByText(/Synthetic sign-out failure|Sign-out did not finish/)).toBeTruthy();
});
