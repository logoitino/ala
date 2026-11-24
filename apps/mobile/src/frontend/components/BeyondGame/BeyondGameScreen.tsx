/** Actor-bound Beyond discovery/history/export uses compact sport-marked categories without changing submission/privacy guards. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BeyondCategory, BeyondPost } from '@tapuai/shared-types/beyondGame';
import { useAuth } from '@/context/AuthContext';
import { useChallenges } from '@/hooks/useChallenges';
import { fetchBeyondStatus, fetchBeyondPosts, fetchMyBeyondPosts, removeBeyondPost, reportBeyondPost, exportMyBeyondData } from '@/lib/beyondGame';
import { exportCsv } from '@/lib/csvExport';
import { CoachLevelBadge } from '@/components/Reels/CoachLevelBadge';
import { SportField } from '@/components/Effects/SportField';
import { useViewerSport } from '@/hooks/useViewerSport';
import { WORKOUT_IDEAS_LINE } from '@/lib/safetyLabels';
import { BeyondButton, BeyondGameComposer } from './BeyondGameComposer';
import { BeyondGameMedia } from './BeyondGameMedia';
import { beyondStyles as styles } from './BeyondGameStyles';
import { MoreText } from '@/components/UI/MoreText';
import { PostDescriptionEditor } from '@/components/Reels/PostDescriptionEditor';
import { saveBeyondDescription } from '@/lib/postCaptions';

const categories: { id: BeyondCategory; label: string }[] = [
  { id: 'workout', label: 'Workouts' }, { id: 'service', label: 'Service' },
  { id: 'learning', label: 'Learning & STEM' }, { id: 'story', label: 'Stories' },
];
const stateLabel = { draft: 'Reserved draft', pending: 'Waiting for review', approved: 'Approved', held: 'Hidden for review', removed: 'Removed' };
function exportRows(sections: Record<string, unknown[]>): string {
  const cell = (value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
    const safe = /^[\s\u200B-\u200F\uFEFF]*[=+@-]/u.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = ['section,record'];
  for (const [section, items] of Object.entries(sections)) for (const item of items) rows.push([section, item].map(cell).join(','));
  return rows.join('\r\n');
}

type ScreenProps = {
  active?: boolean; renderLegacy?: (category: BeyondCategory) => ReactNode;
  /** Open the composer once this account may submit (Upload ＋ → Beyond moment). */
  startComposing?: boolean; onComposeStarted?: () => void;
};
/** Private cursor/draft presentation belongs to one canonical account lifetime, including A/B/A. */
export function BeyondGameScreen(props: ScreenProps) {
  const { user, profile, loading } = useAuth();
  const actorKey = loading ? 'loading' : user && profile && profile.user_id === user.id && !profile.age_blocked_at
    ? `${user.id}:${profile.id}` : user ? `unavailable:${user.id}` : 'guest';
  const scope = useRef({ actorKey, epoch: 0 });
  if (scope.current.actorKey !== actorKey) scope.current = { actorKey, epoch: scope.current.epoch + 1 };
  return <ScopedBeyondGameScreen key={`${actorKey}:${scope.current.epoch}`} {...props} />;
}
function ScopedBeyondGameScreen({ active = true, renderLegacy, startComposing = false, onComposeStarted }: ScreenProps) {
  const { user, profile, isSessionCurrent } = useAuth();
  const [category, setCategory] = useState<BeyondCategory>('workout');
  const [compose, setCompose] = useState(false);
  const [feedBefore, setFeedBefore] = useState<string | null>(null), [ownBefore, setOwnBefore] = useState<string | null>(null);
  const read = useCallback(async (actor: string | null) => {
    const [status, feed, own] = await Promise.all([fetchBeyondStatus(actor), fetchBeyondPosts(actor, category, 30, feedBefore),
      actor ? fetchMyBeyondPosts(actor, 30, ownBefore) : Promise.resolve(null)]);
    if (status.actorId !== actor || feed.enabled !== status.enabled) throw Error('Beyond the Game returned unavailable data. Refresh before continuing.');
    return { status, feed, own };
  }, [category, feedBefore, ownBefore]);
  const model = useChallenges(`beyond:${category}:${feedBefore ?? ''}:${ownBefore ?? ''}`, active && !compose, read, true);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const actor = model.actorId && user ? { userId: user.id, profileId: model.actorId } : null;
  const sourceKey = `${model.identityKey}:${model.version}`;
  const exportState = useRef({ identity: model.identityKey, cursors: { posts: null as string | null, reports: null as string | null, quota: null as string | null }, started: false });
  if (exportState.current.identity !== model.identityKey) exportState.current = { identity: model.identityKey, cursors: { posts: null, reports: null, quota: null }, started: false };
  const snapshot = useRef({ key: model.identityKey, version: model.version, ready: model.ready });
  snapshot.current = { key: model.identityKey, version: model.version, ready: model.ready };
  const current = () => alive.current && model.identityKey !== null && snapshot.current.key === model.identityKey
    && snapshot.current.version === model.version && snapshot.current.ready && !model.busy;
  const navigationCurrent = () => alive.current && model.identityKey !== null && snapshot.current.key === model.identityKey
    && snapshot.current.version === model.version && !model.busy;
  const disabled = model.busy || model.reading || !model.ready;
  const canStart = Boolean(actor && model.ready && model.data?.status.enabled && model.data.status.canSubmit);
  // Description drafts belong to the exact rendered account, page and reviewed revision, not just a post ID.
  type EditTarget = { post: BeyondPost; source: string; epoch: number; userId: string; profileId: string; guard: () => boolean };
  const [description, setDescription] = useState<EditTarget | null>(null);
  const descriptionRef = useRef<EditTarget | null>(null);
  const descriptionFlight = useRef<EditTarget | null>(null);
  const descriptionSource = JSON.stringify([sourceKey, category, feedBefore, ownBefore, active, compose]);
  const descriptionScope = useRef({ source: descriptionSource, guard: isSessionCurrent, epoch: 0, focused: false,
    foreground: AppState.currentState === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden) });
  if (descriptionScope.current.source !== descriptionSource || descriptionScope.current.guard !== isSessionCurrent) {
    descriptionScope.current = { ...descriptionScope.current, source: descriptionSource, guard: isSessionCurrent,
      epoch: descriptionScope.current.epoch + 1 };
  }
  const invalidateDescription = useCallback(() => {
    descriptionScope.current.epoch += 1;
    descriptionRef.current = null;
    setDescription(null);
  }, []);
  useFocusEffect(useCallback(() => {
    descriptionScope.current.focused = true;
    return () => { descriptionScope.current.focused = false; invalidateDescription(); };
  }, [invalidateDescription]));
  useEffect(() => {
    const apply = (foreground: boolean) => {
      descriptionScope.current.foreground = foreground;
      if (!foreground) invalidateDescription();
    };
    const subscription = AppState.addEventListener('change', state => apply(state === 'active'
      && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden)));
    const visibility = () => apply(AppState.currentState === 'active' && !document.hidden);
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
    };
  }, [invalidateDescription]);
  const descriptionView = useRef({ model, user, profile, active, compose });
  descriptionView.current = { model, user, profile, active, compose };
  const descriptionCurrent = (target: EditTarget) => {
    const scope = descriptionScope.current, view = descriptionView.current;
    return alive.current && scope.focused && scope.foreground && view.active && !view.compose
      && scope.source === target.source && scope.epoch === target.epoch && scope.guard === target.guard && target.guard()
      && view.user?.id === target.userId && view.profile?.id === target.profileId && view.profile.user_id === target.userId
      && !view.profile.age_blocked_at && view.model.actorId === target.profileId && view.model.ready
      && !view.model.busy && !view.model.reading && view.model.data?.status.enabled === true
      && view.model.data.own?.enabled === true && target.post.creatorId === target.profileId
      && (target.post.status === 'pending' || target.post.status === 'approved')
      && view.model.data.own.posts.some(row => row === target.post);
  };
  const editTarget = (post: BeyondPost): EditTarget | null => actor && isSessionCurrent ? {
    post, source: descriptionSource, epoch: descriptionScope.current.epoch,
    userId: actor.userId, profileId: actor.profileId, guard: isSessionCurrent,
  } : null;
  const openDescription = (target: EditTarget) => {
    if (!descriptionCurrent(target)) return;
    descriptionRef.current = target;
    setDescription(target);
  };
  const closeDescription = (target: EditTarget) => {
    if (descriptionRef.current !== target) return;
    descriptionRef.current = null;
    setDescription(null);
  };
  const saveDescription = async (target: EditTarget, caption: string) => {
    const accepted = () => descriptionRef.current === target && descriptionCurrent(target);
    if (!accepted()) throw new Error('This post or your account changed. Reopen the editor.');
    if (descriptionFlight.current) throw new Error('Another description save is still finishing. Try again when it settles.');
    descriptionFlight.current = target;
    try {
      await saveBeyondDescription({ userId: target.userId, profileId: target.profileId, isCurrent: accepted }, target.post, caption);
      if (!accepted()) throw new Error('This post or your account changed. Reopen the editor.');
      closeDescription(target);
      await model.refresh();
    } finally {
      if (descriptionFlight.current === target) descriptionFlight.current = null;
    }
  };
  const visibleDescription = description && descriptionRef.current === description && descriptionCurrent(description) ? description : null;
  // Upload ＋ → Beyond moment lands here; open the composer only after the server says this account may submit.
  useEffect(() => {
    if (!startComposing || !active || compose || !canStart) return;
    setCompose(true);
    onComposeStarted?.();
  }, [active, canStart, compose, onComposeStarted, startComposing]);

  const exportData = () => {
    if (!current()) return;
    const state = exportState.current;
    void model.run(async (profileId, accepted) => {
      const sections: Record<string, unknown[]> = {};
      const next = { ...state.cursors };
      for (const section of ['posts', 'reports', 'quota'] as const) {
        if (state.started && state.cursors[section] === null) continue;
        const page = await exportMyBeyondData(profileId, section, state.cursors[section]);
        if (!accepted()) return '';
        sections[section] = page.items; next[section] = page.nextId;
      }
      if (!accepted()) return '';
      const result = await exportCsv('tapuai-beyond-data.csv', exportRows(sections));
      if (!accepted()) return '';
      if (result === 'dismissed') return 'Export sharing dismissed.';
      exportState.current = { identity: model.identityKey, cursors: next, started: Object.values(next).some(Boolean) };
      return Object.values(next).some(Boolean)
        ? 'Data pages exported. Continue for older records.' : 'Current data pages exported. Saved copies are private and cannot be recalled.';
    });
  };
  const remove = (post: BeyondPost) => {
    void model.run(async (profileId) => {
      const removed = await removeBeyondPost(profileId, post.id);
      return removed.cleanup === 'complete' ? 'Post hidden. Storage cleanup is recorded complete; provider deletion still needs verification.'
        : 'Post hidden. File cleanup is queued; physical deletion is not confirmed.';
    });
  };
  const card = (post: BeyondPost, own: boolean) => <View key={`${post.id}:${post.revision}`} style={styles.card}>
    <Text style={styles.kicker}>{categories.find(c => c.id === post.category)?.label}</Text>
    <Text style={styles.body}>{post.caption || 'A shared moment'}</Text>
    {post.coachLevel ? <CoachLevelBadge /> : null}
    {own ? <><Text style={styles.hint}>{stateLabel[post.status]} · {post.audience === 'friends' ? 'Friends' : 'Everyone'}</Text>
      {post.reviewReason ? <Text style={styles.hint}>Review note: {post.reviewReason}</Text> : null}
      {post.cleanup !== 'not_requested' ? <Text style={styles.hint}>{post.cleanup === 'complete' ? 'Cleanup recorded complete; provider deletion not independently verified.' : 'File cleanup pending.'}</Text> : null}
      {(() => {
        const target = editTarget(post);
        return target && descriptionCurrent(target) ? <BeyondButton variant="quiet" label="Edit description"
          disabled={disabled} onPress={() => openDescription(target)} /> : null;
      })()}
      {post.status !== 'removed' ? <BeyondButton variant="danger" label="Remove my post" disabled={disabled} onPress={() => remove(post)} /> : null}</> : null}
    {post.status !== 'removed' ? <BeyondGameMedia key={sourceKey} actor={actor} post={post} active={active && model.ready && !compose} scopeKey={sourceKey} /> : null}
    {!own && actor ? <BeyondButton variant="quiet" label="Report unsafe content" disabled={disabled}
      onPress={() => void model.run(async profileId => { await reportBeyondPost(profileId, post.id, 'Unsafe content concern'); return 'Concern received. This post is hidden for staff review.'; })} /> : null}
  </View>;
  const viewerSport = useViewerSport();
  const continuing = exportState.current.started && Object.values(exportState.current.cursors).some(Boolean);
  const categoryIcons = { workout: 'barbell-outline', service: 'heart-outline', learning: 'school-outline', story: 'book-outline' } as const;
  return <><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
    <View style={styles.header}>
      {/* UX-08: the same fading field band as every tab heading (viewer's sport, generic for fans). */}
      <View pointerEvents="none" style={styles.headerField}><SportField sport={viewerSport} fade="left" labels={false} opacity={0.11} /></View>
      <Text accessibilityRole="header" style={styles.title}>Beyond the Game</Text>
      <MoreText style={styles.hint} lines={1}>{'Share effort, kindness, learning and everyday stories. Highlights remains the game showcase.'}</MoreText>
    </View>
    <View style={styles.filters}>{categories.map(item => <BeyondButton variant="chip" key={item.id} label={item.label} icon={categoryIcons[item.id]} selected={category === item.id} disabled={model.busy || compose}
      onPress={() => { if (navigationCurrent() && !compose) { setCategory(item.id); setFeedBefore(null); } }} />)}</View>
    {category === 'workout' ? <Text style={styles.hint}>{WORKOUT_IDEAS_LINE}</Text> : null}
    {!compose && active ? renderLegacy?.(category) : null}
    <BeyondGameComposer visible={compose} active={active} category={category} onBack={() => setCompose(false)}
      onSubmitted={() => { setCompose(false); setOwnBefore(null); }} />
    {!compose ? <>
      {model.reading ? <Text style={styles.hint}>Loading Beyond the Game…</Text> : null}
      {model.error ? <Text selectable accessibilityRole="alert" style={styles.error}>{model.error}</Text> : null}
      {model.notice ? <Text selectable accessibilityLiveRegion="polite" style={styles.notice}>{model.notice}</Text> : null}
      {model.canRead ? <BeyondButton label="Refresh Beyond the Game" disabled={model.busy || model.reading} onPress={() => void model.refresh()} /> : null}
      {model.data ? <>
        {!model.data.status.enabled ? <View style={styles.note}><Text style={styles.body}>New contributions and shared posts are paused. Your own history, removal and export remain available.</Text></View> : null}
        {actor && model.data.status.enabled && model.data.status.canSubmit ? <BeyondButton variant="primary" label="Share a moment" disabled={disabled} onPress={() => { if (current()) setCompose(true); }} /> : null}
        <Text accessibilityRole="header" style={styles.heading}>Shared moments</Text>
        {model.data.status.enabled ? model.data.feed.posts.map(post => card(post, false)) : null}
        {model.data.status.enabled && !model.data.feed.posts.length ? <View style={styles.note}><Text style={styles.hint}>No approved shared posts in this category page.</Text></View> : null}
        {model.data.status.enabled && model.data.feed.nextId ? <BeyondButton label="Older shared posts" disabled={disabled} onPress={() => { if (current()) setFeedBefore(model.data!.feed.nextId); }} /> : null}
        {feedBefore ? <BeyondButton label="Latest shared posts" disabled={disabled} onPress={() => { if (current()) setFeedBefore(null); }} /> : null}
        {actor && model.data.own ? <>
          <Text accessibilityRole="header" style={styles.heading}>My posts</Text>
          {model.data.own.posts.map(post => card(post, true))}
          {!model.data.own.posts.length ? <Text style={styles.hint}>No posts in your current history page.</Text> : null}
          {model.data.own.nextId ? <BeyondButton label="Older my posts" disabled={disabled} onPress={() => { if (current()) setOwnBefore(model.data!.own!.nextId); }} /> : null}
          {ownBefore ? <BeyondButton label="Latest my posts" disabled={disabled} onPress={() => { if (current()) setOwnBefore(null); }} /> : null}
          <View style={styles.card}>
          <Text style={styles.hint}>Export includes private post, report and quota records with account links. Each click exports up to 50 records per section; continue if older pages remain.</Text>
          <BeyondButton label={continuing ? 'Export next data pages' : 'Export my Beyond data'} disabled={disabled} onPress={exportData} />
          </View>
        </> : null}
      </> : null}
    </> : null}
  </ScrollView>
    {visibleDescription ? <PostDescriptionEditor key={`${visibleDescription.source}:${visibleDescription.epoch}:${visibleDescription.post.id}:${visibleDescription.post.revision}`}
      initialCaption={visibleDescription.post.caption} maxLength={240}
      note="Changes go back for review before others can see them."
      onClose={() => closeDescription(visibleDescription)} onSave={caption => saveDescription(visibleDescription, caption)} /> : null}
  </>;
}
