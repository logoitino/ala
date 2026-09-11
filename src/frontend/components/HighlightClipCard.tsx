import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import {
  PLAY_REACTIONS,
  displayValue,
  emptyReactionCounts,
  type PlayReactionId,
  type Player,
} from '@/data/players';
import type { HighlightClip } from '@/data/highlights';
import { colors } from '@/constants/theme';

type HighlightClipCardProps = {
  clip: HighlightClip;
  player: Player | null;
  active: boolean;
  height: number;
  tipping: boolean;
  sekiPlay?: boolean;
  onTip: () => void;
};

const SEKI_HYPE_THRESHOLD = 3;
const reactionStore = new Map<string, Record<PlayReactionId, number>>();

function getCounts(id: string): Record<PlayReactionId, number> {
  return reactionStore.get(id) ?? emptyReactionCounts();
}

function SekiPlayBadge() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  return (
    <View accessibilityRole="text" accessibilityLabel="Seki play" style={styles.sekiWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.sekiGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />
      <View style={styles.sekiBadge}>
        <Text style={styles.sekiBadgeLabel}>SEKI PLAY ⚡</Text>
      </View>
    </View>
  );
}

export function HighlightClipCard({
  clip,
  player,
  active,
  height,
  tipping,
  sekiPlay = false,
  onTip,
}: HighlightClipCardProps) {
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState(() => getCounts(clip.id));
  const [sekiHint, setSekiHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerName = displayValue(player?.name, clip.athleteName);
  const showSekiBadge = sekiPlay || clip.sekiPlay || counts.seki >= SEKI_HYPE_THRESHOLD;

  const videoPlayer = useVideoPlayer(clip.videoUrl, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (active) {
      videoPlayer.play();
      return;
    }
    videoPlayer.pause();
  }, [active, videoPlayer]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const revealSekiHint = (persist = false) => {
    setSekiHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    if (persist) return;
    hintTimer.current = setTimeout(() => setSekiHint(false), 1800);
  };

  const bump = (id: PlayReactionId) => {
    const current = getCounts(clip.id);
    const next = { ...current, [id]: current[id] + 1 };
    reactionStore.set(clip.id, next);
    setCounts(next);
    if (id === 'seki') revealSekiHint();
  };

  return (
    <View style={[styles.page, { height }]}>
      <VideoView
        player={videoPlayer}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
      <View style={styles.scrim} />

      <View style={[styles.meta, { paddingTop: insets.top + 12 }]}>
        {showSekiBadge ? <SekiPlayBadge /> : null}
        <Text style={styles.tag}>{clip.tag}</Text>
        <Text style={styles.name}>{playerName}</Text>
        <Text style={styles.school}>{displayValue(player?.school_name, clip.school)}</Text>
      </View>

      <View style={[styles.rail, { bottom: 28 }]}>
        {PLAY_REACTIONS.map((reaction) => (
          <Pressable
            key={reaction.id}
            accessibilityRole="button"
            accessibilityLabel={`${reaction.label} ${reaction.emoji}, ${counts[reaction.id]} taps`}
            accessibilityHint={reaction.id === 'seki' ? 'Awesome' : undefined}
            onPress={() => bump(reaction.id)}
            onHoverIn={() => {
              if (reaction.id === 'seki') revealSekiHint(true);
            }}
            onHoverOut={() => {
              if (reaction.id === 'seki') setSekiHint(false);
            }}
            style={({ pressed }) => [
              styles.reaction,
              reaction.id === 'seki' && styles.sekiReaction,
              pressed && styles.pressed,
            ]}
          >
            {reaction.id === 'seki' && sekiHint ? (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipLabel}>Awesome</Text>
              </View>
            ) : null}
            <Text style={styles.emoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionLabel}>{reaction.label}</Text>
            <Text style={styles.count}>
              {reaction.id === 'seki' && sekiHint ? 'Awesome' : counts[reaction.id]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Drop a five dollar Mālo"
        disabled={tipping || !player}
        onPress={onTip}
        style={({ pressed }) => [styles.tip, pressed && styles.pressed, tipping && styles.disabled]}
      >
        <Text style={styles.tipLabel}>$5 Mālo</Text>
        <Text style={styles.tipSublabel}>($5.00 Support)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#050807',
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,8,7,0.22)',
  },
  meta: {
    position: 'absolute',
    left: 16,
    right: 88,
    gap: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  school: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    fontWeight: '600',
  },
  sekiWrap: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    padding: 5,
  },
  sekiGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: '#F4C430',
    shadowColor: '#F4C430',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 10,
  },
  sekiBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.deepGreen,
    borderWidth: 1,
    borderColor: '#F4C430',
  },
  sekiBadgeLabel: {
    color: '#F4C430',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: '#F4C430',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rail: {
    position: 'absolute',
    right: 14,
    gap: 10,
  },
  reaction: {
    width: 62,
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 1,
    overflow: 'visible',
  },
  sekiReaction: {
    borderWidth: 1,
    borderColor: '#F4C430',
    backgroundColor: 'rgba(5,74,41,0.55)',
  },
  tooltip: {
    position: 'absolute',
    top: -26,
    backgroundColor: '#F4C430',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  tooltipLabel: {
    color: colors.deepGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  emoji: {
    fontSize: 22,
  },
  reactionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  count: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  tip: {
    position: 'absolute',
    left: 16,
    bottom: 28,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  tipSublabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
