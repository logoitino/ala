import { BlurView } from 'expo-blur';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

type ReelMoreSheetProps = {
  visible: boolean;
  athleteName: string;
  saved?: boolean;
  saving?: boolean;
  onClose: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onReport: () => void;
};

/**
 * @purpose Highlights ⚡ overflow sheet: Share, Save, and Report / Hide so the Reel rail stays Seki / Aura / Flex / Mālo / ⋯.
 * @param visible Opens over the focused clip.
 * @param saved Bookmark state for the Save row label.
 * @returns Bottom sheet over a dark blur. Report hands off to `ReportContentModal`.
 * @sideEffects None here — Share / `saved_reels` / `report_reel` stay in the parent.
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
}: ReelMoreSheetProps) {
  const insets = useSafeAreaInsets();
  const who = athleteName.trim() || 'this highlight';

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
        <Pressable haptic="none" onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>More</Text>
          <Text style={styles.title} numberOfLines={1}>
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
              color={saved ? FOCAL.neonJade : colors.text}
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

          <AnimatedButton
            accessibilityLabel="Close more options"
            haptic="light"
            onPress={onClose}
            contentStyle={styles.cancel}
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
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,10,12,0.45)',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  row: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowSaved: {
    color: FOCAL.neonJade,
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
    fontSize: 15,
    fontWeight: '700',
  },
});
