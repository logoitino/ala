/**
 * Web-only Stripe Payment Element host. Mirrors native PaymentSheet present/cancel for Expo web.
 * Mounted under the web StripeProvider; never imported from native entry points.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Elements, PaymentElement, useElements, useStripe as useStripeJs } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';

import { colors, KIT, radii } from '@/constants/theme';
import {
  registerWebPaymentSheetHost,
  type WebPaymentSheetResult,
} from '@/lib/webPaymentSheetBridge';
import { FOCAL } from '@/theme/motion';

type SheetState = {
  clientSecret: string;
  merchantDisplayName: string;
  resolve: (result: WebPaymentSheetResult) => void;
} | null;

type WebPaymentSheetHostProps = {
  stripe: Stripe | null;
};

/**
 * @purpose Inner confirm UI once Elements has the PaymentIntent client secret.
 */
function WebPaymentSheetForm({
  merchantDisplayName,
  onClose,
}: {
  merchantDisplayName: string;
  onClose: (result: WebPaymentSheetResult) => void;
}) {
  const stripe = useStripeJs();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setBusy(false);
      setError(submitError.message ?? 'Check your payment details.');
      return;
    }
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    });
    setBusy(false);
    if (confirmError) {
      if (confirmError.code === 'canceled' || confirmError.type === 'validation_error') {
        setError(confirmError.message ?? 'Payment could not be confirmed.');
        return;
      }
      onClose({ error: { code: 'Failed', message: confirmError.message ?? 'Payment failed.' } });
      return;
    }
    onClose({});
  };

  return (
    <View style={styles.sheet} accessibilityRole="summary">
      <Text style={styles.kicker}>{merchantDisplayName}</Text>
      <Text style={styles.title}>Secure checkout</Text>
      <Text style={styles.hint}>Test mode: use card 4242 4242 4242 4242.</Text>
      <View style={styles.elementWrap}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Processing payment' : 'Pay now'}
        disabled={busy || !stripe || !elements}
        onPress={() => {
          void onSubmit();
        }}
        style={[styles.payBtn, (busy || !stripe) && styles.payBtnDisabled]}
      >
        <Text style={styles.payLabel}>{busy ? 'Processing…' : 'Pay now'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel payment"
        disabled={busy}
        onPress={() => onClose({ error: { code: 'Canceled', message: 'The payment has been canceled' } })}
        style={styles.cancelBtn}
      >
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/**
 * @purpose Register present handler and render a centered modal with Stripe Payment Element.
 * @param stripe Loaded Stripe.js instance from `loadStripe`, or null while loading.
 */
export function WebPaymentSheetHost({ stripe }: WebPaymentSheetHostProps) {
  const [sheet, setSheet] = useState<SheetState>(null);

  const finish = useCallback((result: WebPaymentSheetResult) => {
    setSheet((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    registerWebPaymentSheetHost((request) => {
      return new Promise<WebPaymentSheetResult>((resolve) => {
        setSheet({ ...request, resolve });
      });
    });
    return () => registerWebPaymentSheetHost(null);
  }, []);

  const elementsOptions = useMemo(
    () =>
      sheet
        ? {
            clientSecret: sheet.clientSecret,
            appearance: {
              theme: 'stripe' as const,
              variables: {
                colorPrimary: FOCAL.neonJade,
                borderRadius: `${radii.md}px`,
              },
            },
          }
        : undefined,
    [sheet],
  );

  return (
    <Modal
      visible={Boolean(sheet)}
      transparent
      animationType="fade"
      onRequestClose={() => finish({ error: { code: 'Canceled', message: 'The payment has been canceled' } })}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Dismiss checkout"
          onPress={() => finish({ error: { code: 'Canceled', message: 'The payment has been canceled' } })}
          style={StyleSheet.absoluteFill}
        />
        {sheet && stripe && elementsOptions ? (
          <Elements stripe={stripe} options={elementsOptions}>
            <WebPaymentSheetForm merchantDisplayName={sheet.merchantDisplayName} onClose={finish} />
          </Elements>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: KIT.heroRadius,
    padding: 20,
    gap: 10,
    ...KIT.shadowSoft,
    zIndex: 2,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  elementWrap: {
    minHeight: 120,
    marginVertical: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  payBtn: {
    minHeight: 48,
    borderRadius: KIT.controlRadius,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  payBtnDisabled: {
    opacity: 0.55,
  },
  payLabel: {
    color: colors.night,
    fontSize: 16,
    fontWeight: '800',
  },
  cancelBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
});
