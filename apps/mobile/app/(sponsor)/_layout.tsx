/**
 * Sponsor HQ layout: `sponsor` role only; paused screen when the `layouts.sponsorHq` flag is off.
 */

import { Stack } from 'expo-router';

import { RuntimePaused } from '@/components/RuntimePaused';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { roleStackOptions } from '@/lib/navigation';

export default function SponsorLayout() {
  const { live } = useAppRuntime();
  if (!live.layouts.sponsorHq) {
    return (
      <RoleGate allow={['sponsor']}>
        <RuntimePaused title="Sponsor HQ is paused" lede="Turn it back on in Admin → Features, then Publish to app." />
      </RoleGate>
    );
  }
  return (
    <RoleGate allow={['sponsor']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
