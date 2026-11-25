/**
 * One full-screen Highlights clip: video player, hype rail (Seki / Aura / Flex), donate button, save, report,
 * owner peek, "Filmed by" credit and the live play banner. Media fills the page behind the dock;
 * the measured bottom inset moves only caption/reaction chrome.
 * `ReelCard` is a thin wrapper that passes identity-stable callbacks to the memoised `ReelCardImpl`; keep that
 * split or a stale handler can run (see STATE.md, 2026-09-29 pre-merge fixes). View counting needs 3 s of real
 * playback (`useReelViewTracker`). The Rally meter is not here; Home (app/(tabs)/index.tsx) places it.
 * Photo stories (`isPhotoStory(clip)`) render `PhotoStoryMedia` instead of `ReelVideoLayer`, so no video player
 * is created for them; their view counts after 3 s on screen with a photo loaded (VIEW_PLAY_MS). Everything else
 * is shared.
 * The editor is bound to the visible clip and its exact uploader, separate from athlete Vault permissions.
 * @sideEffects Votes, saves, reports, caption edits and view counts via hooks / lib; haptics.
 */

import { fetchReelAccountTags } from '@/lib/accountTags';
import { createOfflineActorClient, isOfflineActorChanged } from '@/lib/offlineActor';
import { useIsFocused } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Share, Text, View, type ViewInstance } from 'react-native';
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
  withTiming,
} from 'react-native-reanimated';

import { ReelActionOverlay } from '@/components/Reels/ReelActionOverlay';
import { PhotoStoryMedia } from '@/components/Reels/PhotoStoryMedia';
import { PlayBroadcastBanner } from '@/components/Reels/PlayBroadcastBanner';
import { ReelVideoLayer } from '@/components/Reels/ReelVideoLayer';
import { WelcomeHighlightsArt } from '@/components/Onboarding/WelcomeHighlightsStage';
import { FilmerSheet } from '@/components/Filmers/FilmerSheet';
import { ReelMoreSheet } from '@/components/Reels/ReelMoreSheet';
import { PostDescriptionEditor } from '@/components/Reels/PostDescriptionEditor';
import { ReportContentModal } from '@/components/Reels/ReportContentModal';
import type { ReportReasonId } from '@/data/contentRights';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { HypeBurst } from '@/components/Effects/HypeBurst';
import { useReelViewTracker } from '@/hooks/useReelViewTracker';
import { VIEW_PLAY_MS, viewThresholdMs } from '@/lib/leaderboards';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useSoftWall } from '@/context/SoftWallContext';
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
} from '@/data/players';
import {
  doubleTapAuraForCategory,
  isPhotoStory,
  reelCategoryBadge,
  REEL_CATEGORY_SERVE,
  type StoryPhoto,
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
import { beginExclusiveUnlock } from '@/lib/exclusiveCheckout';
import { addUserAura, auraBadgeLabel, auraTierForPoints, emitPlayerAura, emitProfileAura, resolveAuraPoints } from '@/lib/aura';
import { hypeFromPlayer } from '@/lib/hype';
import { formatGameEventHeadline } from '@/lib/operator';
import { CoachLevelBadge } from '@/components/Reels/CoachLevelBadge';
import { bumpReelHype, clearReelHype, formatReelDeepLink, hideReelLocally, hypeFromReel, isReelUuid, reportReelRemote, type ReelHype } from '@/lib/reels';
import { clearReelVote, loadReelVotes, markReelVote, type ReelVoteMap } from '@/lib/reelVotes';
import { isVaultSealed } from '@/lib/vault';
import { saveReelDescription } from '@/lib/postCaptions';
import { telemetry } from '@/services/TelemetryManager';
import { offlineQueue } from '@/services/OfflineQueue';
import { FOCAL } from '@/theme/motion';
import { styles } from '@/components/Reels/ReelCardStyles';
import {
  countFor,
  LIVE_BANNER_RESERVE,
  popSize,
  sameReelCardProps,
  type HypePop,
  type ReelCardProps,
} from '@/components/Reels/reelCardModel';

// Props and the memo comparison live in reelCardModel.ts (R4-03); keep exporting the type from here.
export type { ReelCardProps } from '@/components/Reels/reelCardModel';

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
  overlayInsetBottom = 8,
  tipping,
  sekiPlay: _sekiPlay = false,
  playbackActive,
  welcomePoster = false,
  onTip,
  userTipped = false,
  onOpenProfile,
  onReelHypeChange,
  onHide,
  whyThisClip = null,
  surface = 'home',
}: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const { live } = useAppRuntime();
  const { user, profile, isAthlete, isSessionCurrent } = useAuth();
  const { requireAuth } = useSoftWall();
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
  const userId = user?.id;
  const profileId = profile?.id;
  const canEditDescription = Boolean(isFocused && userId && profileId && profileId === clip.uploadedBy
    && profile?.user_id === userId && !profile.age_blocked_at && isSessionCurrent?.()
    && typeof clip.editCaptionSource === 'string' && isReelUuid(clip.id));
  const editScope = useMemo(() => canEditDescription && userId && profileId && isSessionCurrent
    ? { reelId: clip.id, userId, profileId, isSessionCurrent } : null,
  [canEditDescription, clip.id, isSessionCurrent, profileId, userId]);
  const editScopeRef = useRef(editScope);
  editScopeRef.current = editScope;
  const editAlive = useRef(true);
  useEffect(() => { editAlive.current = true; return () => { editAlive.current = false; }; }, []);
  const [descriptionEdit, setDescriptionEdit] = useState<{ scope: NonNullable<typeof editScope>; previous: string } | null>(null);
  const [confirmedDescription, setConfirmedDescription] = useState<{
    scope: NonNullable<typeof editScope>; original: string; caption: string;
  } | null>(null);
  const editedCaption = confirmedDescription && confirmedDescription.scope === editScope
    && (clip.editCaptionSource === confirmedDescription.original || clip.editCaptionSource === confirmedDescription.caption)
    ? confirmedDescription.caption : null;
  const editingDescription = descriptionEdit && descriptionEdit.scope === editScope ? descriptionEdit : null;
  const [filmerOpen, setFilmerOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [votes, setVotes] = useState<ReelVoteMap>({ seki: false, aura: false, flex: false });
  // True only while the video is really playing on screen; the view counter adds up this time.
  const [playing, setPlaying] = useState(false);
  const [welcomePlayedClip, setWelcomePlayedClip] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [videoFailure, setVideoFailure] = useState<{ clipId: string; retry: () => void } | null>(null);
  const photoStory = isPhotoStory(clip);
  // Keyed by clip so a recycled card never shows the previous story's description.
  const [storyNoteFor, setStoryNoteFor] = useState<{ clipId: string; note: string | null }>({ clipId: '', note: null });
  const storyNote = photoStory && storyNoteFor.clipId === clip.id ? storyNoteFor.note : null;
  // Id of the story whose photo (or cover) actually rendered; a story that never loads is not a view.
  const [storyLoadedId, setStoryLoadedId] = useState('');
  const storyLoaded = photoStory && storyLoadedId === clip.id;
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
  const lockedRef = useRef(locked);
  const reelHypeRef = useRef(reelHype);
  const votesRef = useRef(votes);
  const blurTarget = useRef<ViewInstance>(null);
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

  lockedRef.current = locked;
  reelHypeRef.current = reelHype;
  votesRef.current = votes;

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
      const actor = offlineQueue.captureActor(user?.id ?? null);
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
          if (!actor || !isReelUuid(clip.id)) return;
          if (await offlineQueue.dropPendingHype(clip.id, kind, actor)) return;
          if (!actor.isCurrent() || hypeGenRef.current[kind] !== token || votesRef.current[kind]) return;
          if (!(await offlineQueue.isOnline())) {
            await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind }, actor);
            return;
          }
          try {
            const client = await createOfflineActorClient(actor);
            const server = await clearReelHype(clip.id, kind, previous, client);
            if (!actor.isCurrent()) return;
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
            await offlineQueue.enqueue({ type: 'hype_clear', reelId: clip.id, kind }, actor);
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
      const actor = offlineQueue.captureActor(user?.id ?? null);
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
          // Guest/seeded reactions remain local and never become a later account's mutation.
          if (!actor || !isReelUuid(clip.id)) return;
          if (!(await offlineQueue.isOnline())) {
            await offlineQueue.enqueue(payload, actor);
            return;
          }
          try {
            const client = await createOfflineActorClient(actor);
            const server = await bumpReelHype(clip.id, kind, previous, client);
            if (!actor.isCurrent()) return;
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
              const award = await addUserAura(user.id, auraPoints, client);
              if (!actor.isCurrent()) return;
              if (award.profile_aura_points != null) emitProfileAura(user.id, award.profile_aura_points);
              if (award.player_aura_points != null) emitPlayerAura(user.id, award.player_aura_points);
              if (award.profile_aura_points == null && award.player_aura_points == null && award.aura_points) {
                emitProfileAura(user.id, award.aura_points);
              }
            }
          } catch {
            await offlineQueue.enqueue(payload, actor);
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
    const actor = offlineQueue.captureActor(user?.id ?? null);
    setReporting(true);
    try {
      if (reason !== 'coach_level') {
        await hideReelLocally(clip.id);
        onHide?.(clip.id);
        const { rememberFeedHideAthlete } = await import('@/lib/feedPrefs');
        await rememberFeedHideAthlete(clip.playerId ?? player?.id);
      }
      telemetry.trackIssue('report', surface);
      celebration?.showToast(reason === 'coach_level' ? 'Sent to reviewers. This Highlight stays up.' : 'Highlight hidden 🚩');
      setReportOpen(false);
      if (actor && isReelUuid(clip.id)) {
        await offlineQueue.runOrEnqueue({ type: 'report_reel', reelId: clip.id, reason }, async () => {
          const client = await createOfflineActorClient(actor);
          await reportReelRemote(clip.id, reason, client);
        }, actor);
      }
    } catch (error) {
      if (!isOfflineActorChanged(error)) throw error;
    } finally {
      setReporting(false);
    }
  }, [celebration, clip.id, clip.playerId, onHide, player?.id, reporting, surface, user?.id]);

  const unlockVault = useCallback(() => {
    if (unlocking) return;
    telemetry.trackFeature('vault_unlock', surface);
    if (!player) {
      onOpenProfile?.();
      return;
    }
    // Soft-Wall + platform rail: production iOS/Android block Stripe Exclusive; web/test keep PaymentSheet.
    beginExclusiveUnlock({
      player,
      tipAmount: live.catalog.exclusiveDollars,
      auraPoints: live.catalog.exclusiveAura,
      requireAuth,
      startCheckout,
      onPaid: grant,
    });
  }, [grant, live.catalog.exclusiveAura, live.catalog.exclusiveDollars, onOpenProfile, player, requireAuth, startCheckout, surface, unlocking]);

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

    // Photo stories have no sound to mute; a single tap must not flash the mute badge.
    return photoStory ? doubleTap : Gesture.Exclusive(doubleTap, singleTap);
  }, [onDoubleAura, photoStory, toggleMute]);

  const onPlaybackChange = useCallback((isPlaying: boolean, duration: number | null) => {
    setPlaying(isPlaying);
    setDurationSec(duration);
    if (isPlaying && welcomePoster) setWelcomePlayedClip(clip.id);
  }, [clip.id, welcomePoster]);

  const onLoopEnd = useCallback(() => {
    setLoopFlash(true);
    setTimeout(() => setLoopFlash(false), 1400);
  }, []);

  const onPlaybackFailure = useCallback((failedClip: string, retry: (() => void) | null) => {
    setVideoFailure(retry ? { clipId: failedClip, retry } : null);
  }, []);

  const onStoryReady = useCallback(() => setStoryLoadedId(clip.id), [clip.id]);

  const onStoryPhoto = useCallback(
    (photo: StoryPhoto | null) => setStoryNoteFor({ clipId: clip.id, note: photo?.description?.trim() || null }),
    [clip.id],
  );

  // A photo story "plays" while it is the visible, unlocked card with a photo actually on screen:
  // 3 s is a view (design decision 4). A failed or still-loading story never counts.
  useReelViewTracker(
    clip.id,
    Boolean(user?.id),
    photoStory ? storyLoaded && isFocused && !locked : playing && isFocused && !locked,
    photoStory ? VIEW_PLAY_MS : viewThresholdMs(playing ? durationSec : null),
    {
      athleteId: clip.playerId ?? player?.id,
      school: schoolName || clip.school,
      sport: clip.sport,
    },
  );

  return (
    <View style={[styles.page, { height }]}>
      <BlurTargetView ref={blurTarget} style={styles.video}>
        {photoStory ? (
          // The pager itself takes the touches (horizontal swipes), so the double-tap wraps it
          // instead of sitting on a hit layer above it.
          <GestureDetector gesture={videoTaps}>
            <View style={styles.videoFill}>
              <PhotoStoryMedia
                clip={clip}
                active={isFocused && !editingDescription}
                // Home passes its header height; the profile pager passes 0, so clear the notch there.
                topInset={Math.max(overlayInsetTop, insets.top + 8)}
                onPhotoChange={onStoryPhoto}
                onContentReady={onStoryReady}
              />
            </View>
          </GestureDetector>
        ) : (
          <ReelVideoLayer
            clipId={clip.id}
            videoUrl={clip.videoUrl}
            active={active}
            focused={isFocused && !editingDescription}
            locked={locked}
            muted={muted}
            onPlaybackChange={onPlaybackChange}
            onPlaybackFailure={onPlaybackFailure}
            onLoopEnd={onLoopEnd}
          />
        )}
        {welcomePoster && !photoStory && !locked && welcomePlayedClip !== clip.id ? <WelcomeHighlightsArt /> : null}
      </BlurTargetView>

      {photoStory ? null : (
        <GestureDetector gesture={videoTaps}>
          <View style={styles.hitLayer} />
        </GestureDetector>
      )}

      <View pointerEvents="none" style={styles.scrim} />
      {!photoStory && isFocused && !locked && videoFailure?.clipId === clip.id ? (
        // Above the full-screen mute gesture: a failed source must have a reachable recovery action.
        <View style={styles.playbackFailure} accessibilityLiveRegion="polite">
          <Text style={styles.playbackFailureText}>This Highlight couldn't play.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry this Highlight" onPress={videoFailure.retry} style={styles.playbackRetry}>
            <Text style={styles.playbackRetryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
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
                {unlocking ? 'Opening checkout…' : vaultUnlockLabel(live.catalog.exclusiveDollars)}
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

      {/* Badges sit below the parent's real chrome (Home banners + pill row), never under it. */}
      <View pointerEvents="box-none" style={[styles.meta, { paddingTop: Math.max(insets.top + LIVE_BANNER_RESERVE, overlayInsetTop) }]}>
        <View style={styles.focalLeft}>
          {flashChip ? (
            <View accessibilityRole="text" accessibilityLabel={flashChip} style={styles.flashChip}>
              <Text style={styles.flashChipLabel} numberOfLines={1}>
                {flashChip}
              </Text>
            </View>
          ) : null}
          {clip.coachLevel ? <CoachLevelBadge /> : null}
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

      <View pointerEvents="box-none" style={[styles.actionsLayer, { top: overlayInsetTop, bottom: overlayInsetBottom }]}>
        <ReelActionOverlay
          athleteName={playerName}
          sport={clip.sport}
          tagState={clip.tagStatus === 'pending' ? 'pending' : clip.playerId && clip.tagStatus !== 'rejected' ? 'approved' : undefined}
          schoolName={schoolName}
          jerseyNumber={player?.jersey_number}
          position={player?.position}
          caption={editedCaption ?? clip.tag}
          storyNote={storyNote}
          whyThisClip={whyThisClip}
          withAccounts={withAccounts}
          filmedBy={clip.filmedBy}
          onOpenFilmer={clip.filmedBy && clip.uploadedBy ? () => setFilmerOpen(true) : undefined}
          auraColor={auraTier.color}
          auraGlow={auraTier.glow}
          auraLabel={auraBadgeLabel(auraTier)}
          hype={reelHype}
          sekiPlay={clip.sekiPlay}
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
          void (async () => {
            const next = !saved;
            await toggleSave();
            if (next && user?.id) {
              const { rememberFeedSaveTouch } = await import('@/lib/feedPrefs');
              await rememberFeedSaveTouch({
                clipId: clip.id,
                athleteId: clip.playerId ?? player?.id,
                school: schoolName || clip.school,
                sport: clip.sport,
                atMs: Date.now(),
              });
            }
          })();
        }}
        onReport={() => {
          setMoreOpen(false);
          setReportOpen(true);
        }}
        onEditDescription={editScope && typeof clip.editCaptionSource === 'string' ? () => {
          if (!editAlive.current || editScopeRef.current !== editScope || !editScope.isSessionCurrent()) return;
          setMoreOpen(false);
          setDescriptionEdit({ scope: editScope, previous: editedCaption ?? clip.editCaptionSource! });
        } : undefined}
        onSuggest={
          live.buttons.suggest
            ? () => {
                setMoreOpen(false);
                setSuggestOpen(true);
              }
            : undefined
        }
      />
      {editingDescription ? <PostDescriptionEditor initialCaption={editingDescription.previous} maxLength={120}
        onClose={() => setDescriptionEdit(null)}
        onSave={async (value) => {
          const { scope, previous } = editingDescription;
          const isCurrent = () => editAlive.current && editScopeRef.current === scope && scope.isSessionCurrent();
          const caption = await saveReelDescription({ userId: scope.userId, profileId: scope.profileId, isCurrent }, scope.reelId, previous, value);
          if (isCurrent()) setConfirmedDescription({ scope, original: clip.editCaptionSource!, caption });
        }} /> : null}
      <SuggestionSheet visible={suggestOpen} surface="home" onClose={() => setSuggestOpen(false)} />
      <ReportContentModal
        visible={reportOpen}
        athleteName={playerName}
        submitting={reporting}
        showCoachReason={live.layouts.coachLevel !== false}
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
