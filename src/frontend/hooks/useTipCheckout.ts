import { useStripe } from '@stripe/stripe-react-native';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useOptionalCelebration } from '@/context/CelebrationContext';
import { displayValue, getTipCharge } from '@/data/players';
import { createPaymentIntent, incrementBackerCount } from '@/lib/payments';
import type { Player } from '@/types/database';

type StartCheckoutArgs = {
  player: Player;
  tipAmount: number;
  coverFees: boolean;
  onBacked?: (nextCount: number) => void;
};

export function useTipCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const celebration = useOptionalCelebration();
  const [busy, setBusy] = useState(false);

  const startCheckout = useCallback(
    async ({ player, tipAmount, coverFees, onBacked }: StartCheckoutArgs) => {
      if (busy) return;

      const playerName = displayValue(player.name, 'this athlete');
      const { amountCents } = getTipCharge(tipAmount, coverFees);

      setBusy(true);
      try {
        const clientSecret = await createPaymentIntent(amountCents);

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Tapua'i Sports",
        });

        if (initError) {
          Alert.alert('Couldn’t start PaymentSheet', initError.message);
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') return;
          Alert.alert('Payment failed', presentError.message);
          return;
        }

        const nextCount = await incrementBackerCount(player);
        onBacked?.(nextCount);
        celebration?.celebrate({ playerName, backerCount: nextCount });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        Alert.alert('Payment failed', message);
      } finally {
        setBusy(false);
      }
    },
    [busy, celebration, initPaymentSheet, presentPaymentSheet],
  );

  return { startCheckout, busy };
}
