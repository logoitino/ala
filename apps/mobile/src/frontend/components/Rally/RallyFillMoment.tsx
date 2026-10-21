import { Modal, Share, StyleSheet, Text, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { rallyShareMessage } from '@/lib/shareCard';
import { FOCAL } from '@/theme/motion';

const COLORS = [FOCAL.neonJade, FOCAL.electricGold, '#FFFFFF'];

/**
 * @purpose Full-screen moment when a Rally fills: the goal name, who it was for, and the thank-you clip.
 * @param visible Shown on the live → filled transition.
 * @param title The Rally's name.
 * @param athleteName Who the community was supporting.
 * @param onWatch Opens the "what it paid for" clip when the family attached one.
 * @param giftUrl Public gift link included on the share card (username or athlete-id link).
 * @param onClose Dismisses the moment.
 * @sideEffects The share button opens the device share sheet with the filled-Rally message.
 */
export function RallyFillMoment({
  visible,
  title,
  athleteName,
  giftUrl,
  onWatch,
  onClose,
}: {
  visible: boolean;
  title: string;
  athleteName: string;
  giftUrl?: string | null;
  onWatch?: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {visible ? <ConfettiCannon count={140} origin={{ x: 180, y: 0 }} fadeOut colors={COLORS} autoStart /> : null}
        <Text style={styles.kicker}>Goal reached</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          {athleteName}&apos;s community filled this Rally. Thank you for showing up.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share this Rally"
          onPress={() => { void Share.share({ message: rallyShareMessage(title, athleteName, giftUrl) }); }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Share this Rally</Text>
        </Pressable>
        {onWatch ? (
          <Pressable accessibilityRole="button" onPress={onWatch} style={styles.primary}>
            <Text style={styles.primaryText}>▶ Watch what it paid for</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
          <Text style={styles.secondaryText}>Keep watching</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(8, 18, 14, 0.92)',
  },
  kicker: {
    color: FOCAL.electricGold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  primary: {
    marginTop: 8,
    backgroundColor: FOCAL.neonJade,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryText: {
    color: colors.deepGreen,
    fontWeight: '800',
    fontSize: 16,
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
