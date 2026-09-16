import { Stack } from 'expo-router';

import { roleStackOptions } from '@/lib/navigation';

/**
 * @purpose Nested stack so `/user/[id]` stays inside the fan tab navigator (bar stays visible). Header is hidden so the sheet matches the Profile tab.
 */
export default function UserProfileLayout() {
  return (
    <Stack screenOptions={roleStackOptions}>
      <Stack.Screen name="[id]" options={{ headerShown: false, title: 'Athlete' }} />
    </Stack>
  );
}
