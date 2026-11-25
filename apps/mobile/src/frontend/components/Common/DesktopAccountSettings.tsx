/** Web account workspace groups discoverable settings and returns to its overview after a detail closes. */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { colors } from '@/constants/theme';
import { TYPE, figtree } from '@/theme/fonts';
import { LEGAL_MENU_LABEL } from '@/data/legal';
import { FeatureBoundary } from '@/components/Common/FeatureBoundary';
import { BrandMark } from '@/components/UI/BrandMark';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';

const EditProfile = lazy(() => import('@/components/Profile/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const Privacy = lazy(() => import('@/components/Profile/PrivacySettingsSheet').then(m => ({ default: m.PrivacySettingsSheet })));
const Notifications = lazy(() => import('@/components/Profile/NotificationSettingsSheet').then(m => ({ default: m.NotificationSettingsSheet })));
const Capability = lazy(() => import('@/components/Profile/RoleSwitcherModal').then(m => ({ default: m.RoleSwitcherModal })));
const Legal = lazy(() => import('@/components/Legal/LegalModal').then(m => ({ default: m.LegalModal })));
const DeleteAccount = lazy(() => import('@/components/Profile/DeleteAccountSheet').then(m => ({ default: m.DeleteAccountSheet })));
const Highlights = lazy(() => import('@/components/Common/DesktopHighlightsSettings').then(m => ({ default: m.DesktopHighlightsSettings })));

type Panel = 'profile' | 'privacy' | 'notifications' | 'highlights' | 'capability' | 'legal' | 'delete';
const OPTIONS: { panel: Panel; label: string; hint: string; group: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { panel: 'profile', label: 'Edit profile', hint: 'Your name, bio, sports and social links.', group: 'Your profile', icon: 'person-outline' },
  { panel: 'privacy', label: 'Privacy and visibility', hint: 'Choose who sees your profile and how people connect with you.', group: 'Your profile', icon: 'shield-checkmark-outline' },
  { panel: 'notifications', label: 'Notifications', hint: 'Choose the updates you want to receive.', group: 'Your preferences', icon: 'notifications-outline' },
  { panel: 'highlights', label: 'Highlights preferences', hint: 'Pick your sports and schools, and control your personal feed.', group: 'Your preferences', icon: 'play-circle-outline' },
  { panel: 'capability', label: 'Account capability', hint: 'See your roles and the tools available to your account.', group: 'Account management', icon: 'people-outline' },
  { panel: 'legal', label: LEGAL_MENU_LABEL, hint: 'Read the terms, athlete rights and safety information.', group: 'Account management', icon: 'document-text-outline' },
  { panel: 'delete', label: 'Delete account', hint: 'Review the deletion process before making a request.', group: 'Account management', icon: 'trash-outline' },
];

/** Existing panels retain save, identity, confirmation and runtime controls; no settings data is copied. */
export function DesktopAccountSettings({ compact = false }: { compact?: boolean }) {
  const window = useWindowDimensions();
  const { live } = useAppRuntime();
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
    && (selection.panel === 'legal' || signedIn)
    && (selection.panel !== 'highlights' || live.tabs.home !== false) ? selection.panel : null;
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
      <Modal transparent animationType="fade" visible={expanded && !panel} onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpanded(false)} accessibilityLabel="Dismiss account settings" />
          <View style={[styles.workspace, { width: Math.min(960, window.width - 48), maxHeight: window.height - 48 }]}
            accessibilityViewIsModal>
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <BrandMark dark size={26} />
                <Text accessibilityRole="header" style={styles.heroTitle}>Make Tapua’i yours</Text>
                <Text style={styles.heroHint}>Manage your profile, choose your updates, and stay in control of your account.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close account settings"
                onPress={() => setExpanded(false)} style={styles.close}>
                <Ionicons name="close" size={22} color={colors.onVideo} accessible={false} />
              </Pressable>
            </View>
            <ScrollView style={styles.workspaceBody} contentContainerStyle={styles.workspaceContent}>
              <Text style={styles.intro}>{signedIn ? 'Your account settings' : 'Browse freely. Sign in to personalize your account.'}</Text>
              {['Your profile', 'Your preferences', 'Account management'].map(group => {
                const rows = OPTIONS.filter(row => row.group === group && (signedIn || row.panel === 'legal')
                  && (row.panel !== 'highlights' || live.tabs.home !== false));
                if (!rows.length) return null;
                return <View key={group} style={styles.group}>
                  <Text accessibilityRole="header" style={styles.groupTitle}>{group}</Text>
                  <View style={styles.cards}>
                    {rows.map(row => (
                      <Pressable key={row.panel} accessibilityRole="button" accessibilityLabel={row.label}
                        onPress={() => open(row.panel)}
                        style={[styles.card, { width: window.width >= 820 ? '48.5%' : '100%' }]}>
                        <Ionicons name={row.icon} size={22} color={colors.primary} accessible={false} />
                        <View style={styles.cardCopy}>
                          <Text style={styles.cardTitle}>{row.label}</Text>
                          <Text style={styles.hint}>{row.hint}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} accessible={false} />
                      </Pressable>
                    ))}
                  </View>
                </View>;
              })}
              <Pressable accessibilityRole="button" accessibilityLabel={signedIn ? 'Sign out' : 'Sign in'}
                accessibilityState={{ disabled: signingOut || loading }} disabled={signingOut || loading}
                onPress={() => {
                  if (signedIn) void signOutAccount();
                  else { setExpanded(false); requireAuth({ kind: 'signin', resume: () => undefined }); }
                }}
                style={styles.row}>
                <Ionicons name={signedIn ? 'log-out-outline' : 'log-in-outline'} size={18} color={colors.primary} accessible={false} />
                <Text style={styles.label}>{signingOut ? 'Signing out…' : signedIn ? 'Sign out' : 'Sign in'}</Text>
              </Pressable>
              {error ? <Text accessibilityRole="alert" style={styles.hint}>{error}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <SheetPresentationContext.Provider value={panel === 'delete' ? 'default' : 'web-workspace'}>
      <FeatureBoundary feature="auth">
      <Suspense fallback={
        <Modal transparent animationType="fade" visible onRequestClose={close}>
          <View style={styles.overlay}>
            <View style={[styles.workspace, styles.workspaceContent, { width: Math.min(760, window.width - 48) }]}>
              <Text style={styles.cardTitle}>Opening account settings</Text>
              <ActivityIndicator color={colors.primary} />
              <Pressable accessibilityRole="button" accessibilityLabel="Back to account settings" onPress={close} style={styles.row}>
                <Text style={styles.label}>Back to account settings</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      }>
        {panel === 'profile' ? <EditProfile visible onClose={close} onOpenPrivacy={() => open('privacy')} /> : null}
        {panel === 'privacy' ? <Privacy visible onClose={close} /> : null}
        {panel === 'notifications' ? <Notifications visible onClose={close} /> : null}
        {panel === 'highlights' ? <Highlights onClose={close} /> : null}
        {panel === 'capability' ? <Capability visible onClose={close} /> : null}
        {panel === 'legal' ? <Legal visible onClose={close} /> : null}
        {panel === 'delete' ? <DeleteAccount visible onClose={close} /> : null}
      </Suspense>
      </FeatureBoundary>
      </SheetPresentationContext.Provider>
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
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,19,21,0.55)' },
  workspace: { borderRadius: 20, backgroundColor: colors.background, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  hero: { padding: 24, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.videoSurface, gap: 16 },
  heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  heroTitle: { ...TYPE.title, ...figtree('800'), color: colors.onVideo },
  heroHint: { ...TYPE.body, color: colors.onVideoMuted, maxWidth: 620 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  workspaceBody: { flexShrink: 1 },
  workspaceContent: { padding: 24, gap: 20 },
  intro: { ...TYPE.body, color: colors.textMuted },
  group: { gap: 10 },
  groupTitle: { ...TYPE.section, ...figtree('800'), color: colors.text },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 96 },
  cardCopy: { flex: 1, minWidth: 0, gap: 6 },
  cardTitle: { ...TYPE.button, ...figtree('800'), color: colors.text },
  row: { minHeight: 44, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, minWidth: 0, ...TYPE.body, ...figtree('600'), color: colors.text },
});
