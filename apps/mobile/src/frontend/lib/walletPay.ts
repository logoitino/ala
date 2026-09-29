/** Apple Pay merchant id. Must match the `@stripe/stripe-react-native` plugin in `app.json`. */
export const APPLE_PAY_MERCHANT_ID = 'merchant.com.alasports.tapuai';

const MERCHANT_COUNTRY = 'US';

export type WalletPayOptions = {
  applePay: { merchantCountryCode: string };
  googlePay: { merchantCountryCode: string; testEnv: boolean };
};

/**
 * @purpose Apple Pay / Google Pay options for `initPaymentSheet`, so a fan can give with one
 * tap instead of typing a card (ROADMAP Release waves, Wave 1 checklist item 5).
 * @param publishableKey The Stripe publishable key the app was built with. A `pk_test_` key
 * keeps Google Pay in its test environment; anything else is treated as live.
 * @remarks PaymentSheet only shows a wallet button when the device supports it, so passing
 * both is safe everywhere. Apple Pay also needs the merchant id registered in the Apple
 * Developer account and a Stripe Apple Pay certificate — until then iOS falls back to card.
 * Neither wallet works in Expo Go; use a development or preview build.
 */
export function walletPayOptions(
  publishableKey: string | undefined = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
): WalletPayOptions {
  const live = Boolean(publishableKey?.trim().startsWith('pk_live_'));
  return {
    applePay: { merchantCountryCode: MERCHANT_COUNTRY },
    googlePay: { merchantCountryCode: MERCHANT_COUNTRY, testEnv: !live },
  };
}
