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
