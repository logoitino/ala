import { useEventListener } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ReelActionOverlay } from '@/components/Reels/ReelActionOverlay';
import { ReelMoreSheet } from '@/components/Reels/ReelMoreSheet';
import { ReportContentModal } from '@/components/Reels/ReportContentModal';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';
import { HypeBurst } from '@/components/Effects/HypeBurst';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, palette, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  flashUnlockChipLabel,
  isClipVaultOnly,
  isFlashUnlockActive,
  VAULT_BADGE_LABEL,
  vaultUnlockLabel,
} from '@/data/exclusive';
import {
  displayValue,
  type PlayReactionId,
  type Player,
} from '@/data/players';
import {
  doubleTapAuraForCategory,
  reelCategoryBadge,
  REEL_CATEGORY_SERVE,
  type HighlightClip,
} from '@/data/highlights';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useGameEventBroadcast } from '@/hooks/useGameEventBroadcast';
import { useSavedReel } from '@/hooks/useSavedReel';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { addUserAura, auraBadgeLabel, auraTierForPoints, emitPlayerAura, emitProfileAura, resolveAuraPoints } from '@/lib/aura';
import { hypeFromPlayer } from '@/lib/hype';
import { formatGameEventHeadline } from '@/lib/operator';
import { bumpReelHype, formatReelDeepLink, hideReelLocally, hypeFromReel, isReelUuid, reportReelRemote, type ReelHype } from '@/lib/reels';
import { loadReelVotes, markReelVote, type ReelVoteMap } from '@/lib/reelVotes';
import { isVaultSealed } from '@/lib/vault';
import { telemetry } from '@/services/TelemetryManager';
import { offlineQueue } from '@/services/OfflineQueue';
import { FOCAL, SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';
import type { UsageSurface } from '@/hooks/useSurfaceUsage';

export type ReelCardProps = {
  clip: HighlightClip;
  player: Player | null;
  active: boolean;
  height: number;
  tipping: boolean;
  sekiPlay?: boolean;
  /** When true, play if `active` even if the host route is not focused (profile / athlete modal). */
  playbackActive?: boolean;
  onTip: () => void;
  /** True after this fan has already dropped a Mālo on this clip. */
  userTipped?: boolean;
  onOpenProfile?: () => void;
  onReelHypeChange?: (reelId: string, hype: ReelHype) => void;
  /** After Report / Hide, parent drops this clip from the paging feed. */
  onHide?: (reelId: string) => void;
  /** Tab that owns this card so usage reports know which surface liked / failed the control. */
  surface?: UsageSurface;
};

type HypePop = {
  id: number;
  x: number;
  y: number;
  kind: PlayReactionId;
  boosted?: boolean;
};

const LIVE_BANNER_RESERVE = 108;
/** Scene already ends at the fan bar; keep chrome on the clip, just above the nav. */
const OVERLAY_BOTTOM_INSET = 8;

/**
 * @purpose Full-screen Reel feed card: Exclusive mute vs double-tap Aura ⚡, TikTok-style name + caption on the clip just above the fan bar, Train/Serve / Flash Unlock chips, one Seki / Aura / Flex per fan, Mālo fills after a tip, ⋯ for Share / Save / Report. Vault clips lock when `players.vault_locked` (default) unless the fan is subscribed or a Flash Unlock window is live. Serve Like Me doubles double-tap Aura. Seki / Aura / Flex fire a colored `HypeBurst`.
 * @param clip Highlight including `isVaultOnly` from `reels.is_vault_only` (default false), optional `gameId`, `category`, and `flashUnlockUntil`.
 * @param onOpenProfile Opens `/user/[id]` so the fan can subscribe when Stripe is unavailable.
 * @param playbackActive When true, play the focused page even if the Expo route is unfocused (profile modal).
 * @sideEffects expo-video; optimistic `reels` hype + `increment_reel_hype` (OfflineQueue when `NetInfo.isConnected === false`); double-tap `add_user_aura` (2× on Serve Like Me) + Medium haptic + `HypeBurst`; mute toggle; `saved_reels`; Expo `Share.share`; `report_reel`; Broadcast subscribe on `game_events_${gameId}`; `TelemetryManager` TTFF + stall + feature taps / report issues; vault unlock via PaymentSheet.
 */
export function ReelCard({
  clip,
  player,
  active,
  height,
  tipping,
  sekiPlay: _sekiPlay = false,
  playbackActive,
  onTip,
  userTipped = false,
  onOpenProfile,
  onReelHypeChange,
  onHide,
  surface = 'home',
}: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const { live } = useAppRuntime();
  const { user, profile, isAthlete } = useAuth();
  const celebration = useOptionalCelebration();
  const tabFocused = useIsFocused();
  const isFocused = (playbackActive ?? tabFocused) && active;
  const vaultOnly = isClipVaultOnly(clip);
  const [now, setNow] = useState(Date.now());
  const flashOpen = isFlashUnlockActive(clip.flashUnlockUntil, now);
  const flashChip = flashUnlockChipLabel(clip.flashUnlockUntil, now);
  const { subscribed, grant } = useAthleteSubscription(vaultOnly && !flashOpen ? clip.playerId ?? undefined : undefined);
  const { startCheckout, busy: unlocking } = useTipCheckout();
  const { saved, toggling: saving, toggle: toggleSave } = useSavedReel(clip.id);
  const ownsClip =
    isAthlete &&
    Boolean(player?.name?.trim()) &&
    player!.name.trim().toLowerCase() === (profile?.full_name ?? '').trim().toLowerCase();
  const locked = vaultOnly && !flashOpen && isVaultSealed(player?.vault_locked) && subscribed !== true && !ownsClip;
  const [hype, setHype] = useState(() => hypeFromPlayer(player));
  const [reelHype, setReelHype] = useState<ReelHype>(() =>
    hypeFromReel({
      seki_count: clip.sekiCount,
      aura_count: clip.auraCount,
      flex_count: clip.flexCount,
      total_tips_cents: clip.totalTipsCents,
    }),
  );
  const [muted, setMuted] = useState(true);
  const [bursts, setBursts] = useState<HypePop[]>([]);
  const [loopFlash, setLoopFlash] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [votes, setVotes] = useState<ReelVoteMap>({ seki: false, aura: false, flex: false });
  const burstId = useRef(0);
  const loadedUriRef = useRef(clip.videoUrl);
  const isFocusedRef = useRef(isFocused);
  const lockedRef = useRef(locked);
  const mutedRef = useRef(muted);
  const reelHypeRef = useRef(reelHype);
  const votesRef = useRef(votes);
  const loadStartedAtRef = useRef<number | null>(null);
  const firstFrameLoggedRef = useRef(false);
  const stallStartedAtRef = useRef<number | null>(null);
  const appPausedRef = useRef(false);
  const blurTarget = useRef<View>(null);
  const muteOpacity = useSharedValue(0);
  const playerName = displayValue(player?.name, clip.athleteName);
  const schoolName = (player?.school_name || clip.school || '').trim();
  const auraTier = auraTierForPoints(
    player ? resolveAuraPoints(player) : Math.max(0, (clip.auraCount ?? 0) + (clip.sekiCount ?? 0) + (clip.flexCount ?? 0)),
  );
  const { lastEvent, clear: clearPlay } = useGameEventBroadcast({
    gameId: clip.gameId,
    enabled: isFocused,
    followFeatured: !clip.gameId,
  });
  const categoryBadge = reelCategoryBadge(clip.category);
  const serveCategory = clip.category === REEL_CATEGORY_SERVE;
  const videoSource = clip.videoUrl || null;

  isFocusedRef.current = isFocused;
  lockedRef.current = locked;
  mutedRef.current = muted;
  reelHypeRef.current = reelHype;
  votesRef.current = votes;

  const clipIdRef = useRef(clip.id);
  clipIdRef.current = clip.id;

  const videoPlayer = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  const muteBadgeStyle = useAnimatedStyle(() => ({
    opacity: muteOpacity.value,
  }));

  useEffect(() => {
    let live = true;
    void loadReelVotes(clip.id, user?.id).then((next) => {
      if (!live) return;
      votesRef.current = next;
      setVotes(next);
    });
    return () => {
      live = false;
    };
  }, [clip.id, user?.id]);

  useEffect(() => {
    if (!clip.flashUnlockUntil) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clip.flashUnlockUntil]);

  useEffect(() => {
    setHype(hypeFromPlayer(player));
  }, [player?.id, player?.view_count, player?.aura_count, player?.flex_count, player?.seki_count]);

  useEffect(() => {
    setReelHype(
      hypeFromReel({
        seki_count: clip.sekiCount,
        aura_count: clip.auraCount,
        flex_count: clip.flexCount,
        total_tips_cents: clip.totalTipsCents,
      }),
    );
  }, [clip.id, clip.sekiCount, clip.auraCount, clip.flexCount, clip.totalTipsCents]);

  useEffect(() => {
    loadStartedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    stallStartedAtRef.current = null;
  }, [clip.id, clip.videoUrl]);

  useEffect(() => {
    if (!clip.videoUrl || loadedUriRef.current === clip.videoUrl) return;
    loadedUriRef.current = clip.videoUrl;
    loadStartedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    stallStartedAtRef.current = null;
    void videoPlayer.replaceAsync(clip.videoUrl);
  }, [clip.videoUrl, videoPlayer]);

  useEffect(() => {
    videoPlayer.loop = true;
    videoPlayer.muted = muted;
    if (isFocused && !locked) {
      appPausedRef.current = false;
      videoPlayer.play();
      return;
    }
    appPausedRef.current = true;
    stallStartedAtRef.current = null;
    videoPlayer.pause();
  }, [isFocused, locked, muted, videoPlayer]);

  useEffect(() => {
    if (!active) setMuted(true);
  }, [active]);

  const flashMuteBadge = useCallback(() => {
    muteOpacity.value = 1;
    muteOpacity.value = withDelay(800, withTiming(0, { duration: 220 }));
  }, [muteOpacity]);

  const toggleMute = useCallback(() => {
    if (lockedRef.current) return;
    setMuted((current) => !current);
    flashMuteBadge();
  }, [flashMuteBadge]);

  const commitHype = useCallback(
    (kind: PlayReactionId, fromDoubleTap = false) => {
      if (lockedRef.current) return;
      if (votesRef.current[kind]) return;
      telemetry.trackFeature(`hype.${kind}`, surface);
      const nextVotes = { ...votesRef.current, [kind]: true };
      votesRef.current = nextVotes;
      setVotes(nextVotes);
      void markReelVote(clip.id, kind, user?.id);
      const previous = reelHypeRef.current;
      const optimistic: ReelHype = {
        ...previous,
        seki_count: kind === 'seki' ? previous.seki_count + 1 : previous.seki_count,
        aura_count: kind === 'aura' ? previous.aura_count + 1 : previous.aura_count,
        flex_count: kind === 'flex' ? previous.flex_count + 1 : previous.flex_count,
      };
      reelHypeRef.current = optimistic;
      setReelHype(optimistic);
      onReelHypeChange?.(clip.id, optimistic);
      const auraPoints = fromDoubleTap ? doubleTapAuraForCategory(clip.category) : 0;

      void (async () => {
        const payload = {
          type: 'aura_hype' as const,
          reelId: clip.id,
          kind,
          grantAura: fromDoubleTap,
          auraPoints,
          userId: user?.id,
        };
        if (!(await offlineQueue.isOnline())) {
          await offlineQueue.enqueue(payload);
          return;
        }
        try {
          const server = await bumpReelHype(clip.id, kind, previous);
          const applied =
            kind === 'seki'
              ? server.seki_count > previous.seki_count
              : kind === 'aura'
                ? server.aura_count > previous.aura_count
                : server.flex_count > previous.flex_count;
          reelHypeRef.current = server;
          setReelHype(server);
          onReelHypeChange?.(clip.id, server);
          if (!applied) return;
          if (fromDoubleTap && user?.id && auraPoints > 0) {
            const award = await addUserAura(user.id, auraPoints);
            if (award.profile_aura_points != null) emitProfileAura(user.id, award.profile_aura_points);
            if (award.player_aura_points != null) emitPlayerAura(user.id, award.player_aura_points);
            if (award.profile_aura_points == null && award.player_aura_points == null && award.aura_points) {
              emitProfileAura(user.id, award.aura_points);
            }
          }
        } catch {
          await offlineQueue.enqueue(payload);
        }
      })();
    },
    [clip.category, clip.id, onReelHypeChange, surface, user?.id],
  );

  const onDoubleAura = useCallback(
    (x: number, y: number) => {
      if (lockedRef.current) return;
      if (votesRef.current.aura) return;
      const id = burstId.current + 1;
      burstId.current = id;
      const boosted = clip.category === REEL_CATEGORY_SERVE;
      setBursts((current) => [...current.slice(-4), { id, x, y, kind: 'aura', boosted }]);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Simulator / web may not expose haptics.
      }
      commitHype('aura', true);
    },
    [clip.category, commitHype],
  );

  const confirmReport = useCallback(async () => {
    if (reporting) return;
    setReporting(true);
    try {
      await hideReelLocally(clip.id);
      onHide?.(clip.id);
      telemetry.trackIssue('report', surface);
      celebration?.showToast('Highlight hidden 🚩');
      setReportOpen(false);
      if (user?.id && isReelUuid(clip.id)) {
        await offlineQueue.runOrEnqueue({ type: 'report_reel', reelId: clip.id }, () => reportReelRemote(clip.id));
      }
    } finally {
      setReporting(false);
    }
  }, [celebration, clip.id, onHide, reporting, surface, user?.id]);

  const unlockVault = useCallback(() => {
    if (unlocking) return;
    telemetry.trackFeature('vault_unlock', surface);
    if (!player) {
      onOpenProfile?.();
      return;
    }
    void startCheckout({
      player,
      tipAmount: live.catalog.exclusiveDollars,
      coverFees: false,
      auraPoints: live.catalog.exclusiveAura,
      skipBacker: true,
      onPaid: grant,
    });
  }, [grant, live.catalog.exclusiveAura, live.catalog.exclusiveDollars, onOpenProfile, player, startCheckout, surface, unlocking]);

  const onShare = useCallback(async () => {
    const url = formatReelDeepLink(clip.id, clip.playerId ?? player?.id ?? null);
    const message = `Watch ${playerName} on Tapua'i`;
    telemetry.trackFeature('share', surface);
    try {
      await Share.share(
        Platform.OS === 'ios' ? { url, message } : { message: `${message}\n${url}` },
      );
    } catch {
      // User cancelled or the share sheet is unavailable.
    }
  }, [clip.id, clip.playerId, player?.id, playerName, surface]);

  useEffect(() => {
    if (!lastEvent) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Simulator / web may not expose haptics.
    }
  }, [lastEvent]);

  const videoTaps = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(280)
      .maxDelay(220)
      .maxDistance(28)
      .maxDeltaY(28)
      .onEnd((event, success) => {
        if (!success) return;
        runOnJS(onDoubleAura)(event.x, event.y);
      });

    const singleTap = Gesture.Tap()
      .maxDuration(220)
      .maxDistance(28)
      .maxDeltaY(28)
      .requireExternalGestureToFail(doubleTap)
      .onEnd((_event, success) => {
        if (!success) return;
        runOnJS(toggleMute)();
      });

    return Gesture.Exclusive(doubleTap, singleTap);
  }, [onDoubleAura, toggleMute]);

  useEventListener(videoPlayer, 'statusChange', ({ status, oldStatus }) => {
    if (status === 'loading') {
      if (loadStartedAtRef.current == null) loadStartedAtRef.current = Date.now();
      if (
        firstFrameLoggedRef.current &&
        oldStatus === 'readyToPlay' &&
        isFocusedRef.current &&
        !lockedRef.current &&
        !appPausedRef.current &&
        stallStartedAtRef.current == null
      ) {
        stallStartedAtRef.current = Date.now();
      }
    }

    if (status === 'readyToPlay') {
      if (loadStartedAtRef.current != null && !firstFrameLoggedRef.current) {
        telemetry.track({
          event_type: 'video_first_frame',
          video_id: clipIdRef.current,
          duration_ms: Date.now() - loadStartedAtRef.current,
        });
        firstFrameLoggedRef.current = true;
      }
      if (stallStartedAtRef.current != null) {
        telemetry.trackVideoStall(clipIdRef.current, Date.now() - stallStartedAtRef.current);
        stallStartedAtRef.current = null;
      }
      if (isFocusedRef.current && !lockedRef.current) {
        videoPlayer.loop = true;
        videoPlayer.muted = mutedRef.current;
        videoPlayer.play();
      }
    }
  });

  useEventListener(videoPlayer, 'playingChange', ({ isPlaying, oldIsPlaying }) => {
    if (
      oldIsPlaying &&
      !isPlaying &&
      firstFrameLoggedRef.current &&
      isFocusedRef.current &&
      !lockedRef.current &&
      !appPausedRef.current &&
      stallStartedAtRef.current == null
    ) {
      stallStartedAtRef.current = Date.now();
      return;
    }
    if (isPlaying && stallStartedAtRef.current != null) {
      telemetry.trackVideoStall(clipIdRef.current, Date.now() - stallStartedAtRef.current);
      stallStartedAtRef.current = null;
    }
  });

  useEventListener(videoPlayer, 'playToEnd', () => {
    if (!isFocusedRef.current) return;
    setLoopFlash(true);
    setTimeout(() => setLoopFlash(false), 1400);
  });

  return (
    <View style={[styles.page, { height }]}>
      <BlurTargetView ref={blurTarget} style={styles.video}>
        <VideoView
          player={videoPlayer}
          style={styles.videoFill}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"
          allowsVideoFrameAnalysis={false}
          allowsPictureInPicture={false}
          playsInline
        />
      </BlurTargetView>

      <GestureDetector gesture={videoTaps}>
        <View style={styles.hitLayer} />
      </GestureDetector>

      <View pointerEvents="none" style={styles.scrim} />
      {locked ? (
        <BlurView
          intensity={80}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurTarget={blurTarget}
          style={styles.lockBlur}
        >
          <View style={styles.vaultPanel}>
            <View
              accessibilityRole="text"
              accessibilityLabel={VAULT_BADGE_LABEL}
              style={styles.vaultBadge}
            >
              <Text style={styles.vaultBadgeLabel}>{VAULT_BADGE_LABEL}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={vaultUnlockLabel(live.catalog.exclusiveDollars)}
              accessibilityState={{ disabled: unlocking }}
              disabled={unlocking}
              haptic="medium"
              onPress={unlockVault}
              style={({ pressed }) => [styles.unlockBtn, pressed && styles.pressed, unlocking && styles.disabled]}
            >
              <Text style={styles.unlockLabel}>
                {unlocking ? 'Opening PaymentSheet…' : vaultUnlockLabel(live.catalog.exclusiveDollars)}
              </Text>
            </Pressable>
          </View>
        </BlurView>
      ) : null}

      {bursts.map((burst) => (
        <View
          key={burst.id}
          pointerEvents="none"
          style={[
            styles.hypePop,
            burst.boosted && styles.hypePopBoost,
            { left: burst.x - (burst.boosted ? 64 : 48), top: burst.y - (burst.boosted ? 64 : 48) },
          ]}
        >
          <HypeBurst
            kind={burst.kind}
            boosted={burst.boosted}
            onDone={() => setBursts((current) => current.filter((item) => item.id !== burst.id))}
          />
        </View>
      ))}

      <Reanimated.View pointerEvents="none" style={[styles.muteBadge, muteBadgeStyle]}>
        <View style={styles.muteChip}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={28} color={FOCAL.neonJade} />
        </View>
      </Reanimated.View>

      {lastEvent ? (
        <PlayBroadcastBanner
          key={`${lastEvent.timestamp}:${lastEvent.type}`}
          headline={formatGameEventHeadline(lastEvent)}
          top={insets.top + 100}
          onDone={clearPlay}
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.meta, { paddingTop: insets.top + LIVE_BANNER_RESERVE }]}>
        <View style={styles.focalLeft}>
          {flashChip ? (
            <View accessibilityRole="text" accessibilityLabel={flashChip} style={styles.flashChip}>
              <Text style={styles.flashChipLabel} numberOfLines={1}>
                {flashChip}
              </Text>
            </View>
          ) : null}
          {categoryBadge ? (
            <View
              accessibilityRole="text"
              accessibilityLabel={categoryBadge}
              style={[styles.categoryBadge, serveCategory && styles.categoryBadgeServe]}
            >
              <Text style={[styles.categoryBadgeLabel, serveCategory && styles.categoryBadgeLabelServe]} numberOfLines={1}>
                {categoryBadge}
              </Text>
            </View>
          ) : null}
        </View>
        {loopFlash ? <Text style={styles.loopFlash}>Full replay</Text> : null}
      </View>

      <View pointerEvents="box-none" style={styles.actionsLayer}>
        <ReelActionOverlay
          athleteName={playerName}
          schoolName={schoolName}
          caption={clip.tag}
          auraColor={auraTier.color}
          auraGlow={auraTier.glow}
          auraLabel={auraBadgeLabel(auraTier)}
          hype={reelHype}
          voted={votes}
          userTipped={userTipped}
          tipping={tipping}
          reacting={locked}
          canTip={Boolean(player) && !locked}
          canOpenAthlete={Boolean(onOpenProfile)}
          onOpenAthlete={onOpenProfile}
          onTip={() => {
            telemetry.trackFeature('malo', surface);
            onTip();
          }}
          onOpenMore={() => {
            telemetry.trackFeature('more', surface);
            setMoreOpen(true);
          }}
          onReact={(kind) => {
            if (locked) return;
            commitHype(kind);
          }}
        />
      </View>
      <ReelMoreSheet
        visible={moreOpen}
        athleteName={playerName}
        saved={saved}
        saving={saving}
        onClose={() => setMoreOpen(false)}
        onShare={() => {
          setMoreOpen(false);
          void onShare();
        }}
        onToggleSave={() => {
          telemetry.trackFeature('save', surface);
          void toggleSave();
        }}
        onReport={() => {
          setMoreOpen(false);
          setReportOpen(true);
        }}
        onSuggest={
          live.buttons.suggest
            ? () => {
                setMoreOpen(false);
                setSuggestOpen(true);
              }
            : undefined
        }
      />
      <SuggestionSheet visible={suggestOpen} surface="home" onClose={() => setSuggestOpen(false)} />
      <ReportContentModal
        visible={reportOpen}
        athleteName={playerName}
        submitting={reporting}
        onClose={() => {
          if (!reporting) setReportOpen(false);
        }}
        onConfirm={() => {
          void confirmReport();
        }}
      />
    </View>
  );
}

const BANNER_HOLD_MS = 3000;
const BANNER_FADE_MS = 280;

/**
 * @purpose Spring-in live callout over the focused Reel; swipe up or tap ✕ to dismiss, else fades after 3s.
 * @param headline Copy such as "⚡ BIG PLAY: Westlake Thunder!".
 * @param top Offset under the live score overlay.
 * @param onDone Clears hook state after the fade or a manual dismiss.
 * @sideEffects Light `impactAsync` via `SwipeableBannerWrapper` on swipe/tap dismiss.
 */
function PlayBroadcastBanner({
  headline,
  top,
  onDone,
}: {
  headline: string;
  top: number;
  onDone: () => void;
}) {
  const opacity = useSharedValue(0);
  const rise = useSharedValue(-18);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withSpring(1, SPRING_CARD);
    rise.value = withSpring(0, SPRING_CARD);
    scale.value = withSpring(1, SPRING_BOUNCE);
    const fade = setTimeout(() => {
      opacity.value = withTiming(0, { duration: BANNER_FADE_MS });
      rise.value = withTiming(-8, { duration: BANNER_FADE_MS });
    }, BANNER_HOLD_MS);
    const done = setTimeout(onDone, BANNER_HOLD_MS + BANNER_FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone, opacity, rise, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }, { scale: scale.value }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.playBannerSlot, { top }]}>
      <SwipeableBannerWrapper accessibilityLabel="Dismiss play callout" onDismiss={onDone}>
        <Reanimated.View
          style={[styles.playBanner, style]}
          accessibilityLiveRegion="assertive"
          accessibilityLabel={headline}
        >
          <Text style={styles.playBannerLabel}>{headline}</Text>
        </Reanimated.View>
      </SwipeableBannerWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.night,
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  videoFill: {
    ...StyleSheet.absoluteFill,
  },
  hitLayer: {
    ...StyleSheet.absoluteFill,
  },
  lockBlur: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 8,
  },
  vaultPanel: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 300,
  },
  vaultBadge: {
    backgroundColor: colors.videoScrimSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  vaultBadgeLabel: {
    color: FOCAL.neonJade,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  unlockBtn: {
    backgroundColor: FOCAL.neonJade,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
  unlockLabel: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,22,15,0.28)',
  },
  hypePop: {
    position: 'absolute',
    width: 96,
    height: 96,
    zIndex: 6,
  },
  hypePopBoost: {
    width: 128,
    height: 128,
  },
  muteBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  muteChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 4,
    zIndex: 3,
  },
  actionsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: OVERLAY_BOTTOM_INSET,
    zIndex: 3,
  },
  focalLeft: {
    flex: 1,
    gap: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  flashChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,230,118,0.18)',
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
    shadowColor: FOCAL.neonJade,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 4,
  },
  flashChipLabel: {
    color: FOCAL.neonJade,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  categoryBadgeServe: {
    borderColor: FOCAL.neonJade,
    backgroundColor: 'rgba(0,230,118,0.16)',
    shadowColor: FOCAL.neonJade,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 4,
  },
  categoryBadgeLabel: {
    color: colors.onVideo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryBadgeLabelServe: {
    color: FOCAL.neonJade,
  },
  loopFlash: {
    marginTop: 6,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  playBannerSlot: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 12,
  },
  playBanner: {
    alignItems: 'center',
    backgroundColor: palette.midnightObsidian,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    paddingHorizontal: 14,
    paddingRight: 36,
    paddingVertical: 12,
  },
  playBannerLabel: {
    color: FOCAL.neonJade,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
