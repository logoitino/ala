import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedView, { FadeIn } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { CardShine } from '@/components/Effects/CardShine';
import { colors, radii } from '@/constants/theme';
import {
  HIGHLIGHT_LIBRARY_CTA,
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_OPTIMIZING,
  HIGHLIGHT_PICKER_LEDE,
  HIGHLIGHT_PICKER_TITLE,
  HIGHLIGHT_TOO_LONG,
} from '@/data/media';
import { telemetry } from '@/services/TelemetryManager';
import {
  assetDurationMs,
  compressHighlight,
  isHighlightTooLong,
  type PickedHighlight,
} from '@/services/MediaUploadService';
import { FOCAL } from '@/theme/motion';

type HighlightPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onPicked: (clip: PickedHighlight) => void;
};

const LIBRARY_VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  videoMaxDuration: HIGHLIGHT_MAX_SECONDS,
  allowsEditing: true,
  quality: 1,
};

/**
 * @purpose Camera-roll Highlight picker: 45s cap, then `react-native-compressor` overlay before the Publish sheet.
 * @param visible Opens the sheet and (on first show) launches the photo library.
 * @param onClose Dismiss without a clip (blocked while optimizing).
 * @param onPicked Compressed local URI ready for `MediaUploadService.uploadHighlight`.
 * @sideEffects `expo-image-picker` library; `Video.compress` on a dev client; Expo Go skips compress and still returns the URI.
 */
export function HighlightPickerModal({ visible, onClose, onPicked }: HighlightPickerModalProps) {
  const insets = useSafeAreaInsets();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    if (!visible) {
      setOptimizing(false);
      setProgress(0);
    }
  }, [visible]);

  const applyAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (isHighlightTooLong(asset.duration)) {
      Alert.alert('Clip too long', HIGHLIGHT_TOO_LONG);
      return;
    }

    setOptimizing(true);
    setProgress(0.08);
    try {
      const compressedUri = await compressHighlight(asset.uri, setProgress);
      telemetry.trackFeature('upload', 'upload');
      onPicked({
        uri: compressedUri,
        mimeType: asset.mimeType ?? 'video/mp4',
        fileName: asset.fileName,
        durationMs: assetDurationMs(asset.duration),
        compressed: true,
      });
      onClose();
    } catch (caught) {
      Alert.alert(
        'Could not optimize that clip',
        caught instanceof Error ? caught.message : 'Try another highlight from Camera Roll.',
      );
    } finally {
      setOptimizing(false);
      setProgress(0);
    }
  };

  const pickFromLibrary = async () => {
    if (optimizing) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to pick a Seki play.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(LIBRARY_VIDEO_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      await applyAsset(result.assets[0]);
    } catch (caught) {
      Alert.alert(
        'Could not open library',
        caught instanceof Error ? caught.message : 'Try Expo Go on a phone to pick a clip.',
      );
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!optimizing) onClose();
      }}
    >
      <View style={[styles.sheet, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>{HIGHLIGHT_PICKER_TITLE}</Text>
        <Text style={styles.lede}>{HIGHLIGHT_PICKER_LEDE}</Text>

        <AnimatedButton
          accessibilityLabel={HIGHLIGHT_LIBRARY_CTA}
          disabled={optimizing}
          haptic="medium"
          onPress={() => void pickFromLibrary()}
          contentStyle={[styles.primary, optimizing && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>{HIGHLIGHT_LIBRARY_CTA}</Text>
        </AnimatedButton>

        <AnimatedButton
          accessibilityLabel="Cancel"
          disabled={optimizing}
          haptic="light"
          onPress={onClose}
          contentStyle={[styles.ghost, optimizing && styles.disabled]}
        >
          <Text style={styles.ghostLabel}>Cancel</Text>
        </AnimatedButton>

        {optimizing ? (
          <ReanimatedView.View
            entering={FadeIn.duration(140)}
            style={[StyleSheet.absoluteFill, styles.overlay]}
            accessibilityRole="progressbar"
            accessibilityLabel={HIGHLIGHT_OPTIMIZING}
          >
            <ActivityIndicator color={FOCAL.neonJade} size="large" />
            <Text style={styles.overlayTitle}>{HIGHLIGHT_OPTIMIZING}</Text>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: barWidth }]}>
                <CardShine loopMs={1700} width={14} />
              </Animated.View>
            </View>
            <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          </ReanimatedView.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: FOCAL.videoBase,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    color: colors.onAccent,
    fontSize: 22,
    fontWeight: '800',
  },
  lede: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  primary: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  ghost: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  overlay: {
    backgroundColor: 'rgba(15,20,22,0.92)',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  overlayTitle: {
    color: FOCAL.neonJade,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  track: {
    width: '80%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: FOCAL.neonJade,
    overflow: 'hidden',
  },
  percent: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 18,
  },
  disabled: {
    opacity: 0.5,
  },
});
