/**
 * FUN-01 explicitly requested private player; abort/release on exit and never cache or substitute media.
 * @sideEffects Authorized media reads, native player lifetime, AppState subscription and browser URL release.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { AdminBtn, AdminNotice } from '@/components/Admin/AdminChrome';
import { loadFanZoneVideo } from '@/lib/fanZoneMedia';
type Loaded = Awaited<ReturnType<typeof loadFanZoneVideo>>;
/** @purpose Own one reviewed revision; late authorized-byte responses are discarded and released. */
export function FanZoneVideoReview({ entryId, revision }: {
    entryId: string;
    revision: number;
}) {
    const [loaded, setLoaded] = useState<Loaded | null>(null), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
    const current = useRef<Loaded | null>(null), controller = useRef<AbortController | null>(null);
    const close = useCallback(() => { controller.current?.abort(); controller.current = null; current.current?.release(); current.current = null; setLoaded(null); setPending(false); }, []);
    useEffect(() => () => { controller.current?.abort(); controller.current = null; current.current?.release(); current.current = null; }, []);
    useFocusEffect(useCallback(() => () => close(), [close]));
    useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state !== 'active')
        close(); }); return () => sub.remove(); }, [close]);
    const open = async () => {
        close();
        const request = new AbortController();
        controller.current = request;
        setPending(true);
        setError(null);
        try {
            const next = await loadFanZoneVideo(entryId, revision, request.signal);
            if (request.signal.aborted || controller.current !== request) {
                next.release();
                return;
            }
            current.current = next;
            setLoaded(next);
        }
        catch {
            if (!request.signal.aborted)
                setError('Private video is unavailable. Refresh before reviewing this revision.');
        }
        finally {
            if (!request.signal.aborted)
                setPending(false);
        }
    };
    return <>
  <AdminBtn label={loaded ? 'Close private video' : 'Review private video'} disabled={pending} onPress={() => loaded ? close() : void open()}/>
  {pending ? <AdminBtn label="Cancel video load" onPress={close}/> : null}
  {pending ? <Text>Reading authorized private video…</Text> : null}<AdminNotice text={error} tone="danger"/>
  {loaded ? <ReviewedPlayer source={loaded.source} onError={() => setError('Private video playback failed. Refresh or contact Support.')}/> : null}
  <Text>Exact revision only. A delivered/buffered copy cannot be retracted; subsequent requests reauthorize. No video caching.</Text>
 </>;
}
/** @purpose The hook disposes this sole player on unmount; leaving/backgrounding the desk pauses it. */
function ReviewedPlayer({ source, onError }: {
    source: VideoSource;
    onError: () => void;
}) {
    const onFailure = useRef(onError);
    onFailure.current = onError;
    const noCache = useMemo(() => typeof source === 'string' ? { uri: source, useCaching: false } : typeof source === 'object' && source ? { ...source, useCaching: false } : source, [source]);
    const player = useVideoPlayer(noCache, p => { p.loop = false; });
    useEffect(() => { try {
        player.play();
    }
    catch {
        onFailure.current();
    } const listener = player.addListener('statusChange', event => { if (event.status === 'error')
        onFailure.current(); }); return () => { player.pause(); listener.remove(); }; }, [player]);
    return <VideoView player={player} nativeControls accessibilityLabel="Exact private entry video" style={{ width: '100%', height: 240 }}/>;
}
