/**
 * The Aura trading-card sheet opened from the athlete hero's flip control (split out of AthleteProfileView.tsx for R4-03;
 * behaviour unchanged). The parent builds the card, owns the open state and passes its safe-area insets and sheet frame,
 * so hook order in AthleteProfileView is unchanged. The gesture root inside the Modal keeps tap-to-flip working.
 */
import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import type { SheetFrame } from '@/hooks/useSheetFrame';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Show the athlete's Aura trading card in a dimmed sheet with a Done button.
 * @param flipOpen Whether the sheet is requested open; it only shows when `tradingCard` exists.
 * @param setFlipOpen Closes the sheet (dim tap, Done, Android back).
 * @param tradingCard The card element built by AthleteProfileView, or null when the Look desk hides it.
 * @param insets / frame Parent's safe-area insets and sheet frame.
 */
export function AuraCardFlipModal({
  flipOpen,
  setFlipOpen,
  tradingCard,
  insets,
  frame,
}: {
  flipOpen: boolean;
  setFlipOpen: (open: boolean) => void;
  tradingCard: ReactNode;
  insets: EdgeInsets;
  frame: SheetFrame;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={flipOpen && Boolean(tradingCard)}
      onRequestClose={() => setFlipOpen(false)}
    >
      {/* A Modal is its own native root: without this the card's tap-to-flip gesture never fires. */}
      <GestureHandlerRootView style={styles.flipGestureRoot}>
      <View
        style={[
          styles.flipRoot,
          {
            paddingHorizontal: frame.dock.paddingHorizontal,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <Pressable haptic="none" style={styles.flipDim} onPress={() => setFlipOpen(false)} />
        <View style={[styles.flipSheet, frame.card]}>
          <Text style={styles.flipKicker}>Aura card</Text>
          {tradingCard}
          <AnimatedButton
            accessibilityLabel="Close Aura card"
            haptic="selection"
            onPress={() => setFlipOpen(false)}
            contentStyle={styles.flipClose}
          >
            <Text style={styles.flipCloseLabel}>Done</Text>
          </AnimatedButton>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flipGestureRoot: {
    flex: 1,
  },
  flipRoot: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,22,0.45)',
  },
  flipDim: {
    ...StyleSheet.absoluteFill,
  },
  flipSheet: {
    backgroundColor: colors.surface,
    gap: 12,
  },
  flipKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  flipClose: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipCloseLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
