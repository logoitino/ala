/**
 * Exact private fan-video preview; only caller-authorized Open begins a reviewed media lifetime.
 * @sideEffects Authorized media load/abort/blob release, one uncached Expo player, and focus/AppState cleanup.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { VideoView, useVideoPlayer, type VideoPlayerStatus, type VideoSource } from 'expo-video';
import { colors, radii } from '@/constants/theme';
import { loadFanZoneVideo } from '@/lib/fanZoneMedia';
import { TYPE, figtree } from '@/theme/fonts';
export type FanZoneVideoProps = {
  entryId: string; revision: number; reviewKey: string; open: boolean;
  onOpen: () => void; onClose: () => void; onReady: (reviewKey: string, ready: boolean) => void; label?: string;
};
type Loaded = Awaited<ReturnType<typeof loadFanZoneVideo>>;
const loadError = 'Private video is unavailable. Close and try again, or refresh Fan Zone.';
const playbackError = 'Private video playback is unavailable. Close and try again, or refresh Fan Zone.';

/** @purpose Caller owns the sole open target; leaving/backgrounding closes it without an automatic reopen. */
export function FanZoneVideo(props: FanZoneVideoProps) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const callbacks = useRef(props); callbacks.current = props;
  const enabled = props.open && focused && active;
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const key = props.reviewKey;
    if (!enabled) callbacks.current.onReady(key, false);
    if (props.open && (!focused || !active)) callbacks.current.onClose();
    return () => callbacks.current.onReady(key, false);
  }, [active, enabled, focused, props.open, props.reviewKey]);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={props.open ? 'Close private video' : props.label ?? 'Open private video'}
      disabled={!props.open && (!focused || !active)} accessibilityState={{ disabled: !props.open && (!focused || !active) }}
      onPress={props.open ? props.onClose : props.onOpen} style={styles.button}>
      <Text style={styles.buttonText}>{props.open ? 'Close private video' : props.label ?? 'Open private video'}</Text>
    </Pressable>
    {enabled ? <PrivateSession key={JSON.stringify([props.entryId, props.revision, props.reviewKey])}
      entryId={props.entryId} revision={props.revision} reviewKey={props.reviewKey} onReady={props.onReady} /> : null}
  </View>;
}

/** @purpose A single immutable target owns its bytes; stale/cancelled loads release rather than attach. */
function PrivateSession({ entryId, revision, reviewKey, onReady }: Pick<FanZoneVideoProps, 'entryId' | 'revision' | 'reviewKey' | 'onReady'>) {
  const [prepared, setPrepared] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resource = useRef<Loaded | null>(null);
  const callback = useRef(onReady); callback.current = onReady;
  const alive = useRef(false);
  const release = () => { const previous = resource.current; resource.current = null; previous?.release(); };
  useEffect(() => {
    const request = new AbortController(); alive.current = true;
    callback.current(reviewKey, false);
    void loadFanZoneVideo(entryId, revision, request.signal).then(next => {
      if (!alive.current || request.signal.aborted) { next.release(); return; }
      resource.current = next; setPrepared(next);
    }).catch(() => {
      if (alive.current && !request.signal.aborted) { callback.current(reviewKey, false); setError(loadError); }
    });
    return () => { alive.current = false; request.abort(); callback.current(reviewKey, false); release(); };
  }, [entryId, revision, reviewKey]);
  const failed = () => {
    if (!alive.current) return;
    callback.current(reviewKey, false); setError(playbackError); setPrepared(null); release();
  };
  return <>
    {error ? <Text accessibilityRole="alert" style={styles.copy}>{error}</Text> : !prepared ? <Text style={styles.copy}>Reading the exact private video…</Text> : null}
    {prepared && !error ? <ExactPlayer source={prepared.source} reviewKey={reviewKey} onReady={onReady} onFailure={failed} /> : null}
  </>;
}

/** @purpose The supported first-frame callback and readyToPlay must belong to this exact mounted source. */
function ExactPlayer({ source, reviewKey, onReady, onFailure }: { source: VideoSource; reviewKey: string; onReady: FanZoneVideoProps['onReady']; onFailure: () => void }) {
  const noCache = useMemo(() => typeof source === 'string' ? { uri: source, useCaching: false }
    : source && typeof source === 'object' ? { ...source, useCaching: false } : source, [source]);
  const player = useVideoPlayer(noCache, p => { p.loop = false; });
  const callbacks = useRef({ onReady, onFailure }); callbacks.current = { onReady, onFailure };
  const evidence = useRef<{ alive: boolean; status: VideoPlayerStatus; frame: boolean }>({ alive: false, status: player.status, frame: false });
  const report = () => {
    if (evidence.current.alive) callbacks.current.onReady(reviewKey, evidence.current.status === 'readyToPlay' && evidence.current.frame);
  };
  useEffect(() => {
    evidence.current.alive = true; evidence.current.status = player.status; evidence.current.frame = false; report();
    const subscription = player.addListener('statusChange', event => {
      if (!evidence.current.alive) return;
      evidence.current.status = event.status;
      if (event.status === 'error') { evidence.current.frame = false; report(); callbacks.current.onFailure(); }
      else report();
    });
    try { player.play(); } catch { callbacks.current.onReady(reviewKey, false); callbacks.current.onFailure(); }
    return () => {
      evidence.current.alive = false; callbacks.current.onReady(reviewKey, false);
      // Shared-object disposal can precede this cleanup; readiness is already revoked even if pause throws.
      try { player.pause(); } catch { /* Player is already disposed. */ }
      subscription.remove();
    };
  }, [player, reviewKey]);
  return <VideoView key={reviewKey} player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: false }} allowsPictureInPicture={false}
    accessibilityLabel="Exact private fan video" style={styles.video} onFirstFrameRender={() => {
      if (!evidence.current.alive) return;
      // Installed Expo57 web emits this after loadstart/loadeddata; browser paint remains device QA evidence.
      evidence.current.frame = true; report();
    }} />;
}
const styles = StyleSheet.create({ container: { gap: 8 }, button: { minHeight: 44, padding: 12, borderRadius: radii.md,
  borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  buttonText: { color: colors.text, ...TYPE.body, ...figtree('600') }, copy: { ...figtree('400'), color: colors.textMuted, ...TYPE.body,  },
  video: { width: '100%', height: 240, backgroundColor: colors.background } });
