/**
 * Wrapper for each fan tab: safe-area handling, runtime background colour, and a short fade between tabs.
 * `dark` switches to the night background and drops the top inset (full-bleed screens such as Highlights).
 */

import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, isLightCanvas } from '@/constants/theme';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
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
      style={[styles.root, { backgroundColor: dark ? colors.night : live.theme.background }, style]}
    >
      {!dark && isLightCanvas(live.theme.background) ? <MenuBackdrop /> : null}
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
  scene: {
    flex: 1,
  },
});
