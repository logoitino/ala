import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';
import type { UserRole } from '@/types/database';

const PUBLIC_ROLES: UserRole[] = [
  'guest',
  'fan',
  'athlete',
  'parent',
  'operator',
  'booster',
  'sponsor',
  'admin',
];

export default function GuestLayout() {
  return (
    <RoleGate allow={PUBLIC_ROLES}>
      <Stack screenOptions={roleStackOptions}>
        <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
        <Stack.Screen name="player/[id]" options={{ title: 'Player Profile' }} />
      </Stack>
    </RoleGate>
  );
}
