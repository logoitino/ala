/**
 * The staged Highlight uploader: pick a clip from the camera roll (45 s max) or record one, say which athlete is in it,
 * add a caption and category, optionally mention up to three accounts, confirm rights (filmed it or has permission,
 * sound is original or licensed, no logos or broadcast footage), then upload. Publish stays disabled until a clip,
 * athlete, caption and every rights confirmation are set. Compression and Storage upload go through
 * `MediaUploadService`; the reel row is written by `lib/reels.ts`. Account mentions are pending until confirmed.
 * @sideEffects Reads `games`; uploads to Storage bucket `reels`; inserts a `reels` row; `tag_reel_accounts`.
 */

import { UploadVideoComposer, type UploadStep } from '@/components/Reels/UploadVideoComposer';
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
  REEL_CATEGORY_GAME,
  type ReelCategory,
} from '@/data/highlights';
import {
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_OPTIMIZING,
  HIGHLIGHT_TOO_LONG,
} from '@/data/media';
import { rightsReady, type RightsAckId } from '@/data/contentRights';
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

type OpenSelect = 'game' | 'player' | null;
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
  const { profile } = useAuth();
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
  const [statusLabel, setStatusLabel] = useState('Uploading Seki play…');
  const [isExclusive, setIsExclusive] = useState(false);
  const [category, setCategory] = useState<ReelCategory>(REEL_CATEGORY_GAME);
  const [rights, setRights] = useState<Partial<Record<RightsAckId, boolean>>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedGame = games.find((game) => game.id === gameId) ?? null;
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null;

  const gameLabel = selectedGame
    ? gameMatchupLabel(selectedGame.home_team, selectedGame.away_team)
    : 'No specific game (optional)';
  const playerLabel = selectedPlayer ? playerTagLabel(selectedPlayer) : 'Tag the athlete in this video';

  const canSubmit = Boolean(asset && selectedPlayer && caption.trim()) && rightsReady(rights, category) && !uploading;

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
    if (!visible) {
      setStep('clip');
      submitLock.current = false;
      setAsset(null);
      setCaption('');
      setGameId('');
      setPlayerId('');
      setAccountTags([]);
      setProgress(0);
      setUploading(false);
      setOpenSelect(null);
      setPickSource(null);
      setLoadError(null);
      setUploadError(null);
      setStatusLabel('Uploading Seki play…');
      setLibraryOpen(false);
      setIsExclusive(false);
      setCategory(REEL_CATEGORY_GAME);
      setRights({});
      setShowSuccess(false);
      successAnim.setValue(0);
      return;
    }

    let active = true;
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
  }, [visible]);

  // Mālo follows the tag, so never guess it: an athlete posting their own clip starts tagged as
  // themself; everyone else must pick who is in the video. (This used to preselect a demo athlete,
  // which quietly credited the wrong kid when a fan didn't open the picker.)
  const ownPlayerId = profile?.player_id ?? null;
  useEffect(() => {
    if (!visible || !ownPlayerId || !players.some((player) => player.id === ownPlayerId)) return;
    setPlayerId((current) => current || ownPlayerId);
  }, [visible, players, ownPlayerId]);

  const applyPickedAsset = (source: PickSource, next: ImagePicker.ImagePickerAsset) => {
    if (isHighlightTooLong(next.duration)) {
      Alert.alert('Clip too long', HIGHLIGHT_TOO_LONG);
      return;
    }
    setAsset({
      uri: next.uri,
      mimeType: next.mimeType,
      fileName: next.fileName,
      durationMs: assetDurationMs(next.duration),
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

  const submit = async () => {
    if (!asset || !canSubmit || submitLock.current) return;
    submitLock.current = true;
    setUploading(true);
    setUploadError(null);
    setStatusLabel(asset.compressed ? 'Uploading to Tapua\'i…' : HIGHLIGHT_OPTIMIZING);
    setProgress(0.04);
    try {
      const reel = await uploadSekiPlay({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        title: caption,
        playerId,
        gameId,
        isExclusive,
        category,
        compressed: asset.compressed,
        onProgress: setProgress,
        onStatus: setStatusLabel,
      });
      let mentionsFailed = false;
      if (reel.id && accountTags.length > 0) {
        try {
          await attachAccountTags(reel.id, accountTags.map((row) => row.id));
        } catch {
          // The clip already exists: a mention failure must not invite a duplicate upload.
          mentionsFailed = true;
        }
      }
      setProgress(1);
      setStatusLabel('Seki play uploaded.');
      fireSuccess();
      telemetry.trackFeature('upload', 'home');
      onUploaded(reel);
      setShowSuccess(true);
      successAnim.setValue(0);
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
      await new Promise((resolve) => setTimeout(resolve, 650));
      onClose();
      if (mentionsFailed) {
        Alert.alert('Highlight published', 'Your clip is published, but we could not save the account mentions.');
      }
    } catch (caught) {
      setProgress(0);
      const message =
        caught instanceof Error ? caught.message : 'Could not upload that clip. Try picking it again.';
      setUploadError(message);
      setStatusLabel('Upload failed');
      telemetry.trackIssue('upload', 'home');
      Alert.alert('Upload failed', message);
    } finally {
      submitLock.current = false;
      setUploading(false);
      setShowSuccess(false);
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal testID="upload-modal" visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => {
        if (uploading || submitLock.current) return;
        if (libraryOpen) setLibraryOpen(false);
        else if (openSelect) setOpenSelect(null);
        else if (step === 'clip') onClose();
        else setStep(step === 'details' ? 'clip' : step === 'options' ? 'review' : 'details');
      }}>
      <UploadVideoComposer
        step={step} onStep={setStep} asset={asset} pickSource={pickSource}
        onPick={(source) => void pickVideo(source)} simulator={IOS_SIMULATOR}
        games={games} players={sortedPlayers} gameId={gameId} playerId={playerId}
        gameLabel={gameLabel} playerLabel={playerLabel} onGame={setGameId} onPlayer={setPlayerId}
        openSelect={openSelect} onSelect={setOpenSelect}
        caption={caption} onCaption={setCaption} category={category} onCategory={setCategory}
        categoryPills={categoryPills} accountTags={accountTags} onAccountTags={setAccountTags}
        isExclusive={isExclusive} onExclusive={setIsExclusive} exclusiveDollars={exclusiveDollars}
        rights={rights} onRights={setRights} uploading={uploading} canSubmit={canSubmit}
        detailsReady={Boolean(selectedPlayer && caption.trim())}
        uploadError={uploadError} loadError={loadError} onClose={onClose} onSubmit={() => void submit()}
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
