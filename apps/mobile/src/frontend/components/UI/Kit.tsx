/**
 * Shared action kit from the 2026-11 Lovable design refresh: one button family, filter chips, status badges and the
 * LIVE pill, so screens stop hand-rolling full-width pills. Built on `AnimatedButton` (spring + haptics + Reduce
 * Motion) and the Daylight tokens; it changes no copy, actions or business rules.
 */
import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, KIT, radii } from '@/constants/theme';
import type { PressHaptic } from '@/lib/haptics';
import { FOCAL } from '@/theme/motion';
import { figtree } from '@/theme/fonts';

export type KitButtonVariant = 'primary' | 'secondary' | 'tint' | 'ghost' | 'destructive' | 'gold' | 'glass' | 'light';
export type KitButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BOX: Record<KitButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tint: { backgroundColor: colors.accentSoft },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: FOCAL.emberInk },
  gold: { backgroundColor: colors.electricGold },
  glass: { backgroundColor: 'rgba(244,247,245,0.15)', borderWidth: 1, borderColor: 'rgba(244,247,245,0.22)' },
  light: { backgroundColor: colors.onVideo },
};

const BUTTON_INK: Record<KitButtonVariant, string> = {
  primary: colors.onAccent,
  secondary: colors.text,
  tint: colors.primary,
  ghost: colors.primary,
  destructive: '#FFFFFF',
  gold: colors.night,
  glass: colors.onVideo,
  light: colors.night,
};

const BUTTON_SIZE: Record<KitButtonSize, { box: ViewStyle; label: TextStyle }> = {
  sm: { box: { minHeight: 36, paddingHorizontal: 12, borderRadius: radii.sm }, label: { fontSize: 14 } },
  md: { box: { minHeight: 44, paddingHorizontal: 16, borderRadius: KIT.controlRadius }, label: { fontSize: 15 } },
  lg: { box: { minHeight: 52, paddingHorizontal: 20, borderRadius: KIT.controlRadius }, label: { fontSize: 16 } },
};

/**
 * @purpose One button for every screen: pick a variant by role (primary action, secondary, quiet ghost link, gold
 *   award/unlock, glass/light over video) instead of styling each Pressable by hand. `md` and `lg` keep the 44pt
 *   touch target; `sm` is only for dense rows that already sit inside a 44pt row.
 */
export function KitButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  icon,
  haptic = 'light',
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: KitButtonVariant;
  size?: KitButtonSize;
  block?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  haptic?: PressHaptic;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const sized = BUTTON_SIZE[size];
  return (
    <AnimatedButton
      accessibilityLabel={accessibilityLabel ?? label}
      haptic={haptic}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[block && styles.block, style]}
      contentStyle={[
        styles.button,
        sized.box,
        BUTTON_BOX[variant],
        (variant === 'primary' || variant === 'gold') && KIT.shadowSoft,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.buttonLabel, sized.label, { color: BUTTON_INK[variant] }]}>{label}</Text>
    </AnimatedButton>
  );
}

/**
 * @purpose Filter / choice chip (For You · All, gift amounts, tip choices). `dark` is for chips over video.
 */
export function KitChip({
  label,
  active = false,
  dark = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  dark?: boolean;
  onPress?: () => void;
}) {
  const box: ViewStyle = dark
    ? active
      ? { backgroundColor: colors.onVideo, borderColor: colors.onVideo }
      : { backgroundColor: 'rgba(244,247,245,0.10)', borderColor: 'rgba(244,247,245,0.22)' }
    : active
      ? { backgroundColor: colors.text, borderColor: colors.text }
      : { backgroundColor: colors.surface, borderColor: colors.border };
  const ink = dark ? (active ? colors.night : colors.onVideo) : active ? colors.background : colors.text;
  return (
    <AnimatedButton
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      contentStyle={[styles.chip, box]}
    >
      <Text style={[styles.chipLabel, { color: ink }]}>{label}</Text>
    </AnimatedButton>
  );
}

export type KitBadgeTone = 'jade' | 'gold' | 'ember' | 'danger' | 'warn' | 'neutral' | 'dark';

const BADGE: Record<KitBadgeTone, { bg: string; ink: string }> = {
  jade: { bg: colors.accentSoft, ink: colors.primary },
  gold: { bg: colors.goldSoft, ink: colors.gold },
  ember: { bg: colors.ember, ink: '#FFFFFF' },
  danger: { bg: colors.emberSoft, ink: colors.danger },
  warn: { bg: KIT.warnSoft, ink: KIT.warnInk },
  neutral: { bg: FOCAL.mistSlate, ink: colors.textMuted },
  dark: { bg: 'rgba(14,19,21,0.70)', ink: colors.onVideo },
};

/** @purpose Small status pill (Unlocked, Class of '26, Failed / Check). Text always sits on its own fill. */
export function KitBadge({ label, tone = 'neutral', style }: { label: string; tone?: KitBadgeTone; style?: StyleProp<ViewStyle> }) {
  const t = BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.badgeLabel, { color: t.ink }]}>{label}</Text>
    </View>
  );
}

/** @purpose Ember LIVE pill; ember stays reserved for live and danger. */
export function LivePill() {
  return (
    <View style={[styles.badge, { backgroundColor: colors.ember }]} accessibilityLabel="Live">
      <View style={styles.liveDot} />
      <Text style={[styles.badgeLabel, styles.liveLabel]}>LIVE</Text>
    </View>
  );
}

/** @purpose Rounded progress bar; `dark` swaps to the neon glow fill for video and obsidian cards. */
export function KitProgress({ value, dark = false }: { value: number; dark?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, { backgroundColor: dark ? 'rgba(244,247,245,0.15)' : FOCAL.mistSlate }]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: dark ? colors.glow : colors.primaryMuted }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonLabel: { ...figtree('700'), letterSpacing: -0.1 },
  disabled: { opacity: 0.4 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { ...figtree('600'), fontSize: 14 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  badgeLabel: { ...figtree('700'), fontSize: 12, letterSpacing: 0.3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveLabel: { color: '#FFFFFF' },
  track: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
});
