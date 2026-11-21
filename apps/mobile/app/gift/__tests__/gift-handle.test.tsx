/** QR landing and route-lifetime regressions: a scan reaches a Give button tagged as a QR gift, and unknown or failed links never pretend to work. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { GiftLink } from '@/lib/giftLink';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME } from '@/lib/runtime';
import GiftHandleScreen from '../[handle]';

let mockHandle = 'mele';
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRequireAuth = jest.fn((request: { resume: () => void }) => request.resume());
const mockResolve = jest.fn<Promise<GiftLink>, [string | undefined]>();
const mockTipModal = jest.fn();
let mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ handle: mockHandle }),
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: mockLive }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/lib/giftLink', () => ({ resolveGiftLink: (handle: string | undefined) => mockResolve(handle) }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock('@/components/Profile/ShareQrModal', () => ({ ShareQrModal: () => null }));
jest.mock('@/components/TipSheetModal', () => ({
  MaloTipModal: (props: Record<string, unknown>) => {
    mockTipModal(props);
    return null;
  },
}));

const player = { id: '3f2b8c1e-5a4d-4c2b-9e1f-0a1b2c3d4e5f', name: 'Mele Tupou', jersey_number: 5, position: 'Linebacker', school_name: 'Westlake High' };

beforeEach(() => {
  jest.clearAllMocks();
  mockHandle = 'mele';
  mockRequireAuth.mockImplementation((request) => request.resume());
  mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
});

describe('gift landing', () => {
  it('opens the give sheet as a QR gift after the soft wall', async () => {
    mockResolve.mockResolvedValue({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: true });
    await render(<GiftHandleScreen />);
    await fireEvent.press(await screen.findByText('Give to Mele'));
    expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'malo', athleteId: player.id }));
    expect(mockTipModal).toHaveBeenLastCalledWith(expect.objectContaining({ player, origin: 'qr', entry: 'qr_link' }));
    await fireEvent.press(screen.getByText("See Mele's profile"));
    expect(mockPush).toHaveBeenCalledWith(`/user/${player.id}?entry=qr`);
  });

  it('shows the school only when the athlete makes it public', async () => {
    mockResolve.mockResolvedValue({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: true });
    const view = await render(<GiftHandleScreen />);
    expect(await screen.findByText('Linebacker · Westlake High · Football')).toBeTruthy();
    await view.unmount();
    mockResolve.mockResolvedValue({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: false });
    await render(<GiftHandleScreen />);
    expect(await screen.findByText('Linebacker · Football')).toBeTruthy();
    expect(screen.queryByText(/Westlake/)).toBeNull();
    expect(screen.getByLabelText('Jersey number 5')).toBeTruthy();
  });

  it('hides Give when gifts are switched off', async () => {
    mockLive.buttons.malo = false;
    mockResolve.mockResolvedValue({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: true });
    await render(<GiftHandleScreen />);
    await screen.findByText('Support Mele');
    expect(screen.queryByText('Give to Mele')).toBeNull();
  });

  it('says an unknown link is unknown, with no give or share', async () => {
    mockResolve.mockResolvedValue({ status: 'not_found', handle: 'mele' });
    await render(<GiftHandleScreen />);
    await screen.findByText("We couldn't find this athlete");
    expect(screen.queryByText(/Give/)).toBeNull();
    await fireEvent.press(screen.getByText('Go to Home'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('retries a failed lookup', async () => {
    mockResolve.mockResolvedValueOnce({ status: 'error', handle: 'mele', message: 'Could not load this athlete. Check your connection and try again.' });
    mockResolve.mockResolvedValueOnce({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: null, sport: null, schoolVisible: true });
    await render(<GiftHandleScreen />);
    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('Give to Mele')).toBeTruthy();
    expect(mockResolve).toHaveBeenCalledTimes(2);
  });
});

it('does not retarget an already-open gift when the handle changes', async () => {
  const nextPlayer = { ...player, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Sione' };
  mockResolve.mockResolvedValueOnce({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: true })
    .mockResolvedValueOnce({ status: 'found', handle: 'sione', player: nextPlayer as never, name: 'Sione', username: 'sione', sport: 'Football', schoolVisible: true });
  const view = await render(<GiftHandleScreen />);
  await fireEvent.press(await screen.findByText('Give to Mele'));
  expect(mockTipModal).toHaveBeenLastCalledWith(expect.objectContaining({ player }));
  mockHandle = 'sione'; await view.rerender(<GiftHandleScreen />);
  await screen.findByText('Support Sione');
  expect(mockTipModal).toHaveBeenLastCalledWith(expect.objectContaining({ player: null }));
});

it('does not resume an outgoing handle gift on the incoming recipient', async () => {
  let resume: (() => void) | undefined;
  mockRequireAuth.mockImplementation((request) => { resume = request.resume; });
  const nextPlayer = { ...player, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Sione' };
  mockResolve.mockResolvedValueOnce({ status: 'found', handle: 'mele', player: player as never, name: 'Mele', username: 'mele', sport: 'Football', schoolVisible: true })
    .mockResolvedValueOnce({ status: 'found', handle: 'sione', player: nextPlayer as never, name: 'Sione', username: 'sione', sport: 'Football', schoolVisible: true });
  const view = await render(<GiftHandleScreen />);
  await fireEvent.press(await screen.findByText('Give to Mele'));
  mockHandle = 'sione'; await view.rerender(<GiftHandleScreen />);
  await screen.findByText('Support Sione');
  const { act } = await import('@testing-library/react-native');
  await act(async () => { resume?.(); });
  expect(mockTipModal).toHaveBeenLastCalledWith(expect.objectContaining({ player: null }));
});
