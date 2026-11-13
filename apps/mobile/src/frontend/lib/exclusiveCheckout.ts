/**
 * Shared Exclusive (Vault) unlock entry: Soft-Wall resume + platform Stripe gate.
 * Production iOS/Android block Stripe for digital Exclusive; web and test builds keep PaymentSheet.
 */
import { Alert, Linking } from 'react-native';

import {
  decideExclusiveCheckout,
  formatExclusiveWebUrl,
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
  openUrl?: (url: string) => PromiseLike<unknown>;
  alert?: typeof Alert.alert;
};

/**
 * @purpose Start one-time Exclusive unlock with Soft-Wall, or redirect when store rails block Stripe.
 * @param args Athlete, catalog dollars/Aura, Soft-Wall + PaymentSheet hooks, optional test doubles.
 * @sideEffects SoftWallModal, Stripe PaymentSheet, or Alert + optional browser open to the web profile.
 */
export function beginExclusiveUnlock(args: BeginExclusiveUnlockArgs): ExclusiveCheckoutDecision {
  const decision = args.decision ?? decideExclusiveCheckout();
  const alert = args.alert ?? Alert.alert;
  const openUrl = args.openUrl ?? ((url: string) => Linking.openURL(url));

  if (!decision.allowStripe) {
    const url = formatExclusiveWebUrl(args.player.id);
    alert('Exclusive access', decision.fanBody, [
      { text: 'Not now', style: 'cancel' },
      {
        text: decision.fanCta,
        onPress: () => {
          void openUrl(url);
        },
      },
    ]);
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
