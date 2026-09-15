import { BlurView } from 'expo-blur';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';

type ReportContentModalProps = {
  visible: boolean;
  athleteName?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * @purpose Confirm Report / Hide Highlight 🚩 for a Reel. Confirm writes `report_reel` and hides the clip from this device.
 * @param visible Opens over the Reel feed.
 * @param onConfirm Parent hides the clip, toasts, and calls `report_reel` (or queues it offline).
 * @returns Blurred confirm sheet.
 * @sideEffects None here — persistence lives in the parent / OfflineQueue.
 */
export function ReportContentModal({
  visible,
  athleteName,
  submitting = false,
  onClose,
  onConfirm,
}: ReportContentModalProps) {
  const insets = useSafeAreaInsets();
  const who = athleteName?.trim() ? `@${athleteName.trim()}` : 'this highlight';

  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.root, Platform.OS === 'web' ? styles.webRoot : undefined]}>
        <Pressable haptic="none" disabled={submitting} onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>Safety</Text>
          <Text style={styles.title}>Report / Hide Highlight 🚩</Text>
          <Text style={styles.body}>
            Hide {who} from your feed. We flag the clip for review and it will not show on this account again.
          </Text>
          <AnimatedButton
            accessibilityLabel="Report and hide this highlight"
            disabled={submitting}
            haptic="medium"
            onPress={onConfirm}
            contentStyle={[styles.reportBtn, submitting && styles.busy]}
          >
            <Text style={styles.reportLabel}>{submitting ? 'Reporting…' : 'Report and hide'}</Text>
          </AnimatedButton>
          <AnimatedButton
            accessibilityLabel="Cancel report"
            disabled={submitting}
            haptic="light"
            onPress={onClose}
            contentStyle={styles.cancelBtn}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </AnimatedButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.border,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  reportBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  busy: {
    opacity: 0.7,
  },
});
