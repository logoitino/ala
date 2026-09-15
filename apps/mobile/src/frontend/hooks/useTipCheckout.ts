import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { exclusiveUnlockToast } from '@/data/exclusive';
import { displayValue, getTipCharge, auraPointsForTip } from '@/data/players';
import { addUserAura, emitPlayerAura, emitProfileAura } from '@/lib/aura';
import { createPaymentIntent, incrementBackerCount } from '@/lib/payments';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NATIVE_STRIPE_UNAVAILABLE_MESSAGE, useStripe } from '@/lib/stripe';
import { telemetry } from '@/services/TelemetryManager';
import type { Player } from '@/types/database';

export const MALO_DROPPED_KEY = 'tapuai.maloDroppedCount';

type StartCheckoutArgs = {
  player?: Player | null;
  tipAmount: number;
  coverFees?: boolean;
  reelId?: string;
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
 * @purpose Live Auth user id at call time (Soft-Wall resume may invoke a pre-login `startCheckout` closure).
 */
async function resolveFanId(fallback: string | null): Promise<string | null> {
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id) return data.session.user.id;
  }
  return fallback;
}

/**
 * @purpose Native Stripe PaymentSheet for Mālo, exclusive subscribe, Drip, or booster sponsorships. Mālo grants Aura to the tipper and the athlete.
 * @returns `{ startCheckout, busy }` — any authenticated user (including verified athletes) may tip a reel.
 * @sideEffects JWT Stripe PaymentIntent (`Authorization: Bearer` session), optional backer/reel counters, `tips` INSERT on Mālo, `add_user_aura` twice on Mālo (payer-only when `skipBacker`), success haptics, celebration, `refreshProfile`, `TelemetryManager.trackCheckoutLatency`. Fan id is resolved from the live session so Soft-Wall resume after guest sign-in still writes `tips.fan_id` and payer Aura.
 */
export function useTipCheckout() {
  const { user, refreshProfile } = useAuth();
  const { live } = useAppRuntime();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const celebration = useOptionalCelebration();
  const [busy, setBusy] = useState(false);
  const feeAmount = live.catalog.maloFeeDollars;
  const exclusiveAuraToast = exclusiveUnlockToast(live.catalog.exclusiveAura);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;
  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  const startCheckout = useCallback(
    async ({
      player = null,
      tipAmount,
      coverFees = false,
      reelId,
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
        const clientSecret = await createPaymentIntent(amountCents);
        telemetry.trackCheckoutLatency('payment_intent', Date.now() - intentStartedAt);

        const initStartedAt = Date.now();
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Tapua'i Sports",
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

        const nextCount =
          skipBacker || !player ? (player?.backer_count ?? 0) : await incrementBackerCount(player);
        if (!skipBacker && player) {
          onBacked?.(nextCount);
          onTipped?.(amountCents);
          if (reelId) {
            const { addReelTips, EMPTY_REEL_HYPE } = await import('@/lib/reels');
            await addReelTips(reelId, amountCents, EMPTY_REEL_HYPE);
          }
          await bumpMaloDroppedCount();
        }

        const pointsToAdd = auraPoints ?? auraPointsForTip(tipAmount);
        const tipperId = await resolveFanId(userIdRef.current);
        const recipientId = !skipBacker && player?.id ? player.id : null;

        if (!skipBacker && player && isSupabaseConfigured) {
          await supabase.from('tips').insert({
            player_id: player.id,
            amount_cents: Math.round(tipAmount * 100),
            fan_id: tipperId,
            reel_id: reelId ?? null,
            aura_points: pointsToAdd,
          });
        }

        if (isSupabaseConfigured && pointsToAdd > 0) {
          if (tipperId) {
            const tipperAward = await addUserAura(tipperId, pointsToAdd);
            applyAuraAward(tipperId, tipperAward);
          }
          if (recipientId && recipientId !== tipperId) {
            const athleteAward = await addUserAura(recipientId, pointsToAdd);
            applyAuraAward(recipientId, athleteAward);
          }
          await refreshProfileRef.current();
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
    [busy, celebration, exclusiveAuraToast, feeAmount, initPaymentSheet, presentPaymentSheet],
  );

  return { startCheckout, busy };
}
