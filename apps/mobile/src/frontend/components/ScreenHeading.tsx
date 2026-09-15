import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
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
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {kicker ? (
        <Text style={[styles.kicker, compact && styles.kickerCompact, { color: mark }]}>{kicker}</Text>
      ) : null}
      <Text style={[styles.title, compact && styles.titleCompact, { color: live.theme.text }]}>{title}</Text>
      {compact ? null : <View style={[styles.underline, { backgroundColor: mark }]} />}
      {lede ? <Text style={[styles.lede, compact && styles.ledeCompact]}>{lede}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  wrapCompact: {
    gap: 2,
    paddingTop: 2,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.gold,
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
    fontSize: 18,
    letterSpacing: -0.2,
  },
  underline: {
    width: 48,
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
    fontSize: 12,
    lineHeight: 16,
  },
});
