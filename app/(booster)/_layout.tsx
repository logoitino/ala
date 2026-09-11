import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function BoosterLayout() {
  return (
    <RoleGate allow={['booster']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
