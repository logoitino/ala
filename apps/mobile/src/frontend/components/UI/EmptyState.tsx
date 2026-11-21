/** UX-13 readable shared type preserves every action and required notice. Readable recovery cards preserve truthful copy and fan/admin action boundaries; compact fan cards retain full text and targets. */
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SportField } from '@/components/Effects/SportField';
import { MenuBackdrop, type MenuAccent } from '@/components/UI/MenuChrome';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, MENU_METRICS, space } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useViewerSport } from '@/hooks/useViewerSport';
import type { AdminNavHref } from '@/lib/admin';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

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
  /** Fan pages recover space while operator recovery cards keep their existing hierarchy. */
  compact?: boolean;
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
  compact = false,
}: EmptyStateProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const mark = accent ?? FOCAL.goldInk;
  const showAdmin = Boolean(isAdmin && adminHref);
  const sport = useViewerSport();
  const mist = Object.values(TAB_ACCENTS).find(value => value.color === mark)?.mist ?? FOCAL.mistGold;
  const tone: MenuAccent = !compact ? 'gold' : mark === FOCAL.violetInk ? 'violet' : mark === FOCAL.cyanInk ? 'cyan' : mark === FOCAL.emberInk ? 'ember' : mark === FOCAL.jadeInk ? 'jade' : 'gold';

  return (
    <View style={[styles.card, compact && styles.compactCard, compact && { backgroundColor: mist }]} accessibilityRole="summary" accessibilityLabel={title}>
      <MenuBackdrop accent={tone} />
      {/* An empty page is still game day: the viewer's field, faint, in the card's own gold ink. */}
      <SportField sport={sport} color={mark} labels={false} opacity={0.08} />
      {kicker ? <Text style={[styles.kicker, { color: mark }]}>{kicker}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      {lede ? <Text style={[styles.lede, compact && styles.compactLede]}>{lede}</Text> : null}
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
  compactCard: { padding: 12, gap: 8, borderRadius: 16 },
  compactTitle: { ...figtree('400'), ...TYPE.body },
  compactLede: { ...figtree('400'), ...TYPE.body,  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: FOCAL.mistGold,
    borderRadius: MENU_METRICS.cardRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'flex-start',
    ...cardShadow,
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
    textAlign: 'left',
    letterSpacing: -0.2,
  },
  lede: {
    color: colors.textMuted,
    ...TYPE.body,

    ...figtree('600'),
    textAlign: 'left',
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
    ...TYPE.body,
    ...figtree('800'),
  },
  admin: {
    minHeight: MENU_METRICS.touchTarget,
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
    ...TYPE.body,
    ...figtree('800'),
  },
});
