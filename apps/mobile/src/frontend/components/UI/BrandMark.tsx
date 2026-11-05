/**
 * Tapua'i brand mark from the 2026-11 Lovable design standard: the jade app icon (white T, gold star)
 * beside the wordmark in the display face. Decorative image; the wordmark text carries the name.
 */
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';
import { DISPLAY_TEXT } from '@/theme/fonts';

const APP_ICON = require('../../../../assets/brand/tapuai-app-icon.png');

/**
 * @purpose Icon + "Tapua'i" lockup for welcome, sheets and headers.
 * @param size Icon edge in points; the wordmark scales with it.
 * @param dark Light wordmark for night surfaces.
 */
export function BrandMark({ size = 32, dark = false, style }: { size?: number; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Image
        source={APP_ICON}
        accessible={false}
        style={[styles.icon, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}
      />
      <Text style={[styles.word, { fontSize: Math.round(size * 0.75), color: dark ? colors.onVideo : colors.text }]}>
        Tapua&apos;i
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    shadowColor: '#2EE59D',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  word: { ...DISPLAY_TEXT, letterSpacing: -0.5 },
});
