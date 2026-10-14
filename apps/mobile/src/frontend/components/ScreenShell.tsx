/**
 * Wrapper for non-tab screens (role HQs, admin desks): safe-area edges plus the runtime background colour. Feature containment keeps adjacent navigation usable.
 */

import { usePathname } from 'expo-router';
import { FeatureBoundary } from '@/components/Common/FeatureBoundary';
import { supportFeatureForPath } from '@/services/supportRuntime';
import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_BOTTOM_GAP, colors, isLightCanvas } from '@/constants/theme';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { useAppRuntime } from '@/context/AppRuntimeContext';

type ScreenShellProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function ScreenShell({
  children,
  style,
  edges = ['bottom', 'left', 'right'],
}: ScreenShellProps) {
  const { live } = useAppRuntime();
  const pathname = usePathname();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: live.theme.background }, style]}>
      {isLightCanvas(live.theme.background) ? <MenuBackdrop /> : null}
      <FeatureBoundary feature={supportFeatureForPath(pathname)} resetKey={pathname}>{children}</FeatureBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: SCREEN_BOTTOM_GAP,
  },
});
