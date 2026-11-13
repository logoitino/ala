/** Exclusive unlock: Soft-Wall + Stripe when allowed; honest unavailable Alert when blocked. */
import { beginExclusiveUnlock } from '@/lib/exclusiveCheckout';
import type { Player } from '@/types/database';

const player = { id: 'p1', name: 'Kaleo' } as Player;

describe('beginExclusiveUnlock', () => {
  it('opens Soft-Wall Exclusive resume when Stripe is allowed', () => {
    const requireAuth = jest.fn();
    const startCheckout = jest.fn();
    const onPaid = jest.fn();
    const decision = beginExclusiveUnlock({
      player,
      tipAmount: 4.99,
      auraPoints: 100,
      requireAuth,
      startCheckout,
      onPaid,
      decision: {
        allowStripe: true,
        rail: 'stripe_test',
        reason: 'test',
        fanCta: 'Test unlock',
        fanBody: 'body',
      },
    });
    expect(decision.allowStripe).toBe(true);
    expect(requireAuth).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'exclusive', athleteId: 'p1' }),
    );
    const resume = requireAuth.mock.calls[0][0].resume as () => void;
    resume();
    expect(startCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ tipAmount: 4.99, skipBacker: true, auraPoints: 100 }),
    );
  });

  it('alerts unavailable with a single OK when Stripe is blocked (no website redirect)', () => {
    const requireAuth = jest.fn();
    const alert = jest.fn();
    beginExclusiveUnlock({
      player,
      tipAmount: 4.99,
      auraPoints: 100,
      requireAuth,
      startCheckout: jest.fn(),
      onPaid: jest.fn(),
      alert: alert as typeof import('react-native').Alert.alert,
      decision: {
        allowStripe: false,
        rail: 'app_store_iap',
        reason: 'prod ios',
        fanCta: 'OK',
        fanBody: 'Exclusive unlock is unavailable on this build.',
      },
    });
    expect(requireAuth).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Exclusive access',
      'Exclusive unlock is unavailable on this build.',
      [{ text: 'OK' }],
    );
  });
});
