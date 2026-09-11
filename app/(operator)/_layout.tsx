import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function OperatorLayout() {
  return (
    <RoleGate allow={['operator']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
