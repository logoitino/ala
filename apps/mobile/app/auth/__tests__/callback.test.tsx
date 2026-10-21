/** OAuth failures stay visible; web recovery clears Router state as well as the browser address so initial history replay cannot restore return details. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import AuthCallbackScreen from '../callback';

const mockCompleteAuthRedirect = jest.fn();
const mockReplace = jest.fn();
const mockGetInitialURL = jest.fn();
const mockRouter = { replace: mockReplace };
let mockParams: Record<string, string | string[]> = {};

jest.mock('@/lib/auth', () => ({ completeAuthRedirect: (...args: unknown[]) => mockCompleteAuthRedirect(...args) }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-linking', () => ({
  getInitialURL: (...args: unknown[]) => mockGetInitialURL(...args),
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) => (
    `alasports://${path}?${new URLSearchParams(options?.queryParams).toString()}`
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReplace.mockReset();
  mockCompleteAuthRedirect.mockReset();
  mockGetInitialURL.mockReset();
  mockParams = {};
  mockCompleteAuthRedirect.mockResolvedValue({ user: { id: 'fan' } });
  mockGetInitialURL.mockResolvedValue('alasports://auth/callback?code=initial');
});

it('keeps return details out of a later Router history commit without retrying the failed return', async () => {
  const originalOS = Platform.OS;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let address = 'https://app.example/auth/callback?error=access_denied&error_description=synthetic-detail';
  let routeAddress = address;
  try {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      get location() { return new URL(address); },
      history: {
        state: { id: 'callback-entry' },
        replaceState: (_state: unknown, _title: string, path: string) => { address = new URL(path, address).href; },
      },
    } });
    mockParams = { error: 'access_denied', error_description: 'synthetic-detail' };
    mockReplace.mockImplementation((path: string) => { routeAddress = new URL(path, routeAddress).href; });
    mockCompleteAuthRedirect.mockRejectedValueOnce(new Error('failed'));
    const view = await render(<AuthCallbackScreen />);
    expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
    // The Router's next state commit owns the address; a standalone history write cannot sanitize it.
    address = routeAddress;
    expect(address).toBe('https://app.example/auth/callback');
    mockParams = {};
    await view.rerender(<AuthCallbackScreen />);
    expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
    expect(mockCompleteAuthRedirect).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

it('keeps web recovery available and clears Router params when history access is restricted', async () => {
  const originalOS = Platform.OS;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      location: new URL('https://app.example/auth/callback?error=access_denied'),
      history: { state: null, replaceState: () => { throw new Error('history unavailable'); } },
    } });
    mockParams = { error: 'access_denied' };
    mockCompleteAuthRedirect.mockRejectedValueOnce(new Error('failed'));
    await render(<AuthCallbackScreen />);
    expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith('/auth/callback');
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

it('accepts a genuinely new fragment return after failed-route cleanup', async () => {
  const originalOS = Platform.OS;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let address = 'https://app.example/auth/callback?error=access_denied';
  try {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      get location() { return new URL(address); },
      history: { state: null, replaceState: (_state: unknown, _title: string, path: string) => { address = new URL(path, address).href; } },
    } });
    mockParams = { error: 'access_denied' };
    mockCompleteAuthRedirect.mockRejectedValueOnce(new Error('failed'));
    const view = await render(<AuthCallbackScreen />);
    expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
    address = 'https://app.example/auth/callback#code=fresh-return';
    mockParams = {};
    await view.rerender(<AuthCallbackScreen />);
    expect(mockCompleteAuthRedirect).toHaveBeenLastCalledWith(address);
    expect(mockCompleteAuthRedirect).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenLastCalledWith('/');
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

it('shows a failed return and lets the user return to the app instead of claiming success', async () => {
  mockCompleteAuthRedirect.mockRejectedValueOnce(new Error('sensitive provider detail'));
  await render(<AuthCallbackScreen />);
  expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
  expect(screen.queryByText('sensitive provider detail')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Back to app'));
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('treats an empty return as incomplete', async () => {
  mockCompleteAuthRedirect.mockResolvedValueOnce(null);
  await render(<AuthCallbackScreen />);
  expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('uses the current route code rather than the original app launch URL', async () => {
  mockParams = { code: 'current-code' };
  mockGetInitialURL.mockResolvedValueOnce('alasports://gift/old-link');
  await render(<AuthCallbackScreen />);
  expect(mockCompleteAuthRedirect).toHaveBeenCalledWith('alasports://auth/callback?code=current-code');
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('does not exchange a code from a different initial route even when its query mentions the callback', async () => {
  mockGetInitialURL.mockResolvedValueOnce('alasports://gift/old?next=/auth/callback&code=unrelated');
  await render(<AuthCallbackScreen />);
  expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
  expect(mockCompleteAuthRedirect).not.toHaveBeenCalled();
});

it('rejects repeated current credentials instead of falling back to an old launch return', async () => {
  mockParams = { code: ['first', 'second'] };
  await render(<AuthCallbackScreen />);
  expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
  expect(mockGetInitialURL).not.toHaveBeenCalled();
  expect(mockCompleteAuthRedirect).not.toHaveBeenCalled();
});

it('ignores a completed return after the user leaves the route', async () => {
  let finish!: (session: object) => void;
  mockCompleteAuthRedirect.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = await render(<AuthCallbackScreen />);
  await view.unmount();
  await act(async () => finish({ user: { id: 'fan' } }));
  expect(mockReplace).not.toHaveBeenCalled();
});

it('completes once when the router supplies a fresh params object with the same values', async () => {
  mockParams = { code: 'current-code' };
  const view = await render(<AuthCallbackScreen />);
  mockParams = { code: 'current-code' };
  await view.rerender(<AuthCallbackScreen />);
  expect(mockCompleteAuthRedirect).toHaveBeenCalledTimes(1);
});

it('does not exchange a return after the route unmounts during native URL lookup', async () => {
  let resolveURL!: (url: string) => void;
  mockGetInitialURL.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveURL = resolve; }));
  const view = await render(<AuthCallbackScreen />);
  await view.unmount();
  await act(async () => resolveURL('alasports://auth/callback?code=old'));
  expect(mockCompleteAuthRedirect).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('reads browser tokens from the current URL and removes them before showing a failed return', async () => {
  const originalOS = Platform.OS;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const replaceState = jest.fn();
  try {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      location: {
        href: 'https://app.example/auth/callback#access_token=secret&refresh_token=refresh',
        pathname: '/auth/callback', search: '', hash: '#access_token=secret&refresh_token=refresh',
      },
      history: { state: null, replaceState },
    } });
    mockCompleteAuthRedirect.mockRejectedValueOnce(new Error('failed'));
    await render(<AuthCallbackScreen />);
    expect(await screen.findByText("We couldn't finish signing you in.")).toBeTruthy();
    expect(mockCompleteAuthRedirect).toHaveBeenCalledWith('https://app.example/auth/callback#access_token=secret&refresh_token=refresh');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
    // Router owns browser-history replay; cleaning only history leaves the original return in route state.
    expect(mockReplace).toHaveBeenCalledWith('/auth/callback');
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
