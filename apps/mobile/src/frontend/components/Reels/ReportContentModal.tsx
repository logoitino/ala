/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent. */
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { SheetRise } from '@/components/UI/SheetRise';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { REPORT_REASONS, type ReportReasonId } from '@/data/contentRights';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import { FOCAL } from '@/theme/motion';
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';

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
  const { height } = useWindowDimensions();
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
        <SheetRise active={visible} style={[styles.sheet, frame.card, { maxHeight: height * 0.85 }]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={submitting ? undefined : onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} nestedScrollEnabled>
          <Text style={styles.kicker}>Safety</Text>
          <Text accessibilityRole="header" style={styles.title}>Report / Hide</Text>
          <Text style={styles.body}>
            Hide {who} from your feed. Pick a reason, then confirm.
          </Text>
          <Text style={styles.menuLabel}>
            Reason{reason ? ` · ${REPORT_REASONS.find((row) => row.id === reason)?.label ?? ''}` : ''}
          </Text>
          <ScrollView
            nestedScrollEnabled
            style={styles.reasonMenu}
            contentContainerStyle={styles.reasonMenuContent}
            showsVerticalScrollIndicator
          >
            {REPORT_REASONS.filter((row) => showCoachReason || row.id !== 'coach_level').map((row) => {
              const selected = reason === row.id;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={submitting}
                  haptic="selection"
                  onPress={() => setReason(row.id)}
                  style={[styles.reason, selected && styles.reasonOn]}
                >
                  <Text style={[styles.reasonLabel, selected && styles.reasonLabelOn]}>{row.label}</Text>
                  {selected ? <Text style={styles.reasonCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          </ScrollView>
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
  // Required context stays visible in the scrollable body; confirm/cancel stay reachable.
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 8 },
  kicker: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...DISPLAY_TEXT,
  },
  body: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('400'),
  },
  menuLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    marginTop: 2,
  },
  reasonMenu: {
    maxHeight: 200,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  reasonMenuContent: {
    paddingVertical: 4,
  },
  reason: {
    minHeight: MENU_METRICS.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasonOn: {
    backgroundColor: FOCAL.mistJade,
  },
  reasonLabel: {
    flex: 1,
    color: colors.text,
    ...TYPE.button,
    ...figtree('700'),
  },
  reasonLabelOn: {
    color: FOCAL.jadeInk,
  },
  reasonCheck: {
    color: FOCAL.jadeInk,
    ...TYPE.button,
    ...figtree('800'),
  },
  actions: {
    gap: 8,
    marginTop: 6,
  },
  reportBtn: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLabel: {
    color: '#FFFFFF',
    ...TYPE.button,
    ...figtree('800'),
    flexShrink: 1,
    textAlign: 'center',
  },
  cancelBtn: {
    minHeight: MENU_METRICS.touchTarget,
    borderRadius: MENU_METRICS.controlRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textMuted,
    ...TYPE.button,
    ...figtree('700'),
  },
  busy: {
    opacity: 0.7,
  },
});
