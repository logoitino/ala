/** GUEST-ACCESS-01 guest-only preview: no full feed, roster, search, reaction, upload or account-detail hooks mount. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { GuestHighlightPreview } from '@tapuai/shared-types';
import { fetchGuestHighlightPreview } from '@/lib/guestPreview';
import { useSoftWall } from '@/context/SoftWallContext';
import { BrandMark } from '@/components/UI/BrandMark';
import { LegalModal } from '@/components/Legal/LegalModal';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

function PreviewVideo({ clip }: { clip: GuestHighlightPreview }) {
  const { height } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const player = useVideoPlayer(clip.video_url, instance => { instance.loop = true; instance.muted = true; });
  const pause = useCallback(() => { try { player.pause(); } catch { /* The player may already be disposed on route exit. */ } setPlaying(false); }, [player]);
  useFocusEffect(useCallback(() => pause, [pause]));
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state !== 'active') pause(); }); return () => sub.remove(); }, [pause]);
  return <View style={styles.media}>
    <VideoView player={player} nativeControls={false} contentFit="contain" style={[styles.video, { height: Math.max(220, Math.min(480, height - 260)) }]} />
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause preview' : 'Play preview'} style={styles.play} onPress={() => {
      try { if (playing) player.pause(); else player.play(); setPlaying(!playing); setError(false); } catch { setError(true); }
    }}><Text style={styles.secondaryText}>{playing ? 'Pause' : 'Play Highlight'}</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.body}>Playback is unavailable. Tap Play to retry.</Text> : null}
  </View>;
}
/** @purpose Let guests watch only the current safe window and start the existing account flow. @sideEffects Bounded RPC; selected video player; no guest identity tracking. */
export function GuestHighlightsPreview() {
  const { requireAuth } = useSoftWall();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<GuestHighlightPreview[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [index, setIndex] = useState(0), [legal, setLegal] = useState(false);
  const lifetime = useRef({ mounted: false, request: 0 });
  const refresh = useCallback(async () => {
    const request = ++lifetime.current.request;
    setLoading(true); setError(false); setRows([]); setIndex(0);
    try { const next = await fetchGuestHighlightPreview(); if (lifetime.current.mounted && lifetime.current.request === request) setRows(next); }
    catch { if (lifetime.current.mounted && lifetime.current.request === request) setError(true); }
    finally { if (lifetime.current.mounted && lifetime.current.request === request) setLoading(false); }
  }, []);
  useEffect(() => { lifetime.current.mounted = true; void refresh(); return () => { lifetime.current.mounted = false; ++lifetime.current.request; }; }, [refresh]);
  const account = () => requireAuth({ kind: 'browse', resume: () => undefined });
  const clip = rows[index];
  return <ScrollView style={styles.root} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
    <View style={styles.content}>
      <View style={styles.header}><BrandMark size={36} showWordmark={false} /><Text style={styles.brand}>Tapua’i</Text><Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={account} style={styles.signIn}><Text style={styles.secondaryText}>Sign in</Text></Pressable></View>
      <Text accessibilityRole="header" style={styles.title}>Your front-row preview</Text>
      <Text style={styles.body}>Watch a few Highlights. Join to explore athletes, teams and the community.</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading Highlights preview" color={FOCAL.neonJade} /> : null}
      {error ? <><Text accessibilityRole="alert" style={styles.body}>The preview is unavailable. Please try again.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Highlights preview" onPress={() => void refresh()} style={styles.secondary}><Text style={styles.secondaryText}>Try again</Text></Pressable></> : null}
      {!loading && !error && !clip ? <Text style={styles.body}>No preview Highlights are available right now.</Text> : null}
      {clip ? <><Text style={styles.counter}>Highlight {index + 1} of {rows.length}</Text><PreviewVideo key={clip.id} clip={clip} /><Text numberOfLines={3} style={styles.caption}>{clip.title}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous preview Highlight" disabled={index === 0} accessibilityState={{ disabled: index === 0 }} onPress={() => setIndex(current => Math.max(0, current - 1))} style={[styles.secondary, index === 0 && styles.disabled]}><Text style={styles.secondaryText}>Previous</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={index < rows.length - 1 ? 'Next preview Highlight' : 'Continue with an account'} onPress={() => index < rows.length - 1 ? setIndex(current => current + 1) : account()} style={styles.primary}><Text style={styles.primaryText}>{index < rows.length - 1 ? 'Next Highlight' : 'Join to keep exploring'}</Text></Pressable>
        </View></> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in or create an account" onPress={account} style={styles.secondary}><Text style={styles.secondaryText}>Sign in or create an account</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Terms and privacy" onPress={() => setLegal(true)} style={styles.secondary}><Text style={styles.counter}>Terms and privacy</Text></Pressable>
      {legal ? <LegalModal visible onClose={() => setLegal(false)} /> : null}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
 root: { flex: 1, backgroundColor: FOCAL.backgroundBase }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
 content: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 14 },
 header: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brand: { ...TYPE.body, ...figtree('800'), color: '#fff', flex: 1 }, signIn: { minHeight: 44, padding: 10, justifyContent: 'center' },
 title: { ...TYPE.title, ...figtree('800'), color: '#fff' }, body: { ...TYPE.body, ...figtree('400'), color: '#C4D2CE' }, counter: { ...TYPE.caption, ...figtree('500'), color: '#AFBFB8' }, caption: { ...TYPE.body, ...figtree('600'), color: '#fff' },
 media: { gap: 8 }, video: { width: '100%', height: 380, borderRadius: 16, backgroundColor: '#050907' }, play: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
 actions: { flexDirection: 'row', gap: 12 }, primary: { flex: 1, minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: FOCAL.neonJade, alignItems: 'center', justifyContent: 'center' }, primaryText: { ...TYPE.body, ...figtree('700'), color: FOCAL.backgroundBase, textAlign: 'center' },
 secondary: { minHeight: 44, padding: 10, justifyContent: 'center', alignItems: 'center' }, secondaryText: { ...TYPE.body, ...figtree('600'), color: '#D8E5E0', textAlign: 'center' }, disabled: { opacity: 0.4 },
});
