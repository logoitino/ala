import { StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { firstEnabledFanHref } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Full-screen pause when admin published a layout or tab flag off.
 */
export function RuntimePaused({ title, lede }: { title: string; lede: string }) {
  const router = useRouter();
  const { live } = useAppRuntime();
  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={title}>
      <Text style={styles.kicker}>Paused from admin</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{lede}</Text>
      <AnimatedButton
        haptic="medium"
        accessibilityLabel="Back to Home"
        contentStyle={styles.cta}
        onPress={() => router.replace(firstEnabledFanHref(live) as Href)}
      >
        <Text style={styles.ctaLabel}>Back to Home</Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  kicker: {
    color: FOCAL.electricGold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 420,
  },
  cta: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: FOCAL.backgroundBase,
    fontSize: 15,
    fontWeight: '800',
  },
});
