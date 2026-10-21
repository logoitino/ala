/**
 * Jersey number as a block numeral in a double-stitched patch (UX-08), used on athlete heroes, the QR donate page
 * and Spotlight. The number is the athlete's real number ("7", never "07"); the frame colour follows the caller
 * (Aura tier, brand jade or award gold) so it sits inside the Calm Island palette.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, SCOREBOARD_DIGITS } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

type JerseyBadgeProps = {
  number: string | number;
  /** Frame colour (outer stitch). Text uses `ink`. */
  color?: string;
  ink?: string;
  /** Patch fill; pass the video base on dark chrome (Spotlight popup). */
  background?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/**
 * @purpose Render a jersey number patch; returns null for an empty number so callers can pass roster values as-is.
 */
export function JerseyBadge({ number, color = FOCAL.jadeInk, ink = FOCAL.ink, background, size = 'sm', style }: JerseyBadgeProps) {
  const label = String(number ?? '').replace(/^#/, '').trim();
  if (!label) return null;
  const md = size === 'md';
  return (
    <View accessible accessibilityLabel={`Jersey number ${label}`} style={[styles.outer, md && styles.outerMd, { borderColor: color }, background ? { backgroundColor: background } : null, style]}>
      <View style={[styles.inner, md && styles.innerMd, { borderColor: color }]}>
        <Text style={[styles.number, md && styles.numberMd, { color: ink }]} maxFontSizeMultiplier={1.4}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: 9,
    padding: 2,
    backgroundColor: colors.surface,
  },
  outerMd: {
    borderRadius: 12,
    padding: 3,
  },
  inner: {
    minWidth: 30,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  innerMd: {
    minWidth: 44,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  number: {
    ...SCOREBOARD_DIGITS,
    fontSize: 15,
    lineHeight: 19,
  },
  numberMd: {
    fontSize: 24,
    lineHeight: 29,
  },
});
