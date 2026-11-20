/**
 * Upload ＋ chooser (owner 2026-10-16: posting must be one easy tap for every kind of user). Highlight opens the
 * existing athlete clip composer; Beyond moment opens the reviewed Beyond the Game composer. Story-focused
 * copy keeps the destination and review requirements clear. Tall text scrolls inside the sheet, leaving
 * its dismiss handle reachable. No upload happens here. 2026-11-08 density: hugs content (not 90% height).
 */
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
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

type UploadChoiceSheetProps = {
  visible: boolean;
  onHighlight: () => void;
  onBeyond: () => void;
  onClose: () => void;
};

/**
 * @purpose Ask what the fan is posting before any composer opens, in plain words that say where it shows up.
 * @param onHighlight Athlete clip (game, workout or service) → Highlights, where fans can donate.
 * @param onBeyond Own workout, service, learning or story → reviewed Beyond the Game post, no athlete needed.
 * @sideEffects None — the parent opens the matching composer.
 */
export function UploadChoiceSheet({ visible, onHighlight, onBeyond, onClose }: UploadChoiceSheetProps) {
  const frame = useSheetFrame();
  const { height } = useWindowDimensions();
  return (
    <Modal animationType="none" presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable haptic="none" onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
          <SheetRise active={visible} style={[styles.sheet, frame.card, { maxHeight: height * 0.72 }]}>
            <MenuBackdrop accent="jade" />
            <SheetHandle onDismiss={onClose} />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={styles.title}>What are you sharing?</Text>
              <Text style={styles.intro}>The big play. The work behind it. The moments that make you.</Text>

              <AnimatedButton
                accessibilityRole="button"
                accessibilityLabel="Highlight. An athlete's game play, workout or service. Shared in Highlights, where fans can give."
                haptic="light"
                onPress={onHighlight}
                contentStyle={styles.option}
              >
                <View style={styles.icon}><Ionicons name="flash" size={20} color={FOCAL.jadeInk} /></View>
                <View style={styles.copy}>
                  <Text style={styles.optionTitle}>Highlight</Text>
                  <Text style={styles.optionBody}>Athlete game play, workout or service — in Highlights, where fans can give.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedButton>

              <AnimatedButton
                accessibilityRole="button"
                accessibilityLabel="Beyond moment. Your own workout, service, learning or everyday story. No athlete needed. Reviewed before sharing."
                haptic="light"
                onPress={onBeyond}
                contentStyle={styles.option}
              >
                <View style={styles.icon}><Ionicons name="compass" size={20} color={FOCAL.jadeInk} /></View>
                <View style={styles.copy}>
                  <Text style={styles.optionTitle}>Beyond moment</Text>
                  <Text style={styles.optionBody}>Your workout, service, learning or story — reviewed before sharing. No athlete needed.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedButton>

            </ScrollView>
              <AnimatedButton accessibilityLabel="Cancel" haptic="light" onPress={onClose} contentStyle={styles.cancel}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </AnimatedButton>
          </SheetRise>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,10,12,0.45)' },
  sheet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 8, paddingBottom: 2 },
  title: { ...DISPLAY_TEXT, color: colors.text, ...TYPE.title },
  intro: { ...figtree('400'), color: colors.textMuted, ...TYPE.body, marginBottom: 4 },
  option: {
    minHeight: MENU_METRICS.touchTarget,
    borderRadius: MENU_METRICS.cardRadius,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: FOCAL.mistJade },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  optionTitle: { ...figtree('800'), color: colors.text, ...TYPE.section },
  optionBody: { ...figtree('600'), color: colors.textMuted, ...TYPE.body },
  cancel: { minHeight: MENU_METRICS.touchTarget, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { ...figtree('700'), color: colors.textMuted, ...TYPE.button },
});
