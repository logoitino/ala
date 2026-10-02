/**
 * Booster HQ layout: `booster` role only; paused screen when the `layouts.boosterHq` flag is off.
 */

import { Stack } from 'expo-router';

import { RuntimePaused } from '@/components/RuntimePaused';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { roleStackOptions } from '@/lib/navigation';

export default function BoosterLayout() {
  const { live } = useAppRuntime();
  if (!live.layouts.boosterHq) {
    return (
      <RoleGate allow={['booster']}>
        <RuntimePaused title="Booster HQ is paused" lede="Turn it back on in Admin → Features, then Publish to app." />
      </RoleGate>
    );
  }
  return (
    <RoleGate allow={['booster']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
