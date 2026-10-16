/**
 * Privacy & safety on the People desk (PRIV-01, built before the app screens per the feature workflow). Shows one
 * person's privacy settings and counts — never who they befriended or blocked — and lets an admin reset them to the
 * private defaults or hide them from search; the minor-accounts case file (MINOR-01) and payee verification (VERIFY-02) sit underneath. `PrivacyReport`
 * gives the desk-wide counts (blocks per week are the abuse signal) and the minor accounts report.
 * @sideEffects Admin privacy RPCs through `lib/privacy`; minor-account RPCs through `MinorAccountsPanel`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminMetrics, AdminNotice, AdminPanel } from '@/components/Admin/AdminChrome';
import { MinorCaseFile, MinorReport } from '@/components/Admin/MinorAccountsPanel';
import { PayeeReport, PayeeVerificationPanel } from '@/components/Admin/PayeeVerificationPanel';
import { useAdminAction } from '@/hooks/useAdminAction';
import {
  AUDIENCE_LABEL,
  PRIVACY_ITEMS,
  adminFetchPrivacy,
  adminPrivacyReport,
  adminResetPrivacy,
  adminSetHideFromSearch,
  type AdminPrivacy,
  type PrivacyReport as PrivacyReportData,
} from '@/lib/privacy';

/** @purpose Desk-wide privacy counts; a failed read says so instead of showing zeros. */
export function PrivacyReport() {
  const [report, setReport] = useState<PrivacyReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    adminPrivacyReport()
      .then((next) => { if (live) { setReport(next); setError(null); } })
      .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : 'Could not read privacy counts.'); });
    return () => { live = false; };
  }, []);
  return (
    <AdminPanel title="Privacy & safety">
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {report ? (
        <AdminMetrics items={[
          { label: 'Private accounts', value: report.privateAccounts },
          { label: 'Public accounts', value: report.publicAccounts },
          { label: 'Hidden from search', value: report.hiddenFromSearch },
          { label: 'Friendships', value: report.friendships },
          { label: 'Friend requests (7 days)', value: report.requests7d },
          { label: 'Blocks (7 days)', value: report.blocks7d, hint: 'A jump here is the abuse signal.' },
        ]} />
      ) : null}
      {report && !report.friendRequestsEnabled ? <AdminNotice tone="warn" text="Friend requests are paused (switch privacy.friends)." /> : null}
      <MinorReport />
      <PayeeReport />
    </AdminPanel>
  );
}

/** @purpose One person's privacy settings and counts, with the admin repairs and the minor-accounts case file. */
export function PrivacySafetyPanel({ profileId, name }: { profileId: string; name: string }) {
  const [data, setData] = useState<AdminPrivacy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await adminFetchPrivacy(profileId)); setLoadError(null); }
    catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'Could not read privacy settings.'); }
  }, [profileId]);
  useEffect(() => { void load(); }, [load]);
  const { busy, message, run } = useAdminAction(load);

  return (
    <AdminPanel title={`Privacy & safety · ${name}`}>
      {loadError ? <AdminNotice tone="danger" text={loadError} /> : null}
      {data ? (
        <>
          <Text style={{ fontSize: 13 }}>
            {`${data.accountPrivate ? 'Private' : 'Public'} account · ${data.hideFromSearch ? 'hidden from search' : 'in search'} · tags: ${data.tagReview === 'auto_friends' ? 'auto-approve from friends' : 'review every tag'} · friend requests: ${data.friendRequestsFrom === 'nobody' ? 'nobody' : data.friendRequestsFrom === 'teens' ? 'teens only' : 'anyone'}`}
          </Text>
          <Text style={{ fontSize: 12 }}>
            {PRIVACY_ITEMS.map((item) => `${item.label}: ${AUDIENCE_LABEL[data.audience[item.key]]}`).join(' · ')}
          </Text>
          <AdminMetrics items={[
            { label: 'Friends', value: data.friendCount },
            { label: 'Requests waiting', value: data.pendingIncoming },
            { label: 'Requests sent', value: data.pendingOutgoing },
            { label: 'Requests sent (7 days)', value: data.requestsSent7d },
            { label: 'Blocks made', value: data.blocksMade },
            { label: 'Blocked by others', value: data.blocksReceived, hint: 'Many blocks received can mean unwanted contact.' },
          ]} />
          <AdminBtn kind="danger" label={busy === 'reset' ? 'Resetting…' : 'Reset to private defaults'} disabled={busy != null}
            onPress={() => { void run('reset', async () => { await adminResetPrivacy(profileId); return `${name} is back on the private defaults.`; }); }} />
          <AdminBtn label={busy === 'search' ? 'Saving…' : data.hideFromSearch ? 'Show in search' : 'Hide from search'} disabled={busy != null}
            onPress={() => { void run('search', async () => { await adminSetHideFromSearch(profileId, !data.hideFromSearch); return data.hideFromSearch ? 'Shown in search again.' : 'Hidden from search.'; }); }} />
        </>
      ) : null}
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
      <MinorCaseFile profileId={profileId} name={name} />
      <PayeeVerificationPanel profileId={profileId} name={name} />
    </AdminPanel>
  );
}
