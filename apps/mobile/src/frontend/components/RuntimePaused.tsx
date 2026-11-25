/** Web fans get a concise recovery message; operator guidance and native copy remain intact. Paused surfaces keep recovery actions scrollable at large text sizes; caller owns safe-area/dock clearance. */
import { type Href, useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet } from 'react-native';

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
    <ScrollView style={styles.root} contentContainerStyle={styles.wrap} accessibilityLabel={title}>
      <EmptyState
        kicker={isAdmin ? 'Paused from admin' : 'Paused'}
        title={title}
        lede={isAdmin ? lede : Platform.OS === 'web'
          ? 'This part of Tapua’i is currently unavailable. Please check back later.'
          : 'This surface is off right now. It comes back after Admin publishes it live.'}
        actionLabel={Platform.OS === 'web' ? 'Return to app' : 'Back to Home'}
        onAction={() => router.replace(firstEnabledFanHref(live) as Href)}
        adminHref={adminHref}
        adminLabel={adminLabel}
        accent={FOCAL.goldInk}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FOCAL.backgroundBase },
  wrap: {
    flexGrow: 1,
    backgroundColor: FOCAL.backgroundBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});
