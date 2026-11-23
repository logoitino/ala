/** Highlight choices fit their content while tall text/progress scrolls; draft lifetimes and the clip cap remain enforced.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedView, { FadeIn } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { CardShine } from '@/components/Effects/CardShine';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import {
  HIGHLIGHT_LIBRARY_CTA,
  HIGHLIGHT_LENGTH_UNREADABLE,
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
import { TYPE, figtree } from '@/theme/fonts';

type HighlightPickerModalProps = {
  visible: boolean;
  /** Parent account/draft lifetime; standalone callers keep the open-sheet lifetime. */
  draftKey?: object;
  isDraftCurrent?: () => boolean;
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
export function HighlightPickerModal({ visible, draftKey, isDraftCurrent, onClose, onPicked }: HighlightPickerModalProps) {
  const insets = useSafeAreaInsets();
  const sheetFrame = useSheetFrame();
  const { height } = useWindowDimensions();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const lifetime = useRef({ visible, draftKey, closed: false, flight: null as object | null });
  if (lifetime.current.visible !== visible || lifetime.current.draftKey !== draftKey)
    lifetime.current = { visible, draftKey, closed: false, flight: null };
  const frame = lifetime.current;
  const current = () => mounted.current && lifetime.current === frame && frame.visible && !frame.closed
    && (!isDraftCurrent || isDraftCurrent());
  const dismiss = () => {
    if (!current() || optimizing) return;
    frame.closed = true;
    onClose();
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    setOptimizing(false);
    setProgress(0);
  }, [visible, draftKey]);

  const applyAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!current()) return;
    // Expo 58's web picker reports seconds; native pickers report milliseconds.
    const durationMs = assetDurationMs(asset.duration, Platform.OS === 'web' ? 'seconds' : 'milliseconds');
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      Alert.alert('Clip length unavailable', HIGHLIGHT_LENGTH_UNREADABLE);
      return;
    }
    if (isHighlightTooLong(durationMs)) {
      Alert.alert('Clip too long', HIGHLIGHT_TOO_LONG);
      return;
    }

    setOptimizing(true);
    setProgress(0.08);
    try {
      const compressedUri = await compressHighlight(asset.uri, value => { if (current()) setProgress(value); });
      if (!current()) return;
      telemetry.trackFeature('upload', 'upload');
      // Refuse any remaining callback before dismissal causes the next render.
      frame.closed = true;
      setOptimizing(false);
      setProgress(0);
      onPicked({
        uri: compressedUri,
        mimeType: asset.mimeType ?? 'video/mp4',
        fileName: asset.fileName,
        durationMs,
        compressed: true,
      });
      onClose();
    } catch (caught) {
      if (!current()) return;
      Alert.alert(
        'Could not optimize that clip',
        caught instanceof Error ? caught.message : 'Try another highlight from Camera Roll.',
      );
    } finally {
      if (current()) {
        setOptimizing(false);
        setProgress(0);
      }
    }
  };

  const pickFromLibrary = async () => {
    if (optimizing || frame.flight || !current()) return;
    const flight = {};
    frame.flight = flight;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to pick a Seki play.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(LIBRARY_VIDEO_OPTIONS);
      if (!current() || result.canceled || !result.assets[0]) return;
      await applyAsset(result.assets[0]);
    } catch (caught) {
      if (!current()) return;
      Alert.alert(
        'Could not open library',
        caught instanceof Error ? caught.message : 'Try Expo Go on a phone to pick a clip.',
      );
    } finally {
      if (frame.flight === flight) frame.flight = null;
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        dismiss();
      }}
    >
      <View style={styles.root}>
        <Pressable haptic="none" disabled={optimizing} onPress={dismiss} style={StyleSheet.absoluteFill}>
          <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View pointerEvents="box-none" style={sheetFrame.dock}>
          <View style={[styles.sheet, sheetFrame.card, { maxHeight: Math.max(0, height - insets.top - insets.bottom - 24) }]}>
        <MenuBackdrop accent="jade" />
        <SheetHandle onDismiss={optimizing ? undefined : dismiss} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} keyboardShouldPersistTaps="handled">
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
        </ScrollView>

        <AnimatedButton
          accessibilityLabel="Cancel"
          disabled={optimizing}
          haptic="light"
          onPress={dismiss}
          contentStyle={[styles.ghost, optimizing && styles.disabled]}
        >
          <Text style={styles.ghostLabel}>Cancel</Text>
        </AnimatedButton>

        {optimizing ? (
          <ReanimatedView.View
            entering={FadeIn.duration(140)}
            style={[StyleSheet.absoluteFill, styles.overlay]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={HIGHLIGHT_OPTIMIZING}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            <ScrollView style={styles.progressScroll} contentContainerStyle={styles.progressContent} bounces={false}>
            <ActivityIndicator color={FOCAL.neonJade} size="large" />
            <Text style={styles.overlayTitle}>{HIGHLIGHT_OPTIMIZING}</Text>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: barWidth }]}>
                <CardShine loopMs={1700} width={14} />
              </Animated.View>
            </View>
            <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
            </ScrollView>
          </ReanimatedView.View>
        ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,10,12,0.45)' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 12 },
  progressScroll: { alignSelf: 'stretch', flexGrow: 1, flexShrink: 1 },
  progressContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  sheet: {
    backgroundColor: colors.background,
    gap: 12,
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  lede: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
    marginBottom: 8,
  },
  primary: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    ...figtree('800'),
    ...TYPE.body,
    textAlign: 'center',
  },
  ghost: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: colors.textMuted,
    ...figtree('700'),
    ...TYPE.button,
    textAlign: 'center',
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
    ...figtree('800'),
    ...TYPE.section,
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
    ...figtree('800'),
    ...TYPE.title,
  },
  disabled: {
    opacity: 0.5,
  },
});
