import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardShine } from '@/components/Effects/CardShine';
import { useCelebration } from '@/context/CelebrationContext';
import { radii } from '@/constants/theme';
import { FOCAL, SPRING_BOUNCE } from '@/theme/motion';

/**
 * @purpose Top-of-screen toast for Aura grants and exclusive subscribe unlocks.
 * @returns Floating jade banner; custom `message` when set (subscribe, Q&A), else `+N Aura Points Earned!`.
 * @sideEffects Auto-dismisses after ~2.4s via CelebrationContext.
 */
export function AuraToast() {
  const insets = useSafeAreaInsets();
  const { auraToast, dismissAura } = useCelebration();
  const sparkScale = useSharedValue(1);

  useEffect(() => {
    if (!auraToast) return;
    const timer = setTimeout(() => dismissAura(), auraToast.message ? 2800 : 2200);
    return () => clearTimeout(timer);
  }, [auraToast, dismissAura]);

  useEffect(() => {
    if (!auraToast) return;
    sparkScale.value = 0.5;
    sparkScale.value = withDelay(80, withSequence(withSpring(1.35, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE)));
  }, [auraToast, sparkScale]);

  const sparkStyle = useAnimatedStyle(() => ({ transform: [{ scale: sparkScale.value }] }));

  if (!auraToast) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)} style={styles.toast}>
        <CardShine loopMs={1600} width={30} tint={`${FOCAL.electricGold}80`} />
        <Animated.Text style={[styles.spark, sparkStyle]}>⚡</Animated.Text>
        <Text style={styles.label}>
          {auraToast.message ?? `+${auraToast.points} Aura Points Earned!`}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 80,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FOCAL.neonJade,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    shadowColor: FOCAL.neonJade,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  spark: {
    fontSize: 16,
  },
  label: {
    color: FOCAL.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
