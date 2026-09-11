import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function ParentLayout() {
  return (
    <RoleGate allow={['parent']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
