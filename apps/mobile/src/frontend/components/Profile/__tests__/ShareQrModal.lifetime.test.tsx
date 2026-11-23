/** Existing QR copy/share flights, retries and native close completions remain in one account/target frame. Mounted real QR sheets: a delayed old copy must not announce success over a replacement athlete. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ShareQrModal as NativeQr } from '@/components/Profile/ShareQrModal';
import { ShareQrModal as WebQr } from '@/components/Profile/ShareQrModal.web';
import { SHARE_COPY_LABEL } from '@/data/share';
let mockUser = 'A';
let mockGuard = () => true;
const mockCloseCallbacks: (() => void)[] = [];
let mockHoldClose = false;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, isSessionCurrent: mockGuard }) }));
const mockButtonHandlers: Record<string, () => void> = {};
const mockCopy = jest.fn(), mockToast = jest.fn(), mockPlayOpen = jest.fn();
jest.mock('@/lib/share', () => ({
 giftQrTarget: jest.requireActual('@/lib/giftLink').giftQrTarget,
 copyGiftLink: (...args: unknown[]) => mockCopy(...args), shareGiftLink: jest.fn(), saveGiftQrToCameraRoll: jest.fn(),
}));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => ({ showToast: mockToast }) }));
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('@/hooks/useFanSheetMotion', () => ({ useFanSheetMotion: () => ({ sheetStyle: {}, backdropStyle: {}, playOpen: mockPlayOpen, playClose: (done: () => void) => { if (mockHoldClose) mockCloseCallbacks.push(done); else done(); } }) }));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: ({ children, contentStyle, ...props }: any) => {
 mockButtonHandlers[props.accessibilityLabel] = props.onPress;
 const { Pressable } = require('react-native'); return <Pressable {...props} style={contentStyle}>{children}</Pressable>;
} }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
beforeEach(() => { mockCopy.mockReset(); mockCopy.mockResolvedValue(undefined); mockToast.mockReset(); mockUser = 'A'; mockGuard = () => true; mockHoldClose = false; mockCloseCallbacks.length = 0; });
it.each([['native', NativeQr], ['web', WebQr]] as const)('%s refuses old copy success after the athlete changes', async (_name, Sheet) => {
 let release!: () => void;
 mockCopy.mockReset(); mockToast.mockReset(); mockUser = 'A'; mockGuard = () => true; mockHoldClose = false; mockCloseCallbacks.length = 0;
 mockCopy.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
 const view = await render(<Sheet visible athleteName="Athlete A" username="athlete-a" playerId="player-a" onClose={jest.fn()} />);
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining('athlete-a'));
 await view.rerender(<Sheet visible athleteName="Athlete B" username="athlete-b" playerId="player-b" onClose={jest.fn()} />);
 await act(async () => release());
 expect(mockToast).not.toHaveBeenCalled();
});

it.each([['native', NativeQr], ['web', WebQr]] as const)('%s confirms a current copy and exposes a failed copy for explicit retry', async (_name, Sheet) => {
 mockCopy.mockRejectedValueOnce(new Error('Clipboard unavailable'));
 await render(<Sheet visible athleteName="Athlete A" username="athlete-a" onClose={jest.fn()} />);
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 expect(mockToast).toHaveBeenCalledWith('Clipboard unavailable');
 expect(screen.getByLabelText(SHARE_COPY_LABEL)).toBeEnabled();
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 expect(mockCopy).toHaveBeenCalledTimes(2);
 expect(mockToast).toHaveBeenLastCalledWith('Gift link copied.');
});
it.each([['native', NativeQr], ['web', WebQr]] as const)('%s excludes duplicate copy calls in the same act', async (_name, Sheet) => {
 let release!: () => void; mockCopy.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
 await render(<Sheet visible athleteName="Athlete A" username="athlete-a" onClose={jest.fn()} />);
 const handler = mockButtonHandlers[SHARE_COPY_LABEL];
 await act(async () => { handler(); handler(); });
 expect(mockCopy).toHaveBeenCalledTimes(1);
 await act(async () => release());
});
it.each([['native', NativeQr], ['web', WebQr]] as const)('%s isolates outgoing completion from an incoming owner flight', async (_name, Sheet) => {
 let oldRelease!: () => void, newRelease!: () => void;
 mockCopy.mockImplementationOnce(() => new Promise<void>(resolve => { oldRelease = resolve; }));
 mockCopy.mockImplementationOnce(() => new Promise<void>(resolve => { newRelease = resolve; }));
 const props = { visible: true, athleteName: 'Athlete A', username: 'athlete-a', onClose: jest.fn() };
 const view = await render(<Sheet {...props} />);
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 mockUser = 'B'; mockGuard = () => true;
 await view.rerender(<Sheet {...props} />);
 expect(screen.getByLabelText(SHARE_COPY_LABEL)).toBeEnabled();
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 await act(async () => oldRelease());
 expect(screen.getByLabelText(SHARE_COPY_LABEL)).toBeDisabled();
 expect(mockToast).not.toHaveBeenCalled();
 await act(async () => newRelease());
 expect(mockToast).toHaveBeenCalledTimes(1);
 expect(mockToast).toHaveBeenCalledWith('Gift link copied.');
});
it.each([['native', NativeQr], ['web', WebQr]] as const)('%s ignores a failed outgoing copy after closing', async (_name, Sheet) => {
 let reject!: (error: Error) => void;
 mockCopy.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
 const props = { visible: true, athleteName: 'Athlete A', username: 'athlete-a', onClose: jest.fn() };
 const view = await render(<Sheet {...props} />);
 await fireEvent.press(screen.getByLabelText(SHARE_COPY_LABEL));
 await view.rerender(<Sheet {...props} visible={false} />);
 await act(async () => reject(new Error('Clipboard unavailable')));
 expect(mockToast).not.toHaveBeenCalled();
});
it('native rejects an old animation close after a replacement target opens', async () => {
 mockHoldClose = true;
 const close = jest.fn();
 const view = await render(<NativeQr visible athleteName="Athlete A" username="athlete-a" onClose={close} />);
 await fireEvent(screen.getByLabelText(SHARE_COPY_LABEL), 'requestClose');
 expect(mockCloseCallbacks).toHaveLength(1);
 await view.rerender(<NativeQr visible athleteName="Athlete B" username="athlete-b" onClose={close} />);
 await act(async () => mockCloseCallbacks[0]());
 expect(close).not.toHaveBeenCalled();
 expect(screen.getByLabelText(SHARE_COPY_LABEL)).toBeEnabled();
});
it('native still settles the current dismissal animation', async () => {
 mockHoldClose = true;
 const close = jest.fn();
 await render(<NativeQr visible athleteName="Athlete A" username="athlete-a" onClose={close} />);
 await fireEvent(screen.getByLabelText(SHARE_COPY_LABEL), 'requestClose');
 await act(async () => mockCloseCallbacks[0]());
 expect(close).toHaveBeenCalledTimes(1);
});
