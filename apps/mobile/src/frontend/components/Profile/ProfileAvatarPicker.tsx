/**
 * Profile photo circle with the owner's camera-roll picker. The stored `profiles.avatar_url` (legacy full URL or
 * `sb:` reference, SCALE-02) and a just-picked local photo both display through `mediaUri` from lib/media; a blank or
 * unreadable value shows the initials placeholder. Public previews reuse exactly the displayed image.
 * @sideEffects `expo-image-picker`; Storage `avatars` upload via `uploadAvatar`; `refreshProfile`.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { AVATAR_PICKER_LABEL, AVATAR_UPLOADING } from '@/data/media';
import { mediaUri } from '@/lib/media';
import { uploadAvatar } from '@/services/MediaUploadService';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const AVATAR_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.85,
};

type ProfileAvatarPickerProps = {
  uri?: string | null;
  editable?: boolean;
  /** Only the public profile opts in; the owner continues to open the photo picker. */
  previewName?: string;
  size?: number;
  children?: ReactNode;
  onUploaded?: (url: string) => void;
};

/**
 * @purpose Camera-roll 1:1 crop for the Profile hero. Uploads to Storage `avatars` and stamps `profiles.avatar_url`.
 * @param uri Stored avatar value (full URL or `sb:` reference).
 * @param editable Own hub only — guests hit Soft-Wall first.
 * @param children Initials / crest overlay when there is no photo yet.
 * @sideEffects `expo-image-picker`; Storage `avatars`; `profiles` UPDATE; `refreshProfile`.
 */
export function ProfileAvatarPicker({
  uri,
  editable = false,
  previewName,
  size = 132,
  children,
  onUploaded,
}: ProfileAvatarPickerProps) {
  const { isGuest, refreshProfile } = useAuth();
  const { requireAuth } = useSoftWall();
  const [busy, setBusy] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failedPreviewImage, setFailedPreviewImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uri: string; name: string } | null>(null);
  const shown = mediaUri(localUri || uri);
  const previewable = !editable && !!previewName && !!shown && failedPreviewImage !== shown;
  // A retained route must never reveal the previous subject's photo after a prop change.
  useEffect(() => { setPreview(null); setFailedPreviewImage(null); }, [shown, previewName, editable]);

  const pick = async () => {
    if (!editable || busy) return;
    if (isGuest) {
      requireAuth({
        kind: 'signin',
        resume: () => {
          void pick();
        },
      });
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to set your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(AVATAR_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      const nextUri = result.assets[0].uri;
      setLocalUri(nextUri);
      setBusy(true);
      const stored = await uploadAvatar(nextUri);
      telemetry.trackFeature('profile_avatar', 'profile');
      setLocalUri(stored);
      await refreshProfile();
      onUploaded?.(stored);
    } catch (caught) {
      setLocalUri(uri ?? null);
      Alert.alert(
        'Could not save photo',
        caught instanceof Error ? caught.message : 'Try another square crop from Camera Roll.',
      );
    } finally {
      setBusy(false);
    }
  };

  const radius = size / 2;
  const frame = [styles.hit, { width: size, height: size, borderRadius: radius }];
  const photo = shown && (editable || !previewName || failedPreviewImage !== shown) ? (
    <Image source={{ uri: shown }} onError={previewable ? () => setFailedPreviewImage(shown) : undefined}
      style={[styles.photo, { width: size, height: size, borderRadius: radius }]} />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>{children}</View>
  );

  if (!editable) {
    if (previewable && shown && previewName) {
      const closePreview = () => setPreview(null);
      return <>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${previewName}’s profile photo`}
          haptic="selection" onPress={() => setPreview({ uri: shown, name: previewName })} style={frame}>
          {photo}
        </Pressable>
        {preview?.uri === shown && preview.name === previewName ? (
          <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={closePreview}>
            <SafeAreaView style={styles.preview} accessibilityViewIsModal>
              <View style={styles.previewHeader}>
                <Text accessibilityRole="header" style={styles.previewTitle}>Profile photo</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo"
                  onPress={closePreview} style={styles.previewClose}>
                  <Text style={styles.previewCloseText}>Close</Text>
                </Pressable>
              </View>
              <Image accessible accessibilityRole="image" accessibilityLabel={`${previewName}’s profile photo`}
                source={{ uri: shown }} resizeMode="contain"
                onError={() => { setFailedPreviewImage(shown); closePreview(); }}
                style={styles.previewImage} />
            </SafeAreaView>
          </Modal>
        ) : null}
      </>;
    }
    return <View style={frame}>{photo}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={AVATAR_PICKER_LABEL}
      accessibilityState={{ disabled: busy, busy }}
      haptic="selection"
      onPress={() => void pick()}
      style={frame}
    >
      {photo}
      {editable ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{busy ? '…' : '📷'}</Text>
        </View>
      ) : null}
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.busy]} accessibilityLabel={AVATAR_UPLOADING}>
          <ActivityIndicator color={FOCAL.neonJade} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    overflow: 'hidden',
  },
  photo: {
    backgroundColor: colors.photoPlaceholder,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 14,
  },
  busy: {
    backgroundColor: 'rgba(15,20,22,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { flex: 1, backgroundColor: FOCAL.ink, paddingHorizontal: 12 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8 },
  previewTitle: { color: colors.onVideo, ...TYPE.section, ...figtree('700'), flexShrink: 1 },
  previewClose: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  previewCloseText: { color: colors.onVideo, ...TYPE.button, ...figtree('700') },
  previewImage: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
