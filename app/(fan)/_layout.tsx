import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function FanLayout() {
  return (
    <RoleGate allow={['fan', 'athlete']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
