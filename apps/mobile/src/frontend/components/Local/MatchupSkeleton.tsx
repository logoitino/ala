/**
 * Placeholder matchup card shown while Local's live games load
 * (split out of app/(tabs)/local/index.tsx for R4-03; behaviour unchanged).
 */

import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

export function MatchupSkeleton() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonChip} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonLogo} />
        <View style={styles.skeletonScore} />
        <View style={styles.skeletonLogo} />
      </View>
      <View style={styles.skeletonCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  skeletonChip: {
    width: 72,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonScore: {
    width: 64,
    height: 18,
    borderRadius: 8,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonCta: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.photoPlaceholder,
  },
});
