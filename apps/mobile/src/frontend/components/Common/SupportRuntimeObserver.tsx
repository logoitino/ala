/** Auth-scoped runtime sensors are opt-in after migration activation; no raw error or session data enters capture. */
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supportSignals } from '@/services/SupportSignalManager';
import { observeSupportRuntime } from '@/services/supportRuntime';
export function SupportRuntimeObserver() {
 const { session, loading } = useAuth();
 const identity = session?.user.id;
 const accessToken = session?.access_token;
 useEffect(() => {
  const enabled = !loading && !!identity && !!accessToken && process.env.EXPO_PUBLIC_SUPPORT_SENSORS_ENABLED === 'true';
  const configured = supportSignals.configure({ enabled, environment: process.env.EXPO_PUBLIC_SUPPORT_ENVIRONMENT, release: process.env.EXPO_PUBLIC_SUPPORT_RELEASE, accessToken });
  const stop = enabled && configured ? observeSupportRuntime(event => { supportSignals.capture(event); }) : () => {};
  return () => { stop(); supportSignals.dispose(); };
 }, [identity, accessToken, loading]);
 return null;
}
