/**
 * Shared, wrapping page hierarchy keeps published Look-desk copy and colors authoritative.
 * UX-08: the viewer's sport (generic field for non-athletes) fades in behind the right side of every heading.
 * UX-10: compact fan headings use a sport mark and an ink-on-mist kicker; role headings keep their sizing.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
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
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';

type ScreenHeadingProps = {
  kicker?: string;
  title: string;
  lede?: string;
  compact?: boolean;
  /** Override the gold kicker / underline (jade for most tabs; gold for awards). Defaults to Look-desk gold. */
  accent?: string;
};

/**
 * @purpose Shared light-tab hero: gold (or accent) kicker + title + gold underline so every fan tab shares one eye-catching scheme.
 * @param kicker Uppercase eyebrow (Friday Night, Island Drip…).
 * @param title Screen name.
 * @param lede Supporting sentence under the rule.
 * @param compact Tighter Profile / Drip / Local chrome.
 * @param accent Optional ink for kicker + underline (jade primary, gold awards).
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
  fanWrap: { gap: 4, paddingTop: 2, paddingBottom: 2 },
  fanTitle: { ...DISPLAY_TEXT, ...TYPE.display, letterSpacing: -0.6 },
  fanLede: { ...figtree('400'), ...TYPE.body },
  fanKickerBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, maxWidth: '100%' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accentDot: { width: 5, height: 5, borderRadius: 3 },
  field: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: '38%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  wrap: {
    gap: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  wrapCompact: {
    gap: 4,
    paddingTop: 4,
  },
  kicker: {
    ...figtree('800'),
    ...TYPE.caption,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.gold,
    flexShrink: 1,
  },
  kickerCompact: { ...figtree('400'),
    ...TYPE.caption,
    letterSpacing: 0.5,
  },
  title: {
    ...DISPLAY_TEXT,
    ...TYPE.display,
    color: colors.text,
    letterSpacing: -0.6,
  },
  titleCompact: { ...figtree('400'),
    ...TYPE.title,

    letterSpacing: -0.3,
  },
  underline: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.electricGold,
    marginTop: 2,
  },
  lede: {
    ...TYPE.body,
    ...figtree('600'),
    color: colors.textMuted,
  },
  ledeCompact: { ...figtree('400'),
    ...TYPE.body,
  },
});
