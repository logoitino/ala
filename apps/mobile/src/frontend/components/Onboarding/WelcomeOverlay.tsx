/**
 * First fan visit introduces the gift mission on a full-screen night hero (2026-11 design refresh).
 * Admin routes keep their own entry flow and leave the fan welcome unseen for a later fan visit.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KitButton } from '@/components/UI/Kit';
import { SportIcon } from '@/components/UI/SportIcon';
import { colors, KIT } from '@/constants/theme';
import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from '@/data/malo';
import { ONBOARDING_SEEN_KEY } from '@/lib/auth';
import { FOCAL } from '@/theme/motion';

/** Decorative sport tiles behind the headline; hidden from screen readers and never name a real athlete. */
const TILE_SPORTS = ['Football', 'Basketball', 'Volleyball', 'Rugby', 'Soccer', 'Baseball', 'Track', 'Wrestling', 'Softball'];

/**
 * @purpose One-time first-open welcome for guests — brand + support story and the Give. Elevate. Celebrate.
 *   message, then Watch highlights (no account wall).
 * @sideEffects AsyncStorage `tapuai.onboardingSeen`.
 */
export function WelcomeOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
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
    <Modal animationType="fade" visible={visible && !adminRoute} onRequestClose={() => void dismiss()}>
      <View style={styles.screen}>
        <View
          style={[styles.collage, { top: insets.top + 12 }]}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {TILE_SPORTS.map((sport, i) => (
            <View key={sport} style={[styles.tile, i % 2 === 1 && styles.tileTall, i % 3 === 0 && styles.tileJade]}>
              <SportIcon sport={sport} color={i % 3 === 0 ? FOCAL.neonJade : colors.onVideoMuted} size={28} />
              <Text style={styles.tileLabel}>{sport}</Text>
            </View>
          ))}
        </View>
        <View style={styles.fade} />
        <View style={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkLabel}>T</Text>
            </View>
            <Text style={styles.brand}>Tapua&apos;i</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Give to the athletes you cheer for.
          </Text>
          <Text style={styles.body}>
            {DONATION_MISSION} Watch their highlights, cheer your school, and give in a few taps — so student-athletes
            feel believed in.
          </Text>
          {/* Owner-approved message (BRAND-01): plain text under the mission so it never competes with the title. */}
          <View style={styles.tagline}>
            <Text style={styles.taglineHeadline}>{TAGLINE_HEADLINE}</Text>
            <Text style={styles.taglineLine}>{TAGLINE_LINE}</Text>
          </View>
          <KitButton
            label="Watch highlights"
            variant="light"
            size="lg"
            block
            haptic="medium"
            onPress={() => void dismiss()}
          />
          <Text style={styles.foot}>You can browse as a guest. Sign in when you are ready to give or join a Crew.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.videoSurface,
    overflow: 'hidden',
  },
  collage: {
    position: 'absolute',
    left: -24,
    right: -24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    transform: [{ rotate: '-6deg' }],
    opacity: 0.85,
  },
  tile: {
    width: '30%',
    height: 120,
    borderRadius: 20,
    backgroundColor: KIT.obsidianRaised,
    borderWidth: 1,
    borderColor: KIT.onVideoLine,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: 12,
    gap: 6,
  },
  tileTall: { height: 150 },
  tileJade: { backgroundColor: '#123A2E' },
  tileLabel: { color: colors.onVideoMuted, fontSize: 12, fontWeight: '700' },
  fade: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    top: '30%',
    backgroundColor: 'rgba(14,19,21,0.82)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    gap: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  brand: { color: colors.onVideo, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  title: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '900',
    color: colors.onVideo,
    letterSpacing: -1,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: colors.onVideoMuted,
  },
  tagline: { gap: 2, marginBottom: 6 },
  taglineHeadline: { fontSize: 15, fontWeight: '800', color: FOCAL.neonJade },
  taglineLine: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.onVideoMuted },
  foot: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.onVideoMuted,
    textAlign: 'center',
  },
});
