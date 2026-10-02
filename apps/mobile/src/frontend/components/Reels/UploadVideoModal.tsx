/**
 * The "post a highlight" sheet: pick a clip from the camera roll (45 s max) or record one, say which athlete is in it,
 * add a caption and category, confirm rights (filmed it or has permission, sound is original or licensed, no logos
 * or broadcast footage), then upload. Publish stays disabled until a clip, athlete, caption and every rights
 * confirmation are set. Compression and Storage upload go through `MediaUploadService`; the reel row is written
 * by `lib/reels.ts`.
 * @sideEffects Reads `games`; uploads to Storage bucket `reels`; inserts a `reels` row.
 */

import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { CardShine } from '@/components/Effects/CardShine';
import { HighlightPickerModal } from '@/components/Reels/HighlightPickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Constants from 'expo-constants';

import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import {
  HIGHLIGHT_PUBLISH_LABEL,
  labeledReelCategories,
  REEL_CATEGORY_GAME,
  REEL_CATEGORY_SERVE,
  SERVE_LIKE_ME_BOOST_LABEL,
  type ReelCategory,
} from '@/data/highlights';
import {
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_OPTIMIZING,
  HIGHLIGHT_TOO_LONG,
} from '@/data/media';
import { rightsChecksFor, rightsReady, type RightsAckId } from '@/data/contentRights';
import { COMPLIANCE_UPLOAD } from '@/data/legal';
import { displayValue } from '@/data/players';
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

const NEON_JADE = '#00E676';

function formatDuration(durationMs?: number | null): string {
  if (!durationMs || durationMs <= 0) return '';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function fireSuccess() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Paused first-frame preview of the picked clip URI (expo-video, no cache flag).
 * @param uri Local ImagePicker video URI.
 * @returns Cover-fit `VideoView` paused at 0.
 * @sideEffects `useVideoPlayer` loads the local file; paused + muted so it is a thumbnail, not playback.
 */
function ClipPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  useEffect(() => {
    void player.replaceAsync(uri).then(() => {
      player.currentTime = 0;
      player.pause();
    });
  }, [player, uri]);

  return (
    <VideoView player={player} nativeControls={false} contentFit="cover" style={styles.thumb} />
  );
}

/**
 * @purpose Full-screen Seki clip uploader (library/camera → `game_highlights`).
 * @param visible Controls the sheet; closing resets clip, caption, exclusive flag, category, and tags.
 * @param players Roster for the player tag picker.
 * @param onClose Dismiss (blocked while uploading).
 * @param onUploaded Pushes the new reel onto the active feed via `UploadSheetContext`.
 * @sideEffects `HighlightPickerModal` camera roll (45s) + compressor overlay; camera URI; expo-video thumbnail; `MediaUploadService` Storage `reels/{user_id}/{timestamp}.mp4` + `reels` insert with the rights confirmation; Success haptic on Publish Highlight ⚡. iOS Simulator never calls `launchCameraAsync` (native abort).
 */
export function UploadVideoModal({ visible, players, onClose, onUploaded }: UploadVideoModalProps) {
  const insets = useSafeAreaInsets();
  const { live } = useAppRuntime();
  const { profile } = useAuth();
  const categoryPills = labeledReelCategories(live.catalog.reelCategories);
  const exclusiveDollars = live.catalog.exclusiveDollars;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.45)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
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

  const canSubmit = Boolean(asset && playerId && caption.trim()) && rightsReady(rights, category) && !uploading;

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
      setAsset(null);
      setCaption('');
      setGameId('');
      setPlayerId('');
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
        if (active) setLoadError('Add EXPO_PUBLIC Supabase keys to .env.local, then restart Expo.');
        return;
      }

      const activeQuery = await supabase.from('games').select('*').eq('is_active', true);
      let rows = (activeQuery.data as Game[] | null) ?? [];
      if (activeQuery.error || rows.length === 0) {
        const fallback = await supabase.from('games').select('*').order('home_team', { ascending: true });
        if (fallback.error) {
          if (active) setLoadError(fallback.error.message);
          return;
        }
        rows = (fallback.data as Game[] | null) ?? [];
      }
      if (!active) return;
      setGames(rows);
      setLoadError(null);

      const westlake = rows.find(
        (game) =>
          game.home_team.toLowerCase().includes('westlake') &&
          game.away_team.toLowerCase().includes('lone peak'),
      );
      setGameId((current) => current || westlake?.id || rows[0]?.id || '');
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
    if (!asset || !canSubmit) return;
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
    } catch (caught) {
      setProgress(0);
      const message =
        caught instanceof Error ? caught.message : 'Could not upload that clip. Try picking it again.';
      setUploadError(message);
      setStatusLabel('Upload failed');
      telemetry.trackIssue('upload', 'home');
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
      setShowSuccess(false);
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!uploading) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Upload Highlight ⚡</Text>
              <Text style={styles.subtitle}>Clip, tag, caption — then publish.</Text>
              <Text style={styles.subtitle}>{COMPLIANCE_UPLOAD}</Text>
            </View>
            <AnimatedButton
              accessibilityLabel="Close upload"
              disabled={uploading}
              haptic="light"
              onPress={onClose}
              contentStyle={[styles.close, uploading && styles.disabled]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </AnimatedButton>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pickerRow}>
              <AnimatedButton
                accessibilityLabel="Choose a video from library"
                disabled={uploading}
                haptic="light"
                style={styles.sourceHit}
                contentStyle={[
                  styles.sourceBtn,
                  pickSource === 'library' && styles.sourceBtnOn,
                  uploading && styles.disabled,
                ]}
                onPress={() => void pickVideo('library')}
              >
                <View style={[styles.sourceIcon, pickSource === 'library' && styles.sourceIconOn]}>
                  <Ionicons
                    name="images-outline"
                    size={22}
                    color={pickSource === 'library' ? colors.onAccent : NEON_JADE}
                  />
                </View>
                <Text style={styles.sourceTitle}>Library</Text>
                <Text style={styles.sourceHint}>Pick a clip</Text>
              </AnimatedButton>
              <AnimatedButton
                accessibilityLabel="Record a video"
                disabled={uploading}
                haptic="light"
                style={styles.sourceHit}
                contentStyle={[
                  styles.sourceBtn,
                  pickSource === 'camera' && styles.sourceBtnOn,
                  uploading && styles.disabled,
                ]}
                onPress={() => void pickVideo('camera')}
              >
                <View style={[styles.sourceIcon, pickSource === 'camera' && styles.sourceIconOn]}>
                  <Ionicons
                    name="videocam-outline"
                    size={22}
                    color={pickSource === 'camera' ? colors.onAccent : NEON_JADE}
                  />
                </View>
                <Text style={styles.sourceTitle}>Record</Text>
                <Text style={styles.sourceHint}>{IOS_SIMULATOR ? 'Phone only' : 'Capture live'}</Text>
              </AnimatedButton>
            </View>

            <View style={[styles.videoCard, asset ? styles.videoCardReady : null]}>
              {asset ? (
                <View style={styles.previewRow}>
                  <ClipPreview uri={asset.uri} />
                  <View style={styles.videoCopy}>
                    <Text style={styles.videoLabel}>Clip ready</Text>
                    <Text style={styles.videoMeta} numberOfLines={2}>
                      {[asset.fileName || 'Selected video', formatDuration(asset.durationMs)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.videoLabel}>No video selected</Text>
                  <Text style={styles.videoMeta} numberOfLines={2}>
                    {IOS_SIMULATOR
                      ? 'Pick a clip from Library. Record is phone-only (Simulator has no video camera).'
                      : 'Pick from your library or record a new Seki play.'}
                  </Text>
                </>
              )}
            </View>

            <SelectField
              label="Tag a Game (optional)"
              value={gameLabel}
              open={openSelect === 'game'}
              disabled={uploading}
              filled={Boolean(gameId)}
              onToggle={() => setOpenSelect((current) => (current === 'game' ? null : 'game'))}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !gameId }}
                onPress={() => {
                  setGameId('');
                  setOpenSelect(null);
                }}
                style={[styles.option, !gameId && styles.optionSelected]}
              >
                <Text style={[styles.optionLabel, !gameId && styles.optionLabelSelected]}>
                  No specific game
                </Text>
                <Text style={styles.optionMeta}>Post without linking to a live matchup</Text>
              </Pressable>
              {games.map((game) => {
                const label = gameMatchupLabel(game.home_team, game.away_team);
                const selected = game.id === gameId;
                return (
                  <Pressable
                    key={game.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setGameId(game.id);
                      setOpenSelect(null);
                    }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
                    <Text style={styles.optionMeta}>
                      {displayValue(game.venue)} · {displayValue(game.status)}
                    </Text>
                  </Pressable>
                );
              })}
            </SelectField>

            <SelectField
              label="Who’s in this clip?"
              value={playerLabel}
              open={openSelect === 'player'}
              disabled={uploading || sortedPlayers.length === 0}
              filled={Boolean(playerId)}
              onToggle={() => setOpenSelect((current) => (current === 'player' ? null : 'player'))}
            >
              {sortedPlayers.map((player) => {
                const selected = player.id === playerId;
                return (
                  <Pressable
                    key={player.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setPlayerId(player.id);
                      setOpenSelect(null);
                    }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {playerTagLabel(player)}
                    </Text>
                    <Text style={styles.optionMeta}>
                      {displayValue(player.position)} · {displayValue(player.school_name)}
                    </Text>
                  </Pressable>
                );
              })}
            </SelectField>

            <Text style={styles.fieldLabel}>Title / Hype Caption</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              editable={!uploading}
              placeholder="Walk-off scramble — Westlake vs Lone Peak"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={120}
              returnKeyType="done"
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryRow} accessibilityLabel="Video category">
                {categoryPills.map((pill) => {
                  const selected = pill.id === category;
                  const serve = pill.id === REEL_CATEGORY_SERVE;
                  return (
                    <AnimatedButton
                      key={pill.id}
                      accessibilityRole="button"
                      accessibilityLabel={pill.label}
                      accessibilityState={{ selected, disabled: uploading }}
                      disabled={uploading}
                      haptic="light"
                      style={styles.categoryPillWrap}
                      contentStyle={[
                        styles.categoryPill,
                        selected && styles.categoryPillOn,
                        serve && styles.categoryPillServe,
                        selected && serve && styles.categoryPillServeOn,
                      ]}
                      onPress={() => setCategory(pill.id)}
                    >
                      <View style={styles.categoryPillHead}>
                        <View style={styles.categoryPillCopy}>
                          <Text
                            style={[
                              styles.categoryPillLabel,
                              selected && styles.categoryPillLabelOn,
                              selected && serve && styles.categoryPillLabelServe,
                            ]}
                          >
                            {pill.label}
                          </Text>
                          {selected && serve ? (
                            <Text style={styles.impactBadgeLabel}>{SERVE_LIKE_ME_BOOST_LABEL}</Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={selected ? NEON_JADE : colors.border}
                        />
                      </View>
                    </AnimatedButton>
                  );
                })}
              </View>
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: isExclusive, disabled: uploading }}
              accessibilityLabel="Subscriber Vault"
              disabled={uploading}
              onPress={() => setIsExclusive((current) => !current)}
              style={({ pressed }) => [
                styles.exclusiveCard,
                isExclusive && styles.exclusiveCardOn,
                pressed && styles.pressed,
                uploading && styles.disabled,
              ]}
            >
              <View style={styles.exclusiveCopy}>
                <Text style={[styles.exclusiveTitle, isExclusive && styles.exclusiveTitleOn]}>
                  Subscriber Vault 🔒
                </Text>
                <Text style={styles.exclusiveHint}>
                  Off by default (free public feed). On: only ${exclusiveDollars.toFixed(2)}/mo subscribers can watch.
                </Text>
              </View>
              <View style={[styles.exclusiveTrack, isExclusive && styles.exclusiveTrackOn]}>
                <View style={[styles.exclusiveThumb, isExclusive && styles.exclusiveThumbOn]} />
              </View>
            </Pressable>

            {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
            {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}

            {uploading && showSuccess ? (
              <Animated.View
                style={[
                  styles.successWrap,
                  { opacity: successAnim, transform: [{ scale: successAnim }] },
                ]}
              >
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark" size={26} color={colors.onAccent} />
                  <View pointerEvents="none" style={styles.successBadgeGloss} />
                </View>
                <Text style={styles.successLabel}>Seki play uploaded ⚡</Text>
              </Animated.View>
            ) : uploading ? (
              <View style={styles.progressWrap} accessibilityRole="progressbar">
                <Animated.View style={[styles.progressGlow, { opacity: pulse }]} />
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: barWidth }]}>
                    <CardShine loopMs={1700} width={12} />
                  </Animated.View>
                </View>
                <View style={styles.progressMeta}>
                  <ActivityIndicator color={NEON_JADE} />
                  <Text style={styles.progressLabel}>
                    {statusLabel} {Math.round(progress * 100)}%
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.rightsBox}>
              {rightsChecksFor(category).map((row) => {
                const checked = rights[row.id] === true;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: uploading }}
                    disabled={uploading}
                    onPress={() => setRights((current) => ({ ...current, [row.id]: !current[row.id] }))}
                    style={styles.rightsRow}
                  >
                    <Text style={[styles.rightsMark, checked && styles.rightsMarkOn]}>{checked ? '✓' : ''}</Text>
                    <Text style={styles.rightsLabel}>{row.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <AnimatedButton
              accessibilityLabel={HIGHLIGHT_PUBLISH_LABEL}
              disabled={!canSubmit}
              haptic="medium"
              onPress={() => void submit()}
              contentStyle={[styles.submit, !canSubmit && styles.submitDisabled]}
            >
              <Text style={styles.submitLabel}>{uploading ? 'Publishing…' : HIGHLIGHT_PUBLISH_LABEL}</Text>
            </AnimatedButton>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <HighlightPickerModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPicked={(clip) => {
          setAsset(clip);
          setPickSource('library');
          setUploadError(null);
        }}
      />
    </Modal>
  );
}

function SelectField({
  label,
  value,
  open,
  disabled,
  filled,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  disabled: boolean;
  filled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [styles.select, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={[styles.selectValue, !filled && styles.selectPlaceholder]}>{value}</Text>
        <Text style={styles.selectChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={styles.options}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 14,
    paddingBottom: 24,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceHit: {
    flex: 1,
  },
  sourceBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
    minHeight: 108,
  },
  sourceBtnOn: {
    borderColor: NEON_JADE,
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.4)',
    backgroundColor: 'rgba(0,230,118,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sourceIconOn: {
    backgroundColor: NEON_JADE,
    borderColor: NEON_JADE,
  },
  sourceTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  sourceHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  videoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  videoCardReady: {
    borderColor: NEON_JADE,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: colors.photoPlaceholder,
    overflow: 'hidden',
  },
  videoCopy: {
    flex: 1,
    gap: 4,
  },
  videoLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  videoMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  select: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  selectPlaceholder: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  selectChevron: {
    color: NEON_JADE,
    fontSize: 12,
    fontWeight: '800',
  },
  options: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  optionSelected: {
    backgroundColor: colors.accentSoft,
  },
  optionLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  optionLabelSelected: {
    color: NEON_JADE,
  },
  optionMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  categoryRow: {
    gap: 8,
  },
  categoryPillWrap: {
    width: '100%',
  },
  categoryPill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  categoryPillHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPillCopy: {
    flex: 1,
    gap: 2,
  },
  categoryPillOn: {
    borderColor: NEON_JADE,
    backgroundColor: 'rgba(0,230,118,0.12)',
  },
  categoryPillServe: {
    borderColor: 'rgba(0,230,118,0.4)',
  },
  categoryPillServeOn: {
    borderColor: NEON_JADE,
    backgroundColor: 'rgba(0,230,118,0.18)',
  },
  categoryPillLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  categoryPillLabelOn: {
    color: NEON_JADE,
  },
  categoryPillLabelServe: {
    color: NEON_JADE,
  },
  impactBadgeLabel: {
    color: NEON_JADE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  exclusiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
  },
  exclusiveCardOn: {
    borderColor: NEON_JADE,
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  exclusiveCopy: {
    flex: 1,
    gap: 4,
  },
  exclusiveTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  exclusiveTitleOn: {
    color: NEON_JADE,
  },
  exclusiveHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  exclusiveTrack: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  exclusiveTrackOn: {
    backgroundColor: NEON_JADE,
  },
  exclusiveThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    alignSelf: 'flex-start',
  },
  exclusiveThumbOn: {
    backgroundColor: colors.onAccent,
    alignSelf: 'flex-end',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  progressWrap: {
    gap: 10,
  },
  progressGlow: {
    height: 8,
    borderRadius: 999,
    backgroundColor: NEON_JADE,
    opacity: 0.25,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: -18,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: NEON_JADE,
    overflow: 'hidden',
  },
  successWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  successBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  successBadgeGloss: {
    position: 'absolute',
    top: -8,
    left: -6,
    width: 32,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
  },
  successLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  rightsBox: {
    gap: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rightsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rightsMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    lineHeight: 20,
    color: colors.background,
    fontWeight: '800',
    overflow: 'hidden',
  },
  rightsMarkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.background,
  },
  rightsLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  submit: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
