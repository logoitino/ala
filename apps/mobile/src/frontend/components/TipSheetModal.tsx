import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { CardShine } from '@/components/Effects/CardShine';
import { TipCheckout } from '@/components/TipCheckout';
import { colors, radii } from '@/constants/theme';
import { maloAthleteCta, maloAthleteSheetSubtitle } from '@/data/malo';
import { displayValue, type Player } from '@/data/players';
import { FOCAL, SPRING_BOUNCE } from '@/theme/motion';

type TipSheetModalProps = {
  player: Player | null;
  reelId?: string;
  onClose: () => void;
  onBacked?: (nextCount: number) => void;
  onTipped?: (amountCents: number) => void;
};

/**
 * @purpose Bottom-sheet Mālo checkout over a blurred feed backdrop. Copy names the athlete who receives the gift (not the uploader).
 * @sideEffects Unmounts `TipCheckout` on dismiss so custom amount / fee state reset.
 */
export function MaloTipModal({ player, reelId, onClose, onBacked, onTipped }: TipSheetModalProps) {
  const insets = useSafeAreaInsets();
  const [delivered, setDelivered] = useState(false);
  const [busy, setBusy] = useState(false);
  const playerName = displayValue(player?.name, 'this athlete');
  const headerPop = useSharedValue(1);

  useEffect(() => {
    setDelivered(false);
    setBusy(false);
    headerPop.value = 1;
  }, [player?.id, headerPop]);

  useEffect(() => {
    if (delivered) {
      headerPop.value = 0.9;
      headerPop.value = withSpring(1, SPRING_BOUNCE);
    }
  }, [delivered, headerPop]);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerPop.value }],
  }));

  const dismiss = () => {
    if (busy) return;
    setDelivered(false);
    setBusy(false);
    onClose();
  };

  return (
    <Modal animationType="fade" transparent visible={Boolean(player)} onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdropWrap}
      >
      <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
        <BlurView intensity={48} tint="dark" pointerEvents="none" style={styles.blur} />
        <Pressable
          haptic="none"
          style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <Animated.View style={[styles.header, delivered && styles.headerDelivered, headerStyle]}>
            {delivered ? (
              <CardShine tint="rgba(0,230,118,0.4)" color="rgba(255,255,255,0.95)" loopMs={2600} />
            ) : null}
            <Text style={[styles.title, delivered && styles.successTitle]}>
              {delivered ? `SEKI! Mālo delivered to ${playerName} 🚀` : maloAthleteCta(playerName)}
            </Text>
            <Text style={styles.subtitle}>{maloAthleteSheetSubtitle(playerName)}</Text>
          </Animated.View>
          {player ? (
            <TipCheckout
              player={player}
              hideHeader
              reelId={reelId}
              onBusyChange={setBusy}
              onBacked={(nextCount) => {
                setDelivered(true);
                onBacked?.(nextCount);
              }}
              onTipped={onTipped}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={dismiss}
            style={[styles.close, busy && styles.closeDisabled]}
          >
            <Text style={styles.closeLabel}>{busy ? 'Payment in progress…' : delivered ? 'Done' : 'Close'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** @deprecated Prefer `MaloTipModal` — same sheet, blurred backdrop. */
export const TipSheetModal = MaloTipModal;

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
  },
  blur: {
    ...StyleSheet.absoluteFill,
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
  headerDelivered: {
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.mistJade,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
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
    color: colors.deepGreen,
  },
  closeDisabled: {
    opacity: 0.45,
  },
});
