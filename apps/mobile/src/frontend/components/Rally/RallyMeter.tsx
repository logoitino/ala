import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { RallyFillMoment } from '@/components/Rally/RallyFillMoment';
import { MaloTipModal } from '@/components/TipSheetModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import type { Player } from '@/data/players';
import { useRally } from '@/hooks/useRally';
import { rallyProgress, type Rally } from '@/lib/rallies';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

/**
 * @purpose Compact Rally progress on a Highlight, so a fan sees the goal while they watch.
 * @param player The athlete in the current clip. Hidden when they have no live or filled Rally.
 * @param onOpenClip Opens the thank-you clip from the fill moment when it is in the feed.
 * @sideEffects `useRally` → `get_active_rally`. Donate sheet with `origin=rally`.
 */
export function RallyMeter({
  player,
  onOpenClip,
}: {
  player: Player | null;
  onOpenClip?: (reelId: string) => void;
}) {
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { rally, refresh } = useRally(player?.id);
  const [donateOpen, setDonateOpen] = useState(false);
  const [moment, setMoment] = useState<Rally | null>(null);
  const lastStatus = useRef<string | null>(null);
  const fill = useSharedValue(0);
  const fraction = rally ? rallyProgress(rally).fraction : 0;

  useEffect(() => {
    fill.value = withSpring(fraction, SPRING_CARD);
  }, [fill, fraction]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%` }));

  useEffect(() => {
    if (!rally) return;
    if (lastStatus.current === 'live' && rally.status === 'filled') setMoment(rally);
    lastStatus.current = rally.status;
  }, [rally]);

  if (!player || !rally || (rally.status !== 'live' && rally.status !== 'filled')) return null;
  if (rally.status === 'live' && !live.buttons.malo) return null;

  const progress = rallyProgress(rally);
  const name = player.name?.trim() || 'this athlete';

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rally ${rally.title}, ${progress.amountLine}`}
        onPress={() => {
          if (rally.status !== 'live') return;
          requireAuth({
            kind: 'malo',
            athleteName: name,
            athleteId: player.id,
            resume: () => {
              telemetry.trackFeature('rally_donate', 'highlight');
              setDonateOpen(true);
            },
          });
        }}
        style={styles.barBtn}
      >
        <View style={styles.row}>
          <Text style={styles.kicker}>Rally</Text>
          <Text style={styles.title} numberOfLines={1}>
            {rally.title}
          </Text>
          <Text style={styles.amount}>{progress.amountLine}</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
      </Pressable>
      <MaloTipModal
        player={donateOpen ? player : null}
        origin="rally"
        rallyId={rally.id}
        sourceLabel={rally.title}
        onClose={() => setDonateOpen(false)}
        onTipped={() => void refresh()}
      />
      <RallyFillMoment
        visible={Boolean(moment)}
        title={moment?.title ?? rally.title}
        athleteName={name}
        onWatch={
          moment?.thanksReelId && onOpenClip
            ? () => {
                const reelId = moment.thanksReelId as string;
                setMoment(null);
                onOpenClip(reelId);
              }
            : undefined
        }
        onClose={() => setMoment(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  barBtn: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 18, 14, 0.72)',
    borderWidth: 1,
    borderColor: FOCAL.mistJade,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    color: FOCAL.electricGold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  amount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  fill: {
    height: '100%',
    backgroundColor: FOCAL.neonJade,
  },
});
