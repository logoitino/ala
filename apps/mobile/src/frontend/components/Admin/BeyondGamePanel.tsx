/** BEYOND-01 protected admin review. Real auth lifecycle, bounded queue, explicit private preview, reasoned decisions. */
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminBeyondStatus, fetchAdminBeyondPosts, adminSetBeyondEnabled, adminReviewBeyondPost, signBeyondMedia, adminBeyondCleanup, adminBeyondRetention, adminEraseBeyondProfile } from '@/lib/beyondGame';
import type { AdminBeyondStatus, BeyondActor, BeyondPost, BeyondState } from '@tapuai/shared-types/beyondGame';
const buttonStyle = { minHeight: 44, padding: 12, marginVertical: 4, borderWidth: 1, borderColor: '#678374', borderRadius: 8 };
function Button({ label, onPress, disabled = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[buttonStyle, disabled ? { opacity: .45 } : null]}><Text>{label}</Text></Pressable>;
}
function PrivateVideo({ url, onReady, onFail }: {
    url: string;
    onReady: () => void;
    onFail: () => void;
}) {
    const callbacks = useRef({ onReady, onFail });
    callbacks.current = { onReady, onFail };
    const first = useRef(false), ready = useRef(false);
    const player = useVideoPlayer({ uri: url, useCaching: false }, p => {
        p.loop = false;
    });
    useEffect(() => {
        let live = true;
        ready.current = player.status === 'readyToPlay';
        const update = player.addListener('statusChange', event => {
            if (!live) {
                return;
            }
            if (event.status === 'error') {
                callbacks.current.onFail();
            }
            ready.current = event.status === 'readyToPlay';
            if (ready.current && first.current) {
                callbacks.current.onReady();
            }
        });
        return () => {
            live = false;
            update.remove();
            player.pause();
        };
    }, [player]);
    return <VideoView player={player} style={{ height: 240, width: '100%' }} nativeControls onFirstFrameRender={() => {
            first.current = true;
            if (ready.current) {
                callbacks.current.onReady();
            }
        }}/>;
}
/** Parent auth changes remount the scoped panel with a monotonic generation, including closed→same-account reopen. */
export function BeyondGamePanel() {
    const { user, profile, isAdmin, loading } = useAuth();
    const closed = profile != null && 'age_blocked_at' in profile && profile.age_blocked_at != null;
    const allowed = !!user && !!profile && profile.user_id === user.id && isAdmin && !loading && !closed;
    const key = `${user?.id ?? ''}:${profile?.id ?? ''}:${allowed}:${closed}`;
    const generation = useRef({ key, epoch: 0 });
    if (generation.current.key !== key) {
        generation.current = { key, epoch: generation.current.epoch + 1 };
    }
    if (!allowed || !user || !profile) {
        return <Text>Beyond the Game needs a current authorized admin session.</Text>;
    }
    return <ScopedPanel key={`${key}:${generation.current.epoch}`} actor={{ userId: user.id, profileId: profile.id }}/>;
}
function ScopedPanel({ actor }: {
    actor: BeyondActor;
}) {
    const [status, setStatus] = useState<AdminBeyondStatus | null>(null), [posts, setPosts] = useState<BeyondPost[]>([]), [cursor, setCursor] = useState<string | null>(null), [filter, setFilter] = useState<BeyondState>('pending');
    const [reason, setReason] = useState(''), [eraseId, setEraseId] = useState(''), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false), [selected, setSelected] = useState<BeyondPost | null>(null), [urls, setUrls] = useState<string[]>([]), [loaded, setLoaded] = useState<number[]>([]), [rights, setRights] = useState(false);
    const active = useRef(true), request = useRef(0), running = useRef(false), previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [reading, setReading] = useState(false), [shownEpoch, setShownEpoch] = useState(0);
    const readingRef = useRef(false), previewEpoch = useRef(0), uiEpoch = useRef(0);
    const clearPreview = () => {
        uiEpoch.current++;
        previewEpoch.current++;
        if (previewTimer.current) {
            clearTimeout(previewTimer.current);
        }
        previewTimer.current = null;
        setSelected(null);
        setUrls([]);
        setLoaded([]);
        setRights(false);
    };
    const load = async (state: BeyondState = filter, before: string | null = null, append = false) => {
        if (!active.current) {
            return;
        }
        const token = ++request.current;
        readingRef.current = true;
        setReading(true);
        clearPreview();
        setReason('');
        setStatus(null);
        if (!append) {
            setPosts([]);
        }
        setError(null);
        try {
            const [s, p] = await Promise.all([fetchAdminBeyondStatus(actor.profileId), fetchAdminBeyondPosts(actor.profileId, state, 30, before)]);
            if (!active.current || token !== request.current) {
                return;
            }
            setStatus(s);
            setPosts(old => append ? [...old, ...p.posts.filter(x => !old.some(y => y.id === x.id))] : p.posts);
            setCursor(p.nextId);
        }
        catch {
            if (!active.current || token !== request.current) {
                return;
            }
            setStatus(null);
            setPosts([]);
            setCursor(null);
            clearPreview();
            setError('Beyond the Game could not be refreshed. Check your admin session and try again.');
        }
        finally {
            if (active.current && token === request.current) {
                readingRef.current = false;
                setReading(false);
            }
        }
    };
    useEffect(() => {
        active.current = true;
        void load('pending');
        return () => {
            active.current = false;
            request.current++;
            if (previewTimer.current) {
                clearTimeout(previewTimer.current);
            }
        };
    }, []);
    const renderedUiEpoch = uiEpoch.current;
    const renderedRequest = request.current;
    const changeReason = (value: string) => {
        if (!active.current || uiEpoch.current !== renderedUiEpoch) { return; }
        uiEpoch.current++;
        setReason(value);
    };
    const changeEraseId = (value: string) => {
        if (!active.current || uiEpoch.current !== renderedUiEpoch) { return; }
        uiEpoch.current++;
        setEraseId(value);
    };
    const confirmRights = () => {
        if (!active.current || uiEpoch.current !== renderedUiEpoch) {
            return;
        }
        uiEpoch.current++;
        setRights(!rights);
    };
    const run = async (action: () => Promise<string>) => {
        if (!active.current || running.current || readingRef.current || uiEpoch.current !== renderedUiEpoch || request.current !== renderedRequest) {
            return;
        }
        running.current = true;
        setBusy(true);
        setError(null);
        setMessage(null);
        try {
            const text = await action();
            if (!active.current) {
                return;
            }
            await load();
            if (active.current) {
                setMessage(text);
            }
        }
        catch {
            if (active.current) {
                setPosts([]);
                setStatus(null);
                clearPreview();
                setReason('');
                setError('This action could not be confirmed. Refresh and review the current submission again.');
            }
        }
        finally {
            running.current = false;
            if (active.current) {
                setBusy(false);
            }
        }
    };
    const preview = async (post: BeyondPost) => {
        if (!active.current || running.current || readingRef.current || post.status === 'removed') {
            return;
        }
        clearPreview();
        setSelected(post);
        const token = ++request.current, epoch = previewEpoch.current;
        setShownEpoch(epoch);
        setError(null);
        try {
            const results = await Promise.all(post.media.map(m => signBeyondMedia(actor, post, m.id)));
            if (!active.current || request.current !== token || previewEpoch.current !== epoch) {
                return;
            }
            setUrls(results.map(r => r.url));
            previewTimer.current = setTimeout(() => {
                if (active.current) {
                    clearPreview();
                    setError('Private preview expired. Open the current submission again.');
                }
            }, 55000);
        }
        catch {
            if (active.current && request.current === token) {
                clearPreview();
                setError('Private preview is unavailable. Refresh and check current permissions.');
            }
        }
    };
    const markLoaded = (position: number) => {
        if (active.current && previewEpoch.current === shownEpoch) {
            setLoaded(old => old.includes(position) ? old : [...old, position]);
        }
    };
    const mediaFailed = () => {
        if (active.current && previewEpoch.current === shownEpoch) {
            clearPreview();
            setError('Private media failed. Review again before approval.');
        }
    };
    const reviewed = !!selected && urls.length === selected.media.length && loaded.length === selected.media.length && rights;
    const currentReview = useRef({ post: selected, previewEpoch: shownEpoch, reviewed, rights, loadedCount: loaded.length, mediaCount: selected?.media.length ?? 0 });
    currentReview.current = { post: selected, previewEpoch: shownEpoch, reviewed, rights, loadedCount: loaded.length, mediaCount: selected?.media.length ?? 0 };
    const approveCurrent = () => {
        const current = currentReview.current;
        if (!selected || !current.post || !current.reviewed || !current.rights || current.loadedCount !== current.mediaCount || current.previewEpoch !== previewEpoch.current || current.post.id !== selected.id || current.post.revision !== selected.revision) { return; }
        const post = current.post;
        void run(async () => {
            await adminReviewBeyondPost(actor.profileId, post, 'approve', reason.trim());
            return 'Reviewed submission approved for its existing audience.';
        });
    };
    const enough = Array.from(reason.trim()).length >= 5 && Array.from(reason.trim()).length <= 240;
    const choose = (state: BeyondState) => {
        if (busy) {
            return;
        }
        setFilter(state);
        void load(state);
    };
    return <View style={{ gap: 8 }}>
  <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700' }}>Beyond the Game review</Text>
  <Text>Private submissions need rights and safety review. Approval preserves the chosen audience; it adds no athlete, payee, badge or messaging access.</Text>
  {error ? <Text accessibilityRole="alert">{error}</Text> : null}
  {message ? <Text>{message}</Text> : null}
  {status ? <Text>{`Server beyondGameEnabled: ${status.enabled ? 'on' : 'off'} · pending ${status.pending} · cleanup pending ${status.cleanupPending}${status.reason ? ` · ${status.reason}` : ''}`}</Text> : null}
  {status?.missing.length ? <Text>{`Missing dependencies: ${status.missing.join('; ')}`}</Text> : null}
  <Button label="Refresh review queue" disabled={busy || reading} onPress={() => void load()}/>
  <TextInput accessibilityLabel="Review or switch reason" placeholder="Review or switch reason" value={reason} onChangeText={changeReason} maxLength={240} style={buttonStyle}/>
  {status ? <Button label={status.enabled ? 'Switch Beyond the Game off' : 'Switch Beyond the Game on'} disabled={busy || reading || !enough || !status.enabled && status.missing.length > 0} onPress={() => void run(async () => {
        await adminSetBeyondEnabled(actor.profileId, !status.enabled, reason.trim());
        return 'Server switch updated. No content was deleted.';
    })}/> : null}
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['pending', 'held', 'approved', 'removed', 'draft'] as BeyondState[]).map(s => <Button key={s} label={`Show ${s}`} disabled={busy || reading} onPress={() => choose(s)}/>)}</View>
  {status && posts.length === 0 ? <Text>No submissions in this review page.</Text> : null}
  {posts.map(post => <View key={`${post.id}:${post.revision}`} style={{ padding: 12, borderWidth: 1, borderColor: '#ccd8d1', gap: 4 }}>
   <Text>{post.caption}</Text><Text>{`${post.category} · ${post.audience} · ${post.status} · revision ${post.revision} · ${post.reportCount ?? 'unavailable'} reports`}</Text>
   <Text>{`Rights ${post.rightsVersion} · safety ${post.safetyVersion} · attested ${post.attestedAt}`}</Text>
   {post.status !== 'removed' ? <Button label={`Preview submission ${post.id}`} disabled={busy || reading} onPress={() => void preview(post)}/> : <><Text>{`Object cleanup: ${post.cleanup}. Catalog absence is not independent provider physical-erasure evidence.`}</Text><Button label={`Clean removed files ${post.id}`} disabled={busy || reading} onPress={() => void run(async () => {
            const r = await adminBeyondCleanup(actor, post);
            return `Storage cleanup ${r.cleanup}; ${r.remaining} catalog objects remain${r.requestFailed ? '; request reported a failure' : ''}.`;
        })}/></>}
   {post.status !== 'removed' ? <Button label={`Remove submission ${post.id}`} disabled={busy || reading || !enough} onPress={() => void run(async () => {
            await adminReviewBeyondPost(actor.profileId, post, 'remove', reason.trim());
            return 'Submission removed from distribution. Physical cleanup is queued.';
        })}/> : null}
  </View>)}
  {cursor ? <Button label="Load next review page" disabled={busy || reading} onPress={() => void load(filter, cursor, true)}/> : null}
  {selected ? <View><Text>{selected.caption}</Text><Text>{`Review exact revision ${selected.revision}; audience ${selected.audience}. Inspect depicted people, location, sound, rights and safety.`}</Text>
   {urls.map((url, i) => selected.media[i].kind === 'photo' ? <Image key={`${selected.id}:${selected.revision}:${i}:${url}`} accessibilityLabel={`Private submission photo ${i + 1}`} source={{ uri: url }} style={{ width: '100%', height: 220 }} onLoad={() => markLoaded(i)} onError={mediaFailed}/> : <PrivateVideo key={`${selected.id}:${selected.revision}:${url}`} url={url} onReady={() => markLoaded(i)} onFail={mediaFailed}/>)}
   <Button label={rights ? 'Rights and safety reviewed' : 'Confirm rights and safety reviewed'} disabled={busy || reading || urls.length !== selected.media.length || loaded.length !== selected.media.length} onPress={confirmRights}/>
   {(selected.status === 'pending' || selected.status === 'held') ? <Button label="Approve reviewed submission" disabled={busy || reading || !enough || !reviewed || !status?.enabled} onPress={approveCurrent}/> : null}
   <Button label="Close private preview" onPress={clearPreview}/>
  </View> : null}
  <Button label="Expire drafts older than 24 hours" disabled={busy || reading || !enough} onPress={() => void run(async () => {
        const r = await adminBeyondRetention(actor.profileId, reason.trim());
        return `${r.ids.length} expired drafts hidden; physical cleanup remains queued.`;
    })}/>
  <TextInput accessibilityLabel="Profile for support erasure" placeholder="Canonical profile UUID" value={eraseId} onChangeText={changeEraseId} style={buttonStyle}/>
  <Button label="Erase account Beyond Game data" disabled={busy || reading || !enough || !eraseId.trim()} onPress={() => void run(async () => {
        const r = await adminEraseBeyondProfile(actor.profileId, eraseId.trim(), reason.trim());
        setEraseId('');
        return `${r.ids.length} posts de-identified and hidden${r.more ? '; repeat for the next bounded batch' : ''}. Cleanup mappings remain restricted until file removal. Exceptional support erasure resets submission quota.`;
    })}/>
  <Text>Admins may access removed Storage bytes only for cleanup until provider deletion. Downloaded bytes cannot be recalled; previews expire after one minute.</Text>
 </View>;
}
