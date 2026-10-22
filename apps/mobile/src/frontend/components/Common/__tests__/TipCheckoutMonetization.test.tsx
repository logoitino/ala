/** Optional checkout extras require literal-true authorization and an unchanged reviewed allocation.
 * OFF preserves issued payments but removes uncharged extras; gift limits retain the existing SQL cap. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TipCheckout } from '@/components/TipCheckout';
import { PLATFORM_TIP_HINT, PLATFORM_TIP_TITLE } from '@/data/malo';
import type { Player } from '@/data/players';

const mockStart = jest.fn();
let mockFinalPress: (() => void) | undefined;
let mockEnabled: unknown = true;
let mockFee = 1;
let mockAmounts = [5, 10, 25];
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: mockStart, busy: false }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: {
  buttons: { MONETIZATION_TIPS_ENABLED: mockEnabled }, catalog: { maloAmounts: mockAmounts, maloFeeDollars: mockFee },
} }) }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: (props: { accessibilityLabel?: string; onPress: () => void }) => {
  if (props.accessibilityLabel?.startsWith('Send a gift · Pay $')) mockFinalPress = props.onPress;
  const { Pressable } = jest.requireActual('react-native'); return <Pressable {...props} />;
} }));
jest.mock('@/components/TipButton', () => ({ TipButton: ({ label, onPress, disabled, selected }: { label: string; onPress: () => void; disabled: boolean; selected: boolean }) => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return <Pressable accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>;
} }));
jest.mock('expo-checkbox', () => ({ Checkbox: () => null }));
const player = { id: 'p1', name: 'Ana', backer_count: 1 } as Player;
async function options() {
  await fireEvent.press(screen.getByLabelText('$10')); await fireEvent.press(screen.getByLabelText('Next'));
}
async function selectExtras() {
  await fireEvent.press(screen.getByLabelText("10% tip for Tapua'i"));
  await fireEvent.press(screen.getByLabelText(/Cover the processing fee/));
  await fireEvent.press(screen.getByLabelText('Next'));
}

describe('gift monetization authorization and review', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockEnabled = true; mockFee = 1; mockAmounts = [5, 10, 25]; mockFinalPress = undefined;
    mockStart.mockResolvedValue(undefined);
  });
  it.each([false, undefined, 'true', 1])('keeps base gifts available without extras unless the flag is literal true (%s)', async (flag) => {
    mockEnabled = flag;
    await render(<TipCheckout player={player} />); await options();
    expect(screen.queryByText(PLATFORM_TIP_TITLE)).toBeNull();
    expect(screen.queryByText(PLATFORM_TIP_HINT)).toBeNull();
    expect(screen.queryByLabelText(/Cover the processing fee/)).toBeNull();
    expect(screen.queryByLabelText("No tip for Tapua'i")).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText("On a $10.00 gift: $10.00 allocated to Ana's family. You pay $10.00.")).toBeTruthy();
    expect(screen.getByText(/Gifts to individual athletes are personal gifts and are not tax-deductible\./)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Send a gift · Pay $10.00'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ tipAmount: 10, coverFees: false, platformTipPercent: 0, reviewedTotalCents: 1000, reviewedFeeCents: 0 }));
  });
  it('removes unpaid extras on OFF and makes a stale final tap wait for another review', async () => {
    const view = await render(<TipCheckout player={player} />); await options(); await selectExtras();
    const stalePress = mockFinalPress!;
    expect(screen.getByLabelText('Send a gift · Pay $12.00')).toBeTruthy();
    mockEnabled = false; await view.rerender(<TipCheckout player={player} />);
    expect(screen.getByText('Optional extras are now off. Review your gift total again before giving.')).toBeTruthy();
    expect(screen.queryByLabelText(/Cover the processing fee/)).toBeNull();
    await act(async () => { stalePress(); });
    expect(mockStart).not.toHaveBeenCalled();
    mockEnabled = true; await view.rerender(<TipCheckout player={player} />);
    expect(screen.getByLabelText("No tip for Tapua'i").props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(/Cover the processing fee/).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Send a gift · Pay $10.00'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ coverFees: false, platformTipPercent: 0, reviewedTotalCents: 1000, reviewedFeeCents: 0 }));
  });
  it('preserves an issued allocation across OFF and paid-recording failures without offering another charge', async () => {
    let resolve!: () => void;
    mockStart.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const view = await render(<TipCheckout player={player} />); await options(); await selectExtras();
    const stalePress = mockFinalPress!;
    await fireEvent.press(screen.getByLabelText('Send a gift · Pay $12.00'));
    const charged = mockStart.mock.calls[0][0];
    mockEnabled = false; mockFee = 2; await view.rerender(<TipCheckout player={player} />);
    const original = "On a $10.00 gift: $10.00 allocated to Ana's family + $1.00 toward estimated Stripe processing + $1.00 tip to Tapua'i. You pay $12.00.";
    expect(screen.getByText(original)).toBeTruthy();
    expect(charged).toEqual(expect.objectContaining({ coverFees: true, platformTipPercent: 10, reviewedTotalCents: 1200, reviewedFeeCents: 100 }));
    await act(async () => { charged.onPaid(); resolve(); });
    expect(screen.getByText(original)).toBeTruthy();
    expect(screen.getByText('Payment received')).toBeTruthy();
    expect(screen.queryByLabelText('Send a gift · Pay $12.00')).toBeNull();
    await act(async () => { stalePress(); });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it('removes extras only after an in-flight cancelled payment settles when OFF was published', async () => {
    let resolve!: () => void;
    mockStart.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const view = await render(<TipCheckout player={player} />); await options(); await selectExtras();
    await fireEvent.press(screen.getByLabelText('Send a gift · Pay $12.00'));
    mockEnabled = false; await view.rerender(<TipCheckout player={player} />);
    expect(screen.getByLabelText('Send a gift · Pay $12.00').props.accessibilityState.disabled).toBe(true);
    await act(async () => resolve());
    expect(screen.getByText('Optional extras are now off. Review your gift total again before giving.')).toBeTruthy();
    expect(screen.queryByLabelText('Send a gift · Pay $12.00')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Send a gift · Pay $10.00')).toBeTruthy();
  });
  it('requires another review when the configured processing estimate changes before payment', async () => {
    const view = await render(<TipCheckout player={player} />); await options();
    await fireEvent.press(screen.getByLabelText(/Cover the processing fee/));
    await fireEvent.press(screen.getByLabelText('Next'));
    const stalePress = mockFinalPress!;
    mockFee = 2; await view.rerender(<TipCheckout player={player} />);
    expect(screen.getByText('Your gift total changed. Review it again before giving.')).toBeTruthy();
    await act(async () => { stalePress(); }); expect(mockStart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Send a gift · Pay $12.00'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ tipAmount: 10, reviewedTotalCents: 1200, reviewedFeeCents: 200 }));
  });
  it.each(['1', '1000'])('accepts the existing inclusive gift boundary $%s', async (value) => {
    mockEnabled = false;
    await render(<TipCheckout player={player} />);
    await fireEvent.press(screen.getByLabelText('Custom'));
    await fireEvent.changeText(screen.getByLabelText('Custom gift amount'), value);
    await fireEvent.press(screen.getByLabelText('Next')); await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText(`Send a gift · Pay $${Number(value).toFixed(2)}`));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ tipAmount: Number(value), reviewedTotalCents: Number(value) * 100 }));
  });
  it('does not offer published presets outside the gift cap or fractional-cent amounts', async () => {
    mockAmounts = [0, 0.99, 5, 1000.01, 1001, Infinity, 1.001];
    await render(<TipCheckout player={player} />);
    for (const invalid of ['$0', '$0.99', '$1000.01', '$1001', '$Infinity', '$1.001']) expect(screen.queryByLabelText(invalid)).toBeNull();
    await fireEvent.press(screen.getByLabelText('$5')); await fireEvent.press(screen.getByLabelText('Next')); await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Send a gift · Pay $5.00')).toBeTruthy(); expect(mockStart).not.toHaveBeenCalled();
  });
});
