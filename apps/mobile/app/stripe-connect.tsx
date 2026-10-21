/** Stripe's return can select only a fixed owned app surface, never a supplied redirect URL. */
import { Redirect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/**
 * @purpose Deep-link / web return target for Stripe Connect Express (`alasports://stripe-connect`).
 * @sideEffects `WebBrowser.maybeCompleteAuthSession` closes the auth popup on web.
 */
export default function StripeConnectReturn() {
  const { playerId } = useLocalSearchParams<{ playerId?: string | string[] }>();
  const valid = typeof playerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId);
  return <Redirect href={valid ? `/parent?playerId=${playerId.toLowerCase()}` : '/profile'} />;
}
