/**
 * Shared, wrapping page hierarchy keeps published Look-desk copy and colors authoritative.
 * UX-08: the viewer's sport (generic field for non-athletes) fades in behind the right side of every heading.
 * UX-10: compact fan headings use a sport mark and an ink-on-mist kicker; role headings keep their sizing.
 */
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';

import { SportField } from '@/components/Effects/SportField';
import { SportIcon } from '@/components/UI/SportIcon';
import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useViewerSport } from '@/hooks/useViewerSport';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import { MoreText } from '@/components/UI/MoreText';

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
  const path = usePathname();
  const fan = !/^\/(operator|parent|athlete|booster|sponsor|admin)(\/|$)/.test(path ?? '');
  const mist = Object.values(TAB_ACCENTS).find(value => value.color === mark)?.mist ?? FOCAL.mistGold;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, fan && styles.fanWrap]}>
      {/* Field lines stay on the right and fade in, so the title always sits on clear ground. */}
      <View pointerEvents="none" style={styles.field}>
        <SportField sport={sport} fade="left" labels={false} opacity={0.11} />
      </View>
      {kicker ? (
        <View style={[styles.kickerRow, fan && styles.fanKickerBadge, fan && { backgroundColor: mist }]}>
          {fan ? <SportIcon sport={sport} color={mark} size={16} /> : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.accentDot, { backgroundColor: mark }]} />}
          <Text style={[styles.kicker, compact && styles.kickerCompact, { color: mark }]}>{kicker}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact, fan && styles.fanTitle, { color: live.theme.text }]}>{title}</Text>
      {compact ? null : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.underline, { backgroundColor: mark }]} />}
      {/* Fan ledes may collapse to two lines with More. Role homes (parent, booster, operator…) keep admin-edited
          ledes fully visible: they can mention consent or payouts, which must never sit behind More. */}
      {lede ? (fan
        ? <MoreText style={[styles.lede, compact && styles.ledeCompact, styles.fanLede]} lines={2}>{lede}</MoreText>
        : <Text style={[styles.lede, compact && styles.ledeCompact]}>{lede}</Text>) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fanWrap: { gap: 5, paddingTop: 4, paddingBottom: 4 },
  fanTitle: { fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 },
  fanLede: { fontSize: 13, lineHeight: 19 },
  fanKickerBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, maxWidth: '100%' },
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
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
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
