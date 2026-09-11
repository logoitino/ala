import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

import { useCelebration } from '@/context/CelebrationContext';
import { cardShadow, colors, radii } from '@/constants/theme';

const CONFETTI_COLORS = ['#C45C26', '#0B3D2E', '#F4C430', '#FFFFFF', '#E8CFC0', '#166534'];

export function BackedCelebration() {
  const { payload, dismiss } = useCelebration();
  const [burstKey, setBurstKey] = useState(0);
  const width = Dimensions.get('window').width;

  useEffect(() => {
    if (payload) setBurstKey((current) => current + 1);
  }, [payload]);

  const origin = useMemo(() => ({ x: width / 2, y: -12 }), [width]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(payload)}
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        {payload ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ConfettiCannon
              key={burstKey}
              count={220}
              origin={origin}
              fadeOut
              explosionSpeed={420}
              fallSpeed={2800}
              colors={CONFETTI_COLORS}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.kicker}>SEKI! MĀLO DELIVERED! 🚀</Text>
          <Text style={styles.headline}>
            YOU BACKED {payload?.playerName.toUpperCase()}! 🏈
          </Text>
          <Text style={styles.backers}>{payload?.backerCount ?? 0} Backers Tonight</Text>
          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>Keep backing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 61, 46, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 12,
    alignItems: 'center',
    ...cardShadow,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  backers: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  button: {
    marginTop: 8,
    minHeight: 52,
    minWidth: 180,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
