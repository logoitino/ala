import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_BOTTOM_GAP, colors } from '@/constants/theme';
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
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: live.theme.background }, style]}>
      {children}
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
