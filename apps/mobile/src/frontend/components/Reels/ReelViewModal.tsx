import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ReelCard } from '@/components/Reels/ReelCard';
import { MaloTipModal } from '@/components/TipSheetModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useSoftWall } from '@/context/SoftWallContext';
import type { HighlightClip } from '@/data/highlights';
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
  onBacked?: (nextCount: number) => void;
  onTipped?: (reelId: string, amountCents: number) => void;
};

/**
 * @purpose Full-screen profile / athlete clip pager: same `ReelCard` double-tap Aura, mute, chips, Mālo, Share, Save, and Report as the hub feed. Pages newest → oldest from the tapped tile.
 * @param clips Already newest-first tagged clips.
 * @param initialClipId Opens on that clip; `null` hides the modal.
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
    if (clips.length > 0 && visibleClips.length === 0) close();
  }, [clips.length, close, visibleClips.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setActiveIndex(next);
    },
  ).current;

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);

  const hideClip = useCallback((reelId: string) => {
    setHiddenIds((current) => (current.includes(reelId) ? current : [reelId, ...current]));
  }, []);

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
          <FlatList
            ref={listRef}
            data={visibleClips}
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
            renderItem={({ item, index }) => (
              <ReelCard
                clip={item}
                player={player}
                active={index === activeIndex}
                playbackActive
                height={pageHeight}
                tipping={Boolean(tipTarget) || tipping}
                sekiPlay={item.sekiPlay}
                onTip={() => openTip(item.id)}
                onOpenProfile={
                  item.playerId && onOpenAthlete ? () => onOpenAthlete(item.playerId!) : undefined
                }
                onReelHypeChange={onHypeChange}
                onHide={hideClip}
                surface="profile"
              />
            )}
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
