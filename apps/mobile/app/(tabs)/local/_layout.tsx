import { Stack } from 'expo-router';

import { roleStackOptions } from '@/lib/navigation';

/**
 * @purpose Nested stack so Live Match detail stays on the Local tab and `FanTabBar` stays visible.
 * @returns Stack with the Local hub (`index`) and `/local/game/[id]`.
 */
export default function LocalLayout() {
  return (
    <Stack screenOptions={roleStackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Local' }} />
      <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
    </Stack>
  );
}
