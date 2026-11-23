import { Stack } from 'expo-router';

import { roleStackOptions } from '@/lib/navigation';

/**
 * @purpose Nested Local stack keeps games and existing-record discovery within measured fan navigation.
 * @returns Stack with the Local hub, school directory and `/local/game/[id]`.
 */
export default function LocalLayout() {
  return (
    <Stack screenOptions={roleStackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Local' }} />
      <Stack.Screen name="directory" options={{ headerShown: false, title: 'Schools and teams' }} />
      <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
    </Stack>
  );
}
