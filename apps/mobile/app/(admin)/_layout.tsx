import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { roleStackOptions } from '@/lib/navigation';

/**
 * @purpose Admin stack. Access is gated inside `AdminShell` (`profiles.is_admin`) so non-admins see Access Restricted instead of a silent redirect.
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        ...roleStackOptions,
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
