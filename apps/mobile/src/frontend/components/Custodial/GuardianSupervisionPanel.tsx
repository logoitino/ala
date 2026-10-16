/**
 * Parent or guardian supervision (MINOR-01), in Parent HQ and from Profile → Privacy for any adult. Link a teen with the
 * code they share (then sign the consent; the link counts once the teen confirms), see each linked teen's summary
 * (the same one the teen sees), approve or decline an under-16's request, change permissions, withdraw consent or
 * unlink. The guardian on record for an athlete can sign without a code. Replaces the PRIV-01 guardian lock: a guardian
 * cannot change the teen's settings. Shows nothing on databases without the minor-accounts update.
 * @sideEffects `guardian_list_minors`, `preview_guardian_invite`, `accept_guardian_invite`, `sign_guardian_consent`,
 *   `revoke_guardian_consent`, `guardian_get_supervision`, `guardian_decide_approval`, `end_guardian_link` via lib/minors.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { GuardianConsentForm } from '@/components/Custodial/GuardianConsentForm';
import { SupervisionSummary } from '@/components/Custodial/SupervisionSummary';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
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
import { FOCAL } from '@/theme/motion';

const message = (caught: unknown) => (caught instanceof Error ? caught.message : 'That did not work.');

function consentLine(row: GuardianMinorRow): string {
  if (!row.myConsent) return 'No consent signed yet.';
  const allowed = [row.myConsent.allowsPublicProfile ? 'public profile' : null, row.myConsent.allowsDonations ? 'payouts' : null].filter(Boolean);
  return allowed.length ? `You allowed: ${allowed.join(', ')}.` : 'Signed, with nothing extra allowed.';
}

/** @purpose One teen: status line, then (when linked) the summary, requests and consent actions. */
function MinorCard({ row, onChanged }: { row: GuardianMinorRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Supervision | null>(null);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchGuardianSupervision(row.profileId));
    } catch (caught) {
      setNote(message(caught));
    }
  }, [row.profileId]);
  useEffect(() => { if (open && row.linkStatus === 'linked') void load(); }, [open, row.linkStatus, load]);

  const act = async (work: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await work();
      if (result && typeof result === 'object' && 'settings' in (result as object)) setData(result as Supervision);
      if (done) setNote(done);
      onChanged();
    } catch (caught) {
      setNote(message(caught));
    } finally {
      setBusy(false);
    }
  };

  const sign = (consent: ConsentInput) => act(async () => {
    const result = await signGuardianConsent(row.profileId, consent);
    setSigning(false);
    return result;
  }, 'Consent signed.');

  const unlink = () => {
    if (!row.linkId) return;
    Alert.alert(`Unlink from ${row.firstName}?`, 'Your consent ends with the link. A public profile goes private and payouts wait.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: () => void act(() => endGuardianLink(row.linkId as string), 'Unlinked.') },
    ]);
  };

  return (
    <View style={styles.minor}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${row.firstName}, ${row.linkStatus === 'linked' ? 'show summary' : 'status'}`} haptic="selection" onPress={() => setOpen(!open)}>
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
      {open && row.linkStatus === 'linked' && data ? (
        <View style={styles.detail}>
          <SupervisionSummary data={data} />
          {(data.status?.pendingApprovals ?? []).map((request) => (
            <View key={request.id} style={styles.request}>
              <Text style={styles.name}>{`${row.firstName} asked: ${APPROVAL_LABEL[request.changeKey]}`}</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Approve: ${APPROVAL_LABEL[request.changeKey]}`} disabled={busy} haptic="selection" onPress={() => void act(() => decideApproval(request.id, true), 'Approved.')} style={[styles.chip, styles.chipOn]}>
                  <Text style={[styles.chipLabel, styles.chipLabelOn]}>Approve</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Decline: ${APPROVAL_LABEL[request.changeKey]}`} disabled={busy} haptic="selection" onPress={() => void act(() => decideApproval(request.id, false), 'Declined.')} style={styles.chip}>
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
              <Pressable accessibilityRole="button" accessibilityLabel="Withdraw consent" disabled={busy} haptic="selection" onPress={() => void act(() => revokeGuardianConsent(row.profileId), 'Consent withdrawn.')} style={styles.chip}>
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
          canAllowDonations={row.canAllowDonations}
          initial={row.myConsent ?? undefined}
          busy={busy}
          onSign={(consent) => void sign(consent)}
          onCancel={() => setSigning(false)}
        />
      ) : null}
      {note ? <Text style={styles.note} accessibilityRole="alert">{note}</Text> : null}
    </View>
  );
}

/** @purpose The whole guardian area: teens you supervise and "Link a teen". */
export function GuardianSupervisionPanel() {
  const [rows, setRows] = useState<GuardianMinorRow[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ firstName: string; username: string | null; canAllowDonations: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchGuardianMinors());
    } catch (caught) {
      if (message(caught) === NOT_SWITCHED_ON) setAvailable(false);
      else setNote(message(caught));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const lookUp = async () => {
    if (busy || code.trim().length < 8) return;
    setBusy(true);
    setNote(null);
    try {
      const found = await previewGuardianInvite(code);
      if (found.status === 'ok') setPreview(found);
      else setNote("That code didn't work. Ask for a new one.");
    } catch (caught) {
      setNote(message(caught));
    } finally {
      setBusy(false);
    }
  };

  const sign = async (consent: ConsentInput) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await acceptGuardianInvite(code, consent);
      if (result.status === 'bad_code') {
        setNote("That code didn't work. Ask for a new one.");
      } else {
        setNote(result.status === 'waiting_for_teen'
          ? `Signed. ${result.firstName} now confirms you as their parent or guardian, then you can see their summary.`
          : 'Signed.');
        setPreview(null);
        setCode('');
        void load();
      }
    } catch (caught) {
      setNote(message(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!available) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Parent or guardian</Text>
      <Text style={styles.title}>Teens you supervise</Text>
      <Text style={styles.muted}>You see their settings, safety counts and changes, never who their friends are. They see exactly what you see, and either of you can unlink.</Text>
      {(rows ?? []).map((row) => <MinorCard key={`${row.profileId}-${row.linkId ?? 'record'}`} row={row} onChanged={() => void load()} />)}
      {rows && rows.length === 0 ? <Text style={styles.muted}>No teens linked yet.</Text> : null}
      <Text style={styles.section}>Link a teen</Text>
      {preview ? (
        <GuardianConsentForm
          teenFirstName={preview.firstName}
          canAllowDonations={preview.canAllowDonations}
          busy={busy}
          onSign={(consent) => void sign(consent)}
          onCancel={() => setPreview(null)}
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
            onChangeText={(text) => setCode(text.toUpperCase())}
          />
          <AnimatedButton accessibilityLabel="Look up code" disabled={busy || code.trim().length < 8} haptic="selection" onPress={() => void lookUp()} contentStyle={[styles.action, (busy || code.trim().length < 8) && styles.off]}>
            <Text style={styles.actionLabel}>Next</Text>
          </AnimatedButton>
        </View>
      )}
      {note ? <Text style={styles.note} accessibilityRole="alert">{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  section: { marginTop: 6, fontSize: 15, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  minor: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontSize: 14, fontWeight: '800', color: colors.text },
  detail: { gap: 10 },
  request: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: FOCAL.violetInk, borderColor: FOCAL.violetInk },
  chipLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipLabelOn: { color: colors.onAccent },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 16, letterSpacing: 2, color: colors.text },
  grow: { flex: 1 },
  action: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: FOCAL.violetInk },
  actionLabel: { fontSize: 14, fontWeight: '800', color: colors.onAccent },
  off: { opacity: 0.5 },
  note: { fontSize: 13, color: colors.text },
});
