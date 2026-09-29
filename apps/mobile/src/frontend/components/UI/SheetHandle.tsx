import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * @purpose The grab bar every fan bottom sheet wears. Previously each sheet re-declared its
 * own copy, which had already drifted (one was missing the bottom margin), so this is the
 * single definition.
 * @returns A decorative bar — it is not a drag target, so it stays out of the a11y tree.
 */
export function SheetHandle() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.handle} />;
}

const styles = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 6,
    opacity: 0.9,
  },
});
