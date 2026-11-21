/**
 * Full-screen thank-you moment after a gift succeeds (confetti + card).
 * Driven by `CelebrationContext`: any screen sets a payload, this component, mounted once at the app root,
 * shows it and clears it on dismiss.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';

import { CardShine } from '@/components/Effects/CardShine';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { useCelebration } from '@/context/CelebrationContext';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { SPRING_FLIP } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const CONFETTI_COLORS = [colors.accent, colors.primary, colors.gold, '#FFFFFF', colors.success];

export function BackedCelebration() {
  const insets = useSafeAreaInsets();
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const { payload, dismiss } = useCelebration();
  const [burstKey, setBurstKey] = useState(0);
  const width = Dimensions.get('window').width;
  const cardEntrance = useSharedValue(0);

  useEffect(() => {
    if (payload) {
      setBurstKey((current) => current + 1);
      cardEntrance.value = 0;
      cardEntrance.value = withSpring(1, SPRING_FLIP);
    }
  }, [cardEntrance, payload]);

  const origin = useMemo(() => ({ x: width / 2, y: -12 }), [width]);

  const cardEntranceStyle = useAnimatedStyle(() => ({
    opacity: cardEntrance.value,
    transform: [{ scale: 0.85 + cardEntrance.value * 0.15 }],
  }));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(payload)}
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingHorizontal: frame.dock.paddingHorizontal,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {payload?.auraPointsEarned ? (
          <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 10 }]}>
            <View style={styles.toast}>
              <Text style={styles.toastLabel}>+{payload.auraPointsEarned} Aura Points Earned! ⚡</Text>
            </View>
          </View>
        ) : null}
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

        <Animated.View style={[styles.card, frame.card, { maxHeight: windowHeight * 0.85 }, cardEntranceStyle]}>
          <CardShine loopMs={2400} width={70} tint="rgba(0,230,118,0.35)" />
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>MĀLO! GIFT SENT 🚀</Text>
          <Text style={styles.headline}>
            YOU SENT A GIFT TO {payload?.playerName.toUpperCase()}! 🏈
          </Text>
          <Text style={styles.backers}>{payload?.backerCount ?? 0} Supporters Tonight</Text>
          {payload?.auraPointsEarned ? (
            <Text style={styles.auraEarned}>+{payload.auraPointsEarned} Aura Points Earned! ⚡</Text>
          ) : null}
          </ScrollView>
          <AnimatedButton
            accessibilityLabel="Keep watching"
            haptic="medium"
            contentStyle={styles.button}
            onPress={dismiss}
          >
            <Text style={styles.buttonLabel}>Keep watching</Text>
          </AnimatedButton>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bodyScroll: { flexGrow: 0, flexShrink: 1, alignSelf: 'stretch' },
  bodyContent: { gap: 10, paddingBottom: 4, alignItems: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 61, 46, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 4,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  toastLabel: {
    color: colors.onAccent,
    ...TYPE.button,
    ...figtree('800'),
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    gap: 12,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  headline: {
    ...TYPE.display,

    ...figtree('800'),
    color: colors.deepGreen,
    textAlign: 'center',
  },
  backers: {
    ...TYPE.title,
    ...figtree('700'),
    color: colors.text,
  },
  auraEarned: {
    ...TYPE.body,
    ...figtree('800'),
    color: colors.primary,
    textAlign: 'center',
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
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('800'),
  },
  pressed: {
    opacity: 0.88,
  },
});
