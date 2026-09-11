import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { SlangGuideBanner } from '@/components/Onboarding/SlangGuideBanner';
import { HighlightClipCard } from '@/components/HighlightClipCard';
import { TabScreen } from '@/components/TabScreen';
import { HIGHLIGHT_CLIPS } from '@/data/highlights';
import { useRoster } from '@/hooks/useRoster';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import type { Player } from '@/types/database';

export default function HighlightsTab() {
  const { players, applyBackerCount } = useRoster();
  const { startCheckout, busy } = useTipCheckout();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const clips = useMemo(
    () =>
      HIGHLIGHT_CLIPS.map((clip, index) => ({
        clip,
        player:
          players.find((item) => item.name.toLowerCase() === clip.athleteName.toLowerCase()) ??
          players[index % Math.max(players.length, 1)] ??
          null,
      })),
    [players],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setActiveIndex(next);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const tipPlayer = async (player: Player | null) => {
    if (!player || busy) return;
    await startCheckout({
      player,
      tipAmount: 5,
      coverFees: true,
      onBacked: (nextCount) => applyBackerCount(player.id, nextCount),
    });
  };

  return (
    <TabScreen dark>
      <View
        style={styles.fill}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      >
        {pageHeight === 0 ? (
          <View style={styles.boot}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <FlatList
            data={clips}
            keyExtractor={(item) => item.clip.id}
            pagingEnabled
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            windowSize={3}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            renderItem={({ item, index }) => (
              <HighlightClipCard
                clip={item.clip}
                player={item.player}
                active={index === activeIndex}
                height={pageHeight}
                tipping={busy}
                sekiPlay={item.clip.sekiPlay}
                onTip={() => void tipPlayer(item.player)}
              />
            )}
          />
        )}
        <SlangGuideBanner overlay />
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
