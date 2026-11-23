/** Existing public roster discovery remains inside Local's published availability and measured fan-dock shell. */
import { Stack } from 'expo-router';
import { SchoolDirectory } from '@/components/Local/SchoolDirectory';
import { RuntimePaused } from '@/components/RuntimePaused';
import { TabScreen } from '@/components/TabScreen';
import { useAppRuntime } from '@/context/AppRuntimeContext';

export default function SchoolDirectoryRoute() {
  const { live } = useAppRuntime();
  return <TabScreen><Stack.Screen options={{ headerShown: false, title: 'Schools and teams' }} />
    {live.tabs.local ? <SchoolDirectory /> : <RuntimePaused title="Local is paused" lede="Local is unavailable right now. Please check back later." />}
  </TabScreen>;
}
