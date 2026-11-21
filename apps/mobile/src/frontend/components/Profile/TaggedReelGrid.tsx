/** UX-13 readable shared type preserves every action and required notice.
 * Profile "Highlights ⚡" poster grid (3 across, newest first) for an athlete's tagged clips and photo stories,
 * opening the paging `ReelViewModal`. Vault tiles blur until the fan subscribes. Photo stories use their cover
 * photo as the poster and show a `📷 5` badge (PHOTO_STORIES_DESIGN.md, "Grids").
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatCompactCount } from '@/lib/hype';
import { BlurTargetView, BlurView } from 'expo-blur';

import { ReelViewModal } from '@/components/Reels/ReelViewModal';
import { colors, SCOREBOARD_DIGITS } from '@/constants/theme';
import { isClipVaultOnly, isFlashUnlockActive, VAULT_BADGE_LABEL } from '@/data/exclusive';
import { isPhotoStory, type HighlightClip } from '@/data/highlights';
import type { Player } from '@/data/players';
import { useAppViewportWidth } from '@/hooks/useAppViewport';
import { hypeFromReel, sortClipsNewestFirst, type ReelHype } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const COLS = 3;
const GAP = 2;

type TaggedReelGridProps = {
  clips: HighlightClip[];
  player?: Player | null;
  tipping?: boolean;
  /** When false, vault clips stay locked. Omit to leave every tile playable. */
  subscribed?: boolean;
  /** Athlete manager: long-press opens vault placement options. */
  onLongPressClip?: (clip: HighlightClip) => void;
  /** Show a vault chip on `is_vault_only` tiles even when the owner can play them. */
  showVaultBadge?: boolean;
  onLockedPress?: () => void;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onBacked?: (nextCount: number) => void;
  /** Opens this clip in the pager (Rally "Watch what it paid for"). */
  openClipId?: string | null;
};

type TaggedReelTileProps = {
  clip: HighlightClip;
  locked: boolean;
  vaultBadge: boolean;
  tileSize: number;
  tileHeight: number;
  onPress: () => void;
  onLongPress?: () => void;
};

/**
 * @purpose 3×3 tagged-clip grid (newest first); vault tiles blur until the fan subscribes.
 * @param subscribed When `false`, `is_vault_only` tiles cannot open the reel player.
 * @param onLongPressClip Athlete manager options (vault / public).
 * @returns Poster grid plus a paging `ReelViewModal` (same double-tap Aura as the hub feed).
 * @sideEffects Opens the reel pager; locked taps call `onLockedPress` (paywall).
 */
export function TaggedReelGrid({
  clips,
  player = null,
  tipping = false,
  subscribed,
  onLongPressClip,
  showVaultBadge = false,
  onLockedPress,
  onOpenAthlete,
  onHypeChange,
  onBacked,
  openClipId,
}: TaggedReelGridProps) {
  const width = useAppViewportWidth();
  const ordered = useMemo(() => sortClipsNewestFirst(clips), [clips]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hypeById, setHypeById] = useState<Record<string, ReelHype>>({});
  const tileSize = Math.floor((width - 32 - GAP * (COLS - 1)) / COLS);
  const tileHeight = Math.round(tileSize * (4 / 3));

  useEffect(() => {
    setHypeById((current) => {
      const next: Record<string, ReelHype> = {};
      for (const clip of ordered) {
        const fromClip = hypeFromReel({
          seki_count: clip.sekiCount,
          aura_count: clip.auraCount,
          flex_count: clip.flexCount,
          total_tips_cents: clip.totalTipsCents,
        });
        const local = current[clip.id];
        next[clip.id] = local
          ? {
              seki_count: Math.max(local.seki_count, fromClip.seki_count),
              aura_count: Math.max(local.aura_count, fromClip.aura_count),
              flex_count: Math.max(local.flex_count, fromClip.flex_count),
              total_tips_cents: Math.max(local.total_tips_cents, fromClip.total_tips_cents),
            }
          : fromClip;
      }
      return next;
    });
  }, [ordered]);

  useEffect(() => {
    if (!openClipId) return;
    const clip = ordered.find((item) => item.id === openClipId);
    if (!clip) return;
    const locked = isClipVaultOnly(clip) && subscribed === false && !isFlashUnlockActive(clip.flashUnlockUntil);
    if (!locked) setActiveId(openClipId);
  }, [openClipId, ordered, subscribed]);

  useEffect(() => {
    if (!activeId) return;
    const clip = ordered.find((item) => item.id === activeId);
    if (clip && isClipVaultOnly(clip) && subscribed === false && !isFlashUnlockActive(clip.flashUnlockUntil)) {
      setActiveId(null);
    }
  }, [activeId, ordered, subscribed]);

  if (ordered.length === 0) {
    return <Text style={styles.empty}>No tagged clips yet.</Text>;
  }

  const applyHype = (reelId: string, hype: ReelHype) => {
    setHypeById((current) => ({ ...current, [reelId]: hype }));
    onHypeChange?.(reelId, hype);
  };

  const pagerClips = ordered.map((clip) => {
    const hype = hypeById[clip.id];
    if (!hype) return clip;
    return {
      ...clip,
      sekiCount: hype.seki_count,
      auraCount: hype.aura_count,
      flexCount: hype.flex_count,
      totalTipsCents: hype.total_tips_cents,
    };
  });

  return (
    <View>
      <View style={styles.grid} accessibilityRole="list" accessibilityLabel="Tagged clips">
        {ordered.map((clip) => {
          const vaultOnly = isClipVaultOnly(clip);
          const locked = vaultOnly && subscribed === false && !isFlashUnlockActive(clip.flashUnlockUntil);
          return (
            <TaggedReelTile
              key={clip.id}
              clip={clip}
              locked={locked}
              vaultBadge={showVaultBadge && vaultOnly}
              tileSize={tileSize}
              tileHeight={tileHeight}
              onLongPress={onLongPressClip ? () => onLongPressClip(clip) : undefined}
              onPress={() => {
                if (locked) {
                  onLockedPress?.();
                  return;
                }
                setActiveId(clip.id);
              }}
            />
          );
        })}
      </View>
      <ReelViewModal
        clips={pagerClips}
        initialClipId={activeId}
        player={player}
        tipping={tipping}
        onClose={() => setActiveId(null)}
        onOpenAthlete={onOpenAthlete}
        onHypeChange={applyHype}
        onBacked={onBacked}
        onTipped={(reelId, amountCents) => {
          const current = hypeById[reelId] ?? hypeFromReel({
            seki_count: pagerClips.find((item) => item.id === reelId)?.sekiCount,
            aura_count: pagerClips.find((item) => item.id === reelId)?.auraCount,
            flex_count: pagerClips.find((item) => item.id === reelId)?.flexCount,
            total_tips_cents: pagerClips.find((item) => item.id === reelId)?.totalTipsCents,
          });
          applyHype(reelId, {
            ...current,
            total_tips_cents: current.total_tips_cents + amountCents,
          });
        }}
      />
    </View>
  );
}

function TaggedReelTile({
  clip,
  locked,
  vaultBadge,
  tileSize,
  tileHeight,
  onPress,
  onLongPress,
}: TaggedReelTileProps) {
  const blurTarget = useRef<ViewInstance>(null);
  const story = isPhotoStory(clip);
  const photoCount = story ? Math.max(0, clip.photoCount ?? 0) : 0;
  const storyLabel = story ? `Photo story, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : '';
  // Locked tiles never load the cover, so the blur cannot be bypassed by a fast render.
  const cover = story && !locked ? clip.coverUrl?.trim() || null : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${clip.tag} ${story ? storyLabel : 'clip'}, ${VAULT_BADGE_LABEL}`
          : story
            ? `${clip.tag}, ${storyLabel}, ${clip.athleteName}`
            : `${clip.tag} clip, ${clip.athleteName}`
      }
      delayLongPress={280}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        { width: tileSize, height: tileHeight },
        pressed && styles.pressed,
      ]}
    >
      <BlurTargetView ref={blurTarget} style={styles.poster}>
        {cover ? (
          <Image source={{ uri: cover }} resizeMode="cover" style={styles.cover} accessibilityIgnoresInvertColors testID="tile-cover" />
        ) : (
          <Ionicons name={story ? 'images' : 'play'} size={28} color={locked ? colors.onVideoMuted : colors.primary} />
        )}
      </BlurTargetView>
      {locked ? (
        <BlurView
          intensity={80}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurTarget={blurTarget}
          style={styles.lockBlur}
        >
          <View style={styles.lockBadge}>
            <Text style={styles.lockLabel}>{VAULT_BADGE_LABEL}</Text>
          </View>
        </BlurView>
      ) : vaultBadge ? (
        <View style={styles.vaultChip}>
          <Text style={styles.vaultChipLabel}>Vault 🔒</Text>
        </View>
      ) : clip.sekiPlay ? (
        <View style={styles.seki}>
          <Text style={styles.sekiLabel}>SEKI</Text>
        </View>
      ) : null}
      <Text style={styles.tag} numberOfLines={1}>
        {clip.tag}
      </Text>
      <View style={styles.topRight} pointerEvents="none">
        {!locked && typeof clip.viewCount === 'number' ? (
          <View style={styles.views} accessibilityLabel={`${clip.viewCount} views`}>
            <Ionicons name="play" size={10} color={colors.onVideo} />
            <Text style={styles.viewsLabel}>{formatCompactCount(clip.viewCount)}</Text>
          </View>
        ) : null}
        {story && photoCount > 0 ? (
          <View style={styles.views} accessible accessibilityLabel={storyLabel}>
            <Text style={styles.viewsLabel}>{`📷 ${photoCount}`}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: { minHeight: 44,
    backgroundColor: colors.videoSurface,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#151C1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBlur: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  lockBadge: {
    backgroundColor: colors.videoScrim,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  lockLabel: {
    color: colors.onVideo,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  cover: {
    ...StyleSheet.absoluteFill,
  },
  topRight: {
    position: 'absolute',
    top: 6,
    right: 6,
    alignItems: 'flex-end',
    gap: 3,
  },
  views: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.videoScrim,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  viewsLabel: { ...figtree('400'),
    ...SCOREBOARD_DIGITS,
    color: colors.onVideo,
    ...TYPE.caption,
  },
  seki: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sekiLabel: {
    color: colors.onAccent,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
  },
  vaultChip: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  vaultChipLabel: {
    color: FOCAL.neonJade,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.2,
  },
  tag: {
    color: colors.onVideo,
    ...TYPE.caption,
    ...figtree('800'),
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: colors.videoScrim,
    zIndex: 1,
  },
  empty: { ...figtree('400'),
    color: colors.onVideoMuted,
    ...TYPE.body,
    paddingVertical: 24,
    textAlign: 'center',
  },
  pressed: { minHeight: 44,
    opacity: 0.88,
  },
});
