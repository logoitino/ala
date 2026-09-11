import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_BOTTOM_GAP, colors } from '@/constants/theme';

type ScreenShellProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenShell({ children, style }: ScreenShellProps) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.root, style]}>
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
