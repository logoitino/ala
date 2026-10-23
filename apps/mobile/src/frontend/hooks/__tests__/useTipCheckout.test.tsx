/** Stripe success stays distinct from gift recording; paid allocations are never retried with missing fields. */
import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import type { Player } from '@/types/database';

const mockSupportCapture = jest.fn();
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals: { capture: (value: unknown) => mockSupportCapture(value) } }));
const mockInsert = jest.fn();
const mockIncrement = jest.fn();
const mockPresent = jest.fn();
const mockIntent = jest.fn();
const mockReelTips = jest.fn();
jest.mock('@/lib/reels', () => ({ addReelTips: (...args: unknown[]) => mockReelTips(...args), EMPTY_REEL_HYPE: {} }));
let mockTipsEnabled: unknown = false;
let mockFeeDollars = 1;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fan' }, refreshProfile: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { buttons: { MONETIZATION_TIPS_ENABLED: mockTipsEnabled }, catalog: { maloFeeDollars: mockFeeDollars, exclusiveAura: 100 } } }) }));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => null }));
jest.mock('@/lib/stripe', () => ({ useStripe: () => ({ initPaymentSheet: async () => ({}), presentPaymentSheet: mockPresent }) }));
jest.mock('@/lib/payments', () => ({ createPaymentIntent: (...args: unknown[]) => mockIntent(...args), incrementBackerCount: (...args: unknown[]) => mockIncrement(...args) }));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({ insert: mockInsert }),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'fan' } } } }) },
  },
}));
jest.mock('@/lib/aura', () => ({ addUserAura: async () => ({ aura_points: 0 }), emitPlayerAura: jest.fn(), emitProfileAura: jest.fn() }));
jest.mock('@/lib/walletPay', () => ({ walletPayOptions: () => ({}) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackCheckoutLatency: jest.fn(), trackIssue: jest.fn() } }));

const player = { id: 'athlete', name: 'Ana', backer_count: 1 } as Player;
describe('checkout payment settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTipsEnabled = false; mockFeeDollars = 1;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockIntent.mockResolvedValue('secret');
    mockPresent.mockResolvedValue({});
    mockInsert.mockResolvedValue({ error: null });
    mockIncrement.mockResolvedValue(2);
  });
  afterEach(() => jest.restoreAllMocks());
  it('signals payment before recording and reports a counter failure as already paid', async () => {
    const onPaid = jest.fn(), onBacked = jest.fn();
    mockInsert.mockImplementation(async () => { expect(onPaid).toHaveBeenCalledTimes(1); return { error: null }; });
    mockIncrement.mockRejectedValue(new Error('Counter unavailable'));
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, onPaid, onBacked }); });
    expect(onBacked).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Payment received — follow-up needed', expect.stringContaining('Your payment went through'));
    expect(result.current.busy).toBe(false);
  });
  it('signals the charge even when the gift insert is denied', async () => {
    mockInsert.mockResolvedValue({ error: { code: '42501', message: 'Permission denied' } });
    const onPaid = jest.fn(), onBacked = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, onPaid, onBacked }); });
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onBacked).not.toHaveBeenCalled();
    expect(mockIncrement).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Gift not recorded', expect.stringContaining('Your payment went through'));
  });
  it('does not signal payment or record a gift when PaymentSheet is canceled', async () => {
    mockPresent.mockResolvedValue({ error: { code: 'Canceled' } });
    const onPaid = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, onPaid }); });
    expect(onPaid).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
  it.each([
    { code: 'PGRST204', message: "Could not find the 'cover_fee_cents' column" },
    { code: '23514', message: 'tips_cover_fee_cents_check' },
    { code: '42703', message: 'platform_tip_cents missing' },
  ])('retains the paid allocation without any field-dropping retry: %j', async (error) => {
    mockTipsEnabled = true;
    mockIntent.mockResolvedValue('pi_3QabcDEF12345678_secret_x');
    mockInsert.mockResolvedValue({ error });
    const onBacked = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, coverFees: true, platformTipPercent: 10, onBacked }));
    expect(mockIntent).toHaveBeenCalledWith(650, player.id, 50, { giftCents: 500, coverFees: true, platformTipPercent: 10 });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toEqual(expect.objectContaining({
      amount_cents: 500, cover_fee_cents: 100, platform_tip_cents: 50,
      stripe_payment_intent_id: 'pi_3QabcDEF12345678', origin: 'profile',
    }));
    expect(onBacked).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Gift not recorded', expect.stringContaining('before paying again'));
  });
  it('keeps a shared Exclusive/Vault purchase outside gift attribution', async () => {
    const onPaid = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, skipBacker: true, onPaid }));
    expect(mockIntent).toHaveBeenCalledWith(500, player.id, 0, undefined);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(onPaid).toHaveBeenCalledTimes(1);
  });
  it('does not discard the real payment reference when a base gift needs ledger repair', async () => {
    mockIntent.mockResolvedValue('pi_3QabcDEF12345678_secret_x');
    mockInsert.mockResolvedValue({ error: { code: 'PGRST204', message: 'stripe_payment_intent_id missing' } });
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5 }));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].stripe_payment_intent_id).toBe('pi_3QabcDEF12345678');
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it.each([false, undefined, null, 'true', 1])('refuses requested extras before Stripe when authority is %p', async (authority) => {
    mockTipsEnabled = authority;
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, platformTipPercent: 10 }));
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, coverFees: true }));
    expect(mockIntent).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Review your gift', expect.stringContaining('without extras'));
  });

  it.each([false, true])('keeps a base gift at full gross with flag %p', async (authority) => {
    mockTipsEnabled = authority;
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 50 }));
    expect(mockIntent).toHaveBeenCalledWith(5000, player.id, 0, { giftCents: 5000, coverFees: false, platformTipPercent: 0 });
    expect(mockInsert.mock.calls[0][0]).toEqual(expect.objectContaining({ amount_cents: 5000, platform_tip_cents: 0, cover_fee_cents: 0 }));
  });

  it.each([
    { tipAmount: 1000.01 }, { tipAmount: 0.99 }, { tipAmount: NaN },
    { tipAmount: 5, auraPoints: 10001 }, { tipAmount: 5, auraPoints: -1 },
    { tipAmount: 5, auraPoints: 2.5 }, { tipAmount: 5, platformTipPercent: Infinity },
    { tipAmount: 5, platformTipPercent: 101 }, { tipAmount: 5, entry: 'bad' },
  ])('rejects ledger-bound invalid input before creating a charge: %j', async (args) => {
    mockTipsEnabled = true;
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, ...args } as Parameters<typeof result.current.startCheckout>[0]));
    expect(mockIntent).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects covered processing above the existing row cap before creating a charge', async () => {
    mockTipsEnabled = true; mockFeeDollars = 100;
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 50, coverFees: true }));
    expect(mockIntent).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
  });

  it('counts only the gift in callbacks and Highlight totals when extras are paid', async () => {
    mockTipsEnabled = true;
    const onTipped = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, coverFees: true, platformTipPercent: 10, reelId: 'reel', onTipped }));
    expect(mockIntent).toHaveBeenCalledWith(650, player.id, 50, { giftCents: 500, coverFees: true, platformTipPercent: 10 });
    expect(onTipped).toHaveBeenCalledWith(500);
    expect(mockReelTips).toHaveBeenCalledWith('reel', 500, {});
  });

  it('requires another review if the shown fee/total differs from current configuration', async () => {
    mockTipsEnabled = true;
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, coverFees: true, reviewedFeeCents: 50, reviewedTotalCents: 550 }));
    expect(mockIntent).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Review your gift', expect.stringContaining('amount changed'));
  });

  it('admits the inclusive $1000 gift/Aura boundary', async () => {
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 1000 }));
    expect(mockInsert.mock.calls[0][0]).toEqual(expect.objectContaining({ amount_cents: 100000, aura_points: 10000 }));
  });

  it('keeps an issued allocation when the published flag turns OFF during PaymentSheet', async () => {
    mockTipsEnabled = true;
    let finish!: (value: object) => void;
    mockPresent.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = await renderHook(() => useTipCheckout());
    let checkout!: Promise<void>;
    await act(async () => { checkout = result.current.startCheckout({ player, tipAmount: 5, platformTipPercent: 10, coverFees: true }); });
    mockTipsEnabled = false; await rerender({});
    await act(async () => { finish({}); await checkout; });
    expect(mockInsert.mock.calls[0][0]).toEqual(expect.objectContaining({ amount_cents: 500, platform_tip_cents: 50, cover_fee_cents: 100 }));
  });

  it('excludes duplicate calls made before React publishes busy state', async () => {
    let finish!: (value: string) => void;
    mockIntent.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result } = await renderHook(() => useTipCheckout());
    let checkout!: Promise<void>;
    await act(async () => {
      checkout = result.current.startCheckout({ player, tipAmount: 5 });
      await result.current.startCheckout({ player, tipAmount: 5 });
    });
    expect(mockIntent).toHaveBeenCalledTimes(1);
    await act(async () => { finish('pi_3QabcDEF12345678_secret_x'); await checkout; });
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });

  it('does not retry on an unrelated check violation', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23514', message: 'new row violates check constraint "tips_amount_cents_cap_check"' } });
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5 }); });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Gift not recorded', expect.any(String));
  });
});

it('captures cancellation as expected and gift-record failure separately from payment failure', async () => {
 jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); mockIntent.mockResolvedValue('secret'); mockIncrement.mockResolvedValue(2);
 mockPresent.mockResolvedValue({ error: { code: 'Canceled', message: 'private' } });
 const first = await renderHook(() => useTipCheckout()); await act(async () => first.result.current.startCheckout({ player, tipAmount: 5 }));
 expect(mockSupportCapture).toHaveBeenCalledWith({feature:'donation',code:'user_cancelled'});
 mockSupportCapture.mockClear();mockPresent.mockResolvedValue({});mockInsert.mockResolvedValue({error:{code:'23514',message:'private ledger detail'}});
 const second = await renderHook(() => useTipCheckout());await act(async () => second.result.current.startCheckout({player,tipAmount:5}));
 expect(mockSupportCapture).toHaveBeenCalledWith({feature:'donation',code:'data_invalid'});expect(JSON.stringify(mockSupportCapture.mock.calls)).not.toContain('private');
});
