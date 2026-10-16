/**
 * Profile photo circle with the owner's camera-roll picker. The stored `profiles.avatar_url` (legacy full URL or
 * `sb:` reference, SCALE-02) and a just-picked local photo both display through `mediaUri` from lib/media; a blank or
 * unreadable value shows the initials placeholder passed as children.
 * @sideEffects `expo-image-picker`; Storage `avatars` upload via `uploadAvatar`; `refreshProfile`.
 */
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { AVATAR_PICKER_LABEL, AVATAR_UPLOADING } from '@/data/media';
import { mediaUri } from '@/lib/media';
import { uploadAvatar } from '@/services/MediaUploadService';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

const AVATAR_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.85,
};

type ProfileAvatarPickerProps = {
  uri?: string | null;
  editable?: boolean;
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
  size = 132,
  children,
  onUploaded,
}: ProfileAvatarPickerProps) {
  const { isGuest, refreshProfile } = useAuth();
  const { requireAuth } = useSoftWall();
  const [busy, setBusy] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const shown = mediaUri(localUri || uri);

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
  const photo = shown ? (
    <Image source={{ uri: shown }} style={[styles.photo, { width: size, height: size, borderRadius: radius }]} />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>{children}</View>
  );

  if (!editable) {
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
});
