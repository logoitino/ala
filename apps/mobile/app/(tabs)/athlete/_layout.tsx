import { Stack } from 'expo-router';

import { roleStackOptions } from '@/lib/navigation';

/**
 * @purpose Nested stack so `/athlete/[id]` stays inside the fan tab navigator (bar stays visible).
 */
export default function AthleteProfileLayout() {
  return (
    <Stack screenOptions={roleStackOptions}>
      <Stack.Screen name="[id]" options={{ title: 'Athlete' }} />
    </Stack>
  );
}
