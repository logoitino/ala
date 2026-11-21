/** Coach-level badge on a workout clip. The label always shows, including for guests. Tap opens the short notice.
 * @sideEffects None. The sheet is local.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View , ScrollView, useWindowDimensions} from 'react-native';

import { useSheetFrame } from '@/hooks/useSheetFrame';
import { colors, radii } from '@/constants/theme';
import { COACH_LEVEL_BADGE, COACH_LEVEL_SHEET } from '@/lib/safetyLabels';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/** @purpose The visible Coach-level move badge and its notice. */
export function CoachLevelBadge() {
  const [open, setOpen] = useState(false);
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={COACH_LEVEL_BADGE} onPress={() => setOpen(true)} style={styles.badge}>
        <Text style={styles.badgeText}>{COACH_LEVEL_BADGE}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.root}><View style={frame.dock}><View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>{COACH_LEVEL_BADGE}</Text>
          <Text style={styles.body}>{COACH_LEVEL_SHEET}</Text>
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Close coach-level notice" onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View></View></View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bodyScroll: { flexGrow: 0, flexShrink: 1, alignSelf: 'stretch' },
  bodyContent: { gap: 10, paddingBottom: 4 },
  badge: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: FOCAL.electricGold },
  badgeText: { color: FOCAL.ink, ...figtree('800'), ...TYPE.body },
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderRadius: radii.lg, backgroundColor: colors.surface, gap: 12 },
  title: { ...TYPE.title, ...figtree('800'), color: FOCAL.ink },
  body: { ...figtree('400'), ...TYPE.body,  color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radii.pill, backgroundColor: FOCAL.jadeInk },
  closeText: { color: '#F7F6F2', ...figtree('800') },
});
