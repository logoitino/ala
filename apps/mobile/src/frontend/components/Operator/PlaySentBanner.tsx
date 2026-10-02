/**
 * Green confirmation banner the scorer sees after a play is broadcast. Announced politely to screen readers.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

type PlaySentBannerProps = {
  visible: boolean;
  message?: string;
};

export function PlaySentBanner({ visible, message = 'Play Event Sent!' }: PlaySentBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.label}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.success,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  label: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
