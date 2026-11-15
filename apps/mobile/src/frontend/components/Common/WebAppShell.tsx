/**
 * Expo web chrome: at ≥820px, Facebook-style desktop rails (WEB-DESKTOP-01) around the existing
 * Router stack. Native ignores this wrapper. Below 820px the phone layout is unchanged.
 * Desktop vs narrow branching waits until after mount so SSR HTML matches the first client paint.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/constants/theme';
import {
  WEB_DESKTOP_TABLET,
  WEB_DESKTOP_THREE,
  webDesktopMode,
  type WebDesktopMode,
} from '@/hooks/useAppViewport';
import { FOCAL } from '@/theme/motion';
import { DesktopLeftRail } from '@/components/Common/DesktopLeftRail';
import { DesktopRightRail } from '@/components/Common/DesktopRightRail';

export { WEB_DESKTOP_TABLET as WEB_PHONE_BREAKPOINT, WEB_DESKTOP_THREE };

type WebAppShellProps = {
  children: ReactNode;
  backgroundColor?: string;
};

/**
 * @purpose Wrap root app content for Expo web desktop layout without changing native layout.
 * @param children Root stack / providers content.
 * @param backgroundColor Canvas / center column background (runtime theme when provided).
 */
export function WebAppShell({ children, backgroundColor = colors.background }: WebAppShellProps) {
  const { width } = useWindowDimensions();
  const [layoutReady, setLayoutReady] = useState(Platform.OS !== 'web');
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  if (Platform.OS !== 'web') return <>{children}</>;

  const mode: WebDesktopMode = webDesktopMode(width, 'web', layoutReady);

  if (mode === 'mobile') {
    return <View style={[styles.fill, { backgroundColor }]}>{children}</View>;
  }

  const three = mode === 'desktop';

  return (
    <View
      style={[styles.desktopCanvas, { backgroundColor: FOCAL.backgroundBase }]}
      accessibilityLabel="Tapua'i web app"
    >
      <View style={styles.atmosphere} pointerEvents="none" />
      <View style={[styles.shellRow, { backgroundColor }]}>
        <DesktopLeftRail compact={!three} />
        <View style={styles.centerColumn}>{children}</View>
        {three ? <DesktopRightRail /> : null}
      </View>

      {!three ? (
        <>
          <Pressable
            onPress={() => setRightOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open extras panel"
            style={styles.fab}
          >
            <Ionicons name="albums-outline" size={22} color={colors.surface} />
          </Pressable>
          <Modal
            visible={rightOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setRightOpen(false)}
          >
            <View style={styles.drawerRoot}>
              <Pressable
                style={styles.drawerScrim}
                onPress={() => setRightOpen(false)}
                accessibilityLabel="Close extras panel"
              />
              <View style={styles.drawerPanel}>
                <Pressable
                  onPress={() => setRightOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close extras panel"
                  style={styles.drawerClose}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
                <DesktopRightRail />
              </View>
            </View>
          </Modal>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  desktopCanvas: {
    flex: 1,
  },
  atmosphere: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.mistJade,
    opacity: 0.4,
  },
  shellRow: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  centerColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 26, 20, 0.4)',
  },
  drawerPanel: {
    width: 320,
    maxWidth: '90%',
    height: '100%',
    backgroundColor: colors.background,
  },
  drawerClose: {
    alignSelf: 'flex-end',
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
