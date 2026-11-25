/** Web sidebar settings reuse account-owned panels and mount them only after explicit selection. */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { colors } from '@/constants/theme';
import { TYPE, figtree } from '@/theme/fonts';
import { LEGAL_MENU_LABEL } from '@/data/legal';
import { FeatureBoundary } from '@/components/Common/FeatureBoundary';

const EditProfile = lazy(() => import('@/components/Profile/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const Privacy = lazy(() => import('@/components/Profile/PrivacySettingsSheet').then(m => ({ default: m.PrivacySettingsSheet })));
const Notifications = lazy(() => import('@/components/Profile/NotificationSettingsSheet').then(m => ({ default: m.NotificationSettingsSheet })));
const Capability = lazy(() => import('@/components/Profile/RoleSwitcherModal').then(m => ({ default: m.RoleSwitcherModal })));
const Legal = lazy(() => import('@/components/Legal/LegalModal').then(m => ({ default: m.LegalModal })));
const DeleteAccount = lazy(() => import('@/components/Profile/DeleteAccountSheet').then(m => ({ default: m.DeleteAccountSheet })));

type Panel = 'profile' | 'privacy' | 'notifications' | 'capability' | 'legal' | 'delete';
const OPTIONS: { panel: Panel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { panel: 'profile', label: 'Edit profile', icon: 'person-outline' },
  { panel: 'privacy', label: 'Privacy and visibility', icon: 'shield-checkmark-outline' },
  { panel: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { panel: 'capability', label: 'Account capability', icon: 'people-outline' },
  { panel: 'legal', label: LEGAL_MENU_LABEL, icon: 'document-text-outline' },
  { panel: 'delete', label: 'Delete account', icon: 'trash-outline' },
];

/** Existing panels retain save, identity, confirmation and runtime controls; no settings data is copied. */
export function DesktopAccountSettings({ compact = false }: { compact?: boolean }) {
  const { user, profile, isGuest, loading, isSessionCurrent, signOut } = useAuth();
  const { requireAuth } = useSoftWall();
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<{ panel: Panel; userId?: string; guard: typeof isSessionCurrent } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signOutFlight = useRef(false);
  const mounted = useRef(true);
  const lifetime = useRef({ userId: user?.id, guard: isSessionCurrent, epoch: 0 });
  if (lifetime.current.userId !== user?.id || lifetime.current.guard !== isSessionCurrent) {
    lifetime.current = { userId: user?.id, guard: isSessionCurrent, epoch: lifetime.current.epoch + 1 };
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setSelection(null);
    setExpanded(false);
    setError(null);
  }, [user?.id, isSessionCurrent]);
  const signedIn = Boolean(user && !isGuest && !loading && isSessionCurrent?.());
  const panel = selection && selection.userId === user?.id && selection.guard === isSessionCurrent
    && (selection.panel === 'legal' || signedIn) ? selection.panel : null;
  const close = () => setSelection(null);
  const open = (next: Panel) => {
    setError(null);
    setSelection({ panel: next, userId: user?.id, guard: isSessionCurrent });
  };
  const signOutAccount = async () => {
    if (signOutFlight.current || !signedIn) return;
    signOutFlight.current = true;
    setSigningOut(true);
    const epoch = lifetime.current.epoch;
    setError(null);
    close();
    try { await signOut(); }
    catch { if (mounted.current && lifetime.current.epoch === epoch) setError('Could not sign out. Please try again.'); }
    finally {
      signOutFlight.current = false;
      if (mounted.current) setSigningOut(false);
    }
  };
  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityLabel="Account settings"
        accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}
        style={[styles.trigger, compact && styles.compact]}>
        <Ionicons name="settings-outline" size={20} color={colors.primary} accessible={false} />
        {!compact ? <View style={styles.copy}>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.hint}>{signedIn ? profile?.full_name?.trim() || 'Your account' : 'Your place in Tapua’i'}</Text>
        </View> : null}
        {!compact ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} accessible={false} /> : null}
      </Pressable>
      {expanded ? <View style={styles.options}>
        {(signedIn ? OPTIONS : OPTIONS.filter(row => row.panel === 'legal')).map(row => (
          <Pressable key={row.panel} accessibilityRole="button" accessibilityLabel={row.label}
            onPress={() => open(row.panel)} style={[styles.row, compact && styles.compact]}>
            <Ionicons name={row.icon} size={18} color={row.panel === 'delete' ? colors.textMuted : colors.primary} accessible={false} />
            {!compact ? <Text style={styles.label}>{row.label}</Text> : null}
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel={signedIn ? 'Sign out' : 'Sign in'}
          accessibilityState={{ disabled: signingOut || loading }} disabled={signingOut || loading}
          onPress={() => signedIn ? void signOutAccount() : requireAuth({ kind: 'signin', resume: () => undefined })}
          style={[styles.row, compact && styles.compact]}>
          <Ionicons name={signedIn ? 'log-out-outline' : 'log-in-outline'} size={18} color={colors.primary} accessible={false} />
          {!compact ? <Text style={styles.label}>{signingOut ? 'Signing out…' : signedIn ? 'Sign out' : 'Sign in'}</Text> : null}
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.hint}>{error}</Text> : null}
      </View> : null}
      <FeatureBoundary feature="auth">
      <Suspense fallback={<ActivityIndicator accessibilityLabel="Opening account settings" color={colors.primary} />}>
        {panel === 'profile' ? <EditProfile visible onClose={close} onOpenPrivacy={() => open('privacy')} /> : null}
        {panel === 'privacy' ? <Privacy visible onClose={close} /> : null}
        {panel === 'notifications' ? <Notifications visible onClose={close} /> : null}
        {panel === 'capability' ? <Capability visible onClose={close} /> : null}
        {panel === 'legal' ? <Legal visible onClose={close} /> : null}
        {panel === 'delete' ? <DeleteAccount visible onClose={close} /> : null}
      </Suspense>
      </FeatureBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  trigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.accentSoft },
  compact: { justifyContent: 'center', paddingHorizontal: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...TYPE.button, ...figtree('800'), color: colors.text },
  hint: { ...TYPE.caption, color: colors.textMuted },
  options: { paddingTop: 4 },
  row: { minHeight: 44, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, minWidth: 0, ...TYPE.body, ...figtree('600'), color: colors.text },
});
