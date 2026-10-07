/** Donation pages require deliberate payment, preserve drafts and lock navigation during Stripe. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TipCheckout } from '@/components/TipCheckout';
import { COMPLIANCE_PAYMENT, GIFT_RECORD_NOTICE } from '@/data/legal';
import { MALO_DISCLAIMER, type Player } from '@/data/players';
import { TAGLINE_HEADLINE } from '@/data/malo';

const mockStart = jest.fn();
let mockDonatePress: (() => void) | undefined;
let mockBusy = false;
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: mockStart, busy: mockBusy }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { catalog: { maloAmounts: [5, 10, 25], maloFeeDollars: 1 } } }) }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: (props: { accessibilityLabel?: string; onPress: () => void }) => {
  if (props.accessibilityLabel?.startsWith('Donate $')) mockDonatePress = props.onPress;
  const { Pressable } = jest.requireActual('react-native'); return <Pressable {...props} />;
} }));
jest.mock('@/components/TipButton', () => ({ TipButton: ({ label, onPress, disabled, selected }: { label: string; onPress: () => void; disabled: boolean; selected: boolean }) => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return <Pressable accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>;
} }));
jest.mock('expo-checkbox', () => ({ Checkbox: () => null }));
const player = { id: 'p1', name: 'Ana', backer_count: 1 } as Player;
async function chooseAndReview(amount = '$5') {
  await fireEvent.press(screen.getByLabelText(amount));
  await fireEvent.press(screen.getByLabelText('Next'));
  await fireEvent.press(screen.getByLabelText('Next'));
}

describe('short donation checkout', () => {
  beforeEach(() => { jest.clearAllMocks(); mockBusy = false; mockStart.mockResolvedValue(undefined); });
  it('discloses recipient and split before selection; preset taps never pay and Back keeps choices', async () => {
    await render(<TipCheckout player={player} />);
    expect(screen.getByText(TAGLINE_HEADLINE)).toBeTruthy();
    expect(screen.getByText("90% goes to Ana's family account. Tapua'i keeps 10% to run the app.")).toBeTruthy();
    expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('$25'));
    expect(mockStart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText("No tip for Tapua'i").props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(/Cover card fees \(optional\): add \$1\.00/).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText('$25').props.accessibilityState.selected).toBe(true);
    expect(mockStart).not.toHaveBeenCalled();
  });
  it('uses exact selected total, includes disclosures and preserves payment context and callbacks', async () => {
    const onBacked = jest.fn(), onTipped = jest.fn();
    await render(<TipCheckout player={player} reelId="reel" origin="rally" entry="qr_link" wishlistItemId="wish" rallyId="goal" sourceLabel="Travel" onBacked={onBacked} onTipped={onTipped} />);
    await chooseAndReview();
    expect(screen.getByText("On a $5.00 donation: $4.50 to Ana's family, $0.50 to Tapua'i. You pay $5.00.")).toBeTruthy();
    for (const disclosure of [MALO_DISCLAIMER, COMPLIANCE_PAYMENT, GIFT_RECORD_NOTICE]) expect(screen.getByText(disclosure)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Donate $5.00'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ player, tipAmount: 5, coverFees: false, platformTipPercent: 0, reelId: 'reel', origin: 'rally', entry: 'qr_link', wishlistItemId: 'wish', rallyId: 'goal', sourceLabel: 'Travel', onTipped: expect.any(Function) }));
    await act(async () => { mockStart.mock.calls[0][0].onBacked(2); mockStart.mock.calls[0][0].onTipped(500); });
    expect(onBacked).toHaveBeenCalledWith(2);
    expect(onTipped).toHaveBeenCalledWith(500);
    expect(screen.getByText('Thanks for showing up')).toBeTruthy();
    expect(screen.queryByLabelText('Donate $5.00')).toBeNull();
  });
  it('rejects malformed and subminimum custom amounts then retains valid cents across Back', async () => {
    await render(<TipCheckout player={player} />);
    await fireEvent.press(screen.getByLabelText('Custom'));
    for (const invalid of ['0.99', '-5', 'abc5', '2.345', '1..0']) {
      await fireEvent.changeText(screen.getByLabelText('Custom donation amount'), invalid);
      expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
    }
    await fireEvent.changeText(screen.getByLabelText('Custom donation amount'), '12.34');
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText('Custom donation amount').props.value).toBe('12.34');
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Donate $12.34')).toBeTruthy();
  });
  it('adds opted-in extras exactly and preserves them across pages', async () => {
    await render(<TipCheckout player={player} />);
    await fireEvent.press(screen.getByLabelText('$10')); await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText("10% tip for Tapua'i"));
    await fireEvent.press(screen.getByLabelText(/Cover card fees \(optional\)/));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Donate $12.00')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText("10% tip for Tapua'i").props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(/Cover card fees \(optional\)/).props.accessibilityState.checked).toBe(true);
  });
  it('locks repeat payment and Back immediately, keeps review after cancellation and allows a retry', async () => {
    let resolve!: () => void;
    mockStart.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const onBusyChange = jest.fn();
    await render(<TipCheckout player={player} onBusyChange={onBusyChange} />);
    await chooseAndReview();
    const press = mockDonatePress!;
    await act(async () => { press(); press(); });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText('Back').props.accessibilityState.disabled).toBe(true);
    await act(async () => resolve());
    expect(screen.getByLabelText('Donate $5.00').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('Thanks for showing up')).toBeNull();
    mockStart.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByLabelText('Donate $5.00'));
    expect(mockStart).toHaveBeenCalledTimes(2);
  });
  it('resets recipient amounts and add-ons when the athlete changes', async () => {
    const view = await render(<TipCheckout player={player} compact />);
    await fireEvent.press(screen.getByLabelText('$10')); await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText("10% tip for Tapua'i"));
    await view.rerender(<TipCheckout player={{ ...player, id: 'p2', name: 'Sina' }} compact />);
    expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('$5')); await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText("No tip for Tapua'i").props.accessibilityState.selected).toBe(true);
  });
  it('never offers another charge after Stripe succeeds but recording does not finish', async () => {
    mockStart.mockImplementation(async (args) => { args.onPaid(); });
    await render(<TipCheckout player={player} />);
    await chooseAndReview();
    const press = mockDonatePress!;
    await fireEvent.press(screen.getByLabelText('Donate $5.00'));
    expect(screen.getByText('Payment received')).toBeTruthy();
    expect(screen.queryByText('Thanks for showing up')).toBeNull();
    expect(screen.queryByLabelText('Donate $5.00')).toBeNull();
    await act(async () => { press(); });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it('does not apply an old payment result to a replacement recipient, even after switching back', async () => {
    let resolve!: () => void;
    mockStart.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const onBacked = jest.fn(), onTipped = jest.fn();
    const view = await render(<TipCheckout player={player} onBacked={onBacked} onTipped={onTipped} />);
    await chooseAndReview();
    await fireEvent.press(screen.getByLabelText('Donate $5.00'));
    const args = mockStart.mock.calls[0][0];
    await view.rerender(<TipCheckout player={{ ...player, id: 'p2', name: 'Sina' }} />);
    await view.rerender(<TipCheckout player={player} />);
    await act(async () => { args.onPaid(); args.onBacked(2); args.onTipped(500); resolve(); });
    expect(onBacked).not.toHaveBeenCalled();
    expect(onTipped).not.toHaveBeenCalled();
    expect(screen.queryByText('Thanks for showing up')).toBeNull();
    expect(screen.queryByText('Payment received')).toBeNull();
    expect(screen.getByText('Choose your donation')).toBeTruthy();
    expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
  });
});
