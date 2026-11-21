/** UX-13 readable shared type preserves every action and required notice. UX-13 save failures remain visible and late results never close another account frame. Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership.
 * QUIZ-05: athletes also see "Share a fun fact?" here (FunFactShare saves on its own; it hides itself when the server
 * says this account can't share or fun facts are off). My sports saves its own confirmed atomic draft. */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useFanSheetMotion } from '@/hooks/useFanSheetMotion';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAuth } from '@/context/AuthContext';
import { useCelebration } from '@/context/CelebrationContext';
import { RESERVED_BADGE_MARKS, RESERVED_BADGE_MARKS_ERROR } from '@/data/verification';
import { FOCAL } from '@/theme/motion';
import type { ProfileVisibility } from '@/types/database';
import { fetchMyPrivacy } from '@/lib/privacy';
import { FunFactShare } from '@/components/Profile/FunFactShare';
import { MySportsModal } from '@/components/Profile/MySportsModal';
import { useAthleteSports } from '@/hooks/useAthleteSports';
import type { AthleteSportsSnapshot } from '@/lib/athleteSports';
import { TYPE, figtree } from '@/theme/fonts';

const EDIT_PROFILE_TRAVEL = 520;
const BIO_MAX = 500;

const DEFAULT_VISIBILITY: Required<ProfileVisibility> = {
  bio: true,
  school: true,
  stats: true,
  social_links: true,
};

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'Channel URL' },
];

const VISIBILITY_FIELDS: { key: keyof ProfileVisibility; label: string; hint: string }[] = [
  { key: 'bio', label: 'Bio', hint: 'About-me text on your public profile' },
  { key: 'school', label: 'School / team', hint: 'Team affiliation line' },
  { key: 'stats', label: 'Stats', hint: 'Career stats and game logs' },
  { key: 'social_links', label: 'Social links', hint: 'Instagram, X, TikTok, YouTube' },
];

type EditProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Opens Profile → Privacy. When the database has the privacy update it replaces the old show/hide switches. */
  onOpenPrivacy?: () => void;
  onSportsSaved?: (snapshot: AthleteSportsSnapshot) => void;
};

/**
 * @purpose Account customization sheet — display name, username, bio, social links, and per-field
 * "hide from other users' view" toggles. Owner always sees everything on their own Hub regardless
 * of these flags; hiding only ever narrows the public `/user/[id]` view for other users.
 * @sideEffects `AuthContext.updateProfile` → `profiles` UPDATE (bio / social_links / profile_visibility / full_name / username).
 */
export function EditProfileModal({ visible, onClose, onOpenPrivacy, onSportsSaved }: EditProfileModalProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const { profile, user, isSessionCurrent, updateProfile, isAthlete } = useAuth();
  // Preserve the initiating account and modal frame through awaits and delayed close animations.
  const mounted = useRef(true);
  const ownerId = user?.id ?? profile?.id ?? null;
  const authFrame = useRef({ ownerId, visible, guard: isSessionCurrent });
  if (authFrame.current.ownerId !== ownerId || authFrame.current.visible !== visible || authFrame.current.guard !== isSessionCurrent) {
    authFrame.current = { ownerId, visible, guard: isSessionCurrent };
  }
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setSaveError(null); setSaving(false); }, [ownerId, visible, isSessionCurrent]);
  const sports = useAthleteSports(profile?.id, isAthlete && visible);
  const [sportsOpen, setSportsOpen] = useState(false);
  const initialized = useRef<string | null>(null);
  const { showToast } = useCelebration();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [social, setSocial] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Required<ProfileVisibility>>(DEFAULT_VISIBILITY);
  // True once Profile → Privacy is available (PRIV-01 applied); the legacy switches then stay hidden and unsent.
  const [privacyReady, setPrivacyReady] = useState(false);
  const { sheetStyle, backdropStyle, playOpen, playClose } = useFanSheetMotion(EDIT_PROFILE_TRAVEL);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    playOpen();
    if (initialized.current === profile?.id) return;
    initialized.current = profile?.id ?? null;
    setFullName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setSocial({ ...(profile?.social_links ?? {}) });
    setVisibility({ ...DEFAULT_VISIBILITY, ...(profile?.profile_visibility ?? {}) });
    void fetchMyPrivacy().then(() => setPrivacyReady(true), () => setPrivacyReady(false));
  }, [playOpen, profile, visible]);
  useEffect(() => { if (!visible) { initialized.current = null; setSportsOpen(false); } }, [visible]);

  if (!open && !visible) return null;

  const dismiss = (requestGuard?: unknown) => {
    if (saving) return;
    playClose(() => {
      if (typeof requestGuard === 'function' && !requestGuard()) return;
      setOpen(false);
      onClose();
    });
  };

  const onSave = async () => {
    if (saving) return;
    if (RESERVED_BADGE_MARKS.test(fullName) || RESERVED_BADGE_MARKS.test(username)) {
      showToast(RESERVED_BADGE_MARKS_ERROR);
      return;
    }
    const requestFrame = authFrame.current;
    const isCurrent = () => mounted.current && requestFrame === authFrame.current && requestFrame.visible && (requestFrame.guard?.() ?? true);
    if (!isCurrent()) return;
    setSaveError(null);
    setSaving(true);
    try {
      const cleanedSocial = Object.fromEntries(
        Object.entries(social)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value.length > 0),
      );
      await updateProfile({
        full_name: fullName.trim() || (profile?.full_name ?? 'Fan'),
        username: username.trim() || null,
        bio: bio.trim() || null,
        social_links: cleanedSocial,
        ...(privacyReady ? {} : { profile_visibility: visibility }),
      });
      if (!isCurrent()) return;
      showToast('Profile updated ✅');
      dismiss(isCurrent);
    } catch {
      if (isCurrent()) setSaveError("Couldn't save your profile. Please try again.");
    } finally {
      if (isCurrent()) setSaving(false);
    }
  };

  return (
    <><Modal transparent animationType="none" visible={visible && !sportsOpen} onRequestClose={dismiss} onDismiss={() => { if (!sportsOpen) setOpen(false); }}>
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <KeyboardAvoidingView style={{ flexShrink: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }, sheetStyle]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={dismiss} />
            <View style={styles.handle} />
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Edit Profile</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {isAthlete ? <Pressable accessibilityRole="button" accessibilityLabel="My sports" disabled={saving}
                onPress={() => setSportsOpen(true)} style={styles.visRow}><View style={styles.visText}>
                  <Text style={styles.visLabel}>My sports</Text><Text style={styles.visHint}>Primary sport, school / team, position and jersey for each sport</Text>
                </View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable> : null}
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!saving}
              />

              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                value={username}
                onChangeText={(value) => setUsername(value.replace(/\s+/g, ''))}
                placeholder="@handle"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!saving}
              />

              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <Text style={styles.charCount}>
                  {bio.length}/{BIO_MAX}
                </Text>
              </View>
              <TextInput
                value={bio}
                onChangeText={(value) => setBio(value.slice(0, BIO_MAX))}
                placeholder="Tell fans a little about yourself"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.bioInput]}
                multiline
                editable={!saving}
              />

              <Text style={styles.sectionLabel}>Social links</Text>
              {SOCIAL_FIELDS.map((field) => (
                <View key={field.key} style={styles.socialRow}>
                  <Text style={styles.socialLabel}>{field.label}</Text>
                  <TextInput
                    value={social[field.key] ?? ''}
                    onChangeText={(value) => setSocial((current) => ({ ...current, [field.key]: value }))}
                    placeholder={field.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.socialInput]}
                    editable={!saving}
                  />
                </View>
              ))}

              {privacyReady && onOpenPrivacy ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Open privacy settings" haptic="selection"
                  onPress={() => { dismiss(); onOpenPrivacy(); }} style={styles.visRow}>
                  <View style={styles.visText}>
                    <Text style={styles.visLabel}>Privacy</Text>
                    <Text style={styles.visHint}>Public or private, who sees each part of your profile, friends, search and blocked accounts</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
              {isAthlete && visible ? <FunFactShare /> : null}
              {privacyReady ? null : <>
              <Text style={styles.sectionLabel}>Show or hide from other users</Text>
              <Text style={styles.sectionHint}>
                You always see everything on your own Hub. Hiding a field only removes it from your public profile
                that other users see.
              </Text>
              {VISIBILITY_FIELDS.map((field) => {
                const shown = visibility[field.key] !== false;
                return (
                  <Pressable
                    key={field.key}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: shown }}
                    accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${field.label}`}
                    disabled={saving}
                    haptic="selection"
                    onPress={() =>
                      setVisibility((current) => ({ ...current, [field.key]: !shown }))
                    }
                    style={styles.visRow}
                  >
                    <View style={styles.visText}>
                      <Text style={styles.visLabel}>{field.label}</Text>
                      <Text style={styles.visHint}>{field.hint}</Text>
                    </View>
                    <View style={[styles.visPill, shown && styles.visPillOn]}>
                      <Ionicons
                        name={shown ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={shown ? colors.onAccent : colors.textMuted}
                      />
                      <Text style={[styles.visPillLabel, shown && styles.visPillLabelOn]}>
                        {shown ? 'Visible' : 'Hidden'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              </>}
            </ScrollView>

            {saveError ? <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveError}</Text> : null}
            <AnimatedButton
              accessibilityLabel="Save profile"
              disabled={saving}
              haptic="medium"
              onPress={() => void onSave()}
              contentStyle={[styles.submit, saving && styles.submitOff]}
            >
              {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.submitLabel}>Save</Text>}
            </AnimatedButton>
            <Pressable accessibilityRole="button" onPress={dismiss} style={styles.close} disabled={saving}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
    {profile?.id && isAthlete ? <MySportsModal visible={visible && sportsOpen} profileId={profile.id}
      snapshot={sports.snapshot} onClose={() => setSportsOpen(false)} onReload={() => void sports.reload()}
      onSaved={snapshot => { sports.acceptConfirmed(snapshot); onSportsSaved?.(snapshot); }} /> : null}</>
  );
}

const styles = StyleSheet.create({
  saveError: { ...figtree('400'), color: colors.text, ...TYPE.body,  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.surface,
    gap: 10,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  title: {
    ...TYPE.title,
    ...figtree('800'),
    color: colors.text,
    letterSpacing: -0.3,
  },
  scroll: {
    maxHeight: 480,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 8,
  },
  fieldLabel: {
    ...TYPE.caption,
    ...figtree('800'),
    color: colors.text,
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  charCount: {
    ...TYPE.caption,
    ...figtree('700'),
    color: colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    ...TYPE.body,
    ...figtree('700'),
    color: colors.text,
  },
  bioInput: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    ...TYPE.body,
    ...figtree('800'),
    color: colors.text,
    marginTop: 14,
  },
  sectionHint: {
    ...TYPE.caption,
    ...figtree('600'),
    color: colors.textMuted,

    marginBottom: 4,
  },
  socialRow: {
    gap: 4,
  },
  socialLabel: {
    ...TYPE.caption,
    ...figtree('700'),
    color: colors.textMuted,
  },
  socialInput: {
    minHeight: 42,
  },
  visRow: { minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  visText: {
    flex: 1,
    gap: 2,
  },
  visLabel: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.text,
  },
  visHint: {
    ...TYPE.caption,
    ...figtree('600'),
    color: colors.textMuted,
  },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  visPillOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  visPillLabel: {
    ...TYPE.caption,
    ...figtree('800'),
    color: colors.textMuted,
  },
  visPillLabelOn: {
    color: colors.onAccent,
  },
  submit: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitOff: { minHeight: 44,
    opacity: 0.6,
  },
  submitLabel: {
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('800'),
  },
  close: { minHeight: 44,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeLabel: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.textMuted,
  },
});
