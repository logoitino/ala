/**
 * Shared Exclusive (Vault) unlock entry: Soft-Wall resume + platform Stripe gate.
 * Preview/test native builds keep PaymentSheet. Production store apps and web show an honest
 * unavailable alert — do not redirect to a website that cannot complete Exclusive checkout.
 */
import { Alert } from 'react-native';

import {
  decideExclusiveCheckout,
  type ExclusiveCheckoutDecision,
} from '@/data/storeCommerce';
import type { Player } from '@/types/database';

type RequireAuth = (intent: {
  kind: 'exclusive';
  athleteName?: string;
  athleteId?: string;
  resume: () => void;
}) => void;

type StartCheckout = (args: {
  player: Player;
  tipAmount: number;
  coverFees: boolean;
  auraPoints: number;
  skipBacker: true;
  onPaid: () => void | boolean | Promise<void | boolean>;
}) => void | Promise<void>;

export type BeginExclusiveUnlockArgs = {
  player: Player;
  tipAmount: number;
  auraPoints: number;
  requireAuth: RequireAuth;
  startCheckout: StartCheckout;
  onPaid: () => void | boolean | Promise<void | boolean>;
  /** Injectable for tests. */
  decision?: ExclusiveCheckoutDecision;
  alert?: typeof Alert.alert;
};

/**
 * @purpose Start one-time Exclusive unlock with Soft-Wall, or an honest unavailable alert.
 * @param args Athlete, catalog dollars/Aura, Soft-Wall + PaymentSheet hooks, optional test doubles.
 * @sideEffects SoftWallModal, Stripe PaymentSheet, or Alert when the rail is not ready.
 */
export function beginExclusiveUnlock(args: BeginExclusiveUnlockArgs): ExclusiveCheckoutDecision {
  const decision = args.decision ?? decideExclusiveCheckout();
  const alert = args.alert ?? Alert.alert;

  if (!decision.allowStripe) {
    alert('Exclusive access', decision.fanBody, [{ text: decision.fanCta }]);
    return decision;
  }

  args.requireAuth({
    kind: 'exclusive',
    athleteName: args.player.name,
    athleteId: args.player.id,
    resume: () => {
      void args.startCheckout({
        player: args.player,
        tipAmount: args.tipAmount,
        coverFees: false,
        auraPoints: args.auraPoints,
        skipBacker: true,
        onPaid: args.onPaid,
      });
    },
  });
  return decision;
}
