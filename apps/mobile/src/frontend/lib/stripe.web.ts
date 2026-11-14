/**
 * Metro platform file: Expo web Stripe entry. Uses Stripe.js Payment Element via WebPaymentSheetHost
 * so gifts / Exclusive / Drip can checkout in the browser. Native builds resolve `stripe.native.ts`.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

import { WebPaymentSheetHost } from '@/components/Checkout/WebPaymentSheetHost';
import { createPaymentIntent } from '@/lib/stripeIntent';
import {
  clearWebPaymentSheetIntent,
  presentStashedWebPaymentSheet,
  stashWebPaymentSheetIntent,
} from '@/lib/webPaymentSheetBridge';

export { createPaymentIntent };

export const isStripeNativeSupported = false;

export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Card checkout needs a publishable Stripe key. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and refresh.';

type StripeWebContextValue = {
  stripe: Stripe | null;
  publishableKey: string;
};

const StripeWebContext = createContext<StripeWebContextValue | null>(null);

/**
 * @purpose Provide Stripe.js on Expo web and mount the Payment Element host for PaymentSheet-shaped calls.
 */
export function StripeProvider({
  children,
  publishableKey = '',
}: {
  children: ReactNode;
  publishableKey?: string;
  merchantIdentifier?: string;
}) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const key = publishableKey.trim();

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setStripe(null);
      return;
    }
    void loadStripe(key).then((instance) => {
      if (!cancelled) setStripe(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const value = useMemo(() => ({ stripe, publishableKey: key }), [stripe, key]);

  return createElement(
    StripeWebContext.Provider,
    { value },
    children,
    createElement(WebPaymentSheetHost, { stripe }),
  );
}

/**
 * @purpose Same imperative surface as `@stripe/stripe-react-native` for `useTipCheckout` on web.
 */
export function useStripe() {
  const ctx = useContext(StripeWebContext);

  return {
    initPaymentSheet: async (options: {
      paymentIntentClientSecret: string;
      merchantDisplayName: string;
      applePay?: { merchantCountryCode: string };
      googlePay?: { merchantCountryCode: string; testEnv?: boolean };
    }) => {
      if (!ctx?.publishableKey || !ctx.stripe) {
        clearWebPaymentSheetIntent();
        return { error: { code: 'Failed', message: NATIVE_STRIPE_UNAVAILABLE_MESSAGE } };
      }
      if (!options.paymentIntentClientSecret) {
        return { error: { code: 'Failed', message: 'Missing PaymentIntent client secret.' } };
      }
      stashWebPaymentSheetIntent({
        paymentIntentClientSecret: options.paymentIntentClientSecret,
        merchantDisplayName: options.merchantDisplayName || "Tapua'i Sports",
      });
      return {};
    },
    presentPaymentSheet: async () => presentStashedWebPaymentSheet(),
  };
}
