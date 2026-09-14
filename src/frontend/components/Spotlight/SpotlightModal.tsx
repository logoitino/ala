import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { auraBadgeLabel, auraTierForPoints, resolveAuraPoints } from '@/lib/aura';
import {
  SPOTLIGHT_CLOSE_LABEL,
  SPOTLIGHT_DISMISS_LABEL,
  SPOTLIGHT_TIP_LABEL,
  SPOTLIGHT_WATCH_LABEL,
  spotlightBadgeLabel,
  spotlightShotByLabel,
} from '@/lib/spotlight';
import { FOCAL, JADE_BORDER_GLOW, SPRING_CARD } from '@/theme/motion';
import type { Player, SpotlightAward } from '@/types/database';

type SpotlightModalProps = {
  award: SpotlightAward | null;
  visible: boolean;
  /** Board replay: Close does not write the launch dismiss key. */
  replay?: boolean;
  onDismiss: () => void;
  onSupport: (player: Player, reelId?: string) => void;
  onWatch: (reelId?: string | null, playerId?: string) => void;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Start muted loop playback only while the native `VideoPlayer` is still owned by `useVideoPlayer`.
 * @param player Spotlight loop player.
 */
function playSpotlight(player: VideoPlayer) {
  try {
    player.loop = true;
    player.muted = true;
    player.play();
  } catch {
    // Native shared object already released (Strict Mode remount / Modal teardown).
  }
}

/**
 * @purpose Full-screen Player of the Week/Month popup: looped winning Highlight, 7-tier Aura portrait, Mālo + watch CTAs.
 * @param award Active `spotlight_awards` row (plus hydrated player / video URL).
 * @param visible True when this fan has not dismissed the current week/month window.
 * @param onDismiss Launch popup writes AsyncStorage seen; board replay just closes.
 * @param replay When true, the close control is **Close** (Spotlight tab).
 * @param onSupport Opens the Mālo tip sheet for the spotlight athlete.
 * @param onWatch Jumps the Highlights ⚡ feed to the winning clip.
 * @returns Modal over Highlights. Stays mounted after hide so `expo-video` can release without `pause()` on a dead native object.
 * @sideEffects `expo-video` looped muted preview; haptics on CTAs.
 */
export function SpotlightModal({
  award,
  visible,
  replay = false,
  onDismiss,
  onSupport,
  onWatch,
}: SpotlightModalProps) {
  if (!award) return null;
  return (
    <SpotlightBody
      award={award}
      visible={visible}
      replay={replay}
      onDismiss={onDismiss}
      onSupport={onSupport}
      onWatch={onWatch}
    />
  );
}

function SpotlightBody({
  award,
  visible,
  replay = false,
  onDismiss,
  onSupport,
  onWatch,
}: SpotlightModalProps & { award: SpotlightAward }) {
  const insets = useSafeAreaInsets();
  const player = award.player;
  const athleteName = displayValue(player?.name, 'Spotlight athlete');
  const auraPoints = player ? resolveAuraPoints(player) : 0;
  const tier = auraTierForPoints(auraPoints);
  const videoUrl = award.video_url?.trim() || null;
  const closeLabel = replay ? SPOTLIGHT_CLOSE_LABEL : SPOTLIGHT_DISMISS_LABEL;
  const intro = useSharedValue(0.92);
  const pulse = useSharedValue(0.45);
  const canTip = Boolean(player?.id);

  useEffect(() => {
    if (!visible) return;
    intro.value = 0.92;
    intro.value = withSpring(1, SPRING_CARD);
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [intro, pulse, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: intro.value }],
    opacity: 0.55 + intro.value * 0.45,
  }));

  const badgeGlowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.9 + pulse.value * 0.12 }],
  }));

  const portraitGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 0.94 + pulse.value * 0.08 }],
  }));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onDismiss}
      {...(Platform.OS === 'web' ? {} : { presentationStyle: 'overFullScreen' as const })}
    >
      <View style={styles.root}>
        {visible && videoUrl ? <SpotlightVideo uri={videoUrl} /> : <View style={styles.videoFill} />}
        <View pointerEvents="none" style={styles.scrimTop} />
        <View pointerEvents="none" style={styles.scrimBottom} />
        <Reanimated.View
          pointerEvents="box-none"
          style={[
            styles.sheet,
            { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: Math.max(insets.bottom, 16) + 8 },
            sheetStyle,
          ]}
        >
          <View style={styles.badgeWrap}>
            <Reanimated.View
              pointerEvents="none"
              style={[styles.badgeGlow, { backgroundColor: FOCAL.neonJade }, badgeGlowStyle]}
            />
            <View
              style={[styles.badge, JADE_BORDER_GLOW]}
              accessibilityRole="text"
              accessibilityLabel={spotlightBadgeLabel(award)}
            >
              <Text style={styles.badgeLabel}>{spotlightBadgeLabel(award)}</Text>
            </View>
          </View>

          <View style={styles.hero} pointerEvents="none">
            <View style={styles.portraitWrap}>
              <Reanimated.View
                pointerEvents="none"
                style={[
                  styles.portraitGlow,
                  { backgroundColor: tier.glow, shadowColor: tier.color },
                  portraitGlowStyle,
                ]}
              />
              <View style={[styles.portraitRing, { borderColor: tier.color, shadowColor: tier.color }]}>
                <View style={[styles.portraitInner, { borderColor: tier.tier === 7 ? '#00E5FF' : tier.color }]}>
                  <Text style={[styles.initials, { color: tier.color }]}>{initialsFor(athleteName)}</Text>
                </View>
              </View>
              {player?.jersey_number ? (
                <View style={[styles.jerseyChip, { borderColor: tier.color }]}>
                  <Text style={[styles.jerseyLabel, { color: tier.color }]}>#{player.jersey_number}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tierChip, { color: tier.color, borderColor: tier.color }]}>
              {auraBadgeLabel(tier)}
            </Text>
            <Text style={styles.name}>{athleteName}</Text>
            <Text style={styles.headline}>{award.headline}</Text>
            {spotlightShotByLabel(award) ? (
              <Text style={styles.shotBy}>{spotlightShotByLabel(award)}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <AnimatedButton
              accessibilityLabel={SPOTLIGHT_TIP_LABEL}
              accessibilityState={{ disabled: !canTip }}
              haptic="medium"
              disabled={!canTip}
              style={styles.actionHit}
              contentStyle={[styles.primary, !canTip && styles.actionDisabled]}
              onPress={() => {
                if (!player) return;
                onSupport(player, award.reel_id ?? undefined);
              }}
            >
              <Text style={styles.primaryLabel}>{SPOTLIGHT_TIP_LABEL}</Text>
            </AnimatedButton>
            <AnimatedButton
              accessibilityLabel={SPOTLIGHT_WATCH_LABEL}
              haptic="light"
              style={styles.actionHit}
              contentStyle={styles.secondary}
              onPress={() => onWatch(award.reel_id, award.player_id)}
            >
              <Text style={styles.secondaryLabel}>{SPOTLIGHT_WATCH_LABEL}</Text>
            </AnimatedButton>
            <AnimatedButton
              accessibilityLabel={closeLabel}
              haptic="light"
              style={styles.actionHit}
              contentStyle={styles.dismiss}
              onPress={onDismiss}
            >
              <Text style={styles.dismissLabel}>{closeLabel}</Text>
            </AnimatedButton>
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function SpotlightVideo({ uri }: { uri: string }) {
  const videoPlayer = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    playSpotlight(videoPlayer);
  }, [videoPlayer]);

  return (
    <VideoView
      player={videoPlayer}
      style={styles.videoFill}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
      {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
  },
  videoFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.backgroundBase,
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(15, 20, 22, 0.72)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '58%',
    backgroundColor: 'rgba(15, 20, 22, 0.88)',
  },
  sheet: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  badgeWrap: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  badgeGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    opacity: 0.35,
  },
  badge: {
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 20, 22, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeLabel: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  portraitWrap: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitGlow: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 22,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  portraitRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.backgroundBase,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  portraitInner: {
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 1.5,
    backgroundColor: '#161D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
  },
  jerseyChip: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: FOCAL.backgroundBase,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  jerseyLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  tierChip: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  headline: {
    color: FOCAL.electricGold,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  shotBy: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  actionHit: {
    width: '100%',
  },
  actionDisabled: {
    opacity: 0.45,
  },
  primary: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: 'rgba(15, 20, 22, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  dismiss: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dismissLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
