import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';

type TabScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
};

export function TabScreen({ children, style, dark = false }: TabScreenProps) {
  const { live } = useAppRuntime();
  return (
    <SafeAreaView
      edges={dark ? ['left', 'right'] : ['top', 'left', 'right']}
      style={[styles.root, dark && styles.dark, { backgroundColor: live.theme.background }, style]}
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={styles.scene}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dark: {
    backgroundColor: colors.night,
  },
  scene: {
    flex: 1,
  },
});
