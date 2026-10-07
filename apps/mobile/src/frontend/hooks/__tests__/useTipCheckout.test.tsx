/** Stripe success stays distinct from donation-recording failures so donors are not told to pay again. */
import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import type { Player } from '@/types/database';

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
});
