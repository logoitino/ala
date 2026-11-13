/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent. */
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { SheetRise } from '@/components/UI/SheetRise';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { REPORT_REASONS, type ReportReasonId } from '@/data/contentRights';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';

type ReportContentModalProps = {
  visible: boolean;
  athleteName?: string;
  submitting?: boolean;
  showCoachReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: Exclude<ReportReasonId, 'unspecified'>) => void;
};

/**
 * @purpose Confirm Report / Hide Highlight 🚩 for a Reel. The fan picks a reason first.
 * Confirm writes `report_reel` and hides the clip from this device.
 * @param visible Opens over the Reel feed.
 * @param onConfirm Parent hides the clip, toasts, and calls `report_reel` with the reason.
 * @returns Blurred confirm sheet.
 * @sideEffects None here — persistence lives in the parent / OfflineQueue.
 */
export function ReportContentModal({
  visible,
  athleteName,
  submitting = false,
  showCoachReason = true,
  onClose,
  onConfirm,
}: ReportContentModalProps) {
  const frame = useSheetFrame();
  const who = athleteName?.trim() ? `@${athleteName.trim()}` : 'this highlight';
  const [reason, setReason] = useState<Exclude<ReportReasonId, 'unspecified'> | null>(null);

  useEffect(() => {
    if (!visible) setReason(null);
  }, [visible]);

  return (
    <Modal
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.root, Platform.OS === 'web' ? styles.webRoot : undefined]}>
        <Pressable haptic="none" disabled={submitting} onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
        <SheetRise active={visible} style={[styles.sheet, frame.card]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={submitting ? undefined : onClose} />
          <Text style={styles.kicker}>Safety</Text>
          <Text style={styles.title}>Report / Hide Highlight 🚩</Text>
          <Text style={styles.body}>
            Hide {who} from your feed. Tell us what is wrong so we can review it. It will not show on this account again.
          </Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.filter((row) => showCoachReason || row.id !== 'coach_level').map((row) => {
              const selected = reason === row.id;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={submitting}
                  onPress={() => setReason(row.id)}
                  style={[styles.reason, selected && styles.reasonOn]}
                >
                  <Text style={[styles.reasonLabel, selected && styles.reasonLabelOn]}>{row.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <AnimatedButton
              accessibilityLabel="Report and hide this highlight"
              disabled={submitting || !reason}
              haptic="medium"
              onPress={() => {
                if (reason) onConfirm(reason);
              }}
              contentStyle={[styles.reportBtn, (submitting || !reason) && styles.busy]}
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
        </SheetRise>
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
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
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
  reasons: {
    gap: 8,
    marginTop: 4,
  },
  reason: {
    minHeight: 44,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reasonOn: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  reasonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  reasonLabelOn: {
    color: colors.primary,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  reportBtn: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
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
    borderRadius: MENU_METRICS.controlRadius,
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
