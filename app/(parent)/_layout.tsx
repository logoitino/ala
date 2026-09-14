import { Stack } from 'expo-router';

import { RuntimePaused } from '@/components/RuntimePaused';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { roleStackOptions } from '@/lib/navigation';

export default function ParentLayout() {
  const { live } = useAppRuntime();
  if (!live.layouts.parentHq) {
    return (
      <RoleGate allow={['parent']}>
        <RuntimePaused title="Parent HQ is paused" lede="Turn it back on in Admin → Features, then Publish to app." />
      </RoleGate>
    );
  }
  return (
    <RoleGate allow={['parent']}>
      <Stack screenOptions={roleStackOptions} />
    </RoleGate>
  );
}
