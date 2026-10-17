/** Coach-level badge on a workout clip. The label always shows, including for guests. Tap opens the short notice.
 * @sideEffects None. The sheet is local.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { COACH_LEVEL_BADGE, COACH_LEVEL_SHEET } from '@/lib/safetyLabels';
import { FOCAL } from '@/theme/motion';

/** @purpose The visible Coach-level move badge and its notice. */
export function CoachLevelBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={COACH_LEVEL_BADGE} onPress={() => setOpen(true)} style={styles.badge}>
        <Text style={styles.badgeText}>{COACH_LEVEL_BADGE}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>{COACH_LEVEL_BADGE}</Text>
          <Text style={styles.body}>{COACH_LEVEL_SHEET}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close coach-level notice" onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: FOCAL.electricGold },
  badgeText: { color: FOCAL.ink, fontWeight: '800', fontSize: 13 },
  sheet: { marginTop: 'auto', margin: 16, padding: 20, borderRadius: radii.lg, backgroundColor: colors.surface, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: FOCAL.ink },
  body: { fontSize: 16, lineHeight: 22, color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radii.pill, backgroundColor: FOCAL.jadeInk },
  closeText: { color: '#F7F6F2', fontWeight: '800' },
});
