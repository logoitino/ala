/**
 * The staged Highlight uploader: pick a clip from the camera roll (45 s max) or record one — or, when the database
 * supports photo stories, pick up to 10 photos and order them (PHOTO_STORIES_DESIGN.md) — add a caption and category,
 * optionally tag an athlete (or tap This is me), optionally mention up to three accounts, confirm the one permission
 * line, then upload. A video can publish with Tag later; Donate stays off until an athlete is tagged. Photo stories
 * still need an athlete. The sheet does not play the clip, so choosing an athlete cannot cover the phone.
 * Video and photo drafts are kept separately, so switching Video ↔ Photos never discards either; switching clears the
 * rights confirmations because they belong to the media. Videos publish through `lib/reels.ts`; photo stories through
 * `lib/photoStories.ts` (nothing is published unless every photo uploads). Both formats may carry an optional recorded
 * sport; only exact self athlete selection defaults primary. After a failed story attempt the hidden reel id
 * is kept until its files and row are retired before retry; Close persists removal intent before dismissing. Lost publication replies recover the stored
 * story without replacing it or attaching new mentions. Account mentions are pending until confirmed.
 * Picker durations become milliseconds at the boundary and stay attached through publication.
 * @sideEffects Reads `games`; device photo library; uploads to Storage bucket `reels`; inserts a `reels` row;
 *   `set_reel_photos`; `tag_reel_accounts`; owner failed-story cleanup RPCs, Storage list/remove and local owner/story cleanup keys.
 */

import { UploadVideoComposer, type UploadStep } from '@/components/Reels/UploadVideoComposer';
import { sportForChosenAthlete, type UploadSportDraft } from '@/components/Reels/uploadSport';
import { useStoredSportChoices } from '@/hooks/useStoredSportChoices';
import type { DraftStoryPhoto } from '@/components/Reels/PhotoStoryPicker';
import { createPhotoStory, movePhoto, photoStoriesAvailable, PhotoStoryPublishError, PhotoStoryAlreadyPublishedError } from '@/lib/photoStories';
import { cleanupFailedPhotoStory, rememberPhotoStoryCleanup, queuedPhotoStoryCleanups } from '@/lib/photoStoryCleanup';
import { attachAccountTags, type AccountTagHit } from '@/lib/accountTags';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal } from 'react-native';
import { Platform } from 'react-native';
import { HighlightPickerModal } from '@/components/Reels/HighlightPickerModal';
import Constants from 'expo-constants';

import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import {
  labeledReelCategories,
  PHOTO_STORY_MAX_PHOTOS,
  REEL_CATEGORY_GAME,
  type HighlightMediaType,
  type ReelCategory,
} from '@/data/highlights';
import {
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_LENGTH_UNREADABLE,
  HIGHLIGHT_OPTIMIZING,
  HIGHLIGHT_TOO_LONG,
} from '@/data/media';
import { PHOTO_RIGHTS_VERSION, rightsReady, type RightsAckId } from '@/data/contentRights';
import { gameMatchupLabel, playerTagLabel, uploadSekiPlay } from '@/lib/reels';
import { assetDurationMs, isHighlightTooLong } from '@/services/MediaUploadService';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { telemetry } from '@/services/TelemetryManager';
import type { Game, Player, Reel } from '@/types/database';

type UploadVideoModalProps = {
  visible: boolean;
  players: Player[];
  onClose: () => void;
  onUploaded: (reel: Reel) => void;
};

type PickedVideo = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  durationMs?: number | null;
  compressed?: boolean;
};

type OpenSelect = 'game' | 'player' | 'sport' | null;
type PickSource = 'library' | 'camera';

/**
 * @purpose Detect iOS Simulator so we never open UIImagePickerController for video.
 * Expo Go 57 aborts (`setMediaTypes:`) because the sim camera has no `public.movie` types.
 * @returns True only on iOS Simulator (Expo Go or a native sim build).
 */
function isIosSimulator(): boolean {
  if (Platform.OS !== 'ios') return false;
  const extras = Constants as { isDevice?: boolean };
  if (typeof extras.isDevice === 'boolean') return extras.isDevice === false;
  return Constants.deviceYearClass == null;
}

const IOS_SIMULATOR = isIosSimulator();

/**
 * Photo picking (design "Screens: Upload"): `exif: false` so the picker does not hand back metadata, and
 * `quality: 0.85` so the picker re-encodes to JPEG; `MediaUploadService` still strips JPEG metadata itself.
 */
function libraryPhotoOptions(remaining: number): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    orderedSelection: true,
    exif: false,
    quality: 0.85,
  };
}

const CAMERA_VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  videoMaxDuration: HIGHLIGHT_MAX_SECONDS,
  allowsEditing: true,
  quality: 1,
};

function fireSuccess() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Manage the staged Highlight draft, picker and Storage upload; composer renders each short page.
 * @param visible Controls the sheet; closing resets clip, caption, exclusive flag, category, and tags.
 * @param players Roster for the player tag picker.
 * @param onClose Dismiss (blocked while uploading).
 * @param onUploaded Pushes the new reel onto the active feed via `UploadSheetContext`.
 * @sideEffects `HighlightPickerModal` camera roll (45s) + compressor overlay; camera URI; expo-video thumbnail; `MediaUploadService` Storage `reels/{user_id}/{timestamp}.mp4` + `reels` insert with the rights confirmation; Success haptic on Publish Highlight ⚡. iOS Simulator never calls `launchCameraAsync` (native abort).
 */
export function UploadVideoModal({ visible, players, onClose, onUploaded }: UploadVideoModalProps) {
  const { live } = useAppRuntime();
  const { profile, isGuest, user, isSessionCurrent } = useAuth();
  const ownerId = user?.id ?? profile?.user_id ?? undefined;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const draftEpoch = useRef(0);
  const previousOwner = useRef(ownerId);
  const previousSessionGuard = useRef(isSessionCurrent);
  const draftIdentityCurrent = previousOwner.current === ownerId && previousSessionGuard.current === isSessionCurrent;
  const categoryPills = labeledReelCategories(live.catalog.reelCategories);
  const exclusiveDollars = live.catalog.exclusiveDollars;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.45)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const submitLock = useRef(false);
  const [step, setStep] = useState<UploadStep>('clip');
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const { sportNames, status: catalogStatus, reload: reloadSportChoices } = useStoredSportChoices(visible);
  const [sportDraft, setSportDraft] = useState<UploadSportDraft>({ value: '', explicit: false });
  const [accountTags, setAccountTags] = useState<AccountTagHit[]>([]);
  const [caption, setCaption] = useState('');
  const [asset, setAsset] = useState<PickedVideo | null>(null);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const [pickSource, setPickSource] = useState<PickSource | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sportConfirmationPending, setSportConfirmationPending] = useState(false);
  const uncertainSportReceipt = useRef<Reel | null>(null);
  const [statusLabel, setStatusLabel] = useState('Uploading Seki play…');
  const [isExclusive, setIsExclusive] = useState(false);
  const [category, setCategory] = useState<ReelCategory>(REEL_CATEGORY_GAME);
  const [coachLevel, setCoachLevel] = useState(false);
  const [rights, setRights] = useState<Partial<Record<RightsAckId, boolean>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [mediaKind, setMediaKind] = useState<HighlightMediaType>('video');
  const [photos, setPhotos] = useState<DraftStoryPhoto[]>([]);
  const [photosAvailable, setPhotosAvailable] = useState(false);
  const photoKey = useRef(0);
  // Hidden server attempt left by a failed story. Retired before retry/retarget; Close saves cleanup
  // intent before discarding the local draft. Published stories are recovered without replacing their caption or mentions.
  type PendingStory = { reelId: string; playerId: string; gameId: string; ownerId?: string };
  const pendingStory = useRef<PendingStory | null>(null);
  // Keep every unfinished operation until cleanup confirms completion, including forced hiding/reopening.
  const unfinishedStories = useRef(new Map<string, PendingStory>());
  const forgetPending = (pending: PendingStory) => {
    if (unfinishedStories.current.get(pending.reelId) === pending) unfinishedStories.current.delete(pending.reelId);
    if (pendingStory.current === pending) pendingStory.current = null;
  };
  const retirePending = async (pending: PendingStory) => {
    const result = await cleanupFailedPhotoStory(pending.reelId, pending.ownerId);
    forgetPending(pending);
    return result;
  };
  const isCurrentDraft = (epoch: number, owner: string | undefined) =>
    visibleRef.current && draftEpoch.current === epoch && ownerRef.current === owner
    && previousOwner.current === owner && previousSessionGuard.current === isSessionCurrent && (!isSessionCurrent || isSessionCurrent());
  const closeUpload = async () => {
    if (uploading || submitLock.current) return;
    const epoch = draftEpoch.current;
    const owner = ownerId;
    const pending = [...unfinishedStories.current.values()].filter((item) => item.ownerId === owner);
    if (!pending.length) { onClose(); return; }
    submitLock.current = true;
    setUploading(true);
    setStatusLabel('Saving unfinished-story removal…');
    try {
      if (!owner) throw new Error('Sign in again to save unfinished-story removal.');
      for (const item of pending) await rememberPhotoStoryCleanup(item.reelId, owner);
      if (!isCurrentDraft(epoch, owner)) return;
      onClose();
      // Network cleanup can fail offline; saved intent resumes next time this owner opens Upload.
      for (const item of pending) void retirePending(item).catch(() => telemetry.trackIssue('upload', 'home'));
    } catch {
      if (!isCurrentDraft(epoch, owner)) return;
      const message = 'Could not save unfinished-story removal on this device. Your draft is still here. Try closing again.';
      setUploadError(message);
      setStatusLabel('Removal not saved');
      telemetry.trackIssue('upload', 'home');
      Alert.alert('Could not save removal', message);
    } finally {
      if (draftEpoch.current === epoch && ownerRef.current === owner) {
        submitLock.current = false;
        setUploading(false);
      }
    }
  };
  const isPhotos = mediaKind === 'photo_story';

  const selectedGame = games.find((game) => game.id === gameId) ?? null;
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null;

  const gameLabel = selectedGame
    ? gameMatchupLabel(selectedGame.home_team, selectedGame.away_team)
    : 'No specific game (optional)';
  const playerLabel = selectedPlayer ? playerTagLabel(selectedPlayer) : isPhotos ? 'Tag the athlete in these photos' : 'Tag later';

  const mediaReady = isPhotos ? photosAvailable && photos.length > 0 : Boolean(asset);
  const athleteReady = isPhotos ? Boolean(selectedPlayer) : true;
  const sportReady = !sportDraft.value || (catalogStatus === 'ready' && sportNames.includes(sportDraft.value));
  const sportSourceNotice = catalogStatus === 'loading' ? 'Loading sport choices. Your draft stays here.' : catalogStatus === 'unavailable' ? 'Sport choices are unavailable right now. Your draft stays here. Reload sport choices or choose no sport tag.'
    : sportDraft.value && !sportReady ? 'Your selected sport is no longer available. Keep the draft or choose another sport before publishing.'
      : sportNames.length === 0 ? 'No active sport tags are available. You can publish without a sport tag.' : null;
  const canSubmit = draftIdentityCurrent && sportReady && Boolean(mediaReady && caption.trim() && athleteReady) && rightsReady(rights, category, mediaKind) && !uploading && !sportConfirmationPending;
  const choosePlayer = (id: string) => {
    setPlayerId(id);
    setSportDraft(current => sportForChosenAthlete(current, id, profile?.player_id, profile?.athlete_sport, sportNames));
    if (!id) setIsExclusive(false);
  };

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.jersey_number !== b.jersey_number) return a.jersey_number - b.jersey_number;
        return a.name.localeCompare(b.name);
      }),
    [players],
  );

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    if (!uploading) {
      pulse.stopAnimation();
      pulse.setValue(0.45);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const creep = setInterval(() => {
      setProgress((current) => (current > 0 && current < 0.78 ? Math.min(0.78, current + 0.02) : current));
    }, 240);
    return () => {
      loop.stop();
      clearInterval(creep);
    };
  }, [uploading, pulse]);

  useEffect(() => {
    draftEpoch.current += 1;
    const accountChanged = previousOwner.current !== ownerId || previousSessionGuard.current !== isSessionCurrent;
    previousOwner.current = ownerId;
    previousSessionGuard.current = isSessionCurrent;
    if (!visible || accountChanged) pendingStory.current = null;
    if (!visible || accountChanged) {
      for (const pending of unfinishedStories.current.values()) {
        if (pending.ownerId === ownerRef.current) {
          void retirePending(pending).catch(() => {
            // Durable intent and the server claim remain; opening Upload retries it.
            telemetry.trackIssue('upload', 'home');
          });
        }
      }
      setStep('clip');
      submitLock.current = false;
      setAsset(null);
      setCaption('');
      setGameId('');
      setPlayerId('');
      setSportDraft({ value: '', explicit: false });
      setAccountTags([]);
      setProgress(0);
      setUploading(false);
      setOpenSelect(null);
      setPickSource(null);
      setLoadError(null);
      setUploadError(null);
      setSportConfirmationPending(false);
      uncertainSportReceipt.current = null;
      setStatusLabel('Uploading Seki play…');
      setLibraryOpen(false);
      setIsExclusive(false);
      setCategory(REEL_CATEGORY_GAME);
      setRights({});
      setShowSuccess(false);
      successAnim.setValue(0);
      setMediaKind('video');
      setPhotos([]);
      if (!visible) return;
    }

    let active = true;
    if (ownerId) void queuedPhotoStoryCleanups(ownerId).then(async (ids) => {
      for (const reelId of ids) {
        if (!active || ownerRef.current !== ownerId) return;
        // A late queue read must not retire the visible failed attempt behind explicit Retry.
        if (pendingStory.current?.reelId === reelId && pendingStory.current.ownerId === ownerId) continue;
        const pending = unfinishedStories.current.get(reelId) ?? { reelId, ownerId, playerId: '', gameId: '' };
        unfinishedStories.current.set(reelId, pending);
        try { await retirePending(pending); }
        catch { telemetry.trackIssue('upload', 'home'); }
      }
    }).catch(() => telemetry.trackIssue('upload', 'home'));
    // Photos appear only once the photo-story SQL exists (cached per session in lib/photoStories).
    void photoStoriesAvailable().then((available) => {
      if (!active) return;
      setPhotosAvailable(available);
      if (!available) setMediaKind('video');
    });

    const loadGames = async () => {
      if (!isSupabaseConfigured) {
        if (active) setLoadError('Games are unavailable. You can share without linking a game.');
        return;
      }

      const activeQuery = await supabase.from('games').select('*').eq('is_active', true);
      let rows = (activeQuery.data as Game[] | null) ?? [];
      if (activeQuery.error || rows.length === 0) {
        const fallback = await supabase.from('games').select('*').order('home_team', { ascending: true });
        if (fallback.error) {
          if (active) setLoadError('Games could not load. You can share without linking a game.');
          return;
        }
        rows = (fallback.data as Game[] | null) ?? [];
      }
      if (!active) return;
      setGames(rows);
      setLoadError(null);

    };

    void loadGames();
    return () => {
      active = false;
    };
  }, [isSessionCurrent, visible, ownerId]);

  // Mālo follows the tag, so never guess it: an athlete posting their own clip starts tagged as
  // themself; everyone else must pick who is in the video. (This used to preselect a demo athlete,
  // which quietly credited the wrong kid when a fan didn't open the picker.)
  const ownPlayerId = profile?.player_id ?? null;
  useEffect(() => {
    if (!visible || !ownPlayerId || !players.some((player) => player.id === ownPlayerId)) return;
    setPlayerId((current) => current || ownPlayerId);
  }, [visible, players, ownPlayerId]);
  useEffect(() => {
    if (!visible || !ownPlayerId || playerId !== ownPlayerId || catalogStatus !== 'ready') return;
    // A shown default becomes part of the draft. Refreshing source choices must never silently erase its annotation.
    setSportDraft(current => current.value || current.explicit ? current : sportForChosenAthlete(current, ownPlayerId, ownPlayerId, profile?.athlete_sport, sportNames));
  }, [visible, playerId, ownPlayerId, catalogStatus, sportNames]);

  const applyPickedAsset = (source: PickSource, next: ImagePicker.ImagePickerAsset) => {
    // The platform declares the unit; a short native clip must never be mistaken for seconds.
    const durationMs = assetDurationMs(next.duration, Platform.OS === 'web' ? 'seconds' : 'milliseconds');
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      Alert.alert('Clip length unavailable', HIGHLIGHT_LENGTH_UNREADABLE);
      return;
    }
    if (isHighlightTooLong(durationMs)) {
      Alert.alert('Clip too long', HIGHLIGHT_TOO_LONG);
      return;
    }
    setAsset({
      uri: next.uri,
      mimeType: next.mimeType,
      fileName: next.fileName,
      durationMs,
      compressed: false,
    });
    setPickSource(source);
    setRights({});
    setStep('details');
    setUploadError(null);
  };

  const pickVideo = async (source: 'library' | 'camera') => {
    if (uploading) return;

    try {
      if (source === 'library') {
        setLibraryOpen(true);
        return;
      }

      if (IOS_SIMULATOR) {
        Alert.alert(
          'Record needs a phone',
          'iOS Simulator cannot record video (Expo Go crashes if we open the camera picker). Drag a clip into the Simulator Photos app, then tap Library — or open Expo Go on a device.',
        );
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera access to record a Seki play.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync(CAMERA_VIDEO_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      applyPickedAsset(source, result.assets[0]);
    } catch (caught) {
      Alert.alert(
        source === 'camera' ? 'Could not open camera' : 'Could not open library',
        caught instanceof Error ? caught.message : 'Try Expo Go on a phone to pick or record a clip.',
      );
    }
  };

  const chooseMediaKind = (kind: HighlightMediaType) => {
    if (uploading || kind === mediaKind) return;
    if (kind === 'photo_story' && !photosAvailable) return;
    // Both drafts stay; only the confirmations reset, because they were given for the other media.
    setMediaKind(kind);
    setRights({});
    setUploadError(null);
  };

  const pickPhotos = async () => {
    if (uploading) return;
    const remaining = PHOTO_STORY_MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Story is full', `A photo story holds up to ${PHOTO_STORY_MAX_PHOTOS} photos. Remove one to add another.`);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync(libraryPhotoOptions(remaining));
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets
        .filter((item) => item.type !== 'video' && item.type !== 'livePhoto' && item.uri)
        .map((item) => {
          photoKey.current += 1;
          return { key: `photo-${photoKey.current}`, uri: item.uri, width: item.width || undefined, height: item.height || undefined };
        });
      if (!picked.length) return;
      setPhotos((current) => [...current, ...picked].slice(0, PHOTO_STORY_MAX_PHOTOS));
      // New photos have not been confirmed yet; reorder and remove keep the confirmations.
      setRights({});
      setUploadError(null);
    } catch (caught) {
      Alert.alert('Could not open library', caught instanceof Error ? caught.message : 'Try again on a phone.');
    }
  };

  const submit = async () => {
    if (!canSubmit || submitLock.current || uncertainSportReceipt.current || !draftIdentityCurrent) return;
    if (isGuest) {
      setUploadError('Create an account to post a Highlight.');
      return;
    }
    if (isPhotos ? photos.length === 0 : !asset) return;
    const epoch = draftEpoch.current;
    const owner = ownerId;
    const candidate = pendingStory.current;
    const pending = candidate?.ownerId === owner ? candidate : null;
    submitLock.current = true;
    setUploading(true);
    setUploadError(null);
    setStatusLabel(isPhotos ? 'Preparing your story…' : asset?.compressed ? 'Uploading to Tapua\'i…' : HIGHLIGHT_OPTIMIZING);
    setProgress(0.04);
    try {
      if (!isCurrentDraft(epoch, owner)) return;
      if (!isPhotos && pending) {
        const result = await retirePending(pending);
        if (!isCurrentDraft(epoch, owner)) return;
        if (result === 'published') {
          setUploadError('Your earlier photo story was already shared. Your video draft is still here; review it before sharing.');
          return;
        }
      }
      const reuse = pending?.reelId ?? null;
      const reel = isPhotos ? await createPhotoStory({
        existingReelId: reuse,
        photos: photos.map(({ uri, width, height, description }) => ({ uri, width, height, description })),
        title: caption,
        playerId,
        gameId: gameId || null,
        category,
        rightsVersion: PHOTO_RIGHTS_VERSION,
        sport: sportDraft.value || null,
        expectedUserId: owner,
        isSessionCurrent,
        onProgress: (done, total) => {
          if (!isCurrentDraft(epoch, owner)) return;
          setProgress(0.08 + 0.84 * (done / total));
          setStatusLabel(done < total ? `Uploading photo ${done + 1} of ${total}` : 'Saving your story…');
        },
      }) : await uploadSekiPlay({
        uri: asset!.uri,
        mimeType: asset!.mimeType,
        fileName: asset!.fileName,
        durationMs: asset!.durationMs,
        title: caption,
        playerId,
        gameId,
        isExclusive,
        category,
        coachLevel,
        sport: sportDraft.value || null,
        expectedUserId: owner,
        isSessionCurrent,
        compressed: asset!.compressed,
        onProgress: (value) => { if (isCurrentDraft(epoch, owner)) setProgress(value); },
        onStatus: (label) => { if (isCurrentDraft(epoch, owner)) setStatusLabel(label); },
      });
      if (pending) forgetPending(pending);
      if (!isCurrentDraft(epoch, owner)) return;
      let mentionsFailed = false;
      if (reel.id && accountTags.length > 0) {
        try {
          await attachAccountTags(reel.id, accountTags.map((row) => row.id));
        } catch {
          // The clip already exists: a mention failure must not invite a duplicate upload.
          mentionsFailed = true;
        }
      }
      if (!isCurrentDraft(epoch, owner)) return;
      setProgress(1);
      setStatusLabel(isPhotos ? 'Photo story published.' : 'Seki play uploaded.');
      fireSuccess();
      telemetry.trackFeature('upload', 'home');
      // The sheet does not play the clip. This pause lets the success line show, then the feed updates after close.
      setShowSuccess(true);
      successAnim.setValue(0);
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (!isCurrentDraft(epoch, owner)) return;
      onClose();
      onUploaded(reel);
      if (mentionsFailed) {
        Alert.alert('Highlight published', isPhotos
          ? 'Your photo story is published, but we could not save the account mentions.'
          : 'Your clip is published, but we could not save the account mentions.');
      }
    } catch (caught) {
      if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'HIGHLIGHT_SPORT_CONFIRMATION' && 'reel' in caught) {
        if (!isCurrentDraft(epoch, owner)) return;
        uncertainSportReceipt.current = caught.reel as Reel;
        setSportConfirmationPending(true); setProgress(0);
        setUploadError('Highlight saved, but its sport could not be confirmed. Check your posted Highlights before another upload. Your draft is still here.');
        setStatusLabel('Recorded sport needs confirmation');
        telemetry.trackIssue('highlight_sport_confirmation_failed', 'home');
        return;
      }
      if (caught instanceof PhotoStoryPublishError) {
        if (pending && pending.reelId !== caught.reelId) forgetPending(pending);
        const residue = { reelId: caught.reelId, playerId, gameId, ownerId: owner };
        unfinishedStories.current.set(residue.reelId, residue);
        if (isCurrentDraft(epoch, owner)) pendingStory.current = residue;
        if (owner) {
          try { await rememberPhotoStoryCleanup(residue.reelId, owner); }
          catch { telemetry.trackIssue('upload', 'home'); } // In-memory intent remains; Close retries persistence.
        }
        if (!isCurrentDraft(epoch, owner)) void retirePending(residue).catch(() => telemetry.trackIssue('upload', 'home'));
      }
      if (!isCurrentDraft(epoch, owner)) return;
      setProgress(0);
      if (caught instanceof PhotoStoryAlreadyPublishedError) {
        if (pending) forgetPending(pending);
        // Recover only committed fields; edited caption/mentions stay in this unsubmitted draft.
        onUploaded(caught.reel);
        setUploadError(caught.message);
        setStatusLabel('Earlier story already shared');
        Alert.alert('Story already shared', caught.message);
        return;
      }
      // Local photos, caption, tags and confirmations stay intact while retirement is retried.
      const message =
        caught instanceof Error ? caught.message : isPhotos ? 'Could not share those photos. Try again.' : 'Could not upload that clip. Try picking it again.';
      setUploadError(message);
      setStatusLabel('Upload failed');
      telemetry.trackIssue('upload', 'home');
      Alert.alert('Upload failed', message);
    } finally {
      if (draftEpoch.current !== epoch || ownerRef.current !== owner) return;
      submitLock.current = false;
      setUploading(false);
      setShowSuccess(false);
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!draftIdentityCurrent) return null;
  return (
    <Modal testID="upload-modal" visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => {
        if (uploading || submitLock.current) return;
        if (libraryOpen) setLibraryOpen(false);
        else if (openSelect) setOpenSelect(null);
        else if (step === 'clip') void closeUpload();
        else setStep(step === 'details' ? 'clip' : step === 'options' ? 'review' : 'details');
      }}>
      <UploadVideoComposer
        step={step} onStep={setStep} asset={asset} pickSource={pickSource}
        onPick={(source) => void pickVideo(source)} simulator={IOS_SIMULATOR}
        games={games} players={sortedPlayers} gameId={gameId} playerId={playerId} ownPlayerId={profile?.player_id ?? null}
        gameLabel={gameLabel} playerLabel={playerLabel} onGame={setGameId} onPlayer={choosePlayer}
        openSelect={openSelect} onSelect={setOpenSelect}
        sport={sportDraft.value} sportNames={sportNames} sportSourceNotice={sportSourceNotice} onReloadSports={reloadSportChoices} sportChoicesLoading={catalogStatus === 'loading'} onSport={value => setSportDraft({ value, explicit: true })}
        caption={caption} onCaption={setCaption} category={category} onCategory={setCategory}
        showCoachSwitch={live.layouts.coachLevel !== false} coachLevel={coachLevel} onCoachLevel={setCoachLevel}
        categoryPills={categoryPills} accountTags={accountTags} onAccountTags={setAccountTags}
        isExclusive={isExclusive} onExclusive={setIsExclusive} exclusiveDollars={exclusiveDollars}
        rights={rights} onRights={setRights} uploading={uploading} canSubmit={canSubmit}
        detailsReady={Boolean(caption.trim()) && athleteReady}
        mediaKind={mediaKind} onMediaKind={chooseMediaKind} photosAvailable={photosAvailable}
        photos={photos} onPickPhotos={() => void pickPhotos()}
        onMovePhoto={(from, to) => setPhotos((current) => movePhoto(current, from, to))}
        onRemovePhoto={(index) => setPhotos((current) => current.filter((_, at) => at !== index))}
        onPhotoDescription={(index, text) => setPhotos((current) => current.map((photo, at) => (at === index ? { ...photo, description: text } : photo)))}
        uploadError={uploadError} loadError={loadError} onClose={() => void closeUpload()} onSubmit={() => void submit()}
        progress={progress} barWidth={barWidth} pulse={pulse} statusLabel={statusLabel}
        showSuccess={showSuccess} successAnim={successAnim}
      />
      <HighlightPickerModal visible={libraryOpen} onClose={() => setLibraryOpen(false)}
        onPicked={(clip) => {
          setAsset(clip); setPickSource('library'); setUploadError(null);
          setRights({}); setLibraryOpen(false); setStep('details');
        }} />
    </Modal>
  );
}
