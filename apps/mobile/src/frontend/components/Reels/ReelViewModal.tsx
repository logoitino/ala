import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ReelCard } from '@/components/Reels/ReelCard';
import { ReelPage } from '@/components/Reels/ReelPage';
import { MaloTipModal } from '@/components/TipSheetModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useSoftWall } from '@/context/SoftWallContext';
import type { HighlightClip } from '@/data/highlights';
import { adjacentStoryClips, prefetchStoryPhotos } from '@/hooks/useStoryPhotos';
import type { Player } from '@/data/players';
import { type ReelHype, readHiddenReelIds } from '@/lib/reels';

type ReelViewModalProps = {
  clips: HighlightClip[];
  initialClipId: string | null;
  player?: Player | null;
  tipping?: boolean;
  onClose: () => void;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onHide?: (reelId: string) => void;
  onBacked?: (nextCount: number) => void;
  onTipped?: (reelId: string, amountCents: number) => void;
};

/**
 * @purpose Full-screen profile / athlete clip pager: same `ReelCard` double-tap Aura, mute, chips, Mālo, Share, Save, and Report as the hub feed. Pages newest → oldest from the tapped tile.
 * @param clips Already newest-first tagged clips.
 * @param initialClipId Opens on that clip; `null` hides the modal.
 * @param onHide Optional — parent feed should drop the clip when Report hides it (not coach_level).
 * @sideEffects `ReelCard` video + hype RPCs; `MaloTipModal` PaymentSheet. GestureHandlerRootView so Exclusive taps work inside RN Modal.
 */
export function ReelViewModal({
  clips,
  initialClipId,
  player = null,
  tipping = false,
  onClose,
  onOpenAthlete,
  onHypeChange,
  onHide,
  onBacked,
  onTipped,
}: ReelViewModalProps) {
  const visible = Boolean(initialClipId);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && initialClipId ? (
        <ReelViewPager
          key={initialClipId}
          clips={clips}
          initialClipId={initialClipId}
          player={player}
          tipping={tipping}
          onClose={onClose}
          onOpenAthlete={onOpenAthlete}
          onHypeChange={onHypeChange}
          onHide={onHide}
          onBacked={onBacked}
          onTipped={onTipped}
        />
      ) : null}
    </Modal>
  );
}

function ReelViewPager({
  clips,
  initialClipId,
  player,
  tipping,
  onClose,
  onOpenAthlete,
  onHypeChange,
  onHide,
  onBacked,
  onTipped,
}: {
  clips: HighlightClip[];
  initialClipId: string;
  player: Player | null;
  tipping: boolean;
  onClose: () => void;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onHide?: (reelId: string) => void;
  onBacked?: (nextCount: number) => void;
  onTipped?: (reelId: string, amountCents: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { requireAuth } = useSoftWall();
  const listRef = useRef<FlatList<HighlightClip>>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const visibleClips = useMemo(
    () => clips.filter((clip) => !hiddenIds.includes(clip.id)),
    [clips, hiddenIds],
  );
  const startIndex = Math.max(
    0,
    visibleClips.findIndex((clip) => clip.id === initialClipId),
  );
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [tipTarget, setTipTarget] = useState<{ player: Player; reelId: string } | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const pagerY = useSharedValue(0);
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      pagerY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    let active = true;
    void readHiddenReelIds().then((ids) => {
      if (active) setHiddenIds(ids);
    });
    return () => {
      active = false;
    };
  }, []);

  const close = useCallback(() => {
    setTipTarget(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    setTipTarget(null);
    setActiveIndex(startIndex);
  }, [initialClipId]);

  useEffect(() => {
    if (activeIndex >= visibleClips.length) {
      setActiveIndex(Math.max(0, visibleClips.length - 1));
    }
  }, [activeIndex, visibleClips.length]);

  useEffect(() => {
    prefetchStoryPhotos(adjacentStoryClips(visibleClips, activeIndex));
  }, [activeIndex, visibleClips]);

  useEffect(() => {
    if (clips.length > 0 && visibleClips.length === 0) close();
  }, [clips.length, close, visibleClips.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setActiveIndex(next);
    },
  ).current;

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);

  const hideClip = useCallback(
    (reelId: string) => {
      setHiddenIds((current) => (current.includes(reelId) ? current : [reelId, ...current]));
      onHide?.(reelId);
    },
    [onHide],
  );

  const openTip = useCallback(
    (reelId: string) => {
      if (!player) return;
      requireAuth({
        kind: 'malo',
        athleteName: player.name,
        athleteId: player.id,
        resume: () => setTipTarget({ player, reelId }),
      });
    },
    [player, requireAuth],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <View
        style={styles.fill}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      >
        {pageHeight > 0 ? (
          <Animated.FlatList
            ref={listRef}
            data={visibleClips}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            scrollEnabled={!peekOpen}
            extraData={`${activeIndex}:${hiddenIds.join(',')}`}
            keyExtractor={(item) => item.id}
            pagingEnabled
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            initialScrollIndex={startIndex}
            initialNumToRender={2}
            windowSize={2}
            maxToRenderPerBatch={1}
            removeClippedSubviews={false}
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({ index, animated: false });
              });
            }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => {
              const openAthlete =
                item.playerId && onOpenAthlete ? () => onOpenAthlete(item.playerId!) : undefined;
              return (
                <ReelPage
                  index={index}
                  height={pageHeight}
                  scrollY={pagerY}
                  active={index === activeIndex}
                  clip={item}
                  player={player}
                  totalTipsCents={item.totalTipsCents ?? 0}
                  surface="profile"
                  peekEnabled={!tipTarget}
                  onOpenProfile={openAthlete}
                  onTip={player ? () => openTip(item.id) : undefined}
                  onPeekChange={setPeekOpen}
                >
                  <ReelCard
                    clip={item}
                    player={player}
                    active={index === activeIndex}
                    playbackActive
                    height={pageHeight}
                    tipping={Boolean(tipTarget) || tipping}
                    sekiPlay={item.sekiPlay}
                    onTip={() => openTip(item.id)}
                    onOpenProfile={openAthlete}
                    onReelHypeChange={onHypeChange}
                    onHide={hideClip}
                    surface="profile"
                  />
                </ReelPage>
              );
            }}
          />
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close clip"
        onPress={close}
        style={({ pressed }) => [styles.close, { top: insets.top + 8 }, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={20} color={colors.onAccent} />
        <Text style={styles.closeLabel}>Close</Text>
      </Pressable>
      <MaloTipModal
        player={tipTarget?.player ?? null}
        reelId={tipTarget?.reelId}
        onClose={() => setTipTarget(null)}
        onBacked={onBacked}
        onTipped={(amountCents) => {
          if (tipTarget?.reelId) onTipped?.(tipTarget.reelId, amountCents);
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.night,
  },
  fill: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  closeLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
  },
});
