/**
 * Shared Expo admin access boundary and lens provider. Each page owns its scrolling report header so keyboard
 * focus and narrow-screen navigation can scroll into view with the page, rather than behind fixed chrome.
 * SCALE-01: while `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` is on, `AdminMfaGate` holds the desks back until the session is
 * `aal2`. Switch off (the default): the tree below is exactly as before and no MFA call is made.
 * @sideEffects AdminLensProvider persists the existing desk filter; with the MFA switch on, Supabase Auth TOTP reads.
 */
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AccessRestricted } from '@/components/Admin/AccessRestricted';
import { AdminMfaGate } from '@/components/Admin/AdminMfaGate';
import { AdminLensProvider } from '@/context/AdminLensContext';
import { useAuth } from '@/context/AuthContext';
import { isAdminMfaRequiredOnApp } from '@/lib/adminMfa';
import { FOCAL } from '@/theme/motion';

export function AdminShell({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <View style={styles.boot}><ActivityIndicator color={FOCAL.jadeInk} /></View>;
  if (!isAdmin) return <AccessRestricted />;

  const desks = <AdminLensProvider><View style={styles.root}>{children}</View></AdminLensProvider>;
  return isAdminMfaRequiredOnApp() ? <AdminMfaGate>{desks}</AdminMfaGate> : desks;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8f7' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f8f7' },
});
