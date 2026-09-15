import { StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';
import { FOCAL } from '@/theme/motion';
import type { UserRole } from '@/types/database';

const FAN_SURFACES: UserRole[] = ['guest', 'fan', 'athlete'];

/**
 * @purpose Exit hatch back to `/admin` while Studio is previewing Operator / Parent / Booster / Sponsor.
 * Hidden on fan chrome (Guest / Fan / Athlete) so production Home stays clean.
 */
export function StudioPreviewBar() {
  const { role, studioUnlocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const onFanChrome = FAN_SURFACES.includes(role);

  if (!studioUnlocked || onAdmin || onFanChrome) return null;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Text style={styles.copy}>
        Studio preview · {ROLE_LABELS[role]}
      </Text>
      <AnimatedButton
        haptic="selection"
        accessibilityLabel="Back to admin portal"
        contentStyle={styles.cta}
        onPress={() => router.push('/admin')}
      >
        <Text style={styles.ctaLabel}>Admin portal</Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  copy: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cta: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: FOCAL.ink,
    fontSize: 13,
    fontWeight: '800',
  },
});
