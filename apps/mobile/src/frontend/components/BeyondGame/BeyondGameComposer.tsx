/** BEYOND-01 draft/upload flow; UX-06 groups presentation without changing consent or retry lifetimes. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { BeyondCategory, BeyondPost, BeyondReserveInput } from '@tapuai/shared-types/beyondGame';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useChallenges } from '@/hooks/useChallenges';
import { fetchBeyondStatus, reserveBeyondPost, uploadReservedBeyondMedia, finalizeBeyondPost, removeBeyondPost } from '@/lib/beyondGame';
import { COACH_LEVEL_SWITCH, setOwnCoachLabel } from '@/lib/safetyLabels';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { prepareBeyondPhoto, prepareBeyondVideo, type PreparedBeyondMedia } from '@/services/BeyondGameMediaService';
import { colors } from '@/constants/theme';
import { beyondStyles as styles } from './BeyondGameStyles';

export function BeyondButton({ label, onPress, disabled = false, selected = false, variant = 'secondary', icon }: {
  label: string; onPress: () => void; disabled?: boolean; selected?: boolean;
  variant?: 'secondary' | 'primary' | 'quiet' | 'danger' | 'choice' | 'chip';
  /** Decorative category mark leaves the visible text and accessible action name intact. */
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button,
      variant === 'primary' && styles.primary, variant === 'quiet' && styles.quiet,
      variant === 'chip' && styles.chip, selected && (variant === 'chip' ? styles.chipSelected : styles.selected),
      pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
    {variant === 'choice' ? <Ionicons accessible={false} name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? colors.primary : colors.textMuted} /> : null}
    {icon ? <Ionicons accessible={false} name={icon} size={16} color={(selected && variant === 'chip') || variant === 'primary' ? colors.onAccent : colors.primary} /> : null}
    <Text style={[styles.buttonLabel, selected && styles.selectedLabel,
      (variant === 'primary' || (variant === 'chip' && selected)) && styles.primaryLabel,
      variant === 'quiet' && styles.quietLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
  </Pressable>;
}

/** Only a selected local JPEG data URL is normalized. No remote fetch or unbounded base64 decode. */
export async function normalizePickedJpeg(uri: string): Promise<{ uri: string; release: () => void }> {
  if (/^(file:|content:|ph:|blob:)/.test(uri)) return { uri, release: () => undefined };
  const prefix = 'data:image/jpeg;base64,';
  if (!uri.startsWith(prefix)) throw Error('Choose a local JPEG photo. Remote URLs and other data formats are not accepted.');
  const encoded = uri.slice(prefix.length);
  if (!encoded.length || encoded.length > 6990508) throw Error('This JPEG is empty or too large.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw Error('This JPEG selection could not be read.');
  const decoded = atob(encoded);
  if (decoded.length > 5242880) throw Error('This JPEG is too large.');
  const bytes = Uint8Array.from(decoded, ch => ch.charCodeAt(0));
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) throw Error('Choose a valid JPEG photo.');
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  return { uri: url, release: () => URL.revokeObjectURL(url) };
}

type FrozenDraft = { details: Omit<BeyondReserveInput, 'media'>; files: PreparedBeyondMedia[]; reserved: BeyondPost | null };
const rightsLabel = 'I have permission for the people, filming, music and marks in this post.';
const safetyLabel = 'This post is safe to share and reveals no private locations or vulnerable people.';

/** Back retains an unsubmitted draft while the screen stays mounted; identity loss clears it. */
export function BeyondGameComposer(props: {
  visible: boolean; active?: boolean; category: BeyondCategory; onBack: () => void; onSubmitted: () => void;
}) {
  const { user, profile, loading } = useAuth();
  const actor = !loading && user && profile && profile.user_id === user.id && !profile.age_blocked_at
    ? `${user.id}:${profile.id}` : null;
  const generation = useRef({ actor, epoch: 0 });
  if (generation.current.actor !== actor) generation.current = { actor, epoch: generation.current.epoch + 1 };
  return actor ? <ScopedComposer key={`${actor}:${generation.current.epoch}`} {...props} />
    : props.visible ? <Text>Use a current eligible account to prepare a contribution.</Text> : null;
}
function ScopedComposer({ visible, active = true, category, onBack, onSubmitted }: {
  visible: boolean; active?: boolean; category: BeyondCategory; onBack: () => void; onSubmitted: () => void;
}) {
  const { user, profile, loading } = useAuth();
  const actorKey = !loading && user && profile && profile.user_id === user.id && !profile.age_blocked_at
    ? `${user.id}:${profile.id}` : null;
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'friends' | 'everyone'>('friends');
  const [rights, setRights] = useState(false), [safety, setSafety] = useState(false);
  const [coachMove, setCoachMove] = useState(false);
  const { live } = useAppRuntime();
  const [files, setFiles] = useState<PreparedBeyondMedia[]>([]);
  const [frozen, setFrozen] = useState<FrozenDraft | null>(null);
  const frozenRef = useRef<FrozenDraft | null>(null);
  const read = useCallback((actor: string | null) => fetchBeyondStatus(actor), []);
  const model = useChallenges('beyond:composer', visible && active, read);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const identity = useRef(actorKey);
  if (identity.current !== actorKey) {
    identity.current = actorKey;
    frozenRef.current = null;
  }
  useEffect(() => {
    setCaption(''); setAudience('friends'); setRights(false); setSafety(false); setFiles([]); setFrozen(null);
  }, [actorKey]);
  useEffect(() => { if (model.data?.friendsOnly && !frozenRef.current) setAudience('friends'); }, [model.data?.friendsOnly]);
  const frame = useRef({ key: model.identityKey, version: model.version, ready: model.ready });
  frame.current = { key: model.identityKey, version: model.version, ready: model.ready };
  const current = () => alive.current && model.identityKey !== null && frame.current.key === model.identityKey
    && frame.current.version === model.version && frame.current.ready && !model.busy;
  const locked = frozen !== null || model.busy || model.reading || !model.ready;
  const canSubmit = !!model.data?.enabled && !!model.data?.canSubmit && model.data.actorId === profile?.id;

  const choose = (kind: 'photo' | 'video') => {
    if (!current() || frozenRef.current || !canSubmit) return;
    void model.run(async (_actor, accepted) => {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!accepted()) return '';
        if (!permission.granted) throw Error('Allow access to selected photos or videos to choose a file.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
        allowsMultipleSelection: kind === 'photo', selectionLimit: kind === 'photo' ? 3 : 1, quality: 1, exif: false });
      if (!accepted() || result.canceled) return '';
      if (!result.assets.length || result.assets.length > (kind === 'photo' ? 3 : 1)) throw Error('Choose up to three JPEG photos or one video.');
      const prepared: PreparedBeyondMedia[] = [];
      for (const asset of result.assets) {
        if (!accepted()) return '';
        const id = randomUUID();
        if (kind === 'photo') {
          const local = await normalizePickedJpeg(asset.uri);
          try {
            if (!accepted()) return '';
            prepared.push(await prepareBeyondPhoto(id, local.uri));
          } finally { local.release(); }
        } else {
          try {
            prepared.push(await prepareBeyondVideo({ id, uri: asset.uri, durationMs: asset.duration ?? 0 }));
          } catch (caught) {
            if (caught instanceof Error && /development build|installed compressor/i.test(caught.message))
              throw Error('Video preparation is unavailable here. Choose JPEG photos instead.');
            throw caught;
          }
        }
        if (!accepted()) return '';
      }
      setFiles(prepared);
      setRights(false); setSafety(false);
      return kind === 'photo' ? 'Photos prepared.' : 'Video prepared.';
    });
  };

  const submit = () => {
    if (!current() || !canSubmit) return;
    if (!frozenRef.current && (!files.length || !rights || !safety || Array.from(caption).length > 240)) return;
    const draft = frozenRef.current ?? { details: { requestId: randomUUID(), category, caption, audience }, files, reserved: null };
    frozenRef.current = draft; setFrozen(draft);
    const userId = user!.id;
    void model.run(async (actor, accepted) => {
      const post = await reserveBeyondPost(actor, { ...draft.details, media: draft.files.map(file => file.input) });
      if (!accepted()) return '';
      let labelNote = '';
      if (category === 'workout' && coachMove && live.layouts.coachLevel !== false && post.status === 'draft' && post.coachLevel !== true) {
        try { await setOwnCoachLabel('beyond_post', post.id); }
        catch (caught) {
          const message = caught instanceof Error ? caught.message : '';
          if (message !== NOT_SWITCHED_ON) throw caught;
          labelNote = ' The coach-level label is not on this database yet.';
        }
      }
      draft.reserved = post; setFrozen({ ...draft });
      if (post.status === 'removed') throw Error('This submission was removed. Check your history before starting another.');
      if (post.status === 'draft') {
        for (const file of draft.files) {
          if (!accepted()) return '';
          await uploadReservedBeyondMedia({ userId, profileId: actor }, post, file.input.id, file.bytes);
          if (!accepted()) return '';
        }
        await finalizeBeyondPost(actor, post.id);
        if (!accepted()) return '';
      }
      frozenRef.current = null; setFrozen(null); setFiles([]); setCaption(''); setRights(false); setSafety(false);
      onSubmitted();
      return `Submitted for review. This is not a publication approval.${labelNote}`;
    });
  };
  const cancel = () => {
    const reserved = frozenRef.current?.reserved;
    if (!current() || !reserved) return;
    void model.run(async (actor, accepted) => {
      await removeBeyondPost(actor, reserved.id);
      if (!accepted()) return '';
      frozenRef.current = null; setFrozen(null); setFiles([]); setRights(false); setSafety(false);
      return 'Reserved submission removed. File cleanup is queued; physical deletion is not confirmed.';
    });
  };
  if (!visible) return null;
  return <View style={styles.section}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.heading}>Share a moment</Text>
      <Text style={styles.body}>Workouts, service, learning and stories. No athlete tag or fundraising recipient is needed.</Text>
    </View>
    <BeyondButton variant="quiet" label="Back to Beyond the Game" onPress={() => { if (alive.current && model.identityKey !== null && frame.current.key === model.identityKey && frame.current.version === model.version && !model.busy) onBack(); }} />
    <Text style={styles.hint}>Back keeps your draft in this screen's memory. Draft files are not saved for a future app session and are discarded when this screen is unloaded or the account changes.</Text>
    {model.reading ? <Text style={styles.hint}>Checking contribution access…</Text> : null}
    {model.error ? <Text selectable accessibilityRole="alert" style={styles.error}>{model.error}</Text> : null}
    {model.notice ? <Text selectable accessibilityLiveRegion="polite" style={styles.notice}>{model.notice}</Text> : null}
    <BeyondButton variant="quiet" label="Refresh contribution access" disabled={!model.canRead || model.busy || model.reading} onPress={() => void model.refresh()} />
    {model.data && !canSubmit ? <Text style={styles.hint}>New contributions are paused or unavailable on this account. Your history and removal options remain in Beyond the Game.</Text> : null}
    <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Your moment</Text>
    <TextInput accessibilityLabel="Caption" value={actorKey ? caption : ''} multiline editable={!locked && canSubmit}
      maxLength={480} onChangeText={text => { if (current() && !frozenRef.current && Array.from(text).length <= 240) setCaption(text); }}
      placeholder="What would you like to share?" placeholderTextColor={colors.textMuted} style={styles.input} />
    <Text style={styles.count}>{Array.from(caption).length}/240 characters</Text>
    <BeyondButton label="Choose JPEG photos" disabled={locked || !canSubmit} onPress={() => choose('photo')} />
    <BeyondButton label="Choose one video (45 seconds max)" disabled={locked || !canSubmit} onPress={() => choose('video')} />
    <Text style={styles.hint}>{files.length ? `${files.length} prepared ${files[0].input.kind === 'video' ? 'video' : 'photo(s)'}` : 'No files prepared.'}</Text>
    <Text style={styles.hint}>Video preparation may be unavailable in this build. JPEG photos remain an option.</Text>
    </View>
    <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Who can see it</Text>
    <BeyondButton variant="choice" label="Friends" selected={audience === 'friends'} disabled={locked} onPress={() => { if (current() && !frozenRef.current) setAudience('friends'); }} />
    {model.data && !model.data.friendsOnly ? <BeyondButton variant="choice" label="Everyone" selected={audience === 'everyone'} disabled={locked}
      onPress={() => { if (current() && !frozenRef.current) setAudience('everyone'); }} /> : null}
    <Text style={styles.hint}>Friends is the default. Teen and unknown-age accounts stay friends-only. Every submission needs staff review before sharing.</Text>
    </View>
    <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Before you submit</Text>
    <BeyondButton variant="choice" label={rightsLabel} selected={rights} disabled={locked} onPress={() => { if (current() && !frozenRef.current) setRights(!rights); }} />
    <BeyondButton variant="choice" label={safetyLabel} selected={safety} disabled={locked} onPress={() => { if (current() && !frozenRef.current) setSafety(!safety); }} />
    {category === 'workout' && live.layouts.coachLevel !== false ? <BeyondButton variant="choice" label={COACH_LEVEL_SWITCH} selected={coachMove} disabled={locked} onPress={() => { if (current() && !frozenRef.current) setCoachMove(!coachMove); }} /> : null}
    <Text style={styles.hint}>Post your own contribution. Service is voluntary; protect beneficiaries and avoid dangerous workout instructions, private addresses and real-time whereabouts.</Text>
    </View>
    {frozen ? <View style={styles.note}>
      <Text style={styles.body}>The request, prepared files and details are frozen for safe retry. A lost reply does not prove that nothing was saved.</Text>
      <Text style={styles.hint}>Frozen audience: {frozen.details.audience === 'friends' ? 'Friends' : 'Everyone'}. Current account rules still apply to retry.</Text>
      <Text style={styles.hint}>Frozen category: {({ workout: 'Workouts', service: 'Service', learning: 'Learning & STEM', story: 'Stories' })[frozen.details.category]}.</Text>
    </View> : null}
    <BeyondButton variant="primary" label={frozen ? 'Retry same submission' : 'Submit for review'}
      disabled={!canSubmit || model.busy || model.reading || !model.ready || (!frozen && (!files.length || !rights || !safety))} onPress={submit} />
    {frozen?.reserved ? <BeyondButton variant="danger" label="Cancel reserved submission" disabled={!model.ready || model.busy || model.reading} onPress={cancel} /> : null}
  </View>;
}
