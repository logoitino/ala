export { StripeProvider, useStripe } from '@stripe/stripe-react-native';
export { createPaymentIntent } from '@/lib/stripeIntent';
export const isStripeNativeSupported = true;
export const NATIVE_STRIPE_UNAVAILABLE_MESSAGE =
  'Please use Expo Go on iOS or Android to test native Stripe payments.';
