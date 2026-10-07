/** Shared empty card keeps a warm Daylight welcome and actionable recovery without inventing feature content. */
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, MENU_METRICS, space } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AdminNavHref } from '@/lib/admin';
import { FOCAL } from '@/theme/motion';

type EmptyStateProps = {
  kicker?: string;
  title: string;
  lede?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Expo `/admin` desk. Only rendered for operators (`isAdmin`). */
  adminHref?: AdminNavHref;
  adminLabel?: string;
  accent?: string;
};

/**
 * @purpose Shared Daylight empty / paused card: title, supporting line, optional fan CTA, and an Expo `/admin` desk link for operators.
 * @param kicker Uppercase eyebrow (Paused, Highlights ⚡…).
 * @param title What is missing or paused.
 * @param lede One supporting sentence.
 * @param actionLabel Fan-facing button (retry, back to Home, watch Highlights).
 * @param onAction Fan CTA handler.
 * @param adminHref Expo `/admin` path. Hidden unless the signed-in user is an admin.
 * @param adminLabel Desk CTA copy (defaults to Open in Admin).
 * @param accent Kicker ink (defaults to gold).
 * @returns A mist-gold card with jade primary and gold admin actions.
 * @sideEffects `expo-router` push when an operator taps the `/admin` desk CTA.
 */
export function EmptyState({
  kicker,
  title,
  lede,
  actionLabel,
  onAction,
  adminHref,
  adminLabel = 'Open in Admin',
  accent,
}: EmptyStateProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const mark = accent ?? FOCAL.goldInk;
  const showAdmin = Boolean(isAdmin && adminHref);

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={title}>
      <MenuBackdrop accent="gold" />
      {kicker ? <Text style={[styles.kicker, { color: mark }]}>{kicker}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {lede ? <Text style={styles.lede}>{lede}</Text> : null}
      {actionLabel && onAction ? (
        <AnimatedButton
          haptic="medium"
          accessibilityLabel={actionLabel}
          contentStyle={styles.primary}
          onPress={onAction}
        >
          <Text style={styles.primaryLabel}>{actionLabel}</Text>
        </AnimatedButton>
      ) : null}
      {showAdmin ? (
        <AnimatedButton
          haptic="light"
          accessibilityLabel={adminLabel}
          contentStyle={styles.admin}
          onPress={() => router.push(adminHref as Href)}
        >
          <Text style={styles.adminLabel}>{adminLabel}</Text>
        </AnimatedButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: FOCAL.mistGold,
    borderRadius: MENU_METRICS.cardRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
    ...cardShadow,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 420,
  },
  primary: {
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  admin: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminLabel: {
    color: FOCAL.goldInk,
    fontSize: 13,
    fontWeight: '800',
  },
});
