/** Exclusive unlock: Soft-Wall + Stripe when allowed; Alert + web URL when production store rails block. */
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

  it('alerts and offers the website when Stripe is blocked', () => {
    const requireAuth = jest.fn();
    const alert = jest.fn();
    const openUrl = jest.fn();
    beginExclusiveUnlock({
      player,
      tipAmount: 4.99,
      auraPoints: 100,
      requireAuth,
      startCheckout: jest.fn(),
      onPaid: jest.fn(),
      alert: alert as typeof import('react-native').Alert.alert,
      openUrl,
      decision: {
        allowStripe: false,
        rail: 'app_store_iap',
        reason: 'prod ios',
        fanCta: 'Unlock on the website',
        fanBody: 'Use the website',
      },
    });
    expect(requireAuth).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Exclusive access',
      'Use the website',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Unlock on the website')?.onPress?.();
    expect(openUrl).toHaveBeenCalledWith(expect.stringMatching(/\/user\/p1$/));
  });
});
