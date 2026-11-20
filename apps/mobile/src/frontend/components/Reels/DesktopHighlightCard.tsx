/**
 * Lovable-outline desktop Highlight card (WEB-DESKTOP-01 Phase 4): poster, title, Why this clip,
 * Cheer (Seki) and Send a gift. Real clips only — no SAMPLE placeholders in the live app.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, radii, space } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import type { HighlightClip } from '@/data/highlights';
import { isPhotoStory } from '@/data/highlights';
import type { Player } from '@/types/database';
import { bumpReelHype, clearReelHype, isReelUuid, type ReelHype } from '@/lib/reels';
import { createOfflineActorClient } from '@/lib/offlineActor';
import { clearReelVote, loadReelVotes, markReelVote } from '@/lib/reelVotes';
import { offlineQueue } from '@/services/OfflineQueue';
import { telemetry } from '@/services/TelemetryManager';
import { FONT } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

type DesktopHighlightCardProps = {
  clip: HighlightClip;
  player: Player | null;
  whyThisClip?: string | null;
  userTipped?: boolean;
  onOpenProfile?: () => void;
  onPlay: () => void;
  onTip: () => void;
  onReelHypeChange?: (reelId: string, hype: ReelHype) => void;
};

/**
 * @purpose One desktop Highlights card matching the Lovable three-panel outline (real data).
 * @param clip Highlight clip row.
 * @param player Tagged athlete when known.
 * @param whyThisClip FEED-01 reason line for signed-in Home; guests omit.
 * @param userTipped Whether this fan already gifted on the clip.
 * @param onOpenProfile Open athlete profile.
 * @param onPlay Open full Highlight playback.
 * @param onTip Soft-Wall → Send a gift sheet.
 * @param onReelHypeChange Bubble Cheer (Seki) counts to the parent feed.
 * @sideEffects Soft-Wall; `reel_hype_votes` / `increment_reel_hype` via Cheer; telemetry.
 */
export function DesktopHighlightCard({
  clip,
  player,
  whyThisClip,
  userTipped,
  onOpenProfile,
  onPlay,
  onTip,
  onReelHypeChange,
}: DesktopHighlightCardProps) {
  const { user } = useAuth();
  const { requireAuth } = useSoftWall();
  const athlete = player?.name?.trim() || clip.athleteName;
  const school = (player?.school_name || clip.school || '').trim();
  const sport = (clip.sport || '').trim();
  const meta = [sport, school].filter(Boolean).join(' · ');
  const poster = clip.coverUrl?.trim() || null;
  const initial = (athlete[0] || '?').toUpperCase();
  const title = clip.tag?.trim() || `${athlete} Highlight`;

  const [cheered, setCheered] = useState(false);
  const [sekiCount, setSekiCount] = useState(clip.sekiCount ?? 0);

  useEffect(() => {
    setSekiCount(clip.sekiCount ?? 0);
  }, [clip.id, clip.sekiCount]);

  useEffect(() => {
    let active = true;
    void loadReelVotes(clip.id, user?.id).then((votes) => {
      if (active) setCheered(Boolean(votes.seki));
    });
    return () => {
      active = false;
    };
  }, [clip.id, user?.id]);

  const runCheer = useCallback(async () => {
    // Soft-Wall resume is an authorized new tap; capture its resolved actor before any await.
    const actor = offlineQueue.captureActor();
    const actionUserId = actor?.userId ?? null;
    telemetry.trackFeature('hype.seki', 'home');
    const previous: ReelHype = {
      seki_count: sekiCount,
      aura_count: clip.auraCount ?? 0,
      flex_count: clip.flexCount ?? 0,
      total_tips_cents: clip.totalTipsCents ?? 0,
    };
    if (cheered) {
      setCheered(false);
      const next = Math.max(0, sekiCount - 1);
      setSekiCount(next);
      const optimistic = { ...previous, seki_count: next };
      onReelHypeChange?.(clip.id, optimistic);
      void clearReelVote(clip.id, 'seki', actionUserId);
      try {
        if (!actor || !isReelUuid(clip.id)) return;
        if (await offlineQueue.dropPendingHype(clip.id, 'seki', actor)) return;
        if (!(await offlineQueue.isOnline())) {
          await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind: 'seki' }, actor);
          return;
        }
        const client = await createOfflineActorClient(actor);
        const server = await clearReelHype(clip.id, 'seki', previous, client);
        if (!actor.isCurrent()) return;
        onReelHypeChange?.(clip.id, server);
        setSekiCount(server.seki_count);
      } catch {
        await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind: 'seki' }, actor);
      }
      return;
    }

    setCheered(true);
    const next = sekiCount + 1;
    setSekiCount(next);
    const optimistic = { ...previous, seki_count: next };
    onReelHypeChange?.(clip.id, optimistic);
    void markReelVote(clip.id, 'seki', actionUserId);
    const payload = {
      type: 'aura_hype' as const,
      reelId: clip.id,
      kind: 'seki' as const,
      grantAura: false,
      auraPoints: 0,
      userId: actionUserId,
    };
    try {
      if (!actor || !isReelUuid(clip.id)) return;
      if (!(await offlineQueue.isOnline())) {
        await offlineQueue.enqueue(payload, actor);
        return;
      }
      const client = await createOfflineActorClient(actor);
      const server = await bumpReelHype(clip.id, 'seki', previous, client);
      if (!actor.isCurrent()) return;
      onReelHypeChange?.(clip.id, server);
      setSekiCount(server.seki_count);
    } catch {
      await offlineQueue.enqueue(payload, actor);
    }
  }, [
    cheered,
    clip.auraCount,
    clip.flexCount,
    clip.id,
    clip.totalTipsCents,
    onReelHypeChange,
    sekiCount,
    user?.id,
  ]);

  const onCheer = useCallback(() => {
    requireAuth({
      kind: 'signin',
      resume: () => {
        void runCheer();
      },
    });
  }, [requireAuth, runCheer]);

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${athlete}. ${title}`}>
      <Pressable
        onPress={onOpenProfile}
        disabled={!onOpenProfile}
        accessibilityRole={onOpenProfile ? 'link' : undefined}
        accessibilityLabel={onOpenProfile ? `Open ${athlete} profile` : undefined}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {athlete}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={isPhotoStory(clip) ? `Open photo story: ${title}` : `Play Highlight: ${title}`}
        style={styles.media}
      >
        {poster ? (
          <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.posterFallback} />
        )}
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name={isPhotoStory(clip) ? 'images' : 'play'} size={28} color={colors.primary} />
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {whyThisClip ? (
          <Text style={styles.why}>
            <Text style={styles.whyLabel}>Why this clip: </Text>
            {whyThisClip}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={onCheer}
            accessibilityRole="button"
            accessibilityState={{ selected: cheered }}
            accessibilityLabel={cheered ? `Cheered · Seki ${sekiCount}` : `Cheer · Seki ${sekiCount}`}
            style={[styles.actionBtn, cheered && styles.actionBtnOn]}
          >
            <Ionicons name={cheered ? 'heart' : 'heart-outline'} size={18} color={cheered ? colors.primary : colors.text} />
            <Text style={[styles.actionLabel, cheered && styles.actionLabelOn]}>Cheer</Text>
            {sekiCount > 0 ? <Text style={styles.count}>{sekiCount}</Text> : null}
          </Pressable>
          <Pressable
            onPress={onTip}
            accessibilityRole="button"
            accessibilityLabel={userTipped ? 'Gift sent — Send another gift' : 'Send a gift'}
            style={styles.giftBtn}
          >
            <Ionicons name="gift-outline" size={18} color={colors.primary} />
            <Text style={styles.giftLabel}>{userTipped ? 'Gift again' : 'Send a gift'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: colors.surface,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: FONT.semibold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  media: {
    aspectRatio: 16 / 9,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.jadeInk,
  },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: space.md,
    gap: space.sm,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: colors.text,
  },
  why: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  whyLabel: {
    fontFamily: FONT.semibold,
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
  },
  actionBtnOn: {
    backgroundColor: FOCAL.mistJade,
  },
  actionLabel: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.text,
  },
  actionLabelOn: {
    color: colors.primary,
  },
  count: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  giftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  giftLabel: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.primary,
  },
});
