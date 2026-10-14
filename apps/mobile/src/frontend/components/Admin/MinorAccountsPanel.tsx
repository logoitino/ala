/**
 * Minor accounts on the People desk (MINOR-01, admin-first): `MinorReport` counts accounts by age band, guardian links,
 * consents, waiting approvals, under-13 accounts waiting for deletion and two abuse signals, with the retention purge.
 * `MinorCaseFile` is one person's safety file: band and birth month / year, closed state, guardian links (names shown,
 * admins only), signed consent records, the supervision summary; repairs are correcting the birth month (with a reason)
 * and ending a guardian link (with a reason). Shows "not switched on" on databases without the update.
 * @sideEffects `admin_minor_report`, `admin_list_age_blocked`, `admin_purge_minor_records`, `admin_minor_overview`,
 *   `admin_set_birth_month`, `admin_end_guardian_link` through lib/minors.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminField, AdminFieldRow, AdminMetrics, AdminNotice, AdminSectionTitle } from '@/components/Admin/AdminChrome';
import { SupervisionSummary } from '@/components/Custodial/SupervisionSummary';
import { useAdminAction } from '@/hooks/useAdminAction';
import {
  BAND_LABEL,
  MONTHS,
  adminEndGuardianLink,
  adminListAgeBlocked,
  adminMinorOverview,
  adminMinorReport,
  adminPurgeMinorRecords,
  adminSetBirthMonth,
  type AdminMinorOverview,
  type MinorReport as MinorReportData,
} from '@/lib/minors';

const day = (at: string | null) => (at ? new Date(at).toLocaleDateString() : '');
const failed = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

/** @purpose Desk-wide minor account counts and the retention purge. */
export function MinorReport() {
  const [report, setReport] = useState<MinorReportData | null>(null);
  const [blocked, setBlocked] = useState<{ profileId: string; userId: string; blockedAt: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [next, waiting] = await Promise.all([adminMinorReport(), adminListAgeBlocked()]);
      setReport(next);
      setBlocked(waiting);
      setError(null);
    } catch (caught) {
      setError(failed(caught, 'Could not read minor account counts.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const { busy, message, run } = useAdminAction(load);

  return (
    <>
      <AdminSectionTitle>Minor accounts</AdminSectionTitle>
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {report ? (
        <AdminMetrics items={[
          { label: 'Teens 13–15', value: report.teen1315 },
          { label: 'Teens 16–17', value: report.teen1617 },
          { label: 'Adults', value: report.adult },
          { label: 'New, no age yet', value: report.notGiven },
          { label: 'Older accounts, age unknown', value: report.unknown },
          { label: 'Teens with a guardian', value: report.teensWithGuardian },
          { label: 'Consent: public profile', value: report.teensPublicConsent },
          { label: 'Consent: payouts', value: report.teensDonationsConsent },
          { label: 'Requests waiting for guardians', value: report.pendingApprovals },
          { label: 'Guardian codes (7 days)', value: report.invites7d },
          { label: 'Guardians with more than 3 teens', value: report.guardiansOver3Teens, hint: 'Review: one adult supervising many teens.' },
          { label: 'Adult friend requests to teens (7 days)', value: report.adultRequestsToTeens7d, hint: 'A jump here is an abuse signal.' },
          { label: 'Under 13, waiting for deletion', value: report.under13Blocked },
        ]} />
      ) : null}
      {report && !report.linksEnabled ? <AdminNotice tone="warn" text="New guardian links are paused (switch minors.guardian_links). Existing links, consent and the teen rules are unchanged." /> : null}
      {blocked.length ? (
        <Text style={{ fontSize: 12 }}>
          {`Delete these sign-ins in the Supabase dashboard (Authentication → Users), then their data goes with them: ${blocked.map((row) => `${row.userId} (closed ${day(row.blockedAt)})`).join(', ')}`}
        </Text>
      ) : null}
      <AdminBtn label={busy === 'purge' ? 'Cleaning up…' : 'Apply retention (events 365 days, codes 30 days)'} disabled={busy != null}
        onPress={() => { void run('purge', async () => { const n = await adminPurgeMinorRecords(); return `Removed ${n.events} events, ${n.invites} codes, ${n.attempts} tries and ${n.approvals} old requests.`; }); }} />
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </>
  );
}

/** @purpose One person's minor-account case file with the two repairs. */
export function MinorCaseFile({ profileId, name }: { profileId: string; name: string }) {
  const [data, setData] = useState<AdminMinorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try { setData(await adminMinorOverview(profileId)); setError(null); }
    catch (caught) { setError(failed(caught, 'Could not read the minor account file.')); }
  }, [profileId]);
  useEffect(() => { void load(); }, [load]);
  const { busy, message, run } = useAdminAction(load);

  const correct = () => run('birth', async () => {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new Error('Enter a year and a month number (1–12).');
    await adminSetBirthMonth(profileId, y, m, reason);
    setReason('');
    return 'Birth month and year corrected.';
  });

  return (
    <>
      <AdminSectionTitle>{`Age & guardians · ${name}`}</AdminSectionTitle>
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {data ? (
        <>
          <Text style={{ fontSize: 13 }}>
            {`${BAND_LABEL[data.ageBand]}${data.birthYear && data.birthMonth ? ` · born ${MONTHS[data.birthMonth - 1]} ${data.birthYear}` : ''}`}
          </Text>
          {data.ageBlockedAt ? <AdminNotice tone="danger" text={`Closed as under 13 on ${day(data.ageBlockedAt)}. Delete the sign-in, or correct the age if it was a mistake.`} /> : null}
          {data.links.map((link) => (
            <Text key={link.linkId} style={{ fontSize: 12 }}>
              {`${link.guardianName} · ${link.source === 'custodial' ? 'guardian on record' : 'invite code'} · ${link.endedAt ? `ended ${day(link.endedAt)} (${link.endReason ?? ''})` : link.confirmedAt ? `linked ${day(link.confirmedAt)}` : 'waiting for the teen'}${link.guardianTeens > 3 ? ` · supervises ${link.guardianTeens} teens` : ''}`}
            </Text>
          ))}
          {data.links.filter((link) => !link.endedAt).map((link) => (
            <AdminBtn key={`end-${link.linkId}`} kind="danger" label={busy === `end-${link.linkId}` ? 'Ending…' : `End link with ${link.guardianName}`} disabled={busy != null || reason.trim().length < 5}
              onPress={() => { void run(`end-${link.linkId}`, async () => { await adminEndGuardianLink(link.linkId, reason); setReason(''); return 'Link ended. The guardian on record cannot re-link without support.'; }); }} />
          ))}
          {data.consents.map((consent) => (
            <Text key={`${consent.signedAt}-${consent.signerName}`} style={{ fontSize: 12 }}>
              {`Consent ${consent.formVersion} signed ${day(consent.signedAt)} by ${consent.signerName} (${consent.relationship === 'parent' ? 'parent' : 'legal guardian'}): public profile ${consent.allowsPublicProfile ? 'yes' : 'no'}, payouts ${consent.allowsDonations ? 'yes' : 'no'}${consent.revokedAt ? ` · ended ${day(consent.revokedAt)} (${consent.revokeReason ?? ''})` : ''}`}
            </Text>
          ))}
          {data.links.length || data.supervision.events.length ? <SupervisionSummary data={data.supervision} /> : null}
          <AdminField label="Reason (required for both repairs)" value={reason} onChangeText={setReason} autoCapitalize="sentences" />
          <AdminFieldRow>
            <AdminField label="Birth year" value={year} onChangeText={setYear} keyboardType="number-pad" />
            <AdminField label="Birth month (1–12)" value={month} onChangeText={setMonth} keyboardType="number-pad" />
          </AdminFieldRow>
          <AdminBtn label={busy === 'birth' ? 'Saving…' : 'Correct birth month and year'} disabled={busy != null || reason.trim().length < 5 || !year || !month}
            onPress={() => { void correct(); }} />
        </>
      ) : null}
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </>
  );
}
