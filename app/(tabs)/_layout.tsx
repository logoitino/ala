import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoleGate } from '@/context/RoleGate';
import { colors } from '@/constants/theme';

const TAB_ICON_SIZE = 24;

export default function FanTabsLayout() {
  return (
    <RoleGate allow={['guest', 'fan']}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.shell}>
        <Tabs
          safeAreaInsets={{ bottom: 0, left: 0, right: 0 }}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.deepGreen,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
              marginBottom: 2,
            },
            tabBarItemStyle: {
              paddingTop: 4,
            },
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 58,
              paddingTop: 4,
              paddingBottom: 6,
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Reel',
              tabBarLabel: 'Reel',
              tabBarIcon: ({ color }) => (
                <Ionicons name="play-circle" size={TAB_ICON_SIZE} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="local"
            options={{
              title: 'Local',
              tabBarLabel: 'Local',
              tabBarIcon: ({ color }) => (
                <Ionicons name="location" size={TAB_ICON_SIZE} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="shop"
            options={{
              title: 'Locker Room',
              tabBarLabel: 'Locker Room',
              tabBarIcon: ({ color }) => (
                <Ionicons name="bag-handle" size={TAB_ICON_SIZE} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'My Hub',
              tabBarLabel: 'My Hub',
              tabBarIcon: ({ color }) => (
                <Ionicons name="person" size={TAB_ICON_SIZE} color={color} />
              ),
            }}
          />
        </Tabs>
      </SafeAreaView>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
