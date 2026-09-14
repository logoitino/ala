import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { isDevMode } from '@/data/devPersonas';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Full-screen lock when `profiles.is_admin` and Studio unlock are both false.
 */
export function AccessRestricted() {
  const router = useRouter();
  const { unlockStudio } = useAuth();
  const canUnlock = isDevMode();

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel="Access Restricted">
      <Text style={styles.kicker}>Tapua'i Admin</Text>
      <Text style={styles.title}>Access Restricted</Text>
      <Text style={styles.body}>
        This dashboard is only for Tapua'i admins. Sign in with an admin account
        {canUnlock ? ', or unlock Studio on this Expo Go device.' : '.'}
      </Text>
      {canUnlock ? (
        <AnimatedButton
          haptic="medium"
          accessibilityLabel="Unlock Studio"
          contentStyle={styles.cta}
          onPress={() => void unlockStudio()}
        >
          <Text style={styles.ctaLabel}>Unlock Studio</Text>
        </AnimatedButton>
      ) : null}
      <AnimatedButton
        haptic="medium"
        accessibilityLabel="Back to Home"
        contentStyle={canUnlock ? styles.secondary : styles.cta}
        onPress={() => router.replace('/')}
      >
        <Text style={canUnlock ? styles.secondaryLabel : styles.ctaLabel}>Back to Home</Text>
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
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
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
  secondary: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
