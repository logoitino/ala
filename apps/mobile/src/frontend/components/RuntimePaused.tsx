import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/UI/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import type { AdminNavHref } from '@/lib/admin';
import { firstEnabledFanHref } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

type RuntimePausedProps = {
  title: string;
  lede: string;
  /** Expo `/admin` desk that owns this flag. Defaults to Features. */
  adminHref?: AdminNavHref;
  adminLabel?: string;
};

/**
 * @purpose Full-screen pause when admin published a layout or tab flag off. Fans see a calm empty card; operators get a live Expo `/admin` desk link.
 * @param title Paused surface name.
 * @param lede Operator instruction (Features + Publish).
 * @param adminHref Desk that turns the flag back on (Features unless a more specific desk owns it).
 * @returns Centered EmptyState with Back to Home plus Open Features for admins.
 */
export function RuntimePaused({
  title,
  lede,
  adminHref = '/admin/features',
  adminLabel = 'Open Features',
}: RuntimePausedProps) {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { isAdmin } = useAuth();
  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={title}>
      <EmptyState
        kicker={isAdmin ? 'Paused from admin' : 'Paused'}
        title={title}
        lede={isAdmin ? lede : 'This surface is off right now. It comes back after Admin publishes it live.'}
        actionLabel="Back to Home"
        onAction={() => router.replace(firstEnabledFanHref(live) as Href)}
        adminHref={adminHref}
        adminLabel={adminLabel}
        accent={FOCAL.goldInk}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
});
