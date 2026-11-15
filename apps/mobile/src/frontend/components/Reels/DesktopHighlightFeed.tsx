/**
 * Lovable-outline desktop Highlights center column (WEB-DESKTOP-01 Phase 4): scrollable cards,
 * sport / All pills, Cheer + Send a gift. Phone pager stays on native and narrow web.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { DesktopHighlightCard } from '@/components/Reels/DesktopHighlightCard';
import { HomeFeedEmpty } from '@/components/Reels/HomeFeedEmpty';
import { ReelViewModal } from '@/components/Reels/ReelViewModal';
import { MaloTipModal } from '@/components/TipSheetModal';
import { colors, space } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { whyThisClipLine, type FeedReasonCode, type HighlightClip } from '@/data/highlights';
import type { ReelHype } from '@/lib/reels';
import { userProfileHref } from '@/lib/navigation';
import { FONT } from '@/theme/fonts';
import type { Player } from '@/types/database';

export type DesktopFeedItem = {
  clip: HighlightClip;
  player: Player | null;
};

type DesktopHighlightFeedProps = {
  feed: DesktopFeedItem[];
  feedReasons: Map<string, FeedReasonCode[]>;
  sportOptions: string[];
  emptyCopy: string;
  isGuest: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  tippedIds: Set<string>;
  tipPlayer: (player: Player | null, reelId?: string) => void | Promise<void>;
  onReelHypeChange: (reelId: string, hype: ReelHype) => void;
  tipTarget: { player: Player; reelId?: string } | null;
  onCloseTip: () => void;
  onBacked: (nextCount: number) => void;
  onTipped: (amountCents: number) => void;
};

/**
 * @purpose Desktop/tablet web Highlights center: card feed matching the Lovable outline with live data.
 * @param feed Ranked Home clips (same order as the phone pager).
 * @param feedReasons FEED-01 reason codes for Why this clip (empty for guests).
 * @param sportOptions Distinct sports from the current clip set for filter pills.
 * @param emptyCopy Empty-state copy from Home.
 * @param isGuest Soft-Wall guest — hide Why lines.
 * @param refreshing Pull-to-refresh busy.
 * @param onRefresh Refresh reels + ranking.
 * @param tippedIds Clips this fan already gifted.
 * @param tipPlayer Soft-Wall → gift sheet.
 * @param onReelHypeChange Cheer (Seki) count updates.
 * @param tipTarget Open gift sheet target.
 * @param onCloseTip Close gift sheet.
 * @param onBacked After gift backer count.
 * @param onTipped After gift cents on a clip.
 * @sideEffects ReelViewModal playback; MaloTipModal; Soft-Wall via cards.
 */
export function DesktopHighlightFeed({
  feed,
  feedReasons,
  sportOptions,
  emptyCopy,
  isGuest,
  refreshing,
  onRefresh,
  tippedIds,
  tipPlayer,
  onReelHypeChange,
  tipTarget,
  onCloseTip,
  onBacked,
  onTipped,
}: DesktopHighlightFeedProps) {
  const router = useRouter();
  const { live: runtime } = useAppRuntime();
  const { openUpload } = useUploadSheet();
  const [sportPick, setSportPick] = useState<string>('All');
  const [playClipId, setPlayClipId] = useState<string | null>(null);

  const pills = useMemo(() => {
    const rows = ['All', ...sportOptions];
    return rows.slice(0, 8);
  }, [sportOptions]);

  const shown = useMemo(() => {
    if (sportPick === 'All') return feed;
    const want = sportPick.trim().toLowerCase();
    return feed.filter((item) => (item.clip.sport ?? '').trim().toLowerCase() === want);
  }, [feed, sportPick]);

  // One clip at a time so the modal tip target matches the card athlete (ReelViewModal is single-player).
  const playRow = useMemo(
    () => (playClipId ? shown.find((item) => item.clip.id === playClipId) ?? null : null),
    [playClipId, shown],
  );
  const playClips = useMemo(() => (playRow ? [playRow.clip] : []), [playRow]);
  const playPlayer = playRow?.player ?? null;

  const openProfile = useCallback(
    (player: Player | null) => {
      if (!player) return;
      router.push(userProfileHref(player.id));
    },
    [router],
  );

  return (
    <View style={styles.root} testID="desktop-highlight-feed" accessibilityLabel="Highlights">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <Text style={styles.heading}>Highlights</Text>
        <View style={styles.pills} accessibilityLabel="Your picks">
          {pills.map((pill) => {
            const on = sportPick === pill;
            return (
              <Pressable
                key={pill}
                testID={`desktop-feed-pill-${pill}`}
                onPress={() => setSportPick(pill)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={pill === 'All' ? 'All sports' : `Filter ${pill}`}
                style={[styles.pill, on && styles.pillOn]}
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{pill}</Text>
              </Pressable>
            );
          })}
        </View>

        {shown.length === 0 ? (
          <View style={styles.empty}>
            {refreshing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <HomeFeedEmpty
                emptyCopy={emptyCopy}
                feedFilter="home"
                runtime={runtime}
                openUpload={openUpload}
                router={router}
              />
            )}
          </View>
        ) : (
          shown.map((item) => {
            const why =
              isGuest
                ? null
                : whyThisClipLine(feedReasons.get(item.clip.id) ?? [], {
                    athleteName: item.player?.name ?? item.clip.athleteName,
                    sport: item.clip.sport,
                    school: item.player?.school_name ?? item.clip.school,
                  });
            return (
              <DesktopHighlightCard
                key={item.clip.id}
                clip={item.clip}
                player={item.player}
                whyThisClip={why}
                userTipped={tippedIds.has(item.clip.id)}
                onOpenProfile={item.player ? () => openProfile(item.player) : undefined}
                onPlay={() => setPlayClipId(item.clip.id)}
                onTip={() => void tipPlayer(item.player, item.clip.id)}
                onReelHypeChange={onReelHypeChange}
              />
            );
          })
        )}
      </ScrollView>

      <ReelViewModal
        clips={playClips}
        initialClipId={playClipId}
        player={playPlayer}
        tipping={Boolean(tipTarget)}
        onClose={() => setPlayClipId(null)}
        onOpenAthlete={(playerId) => {
          setPlayClipId(null);
          router.push(userProfileHref(playerId));
        }}
        onHypeChange={onReelHypeChange}
        onBacked={onBacked}
        onTipped={(_reelId, amountCents) => {
          onTipped(amountCents);
        }}
      />

      <MaloTipModal
        player={tipTarget?.player ?? null}
        reelId={tipTarget?.reelId}
        onClose={onCloseTip}
        onBacked={onBacked}
        onTipped={(amountCents) => {
          onTipped(amountCents);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 48,
    gap: space.md,
  },
  heading: {
    fontFamily: FONT.display,
    fontSize: 32,
    color: colors.text,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pillText: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: colors.text,
  },
  pillTextOn: {
    color: colors.surface,
  },
  empty: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
});
