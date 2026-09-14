import { Stack } from 'expo-router';

import { RuntimePaused } from '@/components/RuntimePaused';
import { RoleGate } from '@/context/RoleGate';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { roleStackOptions } from '@/lib/navigation';

export default function OperatorLayout() {
  const { live } = useAppRuntime();
  if (!live.layouts.operatorConsole) {
    return (
      <RoleGate allow={['operator']}>
        <RuntimePaused title="Operator console is paused" lede="Turn it back on in Admin → Features, then Publish to app." />
      </RoleGate>
    );
  }
  return (
    <RoleGate allow={['operator']}>
      <Stack screenOptions={roleStackOptions}>
        <Stack.Screen name="index" options={{ title: 'Field Operator' }} />
        <Stack.Screen name="[gameId]" options={{ headerShown: false, title: 'Live Console' }} />
        <Stack.Screen name="console/[gameId]" options={{ headerShown: false, title: 'Live Console' }} />
        <Stack.Screen name="scorer" options={{ title: 'Sideline Scorer' }} />
      </Stack>
    </RoleGate>
  );
}
