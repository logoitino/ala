/**
 * Metro platform file: the iOS / Android Stripe entry point.
 * Re-exports the real `StripeProvider` / `useStripe` from `@stripe/stripe-react-native` and the shared
 * `createPaymentIntent`. Sibling files `stripe.web.ts` / `stripe.ts` expose the same names backed by the stub.
 */

export { StripeProvider, useStripe } from '@stripe/stripe-react-native';
export { createPaymentIntent } from '@/lib/stripeIntent';
export const isStripeNativeSupported = true;
export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Please use Expo Go on iOS or Android to test native Stripe payments.';
