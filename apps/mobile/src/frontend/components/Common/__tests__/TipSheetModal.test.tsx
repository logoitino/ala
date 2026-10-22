/** Popup exits remain locked during Stripe; reopening starts a fresh donation draft. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MaloTipModal } from '@/components/TipSheetModal';
import type { Player } from '@/data/players';
import { TAGLINE_HEADLINE } from '@/data/malo';
import { GIFT_HELD_NOTICE } from '@/data/verification';
const mockStart = jest.fn();
const mockClose = jest.fn();
let mockDeferClose = false;
let mockFinishClose: ((finished: boolean) => void) | undefined;
let mockDonatePress: (() => void) | undefined;
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: mockStart, busy: false }) }));
const mockPayoutAllowed = jest.fn<Promise<boolean>, [string]>();
jest.mock('@/lib/payoutGate', () => ({ fetchPayoutAllowed: (id: string) => mockPayoutAllowed(id) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { catalog: { maloAmounts: [5, 10, 25], maloFeeDollars: 1 } } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('expo-checkbox', () => ({ Checkbox: () => null }));
jest.mock('@/components/Effects/CardShine', () => ({ CardShine: () => null }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: (props: { accessibilityLabel?: string; onPress: () => void }) => {
  if (props.accessibilityLabel?.startsWith('Donate $')) mockDonatePress = props.onPress;
  const { Pressable } = jest.requireActual('react-native'); return <Pressable {...props} />;
} }));
jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native');
  return { __esModule: true, default: { View, Text }, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: () => ({}), withSpring: (value: number) => value, withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { if (mockDeferClose && done) mockFinishClose = done; else done?.(true); return value; }, runOnJS: (fn: unknown) => fn, interpolateColor: () => 'white', withSequence: () => 1, Easing: { out: () => undefined, in: () => undefined, cubic: () => undefined } };
});
const player = { id: 'p1', name: 'Ana', backer_count: 1 } as Player;
describe('donation popup session', () => {
  beforeEach(() => { jest.clearAllMocks(); mockPayoutAllowed.mockResolvedValue(true); mockDeferClose = false; mockFinishClose = undefined; mockStart.mockResolvedValue(undefined); });
  it("tells the donor their donation is held only when this athlete's payouts are not set up", async () => {
    mockPayoutAllowed.mockResolvedValue(false);
    const view = await render(<MaloTipModal player={player} onClose={mockClose} />);
    expect(await screen.findByText(GIFT_HELD_NOTICE)).toBeTruthy();
    expect(mockPayoutAllowed).toHaveBeenCalledWith(player.id);
    await view.unmount();

    mockPayoutAllowed.mockResolvedValue(true);
    await render(<MaloTipModal player={player} onClose={mockClose} />);
    await act(async () => undefined);
    expect(screen.queryByText(GIFT_HELD_NOTICE)).toBeNull();
  });
  it('does not claim the donation is held while the payout check is still loading', async () => {
    mockPayoutAllowed.mockReturnValue(new Promise<boolean>(() => undefined));
    await render(<MaloTipModal player={player} onClose={mockClose} />);
    await act(async () => undefined);
    expect(screen.queryByText(GIFT_HELD_NOTICE)).toBeNull();
  });
  it('blocks a stale Donate press during the close animation', async () => {
    await render(<MaloTipModal player={player} onClose={mockClose} />);
    await fireEvent.press(screen.getByLabelText('$5, +50 Aura Points ⚡'));
    await fireEvent.press(screen.getByLabelText('Next')); await fireEvent.press(screen.getByLabelText('Next'));
    const press = mockDonatePress!;
    mockDeferClose = true;
    await fireEvent.press(screen.getByText('Close'));
    expect(mockClose).not.toHaveBeenCalled();
    await act(async () => { press(); });
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => { mockFinishClose!(true); });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  it('shows the brand line above the Amount step only, keeping Review plain (BRAND-01)', async () => {
    await render(<MaloTipModal player={player} onClose={mockClose} />);
    expect(screen.getByText(TAGLINE_HEADLINE)).toBeTruthy();
    expect(screen.getByText("90% goes to Ana's family account. Tapua'i keeps 10% to run the app.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('$5, +50 Aura Points ⚡'));
    await fireEvent.press(screen.getByLabelText('Next')); await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.queryByText(TAGLINE_HEADLINE)).toBeNull();
    expect(screen.getByLabelText('Donate $5.00')).toBeTruthy();
  });
  it('resets amount after close and reopening the same recipient', async () => {
    const view = await render(<MaloTipModal player={player} onClose={mockClose} />);
    await fireEvent.press(screen.getByLabelText('$5, +50 Aura Points ⚡'));
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByText('Close'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    await view.rerender(<MaloTipModal player={null} onClose={mockClose} />);
    await view.rerender(<MaloTipModal player={player} onClose={mockClose} />);
    expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Choose your donation')).toBeTruthy();
  });
  it('locks Close during payment and keeps a pending session on the original family if the parent changes recipients', async () => {
    let resolve!: () => void;
    mockStart.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const view = await render(<MaloTipModal player={player} onClose={mockClose} />);
    await fireEvent.press(screen.getByLabelText('$5, +50 Aura Points ⚡'));
    await fireEvent.press(screen.getByLabelText('Next')); await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Donate $5.00'));
    await fireEvent.press(screen.getByText('Payment in progress…'));
    expect(mockClose).not.toHaveBeenCalled();
    await view.rerender(<MaloTipModal player={{ ...player, id: 'p2', name: 'Sina' }} onClose={mockClose} />);
    expect(screen.getByText('Give to Ana')).toBeTruthy();
    expect(screen.queryByText('Give to Sina')).toBeNull();
    await act(async () => resolve());
    expect(screen.getByText('Give to Sina')).toBeTruthy();
    expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
  });
});
