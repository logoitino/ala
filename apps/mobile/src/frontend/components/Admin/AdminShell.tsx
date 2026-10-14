/**
 * Shared Expo admin access boundary and lens provider. Each page owns its scrolling report header so keyboard
 * focus and narrow-screen navigation can scroll into view with the page, rather than behind fixed chrome.
 * @sideEffects AdminLensProvider persists the existing desk filter; no new authentication or write behavior.
 */
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AccessRestricted } from '@/components/Admin/AccessRestricted';
import { AdminLensProvider } from '@/context/AdminLensContext';
import { useAuth } from '@/context/AuthContext';
import { FOCAL } from '@/theme/motion';

export function AdminShell({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <View style={styles.boot}><ActivityIndicator color={FOCAL.jadeInk} /></View>;
  if (!isAdmin) return <AccessRestricted />;

  return <AdminLensProvider><View style={styles.root}>{children}</View></AdminLensProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8f7' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f8f7' },
});
