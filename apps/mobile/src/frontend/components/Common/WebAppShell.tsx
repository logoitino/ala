/**
 * Expo web chrome: on wide desktops, constrain the fan app to a phone-width column so tab chrome
 * and Highlights pager stay usable. Native ignores this wrapper.
 */
import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors } from '@/constants/theme';
import { WEB_PHONE_BREAKPOINT, WEB_PHONE_WIDTH } from '@/hooks/useAppViewport';
import { FOCAL } from '@/theme/motion';

export { WEB_PHONE_BREAKPOINT, WEB_PHONE_WIDTH };

type WebAppShellProps = {
  children: ReactNode;
  backgroundColor?: string;
};

/**
 * @purpose Wrap root app content for Expo web desktop layout without changing native layout.
 * @param children Root stack / providers content.
 * @param backgroundColor Canvas behind the phone column (runtime theme when provided).
 */
export function WebAppShell({ children, backgroundColor = colors.background }: WebAppShellProps) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return <>{children}</>;

  const desktop = width >= WEB_PHONE_BREAKPOINT;
  if (!desktop) {
    return <View style={[styles.fill, { backgroundColor }]}>{children}</View>;
  }

  return (
    <View style={[styles.desktopCanvas, { backgroundColor: FOCAL.backgroundBase }]}>
      <View style={styles.atmosphere} pointerEvents="none" />
      <View
        style={[styles.phoneColumn, { backgroundColor, borderColor: colors.border }]}
        accessibilityLabel="Tapua'i web app"
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  desktopCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  atmosphere: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.mistJade,
    opacity: 0.55,
  },
  phoneColumn: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_PHONE_WIDTH,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    // Soft elevation without multi-layer shadow noise.
    shadowColor: '#0B1A14',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
});
