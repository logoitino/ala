/**
 * The empty Home feed message and, on the Beyond switch, its Share a clip / Open Beyond the Game actions
 * (split out of app/(tabs)/index.tsx for R4-03; behaviour unchanged). The route still owns the copy choice,
 * the centred `boot` wrapper and the upload sheet; this file only renders what it is handed.
 */
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import type { HighlightFeedFilter } from '@/data/highlights';
import type { AppRuntimeConfig } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Tell the fan why the Home / Beyond feed is empty and, on Beyond, offer the two ways forward.
 * @param emptyCopy Message chosen by the route for the current pill.
 * @param feedFilter Current pill; only `beyond` shows the actions.
 * @param runtime Published runtime (Share a clip shows only while the Upload tab is on).
 * @param openUpload Opens the shared upload sheet.
 * @param router Route's router, used for `/beyond`.
 */
export function HomeFeedEmpty({
  emptyCopy,
  feedFilter,
  runtime,
  openUpload,
  router,
}: {
  emptyCopy: string;
  feedFilter: HighlightFeedFilter;
  runtime: AppRuntimeConfig;
  openUpload: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.empty}>{emptyCopy}</Text>
      {feedFilter === 'beyond' ? (
        <View style={styles.emptyActions}>
          {runtime.tabs.upload ? (
            <AnimatedButton haptic="light" accessibilityRole="button" accessibilityLabel="Share a clip" contentStyle={styles.emptyPrimary} onPress={openUpload}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyPrimaryLabel}>Share a clip</Text>
            </AnimatedButton>
          ) : null}
          <AnimatedButton haptic="selection" accessibilityRole="link" accessibilityLabel="Open Beyond the Game" contentStyle={styles.emptySecondary} onPress={() => router.push('/beyond')}>
            <Text style={styles.emptySecondaryLabel}>Open Beyond the Game</Text>
          </AnimatedButton>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.onVideo,
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  emptyPrimary: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: FOCAL.jadeInk,
  },
  emptyPrimaryLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptySecondary: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.onVideoMuted,
  },
  emptySecondaryLabel: {
    color: colors.onVideo,
    fontSize: 13,
    fontWeight: '700',
  },
});
