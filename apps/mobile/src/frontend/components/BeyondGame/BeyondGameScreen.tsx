/** BEYOND-01 actor-bound discovery/history/export with UX-06 token-based browsing hierarchy. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { BeyondCategory, BeyondPost } from '@tapuai/shared-types/beyondGame';
import { useAuth } from '@/context/AuthContext';
import { useChallenges } from '@/hooks/useChallenges';
import { fetchBeyondStatus, fetchBeyondPosts, fetchMyBeyondPosts, removeBeyondPost, reportBeyondPost, exportMyBeyondData } from '@/lib/beyondGame';
import { exportCsv } from '@/lib/csvExport';
import { BeyondButton, BeyondGameComposer } from './BeyondGameComposer';
import { BeyondGameMedia } from './BeyondGameMedia';
import { beyondStyles as styles } from './BeyondGameStyles';

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
  const { user } = useAuth();
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
    {own ? <><Text style={styles.hint}>{stateLabel[post.status]} · {post.audience === 'friends' ? 'Friends' : 'Everyone'}</Text>
      {post.reviewReason ? <Text style={styles.hint}>Review note: {post.reviewReason}</Text> : null}
      {post.cleanup !== 'not_requested' ? <Text style={styles.hint}>{post.cleanup === 'complete' ? 'Cleanup recorded complete; provider deletion not independently verified.' : 'File cleanup pending.'}</Text> : null}
      {post.status !== 'removed' ? <BeyondButton variant="danger" label="Remove my post" disabled={disabled} onPress={() => remove(post)} /> : null}</> : null}
    {post.status !== 'removed' ? <BeyondGameMedia key={sourceKey} actor={actor} post={post} active={active && model.ready && !compose} scopeKey={sourceKey} /> : null}
    {!own && actor ? <BeyondButton variant="quiet" label="Report unsafe content" disabled={disabled}
      onPress={() => void model.run(async profileId => { await reportBeyondPost(profileId, post.id, 'Unsafe content concern'); return 'Concern received. This post is hidden for staff review.'; })} /> : null}
  </View>;
  const continuing = exportState.current.started && Object.values(exportState.current.cursors).some(Boolean);
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Beyond the Game</Text>
      <Text style={styles.hint}>Share effort, kindness, learning and everyday stories. Highlights remains the game showcase.</Text>
    </View>
    <View style={styles.filters}>{categories.map(item => <BeyondButton variant="chip" key={item.id} label={item.label} selected={category === item.id} disabled={model.busy || compose}
      onPress={() => { if (navigationCurrent() && !compose) { setCategory(item.id); setFeedBefore(null); } }} />)}</View>
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
  </ScrollView>;
}
