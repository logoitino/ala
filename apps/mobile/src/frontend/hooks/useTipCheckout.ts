/**
 * Gift checkout: opens native Stripe PaymentSheet for a gift, one-time Exclusive purchase, Drip order or
 * booster sponsorship purchase, then records the result. Gifts retain existing giver/athlete Aura; counsel must review digital consideration.
 * Code names keep `tip` / `malo`; on-screen words follow docs/product/VOICE.md. Needs a dev or preview build, not Expo Go.
 * @sideEffects Edge Function `create-payment-intent` (Metro route as fallback), Stripe PaymentSheet, inserts into `tips`.
 */

import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { exclusiveUnlockToast } from '@/data/exclusive';
import { platformTipCentsFor } from '@/data/malo';
import { displayValue, getTipCharge, auraPointsForTip } from '@/data/players';
import { addUserAura, emitPlayerAura, emitProfileAura } from '@/lib/aura';
import { paymentIntentIdFromSecret, resolveTipOrigin, type TipEntry, type TipOrigin } from '@/lib/finance';
import { createPaymentIntent, incrementBackerCount } from '@/lib/payments';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { resolveSessionUserId } from '@/lib/sessionToken';
import { NATIVE_STRIPE_UNAVAILABLE_MESSAGE, useStripe } from '@/lib/stripe';
import { supportSignals } from '@/services/SupportSignalManager';
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
  /** `wishlist_items.id` when this gift supports one locker item. */
  wishlistItemId?: string;
  /** `rallies.id` when this gift counts toward the athlete's Rally goal. The server re-checks it. */
  rallyId?: string;
  /** Optional tip to Tapua'i as a percent of the gift (0 = none). Charged on top, never counted as the gift. */
  platformTipPercent?: number;
  /** Item title or other detail analysts should see without another join. */
  sourceLabel?: string;
  /** Final screen cents; a changed quote requires another review before charging. */
  reviewedTotalCents?: number;
  reviewedFeeCents?: number;
  /** Override Aura grant. Exclusive checkout uses 100 instead of `tipAmount * 10`. */
  auraPoints?: number;
  /** Skip `increment_backer_count` and reel-tip counters (purchases / Drip). */
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
 * @purpose Native Stripe PaymentSheet for gifts, exclusive purchase, Drip, or booster sponsorships. Gifts retain Aura for the giver and the athlete.
 * @returns `{ startCheckout, busy }` — any authenticated user (including verified athletes) may give to a tagged athlete.
 * @sideEffects JWT Stripe PaymentIntent (`Authorization: Bearer` session), optional backer/reel counters, `tips` INSERT on a gift (`origin`, `entry`, `wishlist_item_id`, `source_label`, `platform_tip_cents`, `rally_id`, `cover_fee_cents`, `stripe_payment_intent_id`), `add_user_aura` twice on Mālo (payer-only when `skipBacker`), success haptics, celebration, `refreshProfile`, `TelemetryManager.trackCheckoutLatency`. Fan id is resolved from the live session so Soft-Wall resume still writes `tips.fan_id` and payer Aura.
 */
export function useTipCheckout() {
  const { user, refreshProfile } = useAuth();
  const { live } = useAppRuntime();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const celebration = useOptionalCelebration();
  const [busy, setBusy] = useState(false);
  // State updates alone do not exclude two calls in the same render.
  const checkoutRef = useRef(false);
  const enabledRef = useRef(false);
  enabledRef.current = live.buttons?.MONETIZATION_TIPS_ENABLED === true;
  const feeAmount = live.catalog.maloFeeDollars;
  const exclusiveAuraToast = exclusiveUnlockToast(live.catalog.exclusiveAura);
  // Soft-Wall stashes `resume` before sign-in; read the live id, not a closed-over null.
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
      origin,
      entry,
      wishlistItemId,
      rallyId,
      platformTipPercent = 0,
      sourceLabel,
      reviewedTotalCents,
      reviewedFeeCents,
      auraPoints,
      skipBacker = false,
      successToast,
      onBacked,
      onTipped,
      onPaid,
    }: StartCheckoutArgs) => {
      if (checkoutRef.current || busy) return;

      if (Platform.OS === 'web') {
        Alert.alert('Stripe payments', NATIVE_STRIPE_UNAVAILABLE_MESSAGE);
        return;
      }

      const isGift = !skipBacker && !!player;
      const pointsToAdd = auraPoints ?? auraPointsForTip(tipAmount);
      const giftCents = Math.round(tipAmount * 100);
      // Reject ledger-bound values before creating a charge; existing database caps remain authoritative.
      if (isGift && (!Number.isFinite(tipAmount) || giftCents < 100 || giftCents > 100000 ||
        !Number.isInteger(pointsToAdd) || pointsToAdd < 0 || pointsToAdd > 10000 ||
        !Number.isFinite(platformTipPercent) || platformTipPercent < 0 || platformTipPercent > 100 ||
        (entry != null && !['in_app', 'qr_link'].includes(entry)) ||
        (origin != null && !['highlight', 'qr', 'wishlist', 'profile', 'live', 'rally'].includes(origin)))) {
        Alert.alert('Review your gift', 'Choose a gift from $1 to $1,000 with valid gift options.');
        return;
      }
      if (isGift && (coverFees || platformTipPercent > 0) && !enabledRef.current) {
        Alert.alert('Review your gift', 'Optional extras are unavailable. Review your gift without extras before continuing.');
        return;
      }
      const coveredCents = coverFees ? Math.round(feeAmount * 100) : 0;
      if (isGift && (!Number.isSafeInteger(coveredCents) || coveredCents < 0 || coveredCents > Math.max(500, giftCents))) {
        Alert.alert('Review your gift', 'Processing-fee coverage is unavailable. Review your gift without coverage.');
        return;
      }

      const playerName = player ? displayValue(player.name, 'this athlete') : "Tapua'i";
      const { amountCents: donationChargeCents } = getTipCharge(tipAmount, coverFees, feeAmount);
      // Only a gift to an athlete carries the optional Tapua'i tip (separate from Drip / Exclusive / booster purchases).
      const platformTipCents = !skipBacker && player ? platformTipCentsFor(tipAmount, platformTipPercent) : 0;
      const amountCents = donationChargeCents + platformTipCents;
      if (isGift && ((reviewedTotalCents != null && reviewedTotalCents !== amountCents) ||
        (reviewedFeeCents != null && reviewedFeeCents !== coveredCents))) {
        Alert.alert('Review your gift', 'The checkout amount changed. Review the current total before continuing.');
        return;
      }

      checkoutRef.current = true;
      setBusy(true);
      let paymentSucceeded = false;
      const checkoutStartedAt = Date.now();
      try {
        const intentStartedAt = Date.now();
        // skipBacker marks the existing Vault/Exclusive/Drip/sponsorship purchase paths. It cannot provide gift receipt authority.
        const clientSecret = await createPaymentIntent(amountCents, player?.id ?? null, platformTipCents,
          !skipBacker && player ? { giftCents: Math.round(tipAmount * 100), coverFees, platformTipPercent } : undefined);
        telemetry.trackCheckoutLatency('payment_intent', Date.now() - intentStartedAt);

        const initStartedAt = Date.now();
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Tapua'i Sports",
          ...walletPayOptions(),
        });
        telemetry.trackCheckoutLatency('init_sheet', Date.now() - initStartedAt);

        if (initError) {
          supportSignals.capture({ feature: 'donation', code: 'payment_failed' });
          Alert.alert('Couldn’t start PaymentSheet', initError.message);
          return;
        }

        const presentStartedAt = Date.now();
        const { error: presentError } = await presentPaymentSheet();
        telemetry.trackCheckoutLatency('present_sheet', Date.now() - presentStartedAt);
        if (presentError) {
          if (presentError.code === 'Canceled') { supportSignals.capture({ feature: 'donation', code: 'user_cancelled' }); return; }
          supportSignals.capture({ feature: 'donation', code: 'payment_failed' });
          Alert.alert('Payment failed', presentError.message);
          return;
        }

        paymentSucceeded = true;
        await onPaid?.();

        const tipperId = await resolveSessionUserId(userIdRef.current);
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
            origin: resolveTipOrigin({ origin, reelId, wishlistItemId, rallyId }),
            entry: entry ?? 'in_app',
            wishlist_item_id: wishlistItemId ?? null,
            source_label: sourceLabel?.trim() ?? '',
            platform_tip_cents: platformTipCents,
            rally_id: rallyId ?? null,
          };
          // BOOKS-01: the covered card fee and the PaymentIntent id let the books match Stripe deposits.
          const bookkeeping = {
            cover_fee_cents: Math.max(0, donationChargeCents - Math.round(tipAmount * 100)),
            stripe_payment_intent_id: paymentIntentIdFromSecret(clientSecret),
          };
          // A paid allocation is immutable. Legacy retries that dropped fees, tips or the real
          // payment reference could lose reconciliation/dedupe authority, even for a base gift.
          const { error: tipError } = await supabase.from('tips').insert({ ...ledger, ...bookkeeping });
          if (tipError) {
            supportSignals.capture({ feature: 'donation', code: 'data_invalid' });
            tipInsertSucceeded = false;
            Alert.alert(
              'Gift not recorded',
              'Your payment went through, but we could not record this gift. Contact support before paying again.',
            );
          }
        }

        let nextCount = player?.backer_count ?? 0;
        if (!skipBacker && player && tipInsertSucceeded) {
          nextCount = await incrementBackerCount(player);
          onBacked?.(nextCount);
          // Gift counters exclude separately added processing coverage and Tapua'i tips.
          onTipped?.(giftCents);
          if (reelId) {
            const { addReelTips, EMPTY_REEL_HYPE } = await import('@/lib/reels');
            await addReelTips(reelId, giftCents, EMPTY_REEL_HYPE);
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
        // Recording and Aura can fail after Stripe has charged; another payment is not a retry.
        Alert.alert(paymentSucceeded ? 'Payment received — follow-up needed' : 'Payment failed',
          paymentSucceeded ? 'Your payment went through, but we could not finish updating your gift. Contact support before paying again.' : message);
        telemetry.trackIssue('checkout');
        supportSignals.capture({ feature: 'donation', code: paymentSucceeded ? 'data_invalid' : 'payment_failed' });
      } finally {
        checkoutRef.current = false;
        setBusy(false);
      }
    },
    [busy, celebration, exclusiveAuraToast, feeAmount, initPaymentSheet, presentPaymentSheet],
  );

  return { startCheckout, busy };
}
