import { Stack } from 'expo-router';

import { AdminShell } from '@/components/Admin/AdminShell';
import { colors } from '@/constants/theme';

/**
 * @purpose Nested `/admin` stack inside the control-plane sidebar. Access is gated in `AdminShell`.
 */
export default function AdminPortalLayout() {
  return (
    <AdminShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AdminShell>
  );
}
