/** GUEST-ACCESS-01 authorizes route children before they mount; the root navigator and shared auth/age overlays stay available. */
import { Fragment, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { hasAccountSession } from '@tapuai/shared-types';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { GuestHighlightsPreview } from '@/components/Auth/GuestHighlightsPreview';
import { BrandMark } from '@/components/UI/BrandMark';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/** The callback exemption comes from this screen's root descriptor, never the globally active pathname. */
export function GuestAccessBoundary({ children, authCallback = false, previewEnabled = true }: { children: ReactNode; authCallback?: boolean; previewEnabled?: boolean }) {
  const [retrying, setRetrying] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const accountAuth = useAuth();
  const { requireAuth, close } = useSoftWall();
  if (authCallback) return <>{children}</>;
  if (accountAuth.loading || (accountAuth.isSessionCurrent && !accountAuth.isSessionCurrent())) return <View style={styles.loading}><ActivityIndicator color={FOCAL.neonJade} accessibilityLabel="Checking account access" /></View>;
  const account = !accountAuth.isGuest && hasAccountSession(accountAuth.session) && accountAuth.user?.id === accountAuth.session?.user.id;
  if (account) {
    if (!accountAuth.accountReady) return <View style={styles.loading}><View style={styles.card}>
      <ActivityIndicator color={FOCAL.neonJade} accessibilityLabel="Checking account setup" />
      <Text style={styles.title}>Getting your account ready</Text>
      <Text style={styles.body}>We’re checking your account before opening the community. If this takes a moment, try again.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry account setup" disabled={retrying} style={styles.primary} onPress={async () => { setRetrying(true); try { await accountAuth.refreshProfile(); } catch { /* Keep the account gated; retry stays available. */ } finally { setRetrying(false); } }}><Text style={styles.primaryText}>{retrying ? 'Checking…' : 'Try again'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" style={styles.secondary} onPress={() => { void accountAuth.signOut(); }}><Text style={styles.secondaryText}>Sign out</Text></Pressable>
    </View></View>;
    if (accountAuth.needsAgeConfirmation || accountAuth.birthPrompt != null) return <View style={styles.loading}><ActivityIndicator color={FOCAL.neonJade} accessibilityLabel="Finish account confirmation" /></View>;
    return <Fragment key={accountAuth.user?.id}>{children}</Fragment>;
  }
  if (pathname === '/' && previewEnabled) return <GuestHighlightsPreview />;
  return <View style={styles.loading}>
    <View style={styles.card}>
      <BrandMark size={36} dark />
      <Text accessibilityRole="header" style={styles.title}>{pathname === '/' && !previewEnabled ? 'Highlights will be back soon' : 'There’s more inside'}</Text>
      <Text style={styles.body}>Create an account or sign in to explore athletes, teams and the community.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in or create an account" onPress={() => requireAuth({ kind: 'browse', resume: () => undefined })} style={styles.primary}>
        <Text style={styles.primaryText}>Sign in or create an account</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Highlights preview" onPress={() => { close(); router.replace('/'); }} style={styles.secondary}>
        <Text style={styles.secondaryText}>Back to Highlights preview</Text>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: FOCAL.backgroundBase },
  card: { width: '100%', maxWidth: 460, gap: 16, alignItems: 'center' },
  title: { ...TYPE.title, ...figtree('800'), color: '#fff', textAlign: 'center' },
  body: { ...TYPE.body, ...figtree('400'), color: '#C4D2CE', textAlign: 'center' },
  primary: { width: '100%', minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: FOCAL.neonJade, justifyContent: 'center', alignItems: 'center' },
  primaryText: { ...TYPE.body, ...figtree('700'), color: FOCAL.backgroundBase, textAlign: 'center' },
  secondary: { minHeight: 44, padding: 12, justifyContent: 'center' },
  secondaryText: { ...TYPE.body, ...figtree('600'), color: '#D8E5E0', textAlign: 'center' },
});
