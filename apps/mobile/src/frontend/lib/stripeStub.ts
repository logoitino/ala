/**
 * Stripe stand-in for runtimes resolving the base `stripe.ts`; native/web platform modules choose their own SDK.
 * Mirrors the few `@stripe/stripe-react-native` exports the app uses so imports resolve everywhere; the payment
 * sheet calls return a "Canceled" error carrying NATIVE_STRIPE_UNAVAILABLE_MESSAGE. Picked up via `lib/stripe.ts`.
 */

import { type ReactNode } from 'react';

export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Use a development client or preview build on iOS or Android to test native Stripe payments.';

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
