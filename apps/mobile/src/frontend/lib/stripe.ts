/**
 * Metro fallback for the Stripe entry point (used when neither .native nor .web applies).
 * Re-exports the stub (`stripeStub.ts`) plus the shared `createPaymentIntent`. Keep the export list identical to
 * `stripe.native.ts` and `stripe.web.ts`.
 */

export { createPaymentIntent } from '@/lib/stripeIntent';
export {
  NATIVE_STRIPE_UNAVAILABLE_MESSAGE,
  StripeProvider,
  isStripeNativeSupported,
  useStripe,
} from '@/lib/stripeStub';
