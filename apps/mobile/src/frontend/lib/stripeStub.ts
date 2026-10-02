/**
 * Stripe stand-in for platforms without the native SDK (web, Expo Go without the module).
 * Mirrors the few `@stripe/stripe-react-native` exports the app uses so imports resolve everywhere; the payment
 * sheet calls return a "Canceled" error carrying NATIVE_STRIPE_UNAVAILABLE_MESSAGE. Picked up via `lib/stripe.ts`.
 */

import { type ReactNode } from 'react';

export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Please use Expo Go on iOS or Android to test native Stripe payments.';

export const isStripeNativeSupported = false;

export function StripeProvider({
  children,
}: {
  children: ReactNode;
  publishableKey?: string;
  merchantIdentifier?: string;
}) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async (_options: {
      paymentIntentClientSecret: string;
      merchantDisplayName: string;
      applePay?: { merchantCountryCode: string };
      googlePay?: { merchantCountryCode: string; testEnv?: boolean };
    }) => ({
      error: { code: 'Canceled', message: NATIVE_STRIPE_UNAVAILABLE_MESSAGE },
    }),
    presentPaymentSheet: async () => ({
      error: { code: 'Canceled', message: NATIVE_STRIPE_UNAVAILABLE_MESSAGE },
    }),
  };
}
