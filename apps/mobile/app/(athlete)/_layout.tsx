/**
 * Athlete route group layout: `athlete` role only (`RoleGate`).
 */

import { Stack } from 'expo-router';

import { RoleGate } from '@/context/RoleGate';
import { roleStackOptions } from '@/lib/navigation';

export default function AthleteLayout() {
  return (
    <RoleGate allow={['athlete']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
