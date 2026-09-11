import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TipCheckout } from '@/components/TipCheckout';
import { colors, radii } from '@/constants/theme';
import { displayValue, type Player } from '@/data/players';

type TipSheetModalProps = {
  player: Player | null;
  onClose: () => void;
  onBacked?: (nextCount: number) => void;
};

export function TipSheetModal({ player, onClose, onBacked }: TipSheetModalProps) {
  const insets = useSafeAreaInsets();
  const [delivered, setDelivered] = useState(false);
  const playerName = displayValue(player?.name, 'this athlete');

  useEffect(() => {
    setDelivered(false);
  }, [player?.id]);

  return (
    <Modal animationType="slide" transparent visible={Boolean(player)} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, delivered && styles.successTitle]}>
              {delivered ? 'SEKI! MĀLO DELIVERED! 🚀' : 'Drop a Mālo'}
            </Text>
            <Text style={styles.subtitle}>
              Send direct financial support to {playerName}
            </Text>
          </View>
          {player ? (
            <TipCheckout
              player={player}
              onBacked={(nextCount) => {
                setDelivered(true);
                onBacked?.(nextCount);
              }}
            />
          ) : null}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>{delivered ? 'Done' : 'Close'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  successTitle: {
    color: colors.deepGreen,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  close: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
