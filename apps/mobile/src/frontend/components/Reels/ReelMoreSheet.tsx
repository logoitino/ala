/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent. */
import { BlurView } from 'expo-blur';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { SheetRise } from '@/components/UI/SheetRise';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import { FOCAL } from '@/theme/motion';
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';

type ReelMoreSheetProps = {
  visible: boolean;
  athleteName: string;
  saved?: boolean;
  saving?: boolean;
  onClose: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onReport: () => void;
  onSuggest?: () => void;
};

/**
 * @purpose Highlights ⚡ overflow sheet: Share, Save, Report / Hide, and app-level Suggest an improvement.
 * @param visible Opens over the focused clip.
 * @param saved Bookmark state for the Save row label.
 * @returns Bottom sheet over a dark blur. Report hands off to `ReportContentModal`. Suggest is app-level, not `report_reel`.
 * @sideEffects None here — Share / `saved_reels` / `report_reel` / `submit_app_feedback` stay in the parent.
 */
export function ReelMoreSheet({
  visible,
  athleteName,
  saved = false,
  saving = false,
  onClose,
  onShare,
  onToggleSave,
  onReport,
  onSuggest,
}: ReelMoreSheetProps) {
  const frame = useSheetFrame();
  const { height } = useWindowDimensions();
  const who = athleteName.trim() || 'this highlight';

  return (
    <Modal
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable haptic="none" onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
        <SheetRise active={visible} style={[styles.sheet, frame.card, { maxHeight: height * 0.85 }]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
          <Text style={styles.kicker}>More</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {who}
          </Text>

          <AnimatedButton
            accessibilityLabel="Share this highlight"
            haptic="light"
            onPress={onShare}
            contentStyle={styles.row}
          >
            <Ionicons name="share-outline" size={20} color={colors.text} />
            <Text style={styles.rowLabel}>Share</Text>
          </AnimatedButton>

          <AnimatedButton
            accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark this highlight'}
            accessibilityState={{ disabled: saving, selected: saved }}
            disabled={saving}
            haptic="light"
            onPress={onToggleSave}
            contentStyle={[styles.row, saving && styles.busy]}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? FOCAL.jadeInk : colors.text}
            />
            <Text style={[styles.rowLabel, saved && styles.rowSaved]}>{saved ? 'Saved' : 'Save'}</Text>
          </AnimatedButton>

          <AnimatedButton
            accessibilityLabel="Report or hide this highlight"
            haptic="medium"
            onPress={onReport}
            contentStyle={styles.row}
          >
            <Ionicons name="flag-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, styles.rowDanger]}>Report / Hide</Text>
          </AnimatedButton>

          {onSuggest ? (
            <AnimatedButton
              accessibilityLabel="Suggest an improvement"
              haptic="light"
              onPress={onSuggest}
              contentStyle={styles.row}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
              <Text style={styles.rowLabel}>Suggest an improvement</Text>
            </AnimatedButton>
          ) : null}

          </ScrollView>
          <AnimatedButton
            accessibilityLabel="Close more options"
            haptic="light"
            onPress={onClose}
            contentStyle={styles.cancel}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </AnimatedButton>
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
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,10,12,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  // Content scrolls at large text sizes; dismissal keeps its own reachable row.
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 6 },
  kicker: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...DISPLAY_TEXT,
    marginBottom: 4,
  },
  row: {
    minHeight: MENU_METRICS.touchTarget,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: colors.text,
    ...TYPE.button,
    ...figtree('700'),
    flexShrink: 1,
  },
  rowSaved: {
    color: FOCAL.jadeInk,
  },
  rowDanger: {
    color: colors.danger,
  },
  busy: {
    opacity: 0.55,
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textMuted,
    ...TYPE.button,
    ...figtree('700'),
    flexShrink: 1,
  },
});
