/**
 * Shared, wrapping page hierarchy keeps published Look-desk copy and colors authoritative.
 * UX-08: the viewer's sport (generic field for non-athletes) fades in behind the right side of every heading.
 */
import { StyleSheet, Text, View } from 'react-native';

import { SportField } from '@/components/Effects/SportField';
import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useViewerSport } from '@/hooks/useViewerSport';
import { FOCAL } from '@/theme/motion';

type ScreenHeadingProps = {
  kicker?: string;
  title: string;
  lede?: string;
  compact?: boolean;
  /** Override the gold kicker / underline (e.g. Local cyan). Defaults to Look-desk gold. */
  accent?: string;
};

/**
 * @purpose Shared light-tab hero: gold (or accent) kicker + title + gold underline so every fan tab shares one eye-catching scheme.
 * @param kicker Uppercase eyebrow (Friday Night, Island Drip…).
 * @param title Screen name.
 * @param lede Supporting sentence under the rule.
 * @param compact Tighter Profile / Drip / Local chrome.
 * @param accent Optional ink for kicker + underline when a tab wants its own hint (cyan / ember / violet).
 */
export function ScreenHeading({ kicker, title, lede, compact = false, accent }: ScreenHeadingProps) {
  const { live } = useAppRuntime();
  const mark = accent ?? live.theme.gold ?? FOCAL.goldInk;
  const sport = useViewerSport();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {/* Field lines stay on the right and fade in, so the title always sits on clear ground. */}
      <View pointerEvents="none" style={styles.field}>
        <SportField sport={sport} fade="left" labels={false} opacity={0.11} />
      </View>
      {kicker ? (
        <View style={styles.kickerRow}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.accentDot, { backgroundColor: mark }]} />
          <Text style={[styles.kicker, compact && styles.kickerCompact, { color: mark }]}>{kicker}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact, { color: live.theme.text }]}>{title}</Text>
      {compact ? null : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.underline, { backgroundColor: mark }]} />}
      {lede ? <Text style={[styles.lede, compact && styles.ledeCompact]}>{lede}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  accentDot: { width: 6, height: 6, borderRadius: 3 },
  field: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: '38%',
    overflow: 'hidden',
    borderRadius: 14,
  },
  wrap: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  wrapCompact: {
    gap: 5,
    paddingTop: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.gold,
    flexShrink: 1,
  },
  kickerCompact: {
    fontSize: 10,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  titleCompact: {
    fontSize: 26,
    letterSpacing: -0.3,
  },
  underline: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.electricGold,
    marginTop: 4,
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textMuted,
  },
  ledeCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
});
