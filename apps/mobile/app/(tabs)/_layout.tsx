/**
 * Fan tab bar (Highlights / Activity / Spotlight / Profile around Upload), the global upload sheet and its
 * Highlight-or-Beyond chooser. Drip lives in Profile. Beyond, Local, athlete profiles and receipts
 * stay off the bar. They keep a real href: SDK 58 sends `href: null` back to Home (owner 2026-10-16).
 * The custom dock positions itself absolutely; ordinary TabScreen content reserves its measured height.
 */

import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FanTabBar } from '@/components/UI/FanTabBar';
import { UploadChoiceSheet } from '@/components/Reels/UploadChoiceSheet';
import { UploadVideoModal } from '@/components/Reels/UploadVideoModal';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { colors } from '@/constants/theme';
import { USER_ROLES } from '@/lib/roles';
import { useRoster } from '@/hooks/useRoster';
import { FanNavigationProvider } from '@/context/FanNavigationContext';

function FanTabs() {
  const { players } = useRoster();
  const { visible, chooserVisible, closeChooser, closeUpload, notifyUploaded, openBeyondComposer, openHighlightUpload } = useUploadSheet();
  const { live } = useAppRuntime();

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.shell, { backgroundColor: live.theme.background }]}>
      <Tabs
        detachInactiveScreens={false}
        tabBar={(props) => <FanTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          animation: 'fade',
          transitionSpec: {
            animation: 'timing',
            config: { duration: 180 },
          },
          sceneStyle: { backgroundColor: live.theme.background },
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            overflow: 'visible',
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home', href: live.tabs.home ? undefined : null }} />
        {/* Beyond and Local open from the Highlights pill row. The custom bar omits them; href stays set so SDK 58 does not bounce the tap back to Home. */}
        <Tabs.Screen name="beyond" options={{ title: 'Beyond the Game' }} />
        <Tabs.Screen name="local" options={{ title: 'Local' }} />
        <Tabs.Screen
          name="activity"
          options={{ title: 'Activity', tabBarLabel: 'Activity', href: live.tabs.activity ? undefined : null }}
        />
        <Tabs.Screen name="spotlight" options={{ title: 'Spotlight', tabBarLabel: 'Spotlight', href: live.tabs.spotlight ? undefined : null }} />
        <Tabs.Screen name="drip" options={{ title: 'Drip', tabBarLabel: 'Drip' }} />
        <Tabs.Screen name="shop" options={{ title: 'Drip' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', href: live.tabs.profile ? undefined : null }} />
        <Tabs.Screen name="athlete" options={{ title: 'Athlete' }} />
        <Tabs.Screen name="user" options={{ title: 'Athlete' }} />
        <Tabs.Screen name="receipts" options={{ title: 'Receipts' }} />
      </Tabs>
      <UploadChoiceSheet
        visible={Boolean(chooserVisible) && live.tabs.upload}
        onHighlight={openHighlightUpload}
        onBeyond={openBeyondComposer}
        onClose={closeChooser}
      />
      <UploadVideoModal
        visible={visible && live.tabs.upload}
        players={players}
        onClose={closeUpload}
        onUploaded={notifyUploaded}
      />
    </SafeAreaView>
  );
}

export default function FanTabsLayout() {
  return (
    <RoleGate allow={USER_ROLES}>
      <FanNavigationProvider><FanTabs /></FanNavigationProvider>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: 430,
        alignSelf: 'center',
      },
      default: {},
    }),
  },
});
