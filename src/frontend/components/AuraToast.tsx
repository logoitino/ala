import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCelebration } from '@/context/CelebrationContext';
import { colors, radii } from '@/constants/theme';

/**
 * @purpose Top-of-screen toast for Aura grants and exclusive subscribe unlocks.
 * @returns Floating banner; custom `message` when set (subscribe, Q&A), else `+N Aura Points Earned! ⚡`.
 * @sideEffects Auto-dismisses after ~2.4s via CelebrationContext.
 */
export function AuraToast() {
  const insets = useSafeAreaInsets();
  const { auraToast, dismissAura } = useCelebration();

  useEffect(() => {
    if (!auraToast) return;
    const timer = setTimeout(() => dismissAura(), auraToast.message ? 2800 : 2200);
    return () => clearTimeout(timer);
  }, [auraToast, dismissAura]);

  if (!auraToast) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)} style={styles.toast}>
        <Text style={styles.label}>
          {auraToast.message ?? `+${auraToast.points} Aura Points Earned! ⚡`}
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
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  label: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
