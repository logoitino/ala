/** Keeps source replacement, focus and real playback events in one lifecycle. Serial replacement
 * avoids native URI races; no load or failed play contributes to a Highlight's view threshold. */
type PlaybackPlayer = {
  replaceAsync(uri: string): Promise<void>;
  play(): void;
  pause(): void;
  status: string;
  playing: boolean;
  duration: number;
};
type PlaybackOptions = {
  player: PlaybackPlayer;
  /** Native may retain the prior status while replacing; web sets loading before DOM load. */
  native?: boolean;
  currentUri(): string;
  canPlay(): boolean;
  onReady(): void;
  onError(error: unknown): void;
  onPlaybackChange(playing: boolean, duration: number | null): void;
};

export function createReelPlaybackController(options: PlaybackOptions) {
  const { player } = options;
  let generation = 0;
  let disposed = false;
  let acceptedUri: string | null = null;
  let observedUri: string | null = null;
  let metadataUri: string | null = null;
  let readyForUri: string | null = null;
  let pendingReady = false;
  let replacingUri: string | null = null;
  let busy = false;
  let ready = false;
  let requested = false;
  let actuallyPlaying = false;
  let failed = false;
  let queue = Promise.resolve();
  const current = () => !disposed && acceptedUri === options.currentUri();
  const stopCounting = () => options.onPlaybackChange(false, null);
  const pause = () => {
    requested = false;
    actuallyPlaying = false;
    stopCounting();
    try { player.pause(); } catch { /* The Expo hook may already have released its native player. */ }
  };
  const fail = (error: unknown) => {
    if (disposed || failed) return;
    failed = true;
    ready = false;
    pause();
    options.onError(error);
  };
  const requestPlay = () => {
    if (!current() || busy || !ready || failed || !options.canPlay() || requested) return;
    requested = true;
    try { player.play(); } catch (error) { fail(error); }
  };
  const becameReady = () => {
    if (!current() || observedUri !== acceptedUri || busy || failed) return;
    if (!ready) options.onReady();
    ready = true;
    requestPlay();
  };
  const checkReady = () => {
    if (!options.native) { if (player.status === 'readyToPlay') becameReady(); return; }
    // Metadata identifies a ready-before-source native event, but is never itself buffering-ready.
    if (readyForUri === acceptedUri || (pendingReady && metadataUri === acceptedUri && player.status === 'readyToPlay')) becameReady();
  };
  return {
    load(uri: string): Promise<void> {
      const attempt = ++generation;
      acceptedUri = null;
      observedUri = null;
      metadataUri = null;
      readyForUri = null;
      pendingReady = false;
      busy = true;
      ready = false;
      failed = false;
      pause();
      const isLatest = () => !disposed && attempt === generation && uri === options.currentUri();
      const task = queue.then(async () => {
        if (!isLatest()) return;
        replacingUri = uri;
        try {
          await player.replaceAsync(uri);
          if (!isLatest()) return;
          acceptedUri = uri;
          busy = false;
          replacingUri = null;
          if (player.status === 'error' && (!options.native || observedUri === uri)) fail(new Error('The current Highlight could not load.'));
          else checkReady();
        } catch (error) {
          if (isLatest()) { busy = false; replacingUri = null; fail(error); }
        }
      });
      queue = task;
      return task;
    },
    pause,
    requestPlay,
    retryPlay() {
      // A deliberate mute action may recover an autoplay refusal; never restart a playing clip.
      if (actuallyPlaying) return;
      requested = false;
      requestPlay();
    },
    sourceChanged(uri: string | null) {
      if (disposed || uri !== options.currentUri()) return;
      observedUri = uri;
      if (current() && !busy) checkReady();
    },
    sourceLoaded(uri: string | null) {
      if (disposed || uri !== options.currentUri()) return;
      metadataUri = uri;
      if (current() && !busy) checkReady();
    },
    statusChanged(status: string, error?: unknown) {
      if (disposed || (!current() && replacingUri !== options.currentUri())) return;
      if (status === 'error') {
        // An unlabelled native event can still belong to the replaced item. Promise rejections
        // are separately tied to their load generation, and matching source events identify this one.
        // Bad web media may never produce a source event; completed DOM replacement already
        // identifies the accepted URI. Native replacement can resolve without applying its source.
        if ((!options.native && current() && !busy) || observedUri === options.currentUri() || metadataUri === options.currentUri()) fail(error);
        return;
      }
      if (status === 'loading') { ready = false; pendingReady = false; readyForUri = null; requested = false; actuallyPlaying = false; stopCounting(); }
      // Expo emits statusChange before updating its status getter. Trust the event payload here.
      if (status === 'readyToPlay') {
        pendingReady = true;
        if (observedUri === options.currentUri()) { readyForUri = observedUri; becameReady(); }
        else if (!options.native) becameReady();
      }
    },
    playingChanged(isPlaying: boolean) {
      if (disposed) return;
      if (isPlaying && current() && !busy && ready && !failed && options.canPlay()) {
        requested = true;
        actuallyPlaying = true;
        options.onPlaybackChange(true, Number.isFinite(player.duration) ? player.duration : null);
      } else {
        requested = false;
        actuallyPlaying = false;
        stopCounting();
        if (isPlaying) pause();
      }
    },
    isCurrentReady: () => current() && !busy && ready && !failed,
    dispose() { disposed = true; generation += 1; pause(); },
  };
}
