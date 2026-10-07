/**
 * One full-screen Highlights clip: video player, hype rail (Seki / Aura / Flex), donate button, save, report,
 * owner peek, "Filmed by" credit and the live play banner.
 * `ReelCard` is a thin wrapper that passes identity-stable callbacks to the memoised `ReelCardImpl`; keep that
 * split or a stale handler can run (see STATE.md, 2026-09-29 pre-merge fixes). View counting needs 3 s of real
 * playback (`useReelViewTracker`). The Rally meter is not here; Home (app/(tabs)/index.tsx) places it.
 * @sideEffects Votes, saves, reports and view counts via hooks / lib; haptics.
 */

import { fetchReelAccountTags } from '@/lib/accountTags';
import { useEventListener } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
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
import { FilmerSheet } from '@/components/Filmers/FilmerSheet';
import { ReelMoreSheet } from '@/components/Reels/ReelMoreSheet';
import { ReportContentModal } from '@/components/Reels/ReportContentModal';
import type { ReportReasonId } from '@/data/contentRights';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';
import { HypeBurst } from '@/components/Effects/HypeBurst';
import { useReelViewTracker } from '@/hooks/useReelViewTracker';
import { viewThresholdMs } from '@/lib/leaderboards';
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
import {
  canDropMaloOnHighlight,
  MALO_PENDING_TAG_TOAST,
  MALO_UNTAGGED_TOAST,
} from '@/data/malo';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useGameEventBroadcast } from '@/hooks/useGameEventBroadcast';
import { useSavedReel } from '@/hooks/useSavedReel';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { addUserAura, auraBadgeLabel, auraTierForPoints, emitPlayerAura, emitProfileAura, resolveAuraPoints } from '@/lib/aura';
import { hypeFromPlayer } from '@/lib/hype';
import { formatGameEventHeadline } from '@/lib/operator';
import { bumpReelHype, clearReelHype, formatReelDeepLink, hideReelLocally, hypeFromReel, isReelUuid, reportReelRemote, type ReelHype } from '@/lib/reels';
import { clearReelVote, loadReelVotes, markReelVote, type ReelVoteMap } from '@/lib/reelVotes';
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
  /** Measured feed header clearance; oversized text stays scrollable below its scoreboard. */
  overlayInsetTop?: number;
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

/** Burst container size in points. Offsets are derived as half of this so it centres on the tap. */
function popSize(burst: HypePop): number {
  return burst.boosted ? 224 : 176;
}

/** Reads the counter for one hype kind so the optimistic/server comparisons stay readable. */
function countFor(hype: ReelHype, kind: PlayReactionId): number {
  return kind === 'seki' ? hype.seki_count : kind === 'aura' ? hype.aura_count : hype.flex_count;
}

const LIVE_BANNER_RESERVE = 108;
/** Scene already ends at the fan bar; keep chrome on the clip, just above the nav. */
const OVERLAY_BOTTOM_INSET = 8;

/**
 * @purpose Full-screen Reel feed card: Exclusive mute vs double-tap Aura ⚡, TikTok-style name + caption on the clip just above the fan bar, Train/Serve / Flash Unlock chips, one Seki / Aura / Flex per fan, Mālo for the confirmed athlete on the clip (not the uploader), ⋯ for Share / Save / Report. Vault clips lock when `players.vault_locked` (default) unless the fan is subscribed or a Flash Unlock window is live. Serve Like Me doubles double-tap Aura. Only Aura (chip or double-tap) fires a `HypeBurst`; Seki's chip briefly turns into a 🏈, Flex just lights up.
 * @param clip Highlight including `isVaultOnly` from `reels.is_vault_only` (default false), optional `gameId`, `category`, `flashUnlockUntil`, and `tagStatus`.
 * @param onOpenProfile Opens `/user/[id]` so the fan can subscribe when Stripe is unavailable — also used when Mālo is blocked on a pending tag.
 * @param playbackActive When true, play the focused page even if the Expo route is unfocused (profile modal).
 * @sideEffects expo-video; optimistic `reels` hype + `increment_reel_hype` / `clear_reel_hype` (OfflineQueue when `NetInfo.isConnected === false`); double-tap `add_user_aura` (2× on Serve Like Me) + Medium haptic + `HypeBurst`; mute toggle; `saved_reels`; Expo `Share.share`; `report_reel`; Broadcast subscribe on `game_events_${gameId}`; `TelemetryManager` TTFF + stall + feature taps / report issues; vault unlock via PaymentSheet.
 */
function ReelCardImpl({
  clip,
  player,
  active,
  height,
  overlayInsetTop = 0,
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
  const [withAccounts, setWithAccounts] = useState('');
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
  const [filmerOpen, setFilmerOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [votes, setVotes] = useState<ReelVoteMap>({ seki: false, aura: false, flex: false });
  // True only while the video is really playing on screen; the view counter adds up this time.
  const [playing, setPlaying] = useState(false);
  // Kinds the fan tapped since this clip's saved votes started loading. The load is async, so a
  // tap right after swiping onto a clip used to be overwritten when the stored votes landed —
  // the chip flipped back and the next tap did the opposite of what the fan meant.
  const votesTouchedRef = useRef<Set<PlayReactionId>>(new Set());
  const burstId = useRef(0);
  // One counter per hype kind. Every tap bumps it; a server response is only applied if
  // its token is still current. Without this, spamming a chip interleaves
  // `increment_reel_hype` and `clear_reel_hype` and whichever lands last wins, so the
  // count visibly jumps around and can settle on the wrong value.
  const hypeGenRef = useRef<Record<PlayReactionId, number>>({ seki: 0, aura: 0, flex: 0 });
  // Number of hype mutations still settling. While this is > 0 the `clip` prop is just an
  // echo of our own optimistic write (we push it up via `onReelHypeChange`, the feed rebuilds
  // the clip, and it arrives back here), so the prop-sync effect must not overwrite local
  // state with it — that round trip is what made the counter flicker on tap.
  const hypeInFlightRef = useRef(0);
  // Bumped when the last in-flight mutation settles so the prop-sync effect re-runs and adopts
  // any count that arrived (refresh, another fan) while it was being skipped.
  const [hypeSettled, setHypeSettled] = useState(0);
  const settleHype = useCallback(() => {
    hypeInFlightRef.current = Math.max(0, hypeInFlightRef.current - 1);
    if (hypeInFlightRef.current === 0) setHypeSettled((current) => current + 1);
  }, []);
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
  const maloReady = canDropMaloOnHighlight(clip, player);
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

  // 2026-09 fix: this used to pass `videoSource` here directly, which makes `expo-video` start
  // loading/probing that URL the instant the component mounts — regardless of `active`. The Home
  // feed's FlatList mounts up to 10 cards on first render (RN's `initialNumToRender` default, not
  // overridden below), so every one of those 10 clips' videos — several pointing at now-dead
  // `commondatastorage.googleapis.com` sample URLs mixed into the seeded demo feed — started loading
  // concurrently on a single Home mount. On a real device this pegged the main thread hard enough to
  // make the whole app unresponsive with no error surfaced (confirmed via a wall of AVFoundation
  // "Failed to load available audio/subtitle tracks" warnings for every one of those 10 clips, right
  // where a real freeze reproduced). Starting from `null` and only loading the real source once this
  // card is `active` (below) means an off-screen mounted card never touches the network or the native
  // video decoder at all.
  const videoPlayer = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  const muteBadgeStyle = useAnimatedStyle(() => ({
    opacity: muteOpacity.value,
  }));

  useEffect(() => {
    let live = true;
    votesTouchedRef.current = new Set();
    void loadReelVotes(clip.id, user?.id).then((loaded) => {
      if (!live) return;
      const next = { ...loaded };
      for (const kind of votesTouchedRef.current) next[kind] = votesRef.current[kind];
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
    // Our own optimistic write is still round-tripping through the feed; adopting the prop
    // now would briefly show the pre-tap count.
    if (hypeInFlightRef.current > 0) return;
    const next = hypeFromReel({
      seki_count: clip.sekiCount,
      aura_count: clip.auraCount,
      flex_count: clip.flexCount,
      total_tips_cents: clip.totalTipsCents,
    });
    reelHypeRef.current = next;
    setReelHype(next);
  }, [clip.id, clip.sekiCount, clip.auraCount, clip.flexCount, clip.totalTipsCents, hypeSettled]);

  useEffect(() => {
    loadStartedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    stallStartedAtRef.current = null;
  }, [clip.id, clip.videoUrl]);

  useEffect(() => {
    if (!active || !clip.videoUrl || loadedUriRef.current === clip.videoUrl) return;
    loadedUriRef.current = clip.videoUrl;
    loadStartedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    stallStartedAtRef.current = null;
    void videoPlayer.replaceAsync(clip.videoUrl);
  }, [active, clip.videoUrl, videoPlayer]);

  useEffect(() => {
    if (!active || !clip.id) {
      setWithAccounts('');
      return;
    }
    let live = true;
    void fetchReelAccountTags(clip.id).then((rows) => {
      if (!live) return;
      const names = rows.filter((row) => row.status === 'confirmed').map((row) => row.label);
      setWithAccounts(names.join(', '));
    });
    return () => {
      live = false;
    };
  }, [active, clip.id]);

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

  const releaseHype = useCallback(
    (kind: PlayReactionId) => {
      if (!votesRef.current[kind]) return;
      votesTouchedRef.current.add(kind);
      const token = hypeGenRef.current[kind] + 1;
      hypeGenRef.current[kind] = token;
      const nextVotes = { ...votesRef.current, [kind]: false };
      votesRef.current = nextVotes;
      setVotes(nextVotes);
      void clearReelVote(clip.id, kind, user?.id);
      const previous = reelHypeRef.current;
      const optimistic: ReelHype = {
        ...previous,
        seki_count: kind === 'seki' ? Math.max(0, previous.seki_count - 1) : previous.seki_count,
        aura_count: kind === 'aura' ? Math.max(0, previous.aura_count - 1) : previous.aura_count,
        flex_count: kind === 'flex' ? Math.max(0, previous.flex_count - 1) : previous.flex_count,
      };
      reelHypeRef.current = optimistic;
      setReelHype(optimistic);
      onReelHypeChange?.(clip.id, optimistic);

      hypeInFlightRef.current += 1;
      void (async () => {
        try {
          if (await offlineQueue.dropPendingHype(clip.id, kind)) return;
          if (!user?.id) return;
          if (!(await offlineQueue.isOnline())) {
            await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind });
            return;
          }
          try {
            const server = await clearReelHype(clip.id, kind, previous);
            // A newer tap superseded this one — keep the optimistic value it wrote.
            if (hypeGenRef.current[kind] !== token) return;
            if (votesRef.current[kind]) return;
            // The decrement did not take (e.g. `clear_reel_hype` not applied on this
            // database). Adopting the server row here would snap the count back up — the
            // flicker. Keep the optimistic value; a refresh will reconcile it.
            const cleared = countFor(server, kind) < countFor(previous, kind);
            if (!cleared) return;
            reelHypeRef.current = server;
            setReelHype(server);
            onReelHypeChange?.(clip.id, server);
          } catch {
            await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind });
          }
        } finally {
          settleHype();
        }
      })();
    },
    [clip.id, onReelHypeChange, settleHype, user?.id],
  );

  const commitHype = useCallback(
    (kind: PlayReactionId, fromDoubleTap = false) => {
      if (lockedRef.current) return;
      if (votesRef.current[kind]) {
        if (!fromDoubleTap) releaseHype(kind);
        return;
      }
      telemetry.trackFeature(`hype.${kind}`, surface);
      votesTouchedRef.current.add(kind);
      const token = hypeGenRef.current[kind] + 1;
      hypeGenRef.current[kind] = token;
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

      hypeInFlightRef.current += 1;
      void (async () => {
        const payload = {
          type: 'aura_hype' as const,
          reelId: clip.id,
          kind,
          grantAura: fromDoubleTap,
          auraPoints,
          userId: user?.id,
        };
        try {
          if (!(await offlineQueue.isOnline())) {
            await offlineQueue.enqueue(payload);
            return;
          }
          try {
            const server = await bumpReelHype(clip.id, kind, previous);
            // A newer tap (including an un-vote) superseded this one. Applying the stale
            // server row here is what made the count jump back up after clearing.
            if (hypeGenRef.current[kind] !== token) return;
            if (!votesRef.current[kind]) return;
            const applied = countFor(server, kind) > countFor(previous, kind);
            // Same reasoning as the clear path: if the increment did not take, keep the
            // optimistic value rather than snapping the counter back down.
            if (!applied) return;
            reelHypeRef.current = server;
            setReelHype(server);
            onReelHypeChange?.(clip.id, server);
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
        } finally {
          settleHype();
        }
      })();
    },
    [clip.category, clip.id, onReelHypeChange, releaseHype, settleHype, surface, user?.id],
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

  const confirmReport = useCallback(async (reason: Exclude<ReportReasonId, 'unspecified'>) => {
    if (reporting) return;
    setReporting(true);
    try {
      await hideReelLocally(clip.id);
      onHide?.(clip.id);
      telemetry.trackIssue('report', surface);
      celebration?.showToast('Highlight hidden 🚩');
      setReportOpen(false);
      if (user?.id && isReelUuid(clip.id)) {
        await offlineQueue.runOrEnqueue({ type: 'report_reel', reelId: clip.id, reason }, () =>
          reportReelRemote(clip.id, reason),
        );
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
    setPlaying(isPlaying);
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

  useReelViewTracker(
    clip.id,
    Boolean(user?.id),
    playing && isFocused && !locked,
    viewThresholdMs(playing ? videoPlayer.duration : null),
  );

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

      {bursts.map((burst) => {
        const size = popSize(burst);
        return (
          <View
            key={burst.id}
            pointerEvents="none"
            style={[styles.hypePop, { width: size, height: size, left: burst.x - size / 2, top: burst.y - size / 2 }]}
          >
            <HypeBurst
              kind={burst.kind}
              boosted={burst.boosted}
              onDone={() => setBursts((current) => current.filter((item) => item.id !== burst.id))}
            />
          </View>
        );
      })}

      <Reanimated.View pointerEvents="none" style={[styles.muteBadge, muteBadgeStyle]}>
        <View style={styles.muteChip}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={28} color={FOCAL.electricGold} />
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

      <View pointerEvents="box-none" style={[styles.actionsLayer, { top: overlayInsetTop }]}>
        <ReelActionOverlay
          athleteName={playerName}
          schoolName={schoolName}
          jerseyNumber={player?.jersey_number}
          position={player?.position}
          caption={clip.tag}
          withAccounts={withAccounts}
          filmedBy={clip.filmedBy}
          onOpenFilmer={clip.filmedBy && clip.uploadedBy ? () => setFilmerOpen(true) : undefined}
          auraColor={auraTier.color}
          auraGlow={auraTier.glow}
          auraLabel={auraBadgeLabel(auraTier)}
          hype={reelHype}
          voted={votes}
          userTipped={userTipped}
          tipping={tipping}
          reacting={locked}
          canTip={!locked && Boolean(onTip)}
          maloReady={maloReady}
          canOpenAthlete={Boolean(onOpenProfile)}
          onOpenAthlete={onOpenProfile}
          onTip={() => {
            if (!maloReady) {
              telemetry.trackFeature('malo.blocked', surface);
              const message =
                clip.tagStatus === 'pending' || clip.tagStatus === 'rejected'
                  ? MALO_PENDING_TAG_TOAST
                  : MALO_UNTAGGED_TOAST;
              if (onOpenProfile && (clip.playerId || player?.id)) {
                celebration?.showToast(message);
                onOpenProfile();
                return;
              }
              Alert.alert('Support the athlete in the play', message);
              return;
            }
            telemetry.trackFeature('malo', surface);
            onTip();
          }}
          onOpenMore={() => {
            telemetry.trackFeature('more', surface);
            setMoreOpen(true);
          }}
          onReact={(kind) => {
            if (locked) return;
            // The burst is fired by the chip itself (ReelActionOverlay) so it lands on the
            // control the fan actually touched. Do not also spawn a centred one here —
            // that read as one tap producing two effects.
            commitHype(kind);
          }}
        />
      </View>
      {filmerOpen && clip.filmedBy ? (
        <FilmerSheet
          visible
          filmerName={clip.filmedBy}
          filmerProfileId={clip.uploadedBy}
          reelId={clip.id}
          onClose={() => setFilmerOpen(false)}
        />
      ) : null}
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
        onConfirm={(reason) => {
          void confirmReport(reason);
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
    borderColor: 'rgba(255,23,68,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  vaultBadgeLabel: {
    color: FOCAL.ember,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  unlockBtn: {
    backgroundColor: FOCAL.electricGold,
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
    // Width/height/offset are set inline from `popSize` so the pop centres on the tap point.
    position: 'absolute',
    zIndex: 6,
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
    borderColor: FOCAL.electricGold,
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
    borderColor: FOCAL.electricGold,
    backgroundColor: 'rgba(255,215,0,0.18)',
    shadowColor: FOCAL.electricGold,
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
    color: FOCAL.electricGold,
  },
  loopFlash: {
    marginTop: 6,
    color: FOCAL.electricGold,
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
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 14,
    paddingRight: 36,
    paddingVertical: 12,
  },
  playBannerLabel: {
    color: FOCAL.electricGold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});

/**
 * Tapping a hype chip bubbles the new count to the feed, which rebuilds every `clip` object
 * and re-renders every mounted card — video chrome, blur layers, Skia glow and the action
 * rail included. That cascade, not the counter itself, is what made the chips feel janky.
 *
 * Function props are compared by identity. The exported `ReelCard` wrapper hands the memoized
 * card stable stand-ins that call the latest parent callback, so fresh parent closures do not
 * defeat the memo — and a skipped render can never leave a stale closure behind (the parents'
 * `onTip` goes through `requireAuth`, which captures auth `loading` / `session`).
 */
function sameReelCardProps(prev: ReelCardProps, next: ReelCardProps): boolean {
  if (
    prev.active !== next.active ||
    prev.height !== next.height ||
    prev.overlayInsetTop !== next.overlayInsetTop ||
    prev.tipping !== next.tipping ||
    prev.playbackActive !== next.playbackActive ||
    prev.userTipped !== next.userTipped ||
    prev.surface !== next.surface ||
    prev.sekiPlay !== next.sekiPlay ||
    prev.onTip !== next.onTip ||
    prev.onOpenProfile !== next.onOpenProfile ||
    prev.onReelHypeChange !== next.onReelHypeChange ||
    prev.onHide !== next.onHide
  ) {
    return false;
  }

  const a = prev.clip;
  const b = next.clip;
  if (
    a.id !== b.id ||
    a.videoUrl !== b.videoUrl ||
    a.athleteName !== b.athleteName ||
    a.school !== b.school ||
    a.tag !== b.tag ||
    a.sekiCount !== b.sekiCount ||
    a.auraCount !== b.auraCount ||
    a.flexCount !== b.flexCount ||
    a.totalTipsCents !== b.totalTipsCents ||
    a.isVaultOnly !== b.isVaultOnly ||
    a.flashUnlockUntil !== b.flashUnlockUntil ||
    a.category !== b.category ||
    a.tagStatus !== b.tagStatus ||
    a.playerId !== b.playerId ||
    a.gameId !== b.gameId ||
    a.sekiPlay !== b.sekiPlay ||
    a.filmedBy !== b.filmedBy ||
    a.uploadedBy !== b.uploadedBy
  ) {
    return false;
  }

  const p = prev.player;
  const q = next.player;
  if (p === q) return true;
  if (!p || !q) return false;
  return (
    p.id === q.id &&
    p.name === q.name &&
    p.vault_locked === q.vault_locked &&
    p.aura_count === q.aura_count &&
    p.seki_count === q.seki_count &&
    p.flex_count === q.flex_count &&
    p.view_count === q.view_count &&
    p.backer_count === q.backer_count
  );
}

const MemoReelCard = memo(ReelCardImpl, sameReelCardProps);

/**
 * @purpose Public `ReelCard`. Keeps the parent's latest callbacks in a ref and passes the
 * memoized card identity-stable wrappers, so hype-driven feed rebuilds skip the heavy card
 * while taps still run the current closure. Optional callbacks stay `undefined` when absent
 * because the card reads their presence (`canTip`, `canOpenAthlete`).
 */
export function ReelCard(props: ReelCardProps) {
  const latest = useRef(props);
  latest.current = props;
  const hasOpenProfile = Boolean(props.onOpenProfile);
  const hasHypeChange = Boolean(props.onReelHypeChange);
  const hasHide = Boolean(props.onHide);

  const onTip = useCallback(() => latest.current.onTip(), []);
  const onOpenProfile = useMemo(
    () => (hasOpenProfile ? () => latest.current.onOpenProfile?.() : undefined),
    [hasOpenProfile],
  );
  const onReelHypeChange = useMemo(
    () =>
      hasHypeChange
        ? (reelId: string, hype: ReelHype) => latest.current.onReelHypeChange?.(reelId, hype)
        : undefined,
    [hasHypeChange],
  );
  const onHide = useMemo(
    () => (hasHide ? (reelId: string) => latest.current.onHide?.(reelId) : undefined),
    [hasHide],
  );

  return (
    <MemoReelCard
      {...props}
      onTip={onTip}
      onOpenProfile={onOpenProfile}
      onReelHypeChange={onReelHypeChange}
      onHide={onHide}
    />
  );
}
