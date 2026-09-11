import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function SponsorLayout() {
  return (
    <RoleGate allow={['sponsor']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
