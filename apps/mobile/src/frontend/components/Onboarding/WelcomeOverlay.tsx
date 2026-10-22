/**
 * First fan visit introduces the gift mission using shared Daylight chrome.
 * Admin routes keep their own entry flow and leave the fan welcome unseen for a later fan visit.
 */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from '@/data/malo';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { ONBOARDING_SEEN_KEY } from '@/lib/auth';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose One-time first-open welcome for guests — brand + support story and the Donate. Elevate. Celebrate. message,
 *   then Watch highlights (no account wall).
 * @sideEffects AsyncStorage `tapuai.onboardingSeen`.
 */
export function WelcomeOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const frame = useSheetFrame();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((value) => {
        if (active && value !== '1') setVisible(true);
      })
      .catch(() => {
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  };

  // Admin visits must not obscure controls or consume the welcome reserved for the fan app.
  const adminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  return (
    <Modal animationType="fade" transparent visible={visible && !adminRoute} onRequestClose={() => void dismiss()}>
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: frame.dock.paddingHorizontal,
          },
        ]}
      >
        <View style={[styles.card, frame.card]}>
          <MenuBackdrop accent="gold" />
          <Text style={styles.brand}>Tapua&apos;i</Text>
          <Text style={styles.title}>Give to the athletes you cheer for.</Text>
          <Text style={styles.body}>
            {DONATION_MISSION} Watch their highlights, cheer your school, and give in a few taps — so our kids feel
            believed in.
          </Text>
          {/* Owner-approved message (BRAND-01): plain text under the mission so it never competes with the title. */}
          <View style={styles.tagline}>
            <Text style={styles.taglineHeadline}>{TAGLINE_HEADLINE}</Text>
            <Text style={styles.taglineLine}>{TAGLINE_LINE}</Text>
          </View>
          <AnimatedButton
            accessibilityLabel="Watch highlights"
            haptic="medium"
            onPress={() => void dismiss()}
            contentStyle={styles.cta}
          >
            <Text style={styles.ctaLabel}>Watch highlights</Text>
          </AnimatedButton>
          <Text style={styles.foot}>You can browse as a guest. Sign in when you are ready to give or join a Crew.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,22,0.72)',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tagline: {
    gap: 2,
  },
  taglineHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: FOCAL.jadeInk,
  },
  taglineLine: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  cta: {
    marginTop: 8,
    backgroundColor: FOCAL.jadeInk,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  foot: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
