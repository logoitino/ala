import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FanTabBar } from '@/components/UI/FanTabBar';
import { UploadVideoModal } from '@/components/Reels/UploadVideoModal';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { colors } from '@/constants/theme';
import { useRoster } from '@/hooks/useRoster';

function FanTabs() {
  const { players } = useRoster();
  const { visible, closeUpload, notifyUploaded } = useUploadSheet();
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
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            overflow: 'visible',
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home', href: live.tabs.home ? undefined : null }} />
        <Tabs.Screen name="local" options={{ title: 'Local', tabBarLabel: 'Local', href: live.tabs.local ? undefined : null }} />
        <Tabs.Screen name="spotlight" options={{ title: 'Spotlight', tabBarLabel: 'Spotlight', href: live.tabs.spotlight ? undefined : null }} />
        <Tabs.Screen name="drip" options={{ title: 'Drip', tabBarLabel: 'Drip', href: live.tabs.drip ? undefined : null }} />
        <Tabs.Screen name="shop" options={{ href: null, title: 'Drip' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', href: live.tabs.profile ? undefined : null }} />
        <Tabs.Screen name="athlete" options={{ href: null, title: 'Athlete' }} />
        <Tabs.Screen name="user" options={{ href: null, title: 'Athlete' }} />
        <Tabs.Screen name="receipts" options={{ href: null, title: 'Receipts' }} />
      </Tabs>
      <UploadVideoModal
        visible={visible && live.tabs.upload}
        players={players}
        onClose={closeUpload}
        onUploaded={(reel) => {
          notifyUploaded(reel);
          closeUpload();
        }}
      />
    </SafeAreaView>
  );
}

export default function FanTabsLayout() {
  return (
    <RoleGate allow={['guest', 'fan', 'athlete']}>
      <FanTabs />
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
