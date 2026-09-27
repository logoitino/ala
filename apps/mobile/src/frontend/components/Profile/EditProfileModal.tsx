import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAuth } from '@/context/AuthContext';
import { useCelebration } from '@/context/CelebrationContext';
import { FOCAL, SPRING_CARD } from '@/theme/motion';
import type { ProfileVisibility } from '@/types/database';

const SHEET_TRAVEL = 520;
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
};

/**
 * @purpose Account customization sheet — display name, username, bio, social links, and per-field
 * "hide from other users' view" toggles. Owner always sees everything on their own Hub regardless
 * of these flags; hiding only ever narrows the public `/user/[id]` view for other users.
 * @sideEffects `AuthContext.updateProfile` → `profiles` UPDATE (bio / social_links / profile_visibility / full_name / username).
 */
export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const frame = useSheetFrame();
  const { profile, updateProfile } = useAuth();
  const { showToast } = useCelebration();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [social, setSocial] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Required<ProfileVisibility>>(DEFAULT_VISIBILITY);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    setFullName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setSocial({ ...(profile?.social_links ?? {}) });
    setVisibility({ ...DEFAULT_VISIBILITY, ...(profile?.profile_visibility ?? {}) });
    translateY.value = withSpring(0, SPRING_CARD);
    backdropOpacity.value = withTiming(1, { duration: 200 });
  }, [backdropOpacity, profile, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    if (saving) return;
    translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
    backdropOpacity.value = withTiming(0, { duration: 160 });
    setTimeout(() => {
      setOpen(false);
      onClose();
    }, 180);
  };

  const onSave = async () => {
    if (saving) return;
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
        profile_visibility: visibility,
      });
      showToast('Profile updated ✅');
      dismiss();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss} onDismiss={() => setOpen(false)}>
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[styles.sheet, frame.card, sheetStyle]}>
            <View style={styles.handle} />
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Edit Profile</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
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
            </ScrollView>

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
  );
}

const styles = StyleSheet.create({
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: FOCAL.violetInk,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  bioInput: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 14,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 4,
  },
  socialRow: {
    gap: 4,
  },
  socialLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  socialInput: {
    minHeight: 42,
  },
  visRow: {
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  visHint: {
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  visPillLabelOn: {
    color: colors.onAccent,
  },
  submit: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitOff: {
    opacity: 0.6,
  },
  submitLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  close: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
