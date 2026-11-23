/** UX-14 real ProductSheet callbacks: unavailable stock never starts payment and stale product resumes cannot charge another sheet. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProductSheet } from '@/components/Drip/ProductSheet';
import type { DripItem } from '@/data/shop';
let mockHoldDismiss = false;
let mockDismissCallbacks: ((finished: boolean) => void)[] = [];
let mockActor: { userId: string; isCurrent: () => boolean } | null = null;
const mockStart = jest.fn();
const mockRecord = jest.fn(async (..._args: unknown[]): Promise<void> => undefined);
const mockRequireAuth = jest.fn((intent: { resume: () => void }) => intent.resume());
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: mockStart, busy: false }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockActor ? { id: mockActor.userId } : null }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/lib/finance', () => ({ recordDripOrder: (...args: unknown[]) => mockRecord(...args) }));
jest.mock('@/lib/offlineActor', () => ({ assertCurrent: () => undefined }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => mockActor } }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
// Native shared values retain identity; the shared Node stub intentionally does not.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView } = require('react-native');
  const identity = (value: unknown) => value;
  return { __esModule: true, default: { View, Text, ScrollView },
    useSharedValue: (initial: unknown) => require('react').useRef({ value: initial }).current,
    useAnimatedStyle: (factory: () => unknown) => factory(), withSpring: identity,
    withTiming: (value: unknown, _options: unknown, complete?: (finished: boolean) => void) => { if (complete) { if (mockHoldDismiss) mockDismissCallbacks.push(complete); else complete(true); } return value; }, withSequence: (...values: unknown[]) => values.at(-1),
    runOnJS: identity, Easing: new Proxy({}, { get: () => identity }) };
});
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/components/UI/SheetHandle', () => ({ SheetHandle: () => null }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: ({ children, contentStyle, ...props }: any) => {
  const { Pressable } = require('react-native'); return <Pressable {...props} style={contentStyle}>{children}</Pressable>;
} }));
const bottle: DripItem = { id: 'bottle', name: 'Bottle', category: 'merch', priceCents: 1800, blurb: 'Existing bottle', hasSizes: false, inventory: 3, icon: 'basketball' };
beforeEach(() => { jest.clearAllMocks(); mockActor = null; mockHoldDismiss = false; mockDismissCallbacks = []; mockRequireAuth.mockImplementation(intent => intent.resume()); });
it('does not start checkout for zero stock', async () => {
  await render(<ProductSheet item={{ ...bottle, inventory: 0 }} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText(/Buy Now|Out of stock/));
  expect(mockStart).not.toHaveBeenCalled();
  expect(screen.getAllByText(/Out of stock/).length).toBeGreaterThan(0);
});
it('retains the confirmed existing quantity/order contract for an available item', async () => {
  await render(<ProductSheet item={bottle} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Increase quantity'));
  await fireEvent.press(screen.getByLabelText('Increase quantity'));
  expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Buy Now — $54.00'));
  const checkout = mockStart.mock.calls[0][0];
  expect(checkout.tipAmount).toBe(54);
  const client = {}; const actor = { userId: 'buyer' };
  await act(async () => checkout.onPaid({ actor, client }));
  expect(mockRecord).toHaveBeenCalledWith({ productId: 'bottle', amountCents: 5400, qty: 3, buyerId: 'buyer' }, client);
});
it.each(['retargeted', 'closed'])('refuses an old guest buy resume after its product sheet is %s', async (mode) => {
  let resume!: () => void;
  mockRequireAuth.mockImplementation(intent => { resume = intent.resume; });
  const view = await render(<ProductSheet item={bottle} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Buy Now — $18.00'));
  await view.rerender(<ProductSheet item={mode === 'closed' ? null : { ...bottle, id: 'new-bottle' }} onClose={jest.fn()} />);
  await act(async () => resume());
  expect(mockStart).not.toHaveBeenCalled();
});

it('records an already-paid original product but never dismisses the replacement sheet', async () => {
  let release!: () => void;
  mockRecord.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const close = jest.fn();
  const view = await render(<ProductSheet item={bottle} onClose={close} />);
  await fireEvent.press(screen.getByLabelText('Buy Now — $18.00'));
  let paid!: Promise<void>;
  await act(async () => { paid = mockStart.mock.calls[0][0].onPaid({ actor: { userId: 'buyer' }, client: {} }); });
  await view.rerender(<ProductSheet item={{ ...bottle, id: 'new-bottle' }} onClose={close} />);
  await act(async () => { release(); await paid; });
  expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ productId: 'bottle', buyerId: 'buyer' }), expect.any(Object));
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Buy Now — $18.00')).toBeTruthy();
});
it('refuses a signed-in retained Buy after that initiating actor has left', async () => {
  let active = true, resume!: () => void;
  mockActor = { userId: 'A', isCurrent: () => active };
  mockRequireAuth.mockImplementation(intent => { resume = intent.resume; });
  await render(<ProductSheet item={bottle} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Buy Now — $18.00'));
  active = false;
  await act(async () => resume());
  expect(mockStart).not.toHaveBeenCalled();
});
it('consumes a valid same-product guest resume only once', async () => {
  let resume!: () => void;
  mockRequireAuth.mockImplementation(intent => { resume = intent.resume; });
  await render(<ProductSheet item={bottle} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Buy Now — $18.00'));
  await act(async () => { resume(); resume(); });
  expect(mockStart).toHaveBeenCalledTimes(1);
});

it('refuses an outgoing dismissal animation completion after another product opens', async () => {
  mockHoldDismiss = true;
  const close = jest.fn();
  const view = await render(<ProductSheet item={bottle} onClose={close} />);
  await fireEvent(screen.getByText('Bottle'), 'requestClose');
  expect(mockDismissCallbacks).toHaveLength(1);
  await view.rerender(<ProductSheet item={{ ...bottle, id: 'new-bottle' }} onClose={close} />);
  await act(async () => mockDismissCallbacks[0](true));
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Buy Now — $18.00')).toBeTruthy();
});

it('still settles a valid same-product dismissal after its closing flag becomes inactive', async () => {
  mockHoldDismiss = true;
  const close = jest.fn();
  await render(<ProductSheet item={bottle} onClose={close} />);
  await fireEvent(screen.getByText('Bottle'), 'requestClose');
  await act(async () => mockDismissCallbacks[0](true));
  expect(close).toHaveBeenCalledTimes(1);
});
