import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { FeeCheckbox } from '@/components/FeeCheckbox';
import { TipButton } from '@/components/TipButton';
import { colors, radii } from '@/constants/theme';
import { COMPLIANCE_PAYMENT, GIFT_RECORD_NOTICE } from '@/data/legal';
import {
  PLATFORM_TIP_HINT,
  PLATFORM_TIP_PERCENTS,
  PLATFORM_TIP_TITLE,
  donationBreakdownLine,
  donationSplitLine,
  donationWhereItGoes,
  platformTipChipLabel,
} from '@/data/malo';
import { AURA_PER_DOLLAR, MALO_DISCLAIMER, auraPointsForTip, displayValue, type Player } from '@/data/players';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import type { TipEntry, TipOrigin } from '@/lib/finance';
import { SPRING_BOUNCE } from '@/theme/motion';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

type TipCheckoutProps = {
  player: Player;
  compact?: boolean;
  hideHeader?: boolean;
  reelId?: string;
  origin?: TipOrigin;
  entry?: TipEntry;
  wishlistItemId?: string;
  /** `rallies.id` when this donation counts toward a Rally goal. */
  rallyId?: string;
  sourceLabel?: string;
  onBacked?: (nextCount: number) => void;
  onTipped?: (amountCents: number) => void;
  onBusyChange?: (busy: boolean) => void;
};

function parseCustomTip(value: string): number | null {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount < 1) return null;
  return Math.round(amount * 100) / 100;
}

/**
 * @purpose Donation amount picker ($5 / $10 / $25 / Custom) wired to Stripe PaymentSheet. Header names the
 *   athlete who receives the gift (not the uploader); the split (90% family / 10% Tapua'i) is shown before
 *   any amount, with an optional tip to Tapua'i (default none) and a live "you pay" breakdown.
 * @param onBusyChange Lets the tip sheet lock Close/backdrop while PaymentSheet is presenting.
 * @sideEffects `useTipCheckout` → PaymentIntent, optional backer/reel counters, `add_user_aura`.
 */
export function TipCheckout({
  player,
  compact = false,
  hideHeader = false,
  reelId,
  origin,
  entry,
  wishlistItemId,
  rallyId,
  sourceLabel,
  onBacked,
  onTipped,
  onBusyChange,
}: TipCheckoutProps) {
  // Both extras for Tapua'i start off: the donor opts in (LEGAL row R — no pre-checked add-ons).
  const [coverFees, setCoverFees] = useState(false);
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const { startCheckout, busy } = useTipCheckout();
  const { live } = useAppRuntime();
  const tipAmounts = live.catalog.maloAmounts.length > 0 ? live.catalog.maloAmounts : [5, 10, 25];
  const playerName = displayValue(player.name, 'this athlete');
  const customAmount = useMemo(() => parseCustomTip(customValue), [customValue]);
  const customAura = customAmount != null ? auraPointsForTip(customAmount) : null;
  const exampleAmount = customOpen && customAmount != null ? customAmount : (tipAmounts[1] ?? tipAmounts[0] ?? 10);
  const breakdown = donationBreakdownLine({
    athleteName: playerName,
    donationDollars: exampleAmount,
    feeDollars: coverFees ? live.catalog.maloFeeDollars : 0,
    tipPercent,
  });
  const auraBump = useSharedValue(1);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (customAura == null) return;
    auraBump.value = withSequence(withSpring(1.12, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
    // Bump reacts to the derived aura total, not the shared value itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customAura]);

  const auraBumpStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraBump.value }],
  }));

  const pay = (tipAmount: number) => {
    void startCheckout({
      player,
      tipAmount,
      coverFees,
      reelId,
      origin,
      entry,
      wishlistItemId,
      rallyId,
      sourceLabel,
      platformTipPercent: tipPercent,
      onBacked,
      onTipped,
    });
  };

  return (
    <View style={[styles.section, compact && styles.compact]}>
      {!compact && !hideHeader ? (
        <View style={styles.header}>
          <Text style={styles.title}>Donate to {playerName}</Text>
          <Text style={styles.subtitle}>
            {donationWhereItGoes(playerName)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.split}>{donationSplitLine(playerName)}</Text>

      <Text style={styles.auraHint}>
        You and {playerName} each earn {AURA_PER_DOLLAR} Aura Points per $1 ⚡
      </Text>

      <View style={styles.tipRow}>
        {tipAmounts.map((amount) => (
          <TipButton
            key={amount}
            amount={amount}
            disabled={busy}
            onPress={() => {
              setCustomOpen(false);
              pay(amount);
            }}
          />
        ))}
        <TipButton
          label="Custom"
          sublabel={customAura != null ? `+${customAura} Aura Points ⚡` : 'Enter amount'}
          disabled={busy}
          selected={customOpen}
          onPress={() => setCustomOpen(true)}
        />
      </View>

      {customOpen ? (
        <View style={styles.customBlock}>
          <TextInput
            accessibilityLabel="Custom donation amount"
            editable={!busy}
            keyboardType="decimal-pad"
            onChangeText={setCustomValue}
            placeholder="Enter amount"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={styles.input}
            value={customValue}
          />
          <Animated.Text style={[styles.customAura, auraBumpStyle]}>
            {customAura != null
              ? `+${customAura} Aura Points Earned! ⚡`
              : 'Minimum $1.00'}
          </Animated.Text>
          <TipButton
            amount={customAmount ?? undefined}
            label={customAmount != null ? `Donate $${customAmount}` : 'Donate a custom amount'}
            sublabel={customAura != null ? `+${customAura} Aura Points ⚡` : 'Enter a valid amount'}
            disabled={busy || customAmount == null}
            wide
            onPress={() => {
              if (customAmount == null) return;
              pay(customAmount);
            }}
          />
        </View>
      ) : null}

      <View style={styles.tipBlock}>
        <Text style={styles.tipTitle}>{PLATFORM_TIP_TITLE}</Text>
        <View style={styles.tipChips} accessibilityRole="radiogroup">
          {PLATFORM_TIP_PERCENTS.map((percent) => {
            const selected = tipPercent === percent;
            return (
              <Pressable
                key={percent}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: busy }}
                disabled={busy}
                onPress={() => setTipPercent(percent)}
                style={[styles.tipChip, selected && styles.tipChipOn]}
              >
                <Text style={[styles.tipChipText, selected && styles.tipChipTextOn]}>
                  {platformTipChipLabel(percent)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>{PLATFORM_TIP_HINT}</Text>
      </View>

      <FeeCheckbox playerName={playerName} checked={coverFees} onChange={setCoverFees} />

      <Text style={styles.breakdown}>{breakdown}</Text>

      <Text style={styles.disclaimer}>{MALO_DISCLAIMER}</Text>
      <Text style={styles.disclaimer}>{COMPLIANCE_PAYMENT}</Text>
      <Text style={styles.disclaimer}>{GIFT_RECORD_NOTICE}</Text>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.deepGreen} />
          <Text style={styles.busyText}>Opening PaymentSheet…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  compact: {
    gap: 10,
    marginTop: 4,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  split: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.text,
  },
  tipBlock: {
    gap: 8,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  tipChips: {
    flexDirection: 'row',
    gap: 8,
  },
  tipChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipChipOn: {
    borderColor: colors.deepGreen,
    backgroundColor: colors.accentSoft,
  },
  tipChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tipChipTextOn: {
    color: colors.deepGreen,
    fontWeight: '800',
  },
  breakdown: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: colors.text,
  },
  auraHint: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  tipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customBlock: {
    gap: 8,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 14,
  },
  customAura: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
