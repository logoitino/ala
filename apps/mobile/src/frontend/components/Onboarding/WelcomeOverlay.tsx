/** UX-13 readable shared type preserves every action and required notice.
 * First fan visit introduces the gift mission on the Lovable welcome layout (2026-11 standard): a slowly
 * drifting wall of highlight photos behind a night gradient, the brand mark, one big headline and two
 * actions (Watch highlights, Sign in). Admin routes keep their own entry flow and leave the fan welcome
 * unseen for a later fan visit. Photos are local sample art in `assets/welcome/`; swap them there.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BrandMark } from '@/components/UI/BrandMark';
import { KitButton } from '@/components/UI/Kit';
import { colors } from '@/constants/theme';
import { useOptionalSoftWall } from '@/context/SoftWallContext';
import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from '@/data/malo';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { ONBOARDING_SEEN_KEY } from '@/lib/auth';
import { DISPLAY_TEXT, figtree, TYPE } from '@/theme/fonts';

/** Decorative wall tiles; sport labels only, never a person's name. */
const TILES: { sport: string; image: ImageSourcePropType }[] = [
  { sport: 'Football', image: require('../../../../assets/welcome/welcome-football.jpg') },
  { sport: 'Basketball', image: require('../../../../assets/welcome/welcome-basketball.jpg') },
  { sport: 'Rugby', image: require('../../../../assets/welcome/welcome-rugby.jpg') },
  { sport: 'Volleyball', image: require('../../../../assets/welcome/welcome-volleyball.jpg') },
];
const TILE_HEIGHT = 256;
const TILE_GAP = 12;
/** One full pass of four tiles; the column repeats the set so the loop is seamless. */
const LOOP = (TILE_HEIGHT + TILE_GAP) * TILES.length;
const DRIFT_MS = 40000;

/** @purpose One drifting column of photo tiles; reverse columns move the other way. */
function DriftColumn({ offset, reverse, still }: { offset: number; reverse: boolean; still: boolean }) {
  const y = useSharedValue(reverse ? -LOOP : 0);
  useEffect(() => {
    if (still) return undefined;
    y.value = withRepeat(withTiming(reverse ? 0 : -LOOP, { duration: DRIFT_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(y);
  }, [reverse, still, y]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const ordered = [...TILES.slice(offset), ...TILES.slice(0, offset)];
  return (
    <Animated.View style={[styles.column, drift]}>
      {[...ordered, ...ordered].map((tile, i) => (
        <View key={`${tile.sport}-${i}`} style={styles.tile}>
          <Image source={tile.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id="tileScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.35" stopColor="#0E1315" stopOpacity="0" />
                <Stop offset="1" stopColor="#0E1315" stopOpacity="0.92" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill="url(#tileScrim)" />
          </Svg>
          <Text style={styles.tileLabel}>{tile.sport}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * @purpose One-time first-open welcome for guests — brand, the Give. Elevate. Celebrate. message and two
 *   actions: Watch highlights explicitly opens guest-friendly Home, or Sign in opens the account sheet.
 * @sideEffects AsyncStorage `tapuai.onboardingSeen`; Sign in opens Soft-Wall `signin`.
 */
export function WelcomeOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const softWall = useOptionalSoftWall();
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
          style={styles.wall}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <DriftColumn offset={0} reverse={false} still={reduceMotion} />
          <DriftColumn offset={2} reverse still={reduceMotion} />
        </View>
        {/* Night gradient: photos read at the top, the copy sits on near-solid obsidian below. */}
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
          <Defs>
            <LinearGradient id="welcomeHero" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E1315" stopOpacity="0.2" />
              <Stop offset="0.55" stopColor="#0E1315" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#0E1315" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill="url(#welcomeHero)" />
        </Svg>
        <View style={[styles.content, { paddingBottom: insets.bottom + 32, minHeight: height * 0.5 }]}>
          <BrandMark dark size={34} />
          <Text style={styles.title} accessibilityRole="header">
            Give to the athletes you cheer for.
          </Text>
          {/* Owner-approved message (BRAND-01): plain text under the headline so it never competes with it. */}
          <View style={styles.tagline}>
            <Text style={styles.taglineHeadline}>{TAGLINE_HEADLINE}</Text>
            <Text style={styles.taglineLine}>{TAGLINE_LINE}</Text>
          </View>
          <Text style={styles.mission}>{DONATION_MISSION}</Text>
          <View style={styles.actions}>
            <KitButton
              label="Watch highlights"
              variant="light"
              size="lg"
              block
              haptic="medium"
              icon={<Ionicons name="play" size={16} color={colors.night} />}
              onPress={() => {
                router.navigate({ pathname: '/', params: { welcome: 'highlights' } });
                void dismiss();
              }}
            />
            {softWall ? (
              <KitButton
                label="Sign in"
                variant="glass"
                size="lg"
                block
                onPress={() => {
                  void dismiss();
                  softWall.requireAuth({ kind: 'signin', resume: () => undefined });
                }}
              />
            ) : null}
          </View>
          <Text style={styles.foot}>You can browse as a guest. Sign in when you are ready to give or join a Crew.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.videoSurface, overflow: 'hidden' },
  wall: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    flexDirection: 'row',
    gap: TILE_GAP,
    padding: TILE_GAP,
    opacity: 0.8,
    transform: [{ rotate: '-6deg' }, { scale: 1.15 }],
  },
  column: { flex: 1, gap: TILE_GAP },
  tile: { height: TILE_HEIGHT, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1A2124' },
  tileLabel: { ...figtree('700'), position: 'absolute', left: 10, bottom: 8, ...TYPE.caption, color: colors.onVideo },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, gap: 16 },
  title: { ...DISPLAY_TEXT, ...TYPE.display,  color: colors.onVideo, letterSpacing: -1 },
  tagline: { gap: 2 },
  taglineHeadline: { ...figtree('800'), ...TYPE.body, color: colors.glow },
  taglineLine: { ...figtree('500'), ...TYPE.body,  color: colors.onVideoMuted },
  mission: { ...figtree('500'), ...TYPE.body,  color: colors.onVideoMuted },
  actions: { gap: 12 },
  foot: { ...figtree('500'), ...TYPE.body,  color: colors.onVideoMuted, textAlign: 'center' },
});
