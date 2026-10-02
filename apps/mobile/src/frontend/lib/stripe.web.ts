/**
 * Metro platform file: the web build of the Stripe entry point.
 * Web has no native PaymentSheet, so this re-exports the stub (`stripeStub.ts`) plus the shared `createPaymentIntent`.
 * Mobile builds resolve `stripe.native.ts` instead; `stripe.ts` is the fallback. Keep the three export lists identical.
 */

export { createPaymentIntent } from '@/lib/stripeIntent';
export {
  NATIVE_STRIPE_UNAVAILABLE_MESSAGE,
  StripeProvider,
  isStripeNativeSupported,
  useStripe,
} from '@/lib/stripeStub';
