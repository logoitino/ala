import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/**
 * @purpose Deep-link / web return target for Stripe Connect Express (`alasports://stripe-connect`).
 * @sideEffects `WebBrowser.maybeCompleteAuthSession` closes the auth popup on web.
 */
export default function StripeConnectReturn() {
  return <Redirect href="/profile" />;
}
