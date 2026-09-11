import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type TabScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
};

export function TabScreen({ children, style, dark = false }: TabScreenProps) {
  return (
    <SafeAreaView
      edges={dark ? ['left', 'right'] : ['top', 'left', 'right']}
      style={[styles.root, dark && styles.dark, style]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dark: {
    backgroundColor: '#050807',
  },
});
