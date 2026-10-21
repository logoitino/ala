/** Stripe success stays distinct from donation-recording failures so donors are not told to pay again. */
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
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fan' }, refreshProfile: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { catalog: { maloFeeDollars: 1, exclusiveAura: 100 } } }) }));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => null }));
jest.mock('@/lib/stripe', () => ({ useStripe: () => ({ initPaymentSheet: async () => ({}), presentPaymentSheet: mockPresent }) }));
jest.mock('@/lib/payments', () => ({ createPaymentIntent: (...args: unknown[]) => mockIntent(...args), incrementBackerCount: (...args: unknown[]) => mockIncrement(...args) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: () => ({ insert: mockInsert }) } }));
jest.mock('@/lib/aura', () => ({ addUserAura: async () => ({ aura_points: 0 }), emitPlayerAura: jest.fn(), emitProfileAura: jest.fn() }));
jest.mock('@/lib/walletPay', () => ({ walletPayOptions: () => ({}) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackCheckoutLatency: jest.fn(), trackIssue: jest.fn() } }));

const player = { id: 'athlete', name: 'Ana', backer_count: 1 } as Player;
describe('checkout payment settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  it('signals the charge even when the donation insert is denied', async () => {
    mockInsert.mockResolvedValue({ error: { code: '42501', message: 'Permission denied' } });
    const onPaid = jest.fn(), onBacked = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, onPaid, onBacked }); });
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onBacked).not.toHaveBeenCalled();
    expect(mockIncrement).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Donation not recorded', expect.stringContaining('Your payment went through'));
  });
  it('does not signal payment or record a donation when PaymentSheet is canceled', async () => {
    mockPresent.mockResolvedValue({ error: { code: 'Canceled' } });
    const onPaid = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, onPaid }); });
    expect(onPaid).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
  it('records the covered card fee and PaymentIntent id, and keeps channel data when those columns are missing', async () => {
    mockIntent.mockResolvedValue('pi_3QabcDEF12345678_secret_x');
    mockInsert
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'cover_fee_cents' column of 'tips' in the schema cache" } })
      .mockResolvedValueOnce({ error: null });
    const onBacked = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, coverFees: true, platformTipPercent: 10, onBacked }); });
    expect(mockIntent).toHaveBeenCalledWith(650, player.id, 50, { giftCents: 500, coverFees: true, platformTipPercent: 10 });
    expect(mockInsert).toHaveBeenCalledTimes(2);
    const [first] = mockInsert.mock.calls[0];
    expect(first).toEqual(expect.objectContaining({ amount_cents: 500, stripe_payment_intent_id: 'pi_3QabcDEF12345678', platform_tip_cents: 50 }));
    expect(first.cover_fee_cents).toBeGreaterThan(0);
    const [second] = mockInsert.mock.calls[1];
    expect(second).toEqual(expect.objectContaining({ origin: 'profile', platform_tip_cents: 50, amount_cents: 500 }));
    expect(second).not.toHaveProperty('cover_fee_cents');
    expect(second).not.toHaveProperty('stripe_payment_intent_id');
    expect(onBacked).toHaveBeenCalledWith(2);
  });
  it('keeps a shared Exclusive/Vault purchase outside donation attribution', async () => {
    const onPaid = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => result.current.startCheckout({ player, tipAmount: 5, skipBacker: true, onPaid }));
    expect(mockIntent).toHaveBeenCalledWith(500, player.id, 0, undefined);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(onPaid).toHaveBeenCalledTimes(1);
  });
  it('keeps the donation and logs an issue when the database rejects only the fee or payment id', async () => {
    const { telemetry } = jest.requireMock('@/services/TelemetryManager');
    mockIntent.mockResolvedValue('pi_3QabcDEF12345678_secret_x');
    mockInsert
      .mockResolvedValueOnce({ error: { code: '23514', message: 'new row violates check constraint "tips_cover_fee_cents_check"' } })
      .mockResolvedValueOnce({ error: null });
    const onBacked = jest.fn();
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5, coverFees: true, onBacked }); });
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert.mock.calls[1][0]).not.toHaveProperty('cover_fee_cents');
    expect(telemetry.trackIssue).toHaveBeenCalledWith('checkout.bookkeeping_fields_rejected', 'donate');
    expect(onBacked).toHaveBeenCalled();
  });

  it('does not retry on an unrelated check violation', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23514', message: 'new row violates check constraint "tips_amount_cents_cap_check"' } });
    const { result } = await renderHook(() => useTipCheckout());
    await act(async () => { await result.current.startCheckout({ player, tipAmount: 5 }); });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Donation not recorded', expect.any(String));
  });
});

it('captures cancellation as expected and donation-record failure separately from payment failure', async () => {
 jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); mockIntent.mockResolvedValue('secret'); mockIncrement.mockResolvedValue(2);
 mockPresent.mockResolvedValue({ error: { code: 'Canceled', message: 'private' } });
 const first = await renderHook(() => useTipCheckout()); await act(async () => first.result.current.startCheckout({ player, tipAmount: 5 }));
 expect(mockSupportCapture).toHaveBeenCalledWith({feature:'donation',code:'user_cancelled'});
 mockSupportCapture.mockClear();mockPresent.mockResolvedValue({});mockInsert.mockResolvedValue({error:{code:'23514',message:'private ledger detail'}});
 const second = await renderHook(() => useTipCheckout());await act(async () => second.result.current.startCheckout({player,tipAmount:5}));
 expect(mockSupportCapture).toHaveBeenCalledWith({feature:'donation',code:'data_invalid'});expect(JSON.stringify(mockSupportCapture.mock.calls)).not.toContain('private');
});
