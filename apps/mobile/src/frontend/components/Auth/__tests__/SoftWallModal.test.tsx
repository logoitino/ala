/** Account creation keeps Google available without email fields or bank setup; age rules remain separate. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { SoftWallModal } from '@/components/Auth/SoftWallModal';

// `mock`-prefixed so Jest's hoisted mock factories below may close over them.
const mockSignInWithEmailPassword = jest.fn(async () => undefined);
const mockSignUpWithEmailPassword = jest.fn(async () => undefined);
const mockSignInWithMagicLink = jest.fn(async () => undefined);
const mockSignInWithGoogle = jest.fn(async () => undefined);

// The sheet only needs to be open and to hand back the auth calls it fires. Everything
// else stubbed here is a native module or a layout hook with no Node implementation.
jest.mock('@/context/SoftWallContext', () => ({
  useSoftWall: () => ({
    visible: true,
    intent: { kind: 'signin' as const },
    presentId: 1,
    close: jest.fn(),
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signInWithApple: jest.fn(),
    signInWithGoogle: mockSignInWithGoogle,
    signInWithMagicLink: mockSignInWithMagicLink,
    signInWithEmailPassword: mockSignInWithEmailPassword,
    signUpWithEmailPassword: mockSignUpWithEmailPassword,
    signInWithDemoAccount: jest.fn(),
  }),
}));

jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
// MINOR-01: the under-13 device pause lives in AsyncStorage; keep it in memory per test (`?.`: the Supabase client
// reads storage while modules load, before this map exists).
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore?.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore?.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStore?.delete(key); }),
}));

const EMAIL = 'returning@family.com';
const PASSWORD = 'hunter2password';

// RNTL 14 is async: both `render` and `fireEvent` return promises.
async function openSheet() {
  await render(<SoftWallModal />);
}

async function typeEmail(email = EMAIL) {
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), email);
}

async function openCreate() {
  await fireEvent.press(screen.getByLabelText('Create an account'));
}

async function typePassword(password = PASSWORD) {
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), password);
}

const signInButton = () => screen.getByLabelText('Sign in with email and password');
const createButton = () => screen.getByLabelText('Create an account with email and password');
const magicButton = () => screen.getByLabelText('Send magic link email');
// MINOR-01: birth month and year replace the 13+ checkbox.
async function enterBirth(year: number | string = 1990, month = 'Apr') {
  await fireEvent.press(screen.getByLabelText(`Birth month: ${month}`));
  await fireEvent.changeText(screen.getByLabelText('Birth year'), String(year));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
});

describe('SoftWallModal email form', () => {
  it('lets a new user choose Google from Create an account without filling the email form', async () => {
    await openSheet();
    await openCreate();
    expect(createButton()).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Continue with Google'));
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockSignUpWithEmailPassword).not.toHaveBeenCalled();
  });

  it('offers Google on web without an unsupported Apple button or requiring email fields', async () => {
    const originalOS = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      await openSheet();
      expect(screen.queryByLabelText('Continue with Apple')).toBeNull();
      expect(screen.getByText('Google works for new and existing accounts.')).toBeTruthy();
      expect(screen.getByText('No bank details are needed to create your profile.')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Continue with Google'));
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockSignUpWithEmailPassword).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });

  it('enables Sign in without an age checkbox, and actually signs in', async () => {
    await openSheet();
    await typeEmail();
    await typePassword();

    expect(screen.queryByLabelText('Birth year')).toBeNull();
    expect(signInButton()).toBeEnabled();

    await fireEvent.press(signInButton());
    expect(mockSignInWithEmailPassword).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it('keeps Create account disabled until a birth month and year are given', async () => {
    await openSheet();
    await typeEmail();
    await typePassword();
    await openCreate();

    expect(createButton()).toBeDisabled();

    await enterBirth();
    expect(createButton()).toBeEnabled();

    await fireEvent.press(createButton());
    expect(mockSignUpWithEmailPassword).toHaveBeenCalledWith(EMAIL, PASSWORD, { year: 1990, month: 4 });
  });

  it('refuses an under-13 date neutrally, creates nothing, and pauses this device', async () => {
    await openSheet();
    await typeEmail();
    await typePassword();
    await openCreate();
    await enterBirth(new Date().getFullYear() - 9, 'Jan');

    await fireEvent.press(createButton());
    expect(await screen.findByText("We can't create your account right now.")).toBeTruthy();
    expect(mockSignUpWithEmailPassword).not.toHaveBeenCalled();
    expect(createButton()).toBeDisabled();
    expect(mockStore.size).toBe(1);
  });

  it('keeps the magic link gated too, since signInWithOtp can create the account', async () => {
    await openSheet();
    await typeEmail();
    expect(screen.queryByLabelText('Send magic link email')).toBeNull();
    await openCreate();

    expect(magicButton()).toBeDisabled();

    await enterBirth();
    expect(magicButton()).toBeEnabled();
  });

  it('still requires a password for Sign in', async () => {
    await openSheet();
    await typeEmail();

    expect(signInButton()).toBeDisabled();
    await fireEvent.press(signInButton());
    expect(mockSignInWithEmailPassword).not.toHaveBeenCalled();
  });

  it('holds Create account to the 8-character policy while Sign in stays open', async () => {
    await openSheet();
    await typeEmail();
    await typePassword('short');

    expect(signInButton()).toBeEnabled();
    await openCreate();
    await enterBirth();

    expect(createButton()).toBeDisabled();
  });

  it('ignores a second tap that lands before the button re-renders as busy', async () => {
    let finish: () => void = () => undefined;
    mockSignInWithEmailPassword.mockImplementationOnce(() => new Promise<undefined>((resolve) => { finish = () => resolve(undefined); }));
    await openSheet();
    await typeEmail();
    await typePassword();

    // Two presses in the same frame: neither waits for React to re-render the button as disabled.
    const button = signInButton();
    await Promise.all([fireEvent.press(button), fireEvent.press(button)]);
    expect(mockSignInWithEmailPassword).toHaveBeenCalledTimes(1);

    await act(async () => finish());
  });
});
