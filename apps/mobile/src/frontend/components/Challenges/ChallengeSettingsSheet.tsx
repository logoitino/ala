/** Account sheet for workout-challenge mute, private badges, and the owner's data export.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { colors } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { ChallengeSettings } from './ChallengeSettings';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose Workout challenges live in Account settings, off the profile scroll.
 * @param visible Whether the sheet is open.
 * @param onClose Dismisses the sheet.
 * @returns A scrolling account sheet, or nothing while it is closed.
 * @sideEffects Challenge settings read and write only while the sheet is open.
 */
export function ChallengeSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={frame.dock}><View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>Workout challenges</Text>
            <ChallengeSettings active={visible} />
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Close workout challenges" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View></View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 24, 18, 0.45)' },
  sheet: {

    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: { ...TYPE.title, ...figtree('800'), color: colors.text, letterSpacing: -0.3 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingBottom: 8, gap: 8 },
  close: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  closeLabel: { ...TYPE.body, ...figtree('700'), color: colors.textMuted },
});
