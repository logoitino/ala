/**
 * UX-14: capture each invitation code, bind reads/actions to their initiating guardian, and keep failure retry reachable. UX-13 readable controls preserve all consent, money and operator actions.
 * Parent or guardian supervision (MINOR-01), in Parent HQ and from Profile → Privacy for any adult. Link a teen with the
 * code they share (then sign the consent; the link counts once the teen confirms), see each linked teen's summary
 * (the same one the teen sees), approve or decline an under-16's request, change permissions, withdraw consent or
 * unlink. The guardian on record for an athlete can sign without a code. Replaces the PRIV-01 guardian lock: a guardian
 * cannot change the teen's settings. Shows nothing on databases without the minor-accounts update.
 * @sideEffects `guardian_list_minors`, `preview_guardian_invite`, `accept_guardian_invite`, `sign_guardian_consent`,
 *   `revoke_guardian_consent`, `guardian_get_supervision`, `guardian_decide_approval`, `end_guardian_link` via lib/minors.
 * QUIZ-05: an under-16's fun facts wait here for the guardian with the prompt and the answer, and only Approve or
 * Decline (a guardian never writes, edits or withdraws a fun fact). The list is hidden on servers without QUIZ-05.
 * @sideEffects `guardian_list_minors`, `preview_guardian_invite`, `accept_guardian_invite`, `sign_guardian_consent`,
 *   `revoke_guardian_consent`, `guardian_get_supervision`, `guardian_decide_approval`, `end_guardian_link` via lib/minors;
 *   `quiz_fact_guardian_pending` / `quiz_fact_guardian_decide` via lib/freshQuestions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { GuardianConsentForm } from '@/components/Custodial/GuardianConsentForm';
import { SupervisionSummary } from '@/components/Custodial/SupervisionSummary';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useOptionalAuth } from '@/context/AuthContext';
import { assertCurrent, createOfflineActorClient, type OfflineActor, type OfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { decideGuardianFunFact, fetchGuardianFunFacts, type GuardianFunFacts } from '@/lib/freshQuestions';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import {
  APPROVAL_LABEL,
  BAND_LABEL,
  acceptGuardianInvite,
  decideApproval,
  endGuardianLink,
  fetchGuardianMinors,
  fetchGuardianSupervision,
  previewGuardianInvite,
  revokeGuardianConsent,
  signGuardianConsent,
  type ConsentInput,
  type GuardianMinorRow,
  type Supervision,
} from '@/lib/minors';
import { TYPE, figtree } from '@/theme/fonts';

const message = (caught: unknown) => (caught instanceof Error ? caught.message : 'That did not work.');
type PendingFunFact = GuardianFunFacts['facts'][number];
/** Server refusals for a fun-fact decision, in plain words. */
function funFactRefusal(caught: unknown): string {
  const text = message(caught);
  if (text.includes('quiz_fact_already_decided')) return 'This fun fact was already decided or withdrawn.';
  if (text.includes('quiz_fact_guardian_only')) return 'Only a linked parent or guardian can decide this.';
  if (text.includes('quiz_identity_changed')) return 'Your account changed. Close this and try again.';
  return 'That did not work. Try again.';
}

function consentLine(row: GuardianMinorRow): string {
  if (!row.myConsent) return 'No consent signed yet.';
  const allowed = [row.myConsent.allowsPublicProfile ? 'public profile' : null, row.myConsent.allowsDonations ? 'payouts' : null].filter(Boolean);
  return allowed.length ? `You allowed: ${allowed.join(', ')}.` : 'Signed, with nothing extra allowed.';
}

/** @purpose One teen: status line, then (when linked) the summary, requests and consent actions. */
function MinorCard({ row, onChanged, funFacts = [], guardianProfileId = null, onFunFactsChanged, captureActor }: {
  captureActor: () => OfflineActor;
  row: GuardianMinorRow;
  onChanged: () => void;
  funFacts?: PendingFunFact[];
  guardianProfileId?: string | null;
  onFunFactsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Supervision | null>(null);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mounted = useRef(true);
  const rowLifetime = useRef(`${row.profileId}:${row.linkId}:${row.linkStatus}`);
  const target = `${row.profileId}:${row.linkId}:${row.linkStatus}`;
  rowLifetime.current = target;
  const flight = useRef(false);
  const readRevision = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const capture = useCallback((): OfflineActor => {
    const actor = captureActor();
    return { userId: actor.userId, isCurrent: () => mounted.current && rowLifetime.current === target && actor.isCurrent() };
  }, [captureActor, target]);
  const load = useCallback(async () => {
    const revision = ++readRevision.current;
    let actor: OfflineActor | undefined;
    setLoading(true); setLoadError(null);
    try {
      actor = capture();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const result = await fetchGuardianSupervision(row.profileId, client); assertCurrent(actor);
      if (revision === readRevision.current) setData(result);
    } catch (caught) {
      if (mounted.current && (!actor || actor.isCurrent()) && revision === readRevision.current) setLoadError(message(caught));
    } finally {
      if (mounted.current && (!actor || actor.isCurrent()) && revision === readRevision.current) setLoading(false);
    }
  }, [capture, row.profileId]);
  useEffect(() => {
    if (open && row.linkStatus === 'linked') void load();
    return () => { readRevision.current += 1; };
  }, [open, row.linkStatus, load]);

  const act = async (work: (client: OfflineActorClient) => Promise<unknown>, done?: string, accepted?: () => void,
    refused: (caught: unknown) => string = message) => {
    if (flight.current) return;
    flight.current = true; setBusy(true); setNote(null);
    let actor: OfflineActor | undefined;
    try {
      actor = capture();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const result = await work(client); assertCurrent(actor);
      if (result && typeof result === 'object' && 'settings' in result) setData(result as Supervision);
      accepted?.();
      if (done) setNote(done);
      onChanged();
    } catch (caught) {
      if (mounted.current && (!actor || actor.isCurrent())) setNote(refused(caught));
    } finally {
      flight.current = false;
      if (mounted.current && (!actor || actor.isCurrent())) setBusy(false);
    }
  };

  const sign = (consent: ConsentInput) => act(client => signGuardianConsent(row.profileId, consent, client),
    'Consent signed.', () => setSigning(false));

  // Approve or decline only; the reply is the fact's next step, so the list reloads from the server.
  const decideFunFact = async (fact: PendingFunFact, approve: boolean) => {
    if (flight.current || !guardianProfileId) return;
    await act(client => decideGuardianFunFact(fact.fact_id, approve, guardianProfileId, client),
      approve ? `Approved ${row.firstName}'s fun fact. An admin checks it next.` : `Declined ${row.firstName}'s fun fact.`,
      onFunFactsChanged, caught => { onFunFactsChanged?.(); return funFactRefusal(caught); });
  };

  const unlink = () => {
    if (!row.linkId) return;
    Alert.alert(`Unlink from ${row.firstName}?`, 'Your consent ends with the link. A public profile goes private and payouts wait.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: () => void act(client => endGuardianLink(row.linkId as string, client), 'Unlinked.') },
    ]);
  };

  return (
    <View style={styles.minor}>
      <Pressable style={styles.summaryHit} accessibilityRole="button" accessibilityLabel={`${row.firstName}, ${row.linkStatus === 'linked' ? 'show summary' : 'status'}`} haptic="selection" disabled={busy} onPress={() => { if (!flight.current) setOpen(!open); }}>
        <Text style={styles.name}>{`${row.firstName}${row.username ? ` · @${row.username}` : ''}`}</Text>
        <Text style={styles.muted}>
          {row.linkStatus === 'waiting_for_teen'
            ? `Waiting for ${row.firstName} to confirm you as their parent or guardian.`
            : row.linkStatus === 'not_linked'
              ? `You are the guardian on record. Sign the consent to link with ${row.firstName}.`
              : `${BAND_LABEL[row.ageBand]} · ${row.accountPrivate ? 'private' : 'public'} · ${consentLine(row)}${row.pendingApprovals ? ` · ${row.pendingApprovals} request${row.pendingApprovals === 1 ? '' : 's'} for you` : ''}`}
        </Text>
      </Pressable>
      {row.linkStatus === 'not_linked' && !signing ? (
        <AnimatedButton accessibilityLabel={`Sign the consent for ${row.firstName}`} haptic="selection" onPress={() => setSigning(true)} contentStyle={styles.action}>
          <Text style={styles.actionLabel}>Sign the consent</Text>
        </AnimatedButton>
      ) : null}
      {open && row.linkStatus === 'linked' && loading ? <Text style={styles.muted}>Loading summary…</Text> : null}
      {open && row.linkStatus === 'linked' && loadError ? <View style={styles.detail}>
        <Text accessibilityRole="alert" style={styles.note}>{loadError}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retry summary for ${row.firstName}`} disabled={loading || busy} onPress={() => void load()} style={styles.chip}><Text style={styles.chipLabel}>Retry summary</Text></Pressable>
      </View> : null}
      {open && row.linkStatus === 'linked' && data ? (
        <View style={styles.detail}>
          <SupervisionSummary data={data} />
          {(data.status?.pendingApprovals ?? []).map((request) => (
            <View key={request.id} style={styles.request}>
              <Text style={styles.name}>{`${row.firstName} asked: ${APPROVAL_LABEL[request.changeKey]}`}</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Approve: ${APPROVAL_LABEL[request.changeKey]}`} disabled={busy} haptic="selection" onPress={() => void act(client => decideApproval(request.id, true, client), 'Approved.')} style={[styles.chip, styles.chipOn]}>
                  <Text style={[styles.chipLabel, styles.chipLabelOn]}>Approve</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Decline: ${APPROVAL_LABEL[request.changeKey]}`} disabled={busy} haptic="selection" onPress={() => void act(client => decideApproval(request.id, false, client), 'Declined.')} style={styles.chip}>
                  <Text style={styles.chipLabel}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {funFacts.map((fact) => (
            <View key={fact.fact_id} style={styles.request}>
              <Text accessibilityRole="header" style={styles.name}>{`${row.firstName} wants to share a fun fact`}</Text>
              <Text style={styles.factPrompt}>{fact.label}</Text>
              <Text style={styles.factAnswer}>{fact.answer_text}</Text>
              <Text style={styles.muted}>{`Approve or decline. An admin checks it after you, and only people ${row.firstName}'s privacy settings allow will see it.`}</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Approve fun fact: ${fact.label}`} disabled={busy} haptic="selection" onPress={() => void decideFunFact(fact, true)} style={[styles.chip, styles.chipOn]}>
                  <Text style={[styles.chipLabel, styles.chipLabelOn]}>Approve</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Decline fun fact: ${fact.label}`} disabled={busy} haptic="selection" onPress={() => void decideFunFact(fact, false)} style={styles.chip}>
                  <Text style={styles.chipLabel}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change permissions" disabled={busy} haptic="selection" onPress={() => setSigning(true)} style={styles.chip}>
              <Text style={styles.chipLabel}>Change permissions</Text>
            </Pressable>
            {row.myConsent ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Withdraw consent" disabled={busy} haptic="selection" onPress={() => void act(client => revokeGuardianConsent(row.profileId, client), 'Consent withdrawn.')} style={styles.chip}>
                <Text style={styles.chipLabel}>Withdraw consent</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Unlink from ${row.firstName}`} disabled={busy} haptic="selection" onPress={unlink} style={styles.chip}>
              <Text style={styles.chipLabel}>Unlink</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {signing ? (
        <GuardianConsentForm
          teenFirstName={row.firstName}
          identityKey={row.profileId}
          canAllowDonations={row.canAllowDonations}
          initial={row.myConsent ?? undefined}
          busy={busy}
          onSign={sign}
          onCancel={() => { if (!flight.current) setSigning(false); }}
        />
      ) : null}
      {note ? <Text style={styles.note} accessibilityRole="alert">{note}</Text> : null}
    </View>
  );
}

/** @purpose The whole guardian area: teens you supervise and "Link a teen". */
export function GuardianSupervisionPanel() {
  const auth = useOptionalAuth();
  const ownerId = auth?.user?.id ?? null;
  const sessionCurrent = auth?.isSessionCurrent;
  const lifetime = useRef({ ownerId, sessionCurrent, epoch: 0 });
  if (lifetime.current.ownerId !== ownerId || lifetime.current.sessionCurrent !== sessionCurrent) {
    lifetime.current = { ownerId, sessionCurrent, epoch: lifetime.current.epoch + 1 };
  }
  const frame = lifetime.current;
  const current = useCallback(() => lifetime.current === frame && (!sessionCurrent || sessionCurrent()), [frame, sessionCurrent]);
  return <GuardianPanelBody key={frame.epoch} ownerId={ownerId} current={current} />;
}

function GuardianPanelBody({ ownerId, current }: { ownerId: string | null; current: () => boolean }) {
  const [rows, setRows] = useState<GuardianMinorRow[] | null>(null);
  const [funFacts, setFunFacts] = useState<{ profileId: string | null; facts: PendingFunFact[] }>({ profileId: null, facts: [] });
  const [available, setAvailable] = useState(true);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ code: string; firstName: string; username: string | null; canAllowDonations: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [factError, setFactError] = useState<string | null>(null);
  const mounted = useRef(true);
  const flight = useRef(false);
  const readRevision = useRef(0);
  const factRevision = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const captureActor = useCallback((): OfflineActor => {
    const captured = offlineQueue.captureActor(ownerId);
    const actor = { userId: ownerId ?? '', isCurrent: () => mounted.current && current() && captured?.userId === ownerId && Boolean(captured?.isCurrent()) };
    assertCurrent(actor); return actor;
  }, [ownerId, current]);

  const load = useCallback(async () => {
    const revision = ++readRevision.current;
    if (!ownerId) { setRows([]); return; }
    let actor: OfflineActor | undefined;
    setLoading(true); setLoadError(null);
    try {
      actor = captureActor();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const found = await fetchGuardianMinors(client); assertCurrent(actor);
      if (revision === readRevision.current) setRows(found);
    } catch (caught) {
      if (mounted.current && current() && (!actor || actor.isCurrent()) && revision === readRevision.current) {
        if (message(caught) === NOT_SWITCHED_ON) setAvailable(false);
        else setLoadError(message(caught));
      }
    } finally {
      if (mounted.current && current() && (!actor || actor.isCurrent()) && revision === readRevision.current) setLoading(false);
    }
  }, [captureActor, current, ownerId]);
  // A missing QUIZ-05 remains quietly empty; actual read failures have an honest retry.
  const loadFunFacts = useCallback(async () => {
    const revision = ++factRevision.current;
    if (!ownerId) return;
    let actor: OfflineActor | undefined;
    setFactError(null);
    try {
      actor = captureActor();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const read = await fetchGuardianFunFacts(client); assertCurrent(actor);
      if (revision === factRevision.current) setFunFacts({ profileId: read.profile_id, facts: read.facts });
    } catch (caught) {
      if (mounted.current && current() && (!actor || actor.isCurrent()) && revision === factRevision.current) {
        setFunFacts({ profileId: null, facts: [] });
        if (message(caught) !== NOT_SWITCHED_ON) setFactError(message(caught));
      }
    }
  }, [captureActor, current, ownerId]);
  useEffect(() => { void load(); void loadFunFacts(); }, [load, loadFunFacts]);

  const lookUp = async () => {
    if (flight.current || !ownerId || code.trim().length < 8) return;
    const lookupCode = code.trim();
    flight.current = true; setBusy(true); setNote(null);
    let actor: OfflineActor | undefined;
    try {
      actor = captureActor();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const found = await previewGuardianInvite(lookupCode, client); assertCurrent(actor);
      if (found.status === 'ok') setPreview({ ...found, code: lookupCode });
      else setNote("That code didn't work. Ask for a new one.");
    } catch (caught) {
      if (mounted.current && current() && (!actor || actor.isCurrent())) setNote(message(caught));
    } finally {
      flight.current = false;
      if (mounted.current && current() && (!actor || actor.isCurrent())) setBusy(false);
    }
  };

  const sign = async (consent: ConsentInput) => {
    if (flight.current || !preview) return;
    const signedPreview = preview;
    flight.current = true; setBusy(true); setNote(null);
    let actor: OfflineActor | undefined;
    try {
      actor = captureActor();
      const client = await createOfflineActorClient(actor); assertCurrent(actor);
      const result = await acceptGuardianInvite(signedPreview.code, consent, client); assertCurrent(actor);
      if (result.status === 'bad_code') setNote("That code didn't work. Ask for a new one.");
      else {
        setNote(result.status === 'waiting_for_teen'
          ? `Signed. ${result.firstName} now confirms you as their parent or guardian, then you can see their summary.` : 'Signed.');
        setPreview(null); setCode(''); void load();
      }
    } catch (caught) {
      if (mounted.current && current() && (!actor || actor.isCurrent())) setNote(message(caught));
    } finally {
      flight.current = false;
      if (mounted.current && current() && (!actor || actor.isCurrent())) setBusy(false);
    }
  };

  if (!available) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Parent or guardian</Text>
      <Text style={styles.title}>Teens you supervise</Text>
      <Text style={styles.muted}>You see their settings, safety counts and changes, never who their friends are. They see exactly what you see, and either of you can unlink.</Text>
      {(rows ?? []).map((row) => (
        <MinorCard
          key={`${row.profileId}-${row.linkId ?? 'record'}-${row.linkStatus}`}
          row={row}
          onChanged={() => void load()}
          captureActor={captureActor}
          funFacts={row.linkStatus === 'linked' ? funFacts.facts.filter((fact) => fact.minor_profile_id === row.profileId) : []}
          guardianProfileId={funFacts.profileId}
          onFunFactsChanged={() => void loadFunFacts()}
        />
      ))}
      {loading ? <Text style={styles.muted}>Loading teens you supervise…</Text> : null}
      {loadError ? <View style={styles.detail}><Text style={styles.note} accessibilityRole="alert">{loadError}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry teens you supervise" disabled={loading || busy} onPress={() => void load()} style={styles.chip}><Text style={styles.chipLabel}>Retry</Text></Pressable></View> : null}
      {factError ? <View style={styles.detail}><Text style={styles.note} accessibilityRole="alert">{factError}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry pending fun facts" disabled={busy} onPress={() => void loadFunFacts()} style={styles.chip}><Text style={styles.chipLabel}>Retry fun facts</Text></Pressable></View> : null}
      {rows && rows.length === 0 ? <Text style={styles.muted}>No teens linked yet.</Text> : null}
      <Text style={styles.section}>Link a teen</Text>
      {preview ? (
        <GuardianConsentForm
          teenFirstName={preview.firstName}
          identityKey={preview.code}
          canAllowDonations={preview.canAllowDonations}
          busy={busy}
          onSign={sign}
          onCancel={() => { if (!flight.current && current()) setPreview(null); }}
        />
      ) : (
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Guardian code"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            placeholder="8-character code"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.grow]}
            value={code}
            editable={!busy && Boolean(ownerId)}
            onChangeText={(text) => { if (!flight.current && current()) setCode(text.toUpperCase()); }}
          />
          <AnimatedButton accessibilityLabel="Look up code" disabled={busy || !ownerId || code.trim().length < 8} haptic="selection" onPress={() => void lookUp()} contentStyle={[styles.action, (busy || code.trim().length < 8) && styles.off]}>
            <Text style={styles.actionLabel}>Next</Text>
          </AnimatedButton>
        </View>
      )}
      {note ? <Text style={styles.note} accessibilityRole="alert">{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryHit: { minHeight: 44, justifyContent: 'center' },
  card: { gap: 10, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  kicker: { ...TYPE.caption, ...figtree('800'), letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  title: { ...TYPE.title, ...figtree('800'), color: colors.text },
  section: { marginTop: 6, ...TYPE.section, ...figtree('800'), color: colors.text },
  muted: { ...figtree('400'), ...TYPE.body,  color: colors.textMuted },
  minor: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  name: { ...TYPE.body, ...figtree('800'), color: colors.text },
  detail: { gap: 10 },
  request: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipLabel: { ...TYPE.body, ...figtree('700'), color: colors.text },
  chipLabelOn: { color: colors.onAccent },
  input: { ...figtree('400'), minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, ...TYPE.section, letterSpacing: 2, color: colors.text },
  grow: { flex: 1 },
  action: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  actionLabel: { ...TYPE.body, ...figtree('800'), color: colors.onAccent },
  off: { opacity: 0.5 },
  note: { ...figtree('400'), ...TYPE.body, color: colors.text },
  factPrompt: { ...TYPE.caption, ...figtree('700'), color: colors.textMuted },
  factAnswer: { ...TYPE.section, ...figtree('700'), color: colors.text },
});
