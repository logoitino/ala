/**
 * Workout challenges on the Highlights desk (CHAL-01 part 1a, admin first). The `challenges.enabled` switch with the
 * reason it is refused while PRIV-01 / MINOR-01 are missing, desk totals, aggregate counts per workout post (responses by
 * preset and invites, never who), the nudge-abuse view (invite counts per sender, recipients as ids only) with mute /
 * suspend / clear that need a reason, retention, and erasing one person for a deletion request. Before the migration is
 * applied every read fails with the shared "not switched on" message and the panel says so.
 * @sideEffects `admin_challenge_status`, `admin_set_challenges_enabled`, `admin_challenge_post_counts`,
 *   `admin_challenge_nudge_senders`, `admin_hold_challenge_sender`, `admin_challenge_retention`, `admin_challenge_erase`
 *   through lib/challenges.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

import {
  CHALLENGE_LIMITS,
  CHALLENGE_PRESETS,
  CHALLENGE_PRESET_LABEL,
  CHALLENGE_REASON_LABEL,
  type AdminChallengePost,
  type AdminChallengeSender,
  type AdminChallengeStatus,
} from '@tapuai/shared-types/challenges';

import { AdminBtn, AdminEmpty, AdminField, AdminMetrics, AdminNotice, AdminRow, AdminSectionTitle } from '@/components/Admin/AdminChrome';
import { useAuth } from '@/context/AuthContext';
import {
  adminChallengeErase,
  adminChallengeRetention,
  adminHoldChallengeSender,
  adminSetChallengesEnabled,
  fetchAdminChallengePosts,
  fetchAdminChallengeSenders,
  fetchAdminChallengeStatus,
} from '@/lib/challenges';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

const failed = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
const day = (at: string | null) => (at ? new Date(at).toLocaleDateString() : '');
const enoughReason = (reason: string) => reason.trim().length >= 5;

/** @purpose Account-isolated Workout challenges controls on the Highlights desk. */
export function WorkoutChallengesPanel() {
  const { user, profile, isAdmin, loading } = useAuth();
  const actor = !loading && isAdmin && user?.id && profile?.id && !profile.age_blocked_at && profile.user_id === user.id
    ? JSON.stringify([user.id, profile.id]) : null;
  // A monotonic lifetime prevents A → B → A or access-loss/reentry from reviving A's old callbacks/state.
  const scope = useRef({ actor, epoch: 0 });
  if (scope.current.actor !== actor) scope.current = { actor, epoch: scope.current.epoch + 1 };
  const epoch = scope.current.epoch;
  const current = useCallback(() => actor !== null && scope.current.actor === actor && scope.current.epoch === epoch,
    [actor, epoch]);
  if (actor === null) return null;
  return <WorkoutChallengesDesk key={epoch} current={current} actorProfileId={profile?.id ?? ''} />;
}

function WorkoutChallengesDesk({ current, actorProfileId }: { current: () => boolean; actorProfileId: string }) {
  const alive = useRef(true);
  const sequence = useRef(0);
  const ready = useRef(false);
  const flight = useRef(false);
  const [readVersion, setReadVersion] = useState(0);
  const [reading, setReading] = useState(true);
  const [status, setStatus] = useState<AdminChallengeStatus | null>(null);
  const [posts, setPosts] = useState<AdminChallengePost[]>([]);
  const [senders, setSenders] = useState<AdminChallengeSender[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notApplied, setNotApplied] = useState(false);
  const [reason, setReason] = useState('');
  const [eraseId, setEraseId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'danger' } | null>(null);

  const load = useCallback(async () => {
    if (!alive.current || !current()) return;
    const request = ++sequence.current;
    const accepted = () => alive.current && current() && sequence.current === request;
    ready.current = false;
    setReading(true);
    setStatus(null); setPosts([]); setSenders([]);
    setReason(''); setEraseId('');
    setNotApplied(false); setError(null);
    try {
      const [nextStatus, nextPosts, nextSenders] = await Promise.all([
        fetchAdminChallengeStatus(actorProfileId), fetchAdminChallengePosts(30, actorProfileId), fetchAdminChallengeSenders(7, actorProfileId),
      ]);
      if (!accepted()) return;
      setStatus(nextStatus); setPosts(nextPosts); setSenders(nextSenders);
      ready.current = true;
    } catch (caught) {
      if (!accepted()) return;
      const text = failed(caught, 'Could not read workout challenges.');
      setNotApplied(text === NOT_SWITCHED_ON);
      setError(text === NOT_SWITCHED_ON ? null : text);
    } finally {
      if (accepted()) { setReadVersion(request); setReading(false); }
    }
  }, [current, actorProfileId]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; ready.current = false; sequence.current += 1; };
  }, [load]);

  const controlsCurrent = () => alive.current && current() && ready.current && sequence.current === readVersion;
  const run = async (label: string, work: () => Promise<string>, clear: { reason?: boolean; erase?: boolean } = {}) => {
    if (!controlsCurrent() || flight.current) return;
    flight.current = true;
    setBusy(label); setMessage(null);
    try {
      const text = await work();
      if (!controlsCurrent()) return;
      if (clear.reason) setReason('');
      if (clear.erase) setEraseId('');
      setMessage({ text, tone: 'ok' });
      // A committed write and a failed reload are distinct; keep the acknowledgment alongside the read error.
      await load();
    } catch (caught) {
      if (controlsCurrent()) {
        // An uncertain write must not leave an old protected snapshot or retained controls ready for another action.
        ready.current = false;
        setReadVersion(++sequence.current);
        setStatus(null); setPosts([]); setSenders([]); setReason(''); setEraseId('');
        setMessage({ text: failed(caught, 'That did not work. Refresh before trying again.'), tone: 'danger' });
      }
    } finally {
      if (alive.current && current()) { flight.current = false; setBusy(null); }
    }
  };
  const reload = () => {
    if (!alive.current || !current() || sequence.current !== readVersion || flight.current) return;
    setMessage(null);
    void load();
  };
  const flip = (turnOn: boolean) => run(turnOn ? 'on' : 'off', async () => {
    await adminSetChallengesEnabled(turnOn, reason, actorProfileId);
    return turnOn ? 'Workout challenges are on.' : 'Workout challenges are off. Nothing was deleted.';
  }, { reason: true });
  const hold = (sender: AdminChallengeSender, kind: 'mute' | 'suspend' | 'clear') => run(`${kind}-${sender.senderId}`, async () => {
    await adminHoldChallengeSender(sender.senderId, kind, reason, actorProfileId);
    const who = sender.username ?? sender.senderId;
    if (kind === 'clear') return `Invites from ${who} work normally again.`;
    return kind === 'mute' ? `Invites from ${who} are now dropped without telling them.` : `Invites from ${who} are paused; they see a message.`;
  }, { reason: true });

  const header = <>
    <AdminSectionTitle>Workout challenges</AdminSectionTitle>
    {error ? <AdminNotice tone="danger" text={error} /> : null}
    {notApplied ? <AdminNotice tone="warn" text="Workout challenges are not switched on: the database update (20261016100000_workout_challenges.sql) has not been applied." /> : null}
    {reading ? <Text>Loading workout challenges…</Text> : null}
    <AdminBtn label="Refresh workout challenges" disabled={reading || busy != null} onPress={reload} />
    <AdminNotice text={message?.text ?? null} tone={message?.tone} />
  </>;
  // Failed/missing/loading source is unavailable, not a healthy empty report or an actionable old snapshot.
  if (!status) return header;

  const missing = status?.missing ?? [];
  return (
    <>
      {header}
      {status ? (
        <>
          <Text style={{ fontSize: 13 }}>
            {`Switch challenges.enabled: ${status.live ? 'on' : status.switchedOn ? 'on, but waiting for the pieces below' : 'off'}${status.changedAt ? ` · changed ${day(status.changedAt)}${status.changeReason ? ` (${status.changeReason})` : ''}` : ''}`}
          </Text>
          {missing.length ? <AdminNotice tone="warn" text={`Can't switch on yet. Missing: ${missing.join('; ')}.`} /> : null}
          <AdminMetrics items={[
            { label: 'Responses', value: status.totals.responses },
            { label: 'People who responded', value: status.totals.responders },
            { label: 'Invites (7 days)', value: status.totals.invites7d },
            { label: 'Invites dropped (7 days)', value: status.totals.invitesDropped7d, hint: 'Muted, blocked or held senders. Senders are never told.' },
            { label: 'Challenge finisher badges', value: status.totals.badges },
            { label: 'Senders on hold', value: status.totals.sendersHeld },
            { label: 'Athletes who turned it on', value: status.totals.athletesOn },
            { label: 'Athletes who turned it off', value: status.totals.athletesOff },
          ]} />
        </>
      ) : null}
      <AdminField label="Reason (required for the switch, holds and erasing)" value={reason} onChangeText={(value) => { if (controlsCurrent() && !flight.current) setReason(value); }} autoCapitalize="sentences" />
      {status && !status.switchedOn ? (
        <AdminBtn kind="primary" label={busy === 'on' ? 'Switching on…' : 'Switch challenges on'} disabled={busy != null || missing.length > 0 || !enoughReason(reason)}
          onPress={() => { void flip(true); }} />
      ) : null}
      {status?.switchedOn ? (
        <AdminBtn kind="danger" label={busy === 'off' ? 'Switching off…' : 'Switch challenges off'} disabled={busy != null || !enoughReason(reason)}
          onPress={() => { void flip(false); }} />
      ) : null}

      <AdminSectionTitle>Workout posts</AdminSectionTitle>
      {posts.length === 0 ? <AdminEmpty text="No Train Like Me posts yet." /> : posts.map((post) => (
        <AdminRow
          key={post.reelId}
          title={`${post.title} · ${post.athleteName}`}
          meta={[
            CHALLENGE_PRESETS.map((preset) => `${CHALLENGE_PRESET_LABEL[preset]} ${post.counts[preset]}`).join(' · '),
            `Invites ${post.invites} (${post.invites7d} this week)`,
            post.eligible === false && post.reason ? `Closed: ${CHALLENGE_REASON_LABEL[post.reason]}` : '',
          ].filter(Boolean).join(' · ')}
        />
      ))}

      <AdminSectionTitle>Invites by sender (7 days)</AdminSectionTitle>
      {senders.length === 0 ? <AdminEmpty text="No invites sent this week." /> : senders.map((sender) => {
        const who = sender.username ?? sender.senderId;
        return (
          <AdminRow
            key={sender.senderId}
            title={who}
            meta={[
              `Sent ${sender.sent} · delivered ${sender.delivered} · dropped ${sender.dropped} · ${sender.recipients} people`,
              sender.mutedBy ? `Muted by ${sender.mutedBy}` : '',
              sender.hold ? `On hold: ${sender.hold === 'mute' ? 'muted' : 'suspended'}${sender.holdReason ? ` (${sender.holdReason})` : ''}` : '',
              sender.recipientIds.length ? `Recipient ids: ${sender.recipientIds.join(', ')}` : '',
            ].filter(Boolean).join(' · ')}
          >
            {sender.hold !== 'mute' ? (
              <AdminBtn label={`Mute ${who}`} disabled={busy != null || !enoughReason(reason)} onPress={() => { void hold(sender, 'mute'); }} />
            ) : null}
            {sender.hold !== 'suspend' ? (
              <AdminBtn kind="danger" label={`Suspend ${who}`} disabled={busy != null || !enoughReason(reason)} onPress={() => { void hold(sender, 'suspend'); }} />
            ) : null}
            {sender.hold ? (
              <AdminBtn label={`Clear hold on ${who}`} disabled={busy != null || !enoughReason(reason)} onPress={() => { void hold(sender, 'clear'); }} />
            ) : null}
          </AdminRow>
        );
      })}

      <AdminBtn label={busy === 'retention' ? 'Cleaning up…' : `Apply retention (invites ${CHALLENGE_LIMITS.inviteRetentionDays} days)`} disabled={busy != null}
        onPress={() => { void run('retention', async () => { const n = await adminChallengeRetention(actorProfileId); return `Removed ${n.invites} old invites and ${n.adminRecords} old admin records.`; }); }} />
      <AdminField label="Profile id to erase from challenges" value={eraseId} onChangeText={(value) => { if (controlsCurrent() && !flight.current) setEraseId(value); }} />
      <AdminBtn kind="danger" label={busy === 'erase' ? 'Erasing…' : 'Erase this person from challenges'} disabled={busy != null || !eraseId.trim() || !enoughReason(reason)}
        onPress={() => { void run('erase', async () => {
          const n = await adminChallengeErase(eraseId, reason, actorProfileId);
          return `Erased ${n.responses ?? 0} responses, ${n.invites ?? 0} invites, ${n.mutes ?? 0} mutes and ${n.badges ?? 0} badges.`;
        }, { reason: true, erase: true }); }} />
    </>
  );
}
