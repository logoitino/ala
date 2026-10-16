/**
 * Payee verification on the People desk (VERIFY-02, admin-first). `PayeeVerificationPanel` shows, for one person, the
 * athletes whose donations would go to them (as the athlete or the guardian on record), what each payee still needs,
 * the check history (never an SSN; documents are not kept) and payout override requests. Admins record the school's
 * parent confirmation, a document review or (disputes only) a Stripe ID + selfie result — a second admin (not the
 * recorder, not the person) confirms it — revoke a wrong check, and ask for or decide a payout override (reason required;
 * an independent second admin decides). Stripe's identity / tax ID result arrives
 * from the server only. `PayeeReport` gives desk-wide counts.
 * @sideEffects Admin payee functions through `lib/payeeVerification`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminField, AdminMetrics, AdminNotice, AdminSectionTitle } from '@/components/Admin/AdminChrome';
import { useAdminAction } from '@/hooks/useAdminAction';
import {
  METHOD_LABEL,
  MISSING_LABEL,
  adminConfirmPayeeCheck,
  adminDecidePayoutOverride,
  adminPayeeOverview,
  adminPayeeReport,
  adminRecordPayeeCheck,
  adminRequestPayoutOverride,
  adminRevokePayeeCheck,
  type PayeeOverview,
  type PayeeReport as PayeeReportData,
} from '@/lib/payeeVerification';

const day = (at: string | null) => (at ? new Date(at).toLocaleDateString() : '');
const failed = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

/** @purpose Desk-wide payee verification counts. */
export function PayeeReport() {
  const [report, setReport] = useState<PayeeReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    adminPayeeReport()
      .then((next) => { if (live) { setReport(next); setError(null); } })
      .catch((caught) => { if (live) setError(failed(caught, 'Could not read payee counts.')); });
    return () => { live = false; };
  }, []);
  return (
    <>
      <AdminSectionTitle>Payee verification</AdminSectionTitle>
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {report ? (
        <AdminMetrics items={[
          { label: 'Payees verified by Stripe', value: report.verifiedIdentity },
          { label: 'Parents confirmed (school or document)', value: report.verifiedRelationship },
          { label: 'Checks waiting for a second admin', value: report.awaitingSecondAdmin },
          { label: 'Stripe needs more from them', value: report.needsInput },
          { label: 'Failed checks (30 days)', value: report.failed30d },
          { label: 'Payout overrides waiting for a second admin', value: report.overridesWaiting },
        ]} />
      ) : null}
    </>
  );
}

/** @purpose One person's payee picture with the admin actions. */
export function PayeeVerificationPanel({ profileId, name }: { profileId: string; name: string }) {
  const [data, setData] = useState<PayeeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try { setData(await adminPayeeOverview(profileId)); setError(null); }
    catch (caught) { setError(failed(caught, 'Could not read payee verification.')); }
  }, [profileId]);
  useEffect(() => { void load(); }, [load]);
  const { busy, message, run } = useAdminAction(load);
  const hasReason = reason.trim().length >= 10;
  const done = (text: string) => async () => { setReason(''); return text; };

  return (
    <>
      <AdminSectionTitle>{`Payee verification · ${name}`}</AdminSectionTitle>
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {data ? (
        <>
          <Text style={{ fontSize: 13 }}>
            {`${data.hasConnectAccount ? 'Has a Stripe payout account' : 'No Stripe payout account'} · transfers ${data.payoutsEnabled ? 'on' : 'off'}. Stripe collects the SSN; Tapua'i keeps only yes / no.`}
          </Text>
          {data.athletes.length === 0 ? <Text style={{ fontSize: 12 }}>Not a payee for any athlete.</Text> : null}
          {data.athletes.map((athlete) => (
            <Text key={athlete.playerId} style={{ fontSize: 12 }}>
              {`${athlete.name} (${athlete.as === 'guardian' ? 'guardian on record' : 'own account'})${athlete.payeeIsThisPerson ? '' : ' · not the payee right now'} · ${athlete.payoutAllowed ? 'payouts allowed' : `held: ${athlete.payoutReason ?? 'unknown'}`}${athlete.missing.length ? ` · needs: ${athlete.missing.map((m) => MISSING_LABEL[m]).join('; ')}` : ''}`}
            </Text>
          ))}
          <AdminField label="Reason (what was checked, by whom; at least 10 characters — never an SSN or document number)" value={reason} onChangeText={setReason} autoCapitalize="sentences" />
          {data.isMe ? <AdminNotice tone="warn" text="This is your own account: another admin records and confirms checks about you." /> : null}
          {data.athletes.filter((athlete) => athlete.as === 'guardian' && !data.isMe).map((athlete) => (
            <AdminBtn key={`school-${athlete.playerId}`} label={busy === `school-${athlete.playerId}` ? 'Saving…' : `School confirmed ${name} is ${athlete.name}'s parent`} disabled={busy != null || !hasReason}
              onPress={() => { void run(`school-${athlete.playerId}`, async () => { await adminRecordPayeeCheck(athlete.playerId, profileId, 'school_parent_confirmation', true, reason); return done('School confirmation recorded. A second admin confirms it.')(); }); }} />
          ))}
          {data.athletes.filter((athlete) => athlete.as === 'guardian' && !data.isMe).map((athlete) => (
            <AdminBtn key={`doc-${athlete.playerId}`} label={busy === `doc-${athlete.playerId}` ? 'Saving…' : `Document reviewed for ${athlete.name} (not kept)`} disabled={busy != null || !hasReason}
              onPress={() => { void run(`doc-${athlete.playerId}`, async () => { await adminRecordPayeeCheck(athlete.playerId, profileId, 'document_review', true, reason); return done('Document review recorded (do not keep a copy). A second admin confirms it.')(); }); }} />
          ))}
          {data.checks.map((check) => (
            <Text key={check.id} style={{ fontSize: 12 }}>
              {`${day(check.createdAt)} · ${METHOD_LABEL[check.method]} · ${check.status === 'pending' && check.method !== 'stripe_connect_kyc' ? 'waiting for a second admin' : check.status}${check.reviewer ? ` · by ${check.reviewer}` : ''}${check.secondReviewer ? `, confirmed by ${check.secondReviewer}` : ''}${check.reason ? ` · ${check.reason}` : ''}`}
            </Text>
          ))}
          {data.checks.filter((check) => check.status === 'pending' && check.method !== 'stripe_connect_kyc' && !check.recordedByMe && !data.isMe).map((check) => (
            <AdminBtn key={`confirm-${check.id}`} label={busy === `confirm-${check.id}` ? 'Confirming…' : `Confirm as second admin: ${METHOD_LABEL[check.method]}`} disabled={busy != null}
              onPress={() => { void run(`confirm-${check.id}`, async () => { await adminConfirmPayeeCheck(check.id); return 'Confirmed.'; }); }} />
          ))}
          {data.checks.filter((check) => (check.status === 'verified' || check.status === 'pending') && check.method !== 'stripe_connect_kyc').map((check) => (
            <AdminBtn key={`revoke-${check.id}`} kind="danger" label={busy === `revoke-${check.id}` ? 'Revoking…' : `Revoke: ${METHOD_LABEL[check.method]}`} disabled={busy != null || !hasReason}
              onPress={() => { void run(`revoke-${check.id}`, async () => { await adminRevokePayeeCheck(check.id, reason); return done('Check revoked.')(); }); }} />
          ))}
          <AdminBtn label={busy === 'override' ? 'Sending…' : `Ask a second admin to turn transfers ${data.payoutsEnabled ? 'off' : 'on'}`} disabled={busy != null || !hasReason}
            onPress={() => { void run('override', async () => { await adminRequestPayoutOverride(profileId, null, !data.payoutsEnabled, reason); return done('Sent. Another admin approves or rejects it.')(); }); }} />
          {data.overrides.map((override) => (
            <Text key={override.id} style={{ fontSize: 12 }}>
              {`${day(override.requestedAt)} · transfers ${override.payoutsEnabled ? 'on' : 'off'} · ${override.status} · asked by ${override.requestedBy ?? 'an admin'}: ${override.reason}`}
            </Text>
          ))}
          {data.overrides.filter((override) => override.status === 'pending' && !override.mine).map((override) => (
            <AdminBtn key={`approve-${override.id}`} label={busy === `approve-${override.id}` ? 'Saving…' : `Approve: transfers ${override.payoutsEnabled ? 'on' : 'off'}`} disabled={busy != null}
              onPress={() => { void run(`approve-${override.id}`, async () => `Override ${await adminDecidePayoutOverride(override.id, true)}.`); }} />
          ))}
          {data.overrides.filter((override) => override.status === 'pending' && !override.mine).map((override) => (
            <AdminBtn key={`reject-${override.id}`} kind="danger" label={busy === `reject-${override.id}` ? 'Saving…' : 'Reject override'} disabled={busy != null}
              onPress={() => { void run(`reject-${override.id}`, async () => `Override ${await adminDecidePayoutOverride(override.id, false)}.`); }} />
          ))}
        </>
      ) : null}
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </>
  );
}
