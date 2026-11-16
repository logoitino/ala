/**
 * Wrapper for each fan tab: safe-area handling, runtime background colour, and a short fade between tabs.
 * Feature containment uses fixed route scopes; money/access never offer automatic retry.
 * Ordinary fan screens reserve the measured floating dock. Dark Highlights fill the shell behind it;
 * only their interactive chrome reserves dock clearance, so video and paging use the same full height.
 */

import { usePathname } from 'expo-router';
import { FeatureBoundary } from '@/components/Common/FeatureBoundary';
import { supportFeatureForPath } from '@/services/supportRuntime';
import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useFanDockHeight } from '@/context/FanNavigationContext';

type TabScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
};

export function TabScreen({ children, style, dark = false }: TabScreenProps) {
  const { live } = useAppRuntime();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const dockHeight = useFanDockHeight();
  return (
    <SafeAreaView
      edges={dark ? ['left', 'right'] : ['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: dark ? colors.night : live.theme.background }, style, { paddingBottom: dark ? 0 : dockHeight }]}
    >
      <Animated.View
        entering={reduce ? FadeIn.duration(80) : FadeInDown.duration(160)}
        exiting={FadeOut.duration(100)}
        style={styles.scene}
      >
        <FeatureBoundary feature={supportFeatureForPath(pathname)} resetKey={pathname}>{children}</FeatureBoundary>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scene: {
    flex: 1,
  },
});
