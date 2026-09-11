import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function AdminLayout() {
  return (
    <RoleGate allow={['admin']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
