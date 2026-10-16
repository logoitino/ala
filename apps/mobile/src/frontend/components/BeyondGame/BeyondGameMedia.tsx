/** Explicit private-media load. SDK-requested expiry is enforced locally, not a provider revocation guarantee. */
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Platform, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { BeyondActor, BeyondPost } from '@tapuai/shared-types/beyondGame';
import { signBeyondMedia } from '@/lib/beyondGame';
import { BeyondButton } from './BeyondGameComposer';

function PrivateVideo({ url, onFail }: { url: string; onFail: () => void }) {
  const player = useVideoPlayer({ uri: url, useCaching: false }, p => { p.loop = false; });
  useEffect(() => {
    const listener = player.addListener('statusChange', event => { if (event.status === 'error') onFail(); });
    return () => { listener.remove(); player.pause(); };
  }, [player, onFail]);
  return <VideoView player={player} nativeControls style={{ width: '100%', height: 260 }} />;
}

export function BeyondGameMedia({ actor, post, active, scopeKey }: {
  actor: BeyondActor | null; post: BeyondPost; active: boolean; scopeKey: string;
}) {
  const identity = `${scopeKey}:${actor?.userId ?? 'guest'}:${actor?.profileId ?? ''}:${post.id}:${post.revision}:${active}`;
  const guard = useRef({ identity, epoch: 0, alive: true, visible: true });
  if (guard.current.identity !== identity) guard.current = { identity, epoch: guard.current.epoch + 1, alive: true, visible: true };
  const epoch = guard.current.epoch;
  const lifetime = guard.current;
  const [, refreshLifetime] = useState(0);
  const current = () => active && guard.current === lifetime && lifetime.alive && lifetime.visible && lifetime.identity === identity && lifetime.epoch === epoch;
  const [media, setMedia] = useState<{ identity: string; epoch: number; token: number; urls: string[] } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const request = useRef(0), flight = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    request.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null; flight.current = false; setMedia(null); setBusy(false);
  }, []);
  useEffect(() => { lifetime.alive = true; clear(); setError(null); return () => { lifetime.alive = false; clear(); }; }, [identity, clear]);
  useFocusEffect(useCallback(() => {
    lifetime.visible = true;
    return () => { lifetime.visible = false; lifetime.epoch++; clear(); };
  }, [identity, clear]));
  useEffect(() => {
    const update = (visible: boolean) => {
      guard.current.visible = visible;
      if (!visible) { guard.current.epoch++; clear(); }
      refreshLifetime(value => value + 1);
    };
    const sub = AppState.addEventListener('change', state => update(state === 'active'));
    const visibility = () => update(!document.hidden && AppState.currentState === 'active');
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
    return () => { sub.remove(); if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); };
  }, [clear]);
  const load = async () => {
    if (!current() || flight.current || post.status === 'removed') return;
    const token = ++request.current;
    flight.current = true;
    setBusy(true); setError(null); setMedia(null);
    try {
      const signed: { url: string; expiresAt: number }[] = [];
      for (const item of post.media) {
        if (!current() || token !== request.current) return;
        signed.push(await signBeyondMedia(actor, post, item.id));
      }
      if (!current() || token !== request.current) return;
      const remaining = Math.min(...signed.map(item => item.expiresAt)) - Date.now();
      if (!signed.length || !Number.isFinite(remaining) || remaining <= 0 || remaining > 60000) throw Error('Media access expired. Load it again.');
      setMedia({ identity, epoch, token, urls: signed.map(item => item.url) });
      timer.current = setTimeout(() => { if (current() && token === request.current) { clear(); setError('Media access expired. Load it again.'); } }, remaining);
    } catch (caught) {
      if (current() && token === request.current) { clear(); setError(caught instanceof Error ? caught.message : 'Could not load this media.'); }
    } finally { if (current() && token === request.current) { flight.current = false; setBusy(false); } }
  };
  const shown = current() && media?.identity === identity && media.epoch === epoch ? media.urls : [];
  const failed = () => { if (current() && media?.token === request.current) { clear(); setError('This media could not be shown. Load it again.'); } };
  return <View>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <BeyondButton label={busy ? 'Loading post media…' : 'Load post media'} disabled={!active || busy || post.status === 'removed'} onPress={() => void load()} />
    {shown.map((url, index) => post.media[index].kind === 'video'
      ? <PrivateVideo key={`${identity}:${epoch}:${url}`} url={url} onFail={failed} />
      : <Image key={`${identity}:${epoch}:${url}`} accessibilityLabel={`Post photo ${index + 1}`} source={{ uri: url, cache: 'reload' }} onError={failed}
        style={{ width: '100%', height: 260, resizeMode: 'contain' }} />)}
    {shown.length ? <BeyondButton label="Close post media" onPress={() => { if (current() && media?.token === request.current) clear(); }} /> : null}
  </View>;
}
