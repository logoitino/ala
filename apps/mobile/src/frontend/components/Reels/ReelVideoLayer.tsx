/**
 * The expo-video layer of one Highlight card (split out of ReelCard.tsx for R4-03; behaviour unchanged).
 * Only the card on screen gets a file; a mounted neighbour renders an empty view (one decoded Highlight at a time).
 * Playback decisions live in `reelPlayback.ts`; this component wires the player, focus/lock/mute and telemetry.
 * @sideEffects expo-video player; `TelemetryManager` first-frame, stall and playback-failure events.
 */
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { createReelPlaybackController } from '@/components/Reels/reelPlayback';
import { telemetry } from '@/services/TelemetryManager';

export type ReelVideoLayerProps = {
  clipId: string;
  videoUrl: string;
  /** Current page: load the source. Off-screen mounted cards never touch the decoder. */
  active: boolean;
  /** Current page on a focused route (or `playbackActive`): play. */
  focused: boolean;
  locked: boolean;
  muted: boolean;
  /** Real playback state for the view counter, with the clip length once known. */
  onPlaybackChange: (playing: boolean, durationSec: number | null) => void;
  /** Recovery is rendered above the card's tap gesture, so Retry remains reachable. */
  onPlaybackFailure: (clipId: string, retry: (() => void) | null) => void;
  /** Clip reached its end while focused ("Full replay" flash). */
  onLoopEnd: () => void;
};

/**
 * @purpose The expo-video player for a video Highlight: lazy source load, play / pause with focus and
 *   lock, TTFF and stall telemetry. Split out of `ReelCardImpl` so a photo story never creates a player.
 * @sideEffects expo-video player; `TelemetryManager` first-frame and stall events.
 */
export function ReelVideoLayer({ clipId, videoUrl, active, focused, locked, muted, onPlaybackChange, onPlaybackFailure, onLoopEnd }: ReelVideoLayerProps) {
  const loadedUriRef = useRef('');
  const latest = useRef({ clipId, videoUrl, active, focused, locked, muted, onPlaybackChange, onPlaybackFailure, onLoopEnd });
  latest.current = { clipId, videoUrl, active, focused, locked, muted, onPlaybackChange, onPlaybackFailure, onLoopEnd };
  const loadStartedAtRef = useRef<number | null>(null);
  const firstFrameLoggedRef = useRef(false);
  const stallStartedAtRef = useRef<number | null>(null);
  const appPausedRef = useRef(false);
  const lastMutedRef = useRef(muted);
  const controllerRef = useRef<ReturnType<typeof createReelPlaybackController> | null>(null);

  // Only the card on screen is given a file. A mounted neighbor stays on an empty player.
  const videoPlayer = useVideoPlayer(active && videoUrl ? videoUrl : null, (instance) => { instance.loop = true; instance.muted = true; });
  const resetLoad = useCallback(() => {
    loadStartedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    stallStartedAtRef.current = null;
    latest.current.onPlaybackFailure(latest.current.clipId, null);
  }, []);

  useEffect(() => {
    loadedUriRef.current = '';
    const controller = createReelPlaybackController({
      player: videoPlayer,
      native: Platform.OS !== 'web',
      currentUri: () => latest.current.videoUrl,
      canPlay: () => latest.current.active && latest.current.focused && !latest.current.locked,
      onPlaybackChange: (playing, duration) => latest.current.onPlaybackChange(playing, duration),
      onReady: () => {
        if (loadStartedAtRef.current != null && !firstFrameLoggedRef.current) {
          telemetry.track({ event_type: 'video_first_frame', video_id: latest.current.clipId, duration_ms: Date.now() - loadStartedAtRef.current });
          firstFrameLoggedRef.current = true;
        }
        if (stallStartedAtRef.current != null) {
          telemetry.trackVideoStall(latest.current.clipId, Date.now() - stallStartedAtRef.current);
          stallStartedAtRef.current = null;
        }
      },
      onError: () => {
        stallStartedAtRef.current = null;
        // Stable issue code only: media URLs and browser error messages never enter telemetry.
        telemetry.trackIssue('video.playback.failed');
        latest.current.onPlaybackFailure(latest.current.clipId, () => {
          const current = latest.current;
          if (!current.active || !current.focused || current.locked || !current.videoUrl) return;
          resetLoad();
          void controller.load(current.videoUrl);
        });
      },
    });
    controllerRef.current = controller;
    return () => { controller.dispose(); controllerRef.current = null; };
  }, [videoPlayer, resetLoad]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    // The player hook drops the file when this card is not the one on screen.
    if (!active || !videoUrl) {
      loadedUriRef.current = '';
      controller.pause();
      return;
    }
    if (loadedUriRef.current === videoUrl) return;
    loadedUriRef.current = videoUrl;
    resetLoad();
    void controller.load(videoUrl);
  }, [active, videoUrl, videoPlayer, resetLoad]);

  useEffect(() => {
    videoPlayer.loop = true;
    videoPlayer.muted = muted;
    const muteChanged = lastMutedRef.current !== muted;
    lastMutedRef.current = muted;
    if (active && focused && !locked) {
      appPausedRef.current = false;
      if (muteChanged) controllerRef.current?.retryPlay();
      else controllerRef.current?.requestPlay();
    } else {
      appPausedRef.current = true;
      stallStartedAtRef.current = null;
      controllerRef.current?.pause();
    }
  }, [active, focused, locked, muted, videoUrl, videoPlayer]);

  useEventListener(videoPlayer, 'sourceChange', ({ source }) => {
    const uri = typeof source === 'string' ? source : source && typeof source === 'object' ? source.uri ?? null : null;
    controllerRef.current?.sourceChanged(uri);
  });
  useEventListener(videoPlayer, 'sourceLoad', ({ videoSource }) => {
    const uri = typeof videoSource === 'string' ? videoSource : videoSource && typeof videoSource === 'object' ? videoSource.uri ?? null : null;
    controllerRef.current?.sourceLoaded(uri);
  });
  useEventListener(videoPlayer, 'statusChange', ({ status, oldStatus, error }) => {
    if (status === 'loading' && controllerRef.current?.isCurrentReady() && firstFrameLoggedRef.current && oldStatus === 'readyToPlay' && latest.current.active && latest.current.focused && !latest.current.locked && !appPausedRef.current && stallStartedAtRef.current == null) {
      stallStartedAtRef.current = Date.now();
    }
    controllerRef.current?.statusChanged(status, error);
  });
  useEventListener(videoPlayer, 'playingChange', ({ isPlaying, oldIsPlaying }) => {
    controllerRef.current?.playingChanged(isPlaying);
    if (!controllerRef.current?.isCurrentReady() || !latest.current.active || !latest.current.focused || latest.current.locked || appPausedRef.current) return;
    if (oldIsPlaying && !isPlaying && firstFrameLoggedRef.current && stallStartedAtRef.current == null) stallStartedAtRef.current = Date.now();
    if (isPlaying && stallStartedAtRef.current != null) {
      telemetry.trackVideoStall(latest.current.clipId, Date.now() - stallStartedAtRef.current);
      stallStartedAtRef.current = null;
    }
  });
  useEventListener(videoPlayer, 'playToEnd', () => {
    if (controllerRef.current?.isCurrentReady() && latest.current.active && latest.current.focused && !latest.current.locked) latest.current.onLoopEnd();
  });

  if (!active) return <View style={styles.videoFill} />;
  return <VideoView player={videoPlayer} style={styles.videoFill} contentFit="cover" nativeControls={false} surfaceType="textureView" allowsVideoFrameAnalysis={false} allowsPictureInPicture={false} playsInline />;
}

const styles = StyleSheet.create({
  videoFill: {
    ...StyleSheet.absoluteFill,
  },
});
