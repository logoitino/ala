import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { exclusiveUnlockToast } from '@/data/exclusive';
import { displayValue, getTipCharge, auraPointsForTip } from '@/data/players';
import { addUserAura, emitPlayerAura, emitProfileAura } from '@/lib/aura';
import { resolveTipOrigin, type TipEntry, type TipOrigin } from '@/lib/finance';
import { createPaymentIntent, incrementBackerCount } from '@/lib/payments';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NATIVE_STRIPE_UNAVAILABLE_MESSAGE, useStripe } from '@/lib/stripe';
import { telemetry } from '@/services/TelemetryManager';
import type { Player } from '@/types/database';
import { walletPayOptions } from '@/lib/walletPay';

export const MALO_DROPPED_KEY = 'tapuai.maloDroppedCount';

type StartCheckoutArgs = {
  player?: Player | null;
  tipAmount: number;
  coverFees?: boolean;
  reelId?: string;
  /** Where the gift started. A clip id becomes `highlight` when this is omitted. */
  origin?: TipOrigin;
  /** How the fan arrived. QR gift links use `qr_link`. */
  entry?: TipEntry;
  /** `wishlist_items.id` when this Mālo funds one locker item. */
  wishlistItemId?: string;
  /** Item title or other detail analysts should see without another join. */
  sourceLabel?: string;
  /** Override Aura grant. Exclusive checkout uses 100 instead of `tipAmount * 10`. */
  auraPoints?: number;
  /** Skip `increment_backer_count` and reel-tip counters (subscribe / Drip). */
  skipBacker?: boolean;
  /** Replaces the exclusive unlock copy when `skipBacker` (Drip purchase toast). */
  successToast?: string;
  onBacked?: (nextCount: number) => void;
  onTipped?: (amountCents: number) => void;
  /** Fires immediately after PaymentSheet succeeds so exclusive tiles can unlock before RPCs. */
  onPaid?: () => void | Promise<void>;
};

/**
 * @purpose Count Mālo this device has dropped (Fan engagement on the Profile card).
 */
export async function readMaloDroppedCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(MALO_DROPPED_KEY);
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function bumpMaloDroppedCount() {
  const next = (await readMaloDroppedCount()) + 1;
  await AsyncStorage.setItem(MALO_DROPPED_KEY, String(next));
}

function applyAuraAward(
  targetId: string,
  award: { player_aura_points: number | null; profile_aura_points: number | null; aura_points: number },
) {
  if (award.profile_aura_points != null) emitProfileAura(targetId, award.profile_aura_points);
  if (award.player_aura_points != null) emitPlayerAura(targetId, award.player_aura_points);
  if (award.profile_aura_points == null && award.player_aura_points == null && award.aura_points) {
    emitProfileAura(targetId, award.aura_points);
  }
}

/**
 * @purpose Native Stripe PaymentSheet for Mālo, exclusive subscribe, Drip, or booster sponsorships. Mālo grants Aura to the tipper and the athlete.
 * @returns `{ startCheckout, busy }` — any authenticated user (including verified athletes) may tip a reel.
 * @sideEffects JWT Stripe PaymentIntent (`Authorization: Bearer` session), optional backer/reel counters, `tips` INSERT on Mālo (`origin`, `entry`, `wishlist_item_id`, `source_label`), `add_user_aura` twice on Mālo (payer-only when `skipBacker`), success haptics, celebration, `refreshProfile`, `TelemetryManager.trackCheckoutLatency`.
 */
export function useTipCheckout() {
  const { user, refreshProfile } = useAuth();
  const { live } = useAppRuntime();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const celebration = useOptionalCelebration();
  const [busy, setBusy] = useState(false);
  const feeAmount = live.catalog.maloFeeDollars;
  const exclusiveAuraToast = exclusiveUnlockToast(live.catalog.exclusiveAura);

  const startCheckout = useCallback(
    async ({
      player = null,
      tipAmount,
      coverFees = false,
      reelId,
      origin,
      entry,
      wishlistItemId,
      sourceLabel,
      auraPoints,
      skipBacker = false,
      successToast,
      onBacked,
      onTipped,
      onPaid,
    }: StartCheckoutArgs) => {
      if (busy) return;

      if (Platform.OS === 'web') {
        Alert.alert('Stripe payments', NATIVE_STRIPE_UNAVAILABLE_MESSAGE);
        return;
      }

      const playerName = player ? displayValue(player.name, 'this athlete') : "Tapua'i";
      const { amountCents } = getTipCharge(tipAmount, coverFees, feeAmount);

      setBusy(true);
      const checkoutStartedAt = Date.now();
      try {
        const intentStartedAt = Date.now();
        const clientSecret = await createPaymentIntent(amountCents, player?.id ?? null);
        telemetry.trackCheckoutLatency('payment_intent', Date.now() - intentStartedAt);

        const initStartedAt = Date.now();
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Tapua'i Sports",
          ...walletPayOptions(),
        });
        telemetry.trackCheckoutLatency('init_sheet', Date.now() - initStartedAt);

        if (initError) {
          Alert.alert('Couldn’t start PaymentSheet', initError.message);
          return;
        }

        const presentStartedAt = Date.now();
        const { error: presentError } = await presentPaymentSheet();
        telemetry.trackCheckoutLatency('present_sheet', Date.now() - presentStartedAt);
        if (presentError) {
          if (presentError.code === 'Canceled') return;
          Alert.alert('Payment failed', presentError.message);
          return;
        }

        await onPaid?.();

        const pointsToAdd = auraPoints ?? auraPointsForTip(tipAmount);
        const tipperId = user?.id ?? null;
        const recipientId = !skipBacker && player?.id ? player.id : null;

        // A compliance freeze (or any other insert-denied response) on the `tips` ledger row means
        // this athlete should see NONE of the tip's visible effects — not just a missing ledger row.
        // Insert (or skip, when there's nothing to insert) BEFORE incrementing the public backer
        // count / reel-tip total, and before awarding the recipient Aura, and gate both on it having
        // actually succeeded. `add_user_aura` / `increment_backer_count` / `increment_reel_tips` also
        // check the freeze themselves server-side (defense in depth), but ordering this correctly on
        // the client avoids firing those RPCs — and their exceptions — needlessly.
        let tipInsertSucceeded = !skipBacker && !!player;
        if (!skipBacker && player && isSupabaseConfigured) {
          // Minimal generic message for an insert-denied response (e.g. a compliance freeze) — the
          // policy itself does the real gating server-side, this just tells the fan something.
          const ledger = {
            player_id: player.id,
            amount_cents: Math.round(tipAmount * 100),
            fan_id: tipperId,
            reel_id: reelId ?? null,
            aura_points: pointsToAdd,
            origin: resolveTipOrigin({ origin, reelId, wishlistItemId }),
            entry: entry ?? 'in_app',
            wishlist_item_id: wishlistItemId ?? null,
            source_label: sourceLabel?.trim() ?? '',
          };
          let { error: tipError } = await supabase.from('tips').insert(ledger);
          const missingChannel =
            tipError?.code === '42703' ||
            /origin|entry|wishlist_item_id|source_label/i.test(tipError?.message ?? '');
          if (tipError && missingChannel) {
            const retry = await supabase.from('tips').insert({
              player_id: ledger.player_id,
              amount_cents: ledger.amount_cents,
              fan_id: ledger.fan_id,
              reel_id: ledger.reel_id,
              aura_points: ledger.aura_points,
            });
            tipError = retry.error;
          }
          if (tipError) {
            tipInsertSucceeded = false;
            Alert.alert(
              'Donation not recorded',
              'Your payment went through, but this athlete cannot currently receive donations. Contact support if this seems wrong.',
            );
          }
        }

        let nextCount = player?.backer_count ?? 0;
        if (!skipBacker && player && tipInsertSucceeded) {
          nextCount = await incrementBackerCount(player);
          onBacked?.(nextCount);
          onTipped?.(amountCents);
          if (reelId) {
            const { addReelTips, EMPTY_REEL_HYPE } = await import('@/lib/reels');
            await addReelTips(reelId, amountCents, EMPTY_REEL_HYPE);
          }
          await bumpMaloDroppedCount();
        }

        if (isSupabaseConfigured && pointsToAdd > 0) {
          if (tipperId) {
            const tipperAward = await addUserAura(tipperId, pointsToAdd);
            applyAuraAward(tipperId, tipperAward);
          }
          if (recipientId && recipientId !== tipperId && tipInsertSucceeded) {
            const athleteAward = await addUserAura(recipientId, pointsToAdd);
            applyAuraAward(recipientId, athleteAward);
          }
          await refreshProfile();
        }

        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Simulator / web may not expose haptics.
        }

        if (successToast) {
          celebration?.celebrateAura(pointsToAdd, successToast);
        } else if (skipBacker) {
          celebration?.celebrateAura(pointsToAdd, exclusiveAuraToast);
        } else {
          celebration?.celebrate({ playerName, backerCount: nextCount, auraPointsEarned: pointsToAdd });
        }
        telemetry.trackCheckoutLatency('total', Date.now() - checkoutStartedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        Alert.alert('Payment failed', message);
        telemetry.trackIssue('checkout');
      } finally {
        setBusy(false);
      }
    },
    [busy, celebration, exclusiveAuraToast, feeAmount, initPaymentSheet, presentPaymentSheet, refreshProfile, user?.id],
  );

  return { startCheckout, busy };
}
