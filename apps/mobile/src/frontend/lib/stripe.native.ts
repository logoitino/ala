/**
 * Metro platform file: the iOS / Android Stripe entry point.
 * Re-exports native Stripe and the shared PaymentIntent helper for installed development/preview builds.
 * `stripe.web.ts` owns Stripe.js; `stripe.ts` supplies the unsupported-platform stub. Expo Go payments need device verification.
 */

export { StripeProvider, useStripe } from '@stripe/stripe-react-native';
export { createPaymentIntent } from '@/lib/stripeIntent';
export const isStripeNativeSupported = true;
export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Use a development client or preview build on iOS or Android to test native Stripe payments.';
