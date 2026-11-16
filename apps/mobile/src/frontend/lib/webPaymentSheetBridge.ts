/**
 * Bridge between `useStripe().presentPaymentSheet` on web and the mounted Payment Element host.
 * Native PaymentSheet is imperative; Stripe.js needs a React host — this queue connects them.
 */

export type WebPaymentSheetResult =
  | { error?: undefined }
  | { error: { code: string; message: string } };

export type WebPaymentSheetRequest = {
  clientSecret: string;
  merchantDisplayName: string;
  resolve: (result: WebPaymentSheetResult) => void;
};

type PresentHandler = (request: Omit<WebPaymentSheetRequest, 'resolve'>) => Promise<WebPaymentSheetResult>;

let presentHandler: PresentHandler | null = null;
let pendingSecret: { clientSecret: string; merchantDisplayName: string } | null = null;

/**
 * @purpose Register the React host that renders Stripe Payment Element (called from WebPaymentSheetHost).
 * @param handler Present implementation, or null on unmount.
 */
export function registerWebPaymentSheetHost(handler: PresentHandler | null): void {
  presentHandler = handler;
}

/**
 * @purpose Remember the PaymentIntent secret from `initPaymentSheet` until `presentPaymentSheet`.
 */
export function stashWebPaymentSheetIntent(options: {
  paymentIntentClientSecret: string;
  merchantDisplayName: string;
}): void {
  pendingSecret = {
    clientSecret: options.paymentIntentClientSecret,
    merchantDisplayName: options.merchantDisplayName,
  };
}

/**
 * @purpose Clear a stashed intent (after present, cancel, or failed init).
 */
export function clearWebPaymentSheetIntent(): void {
  pendingSecret = null;
}

/**
 * @purpose Present the web Payment Element using the stashed client secret.
 */
export async function presentStashedWebPaymentSheet(): Promise<WebPaymentSheetResult> {
  if (!pendingSecret) {
    return { error: { code: 'Failed', message: 'PaymentSheet was not initialized.' } };
  }
  if (!presentHandler) {
    return {
      error: {
        code: 'Failed',
        message: 'Web checkout UI is not ready. Refresh the page and try again.',
      },
    };
  }
  const payload = pendingSecret;
  clearWebPaymentSheetIntent();
  return presentHandler(payload);
}
