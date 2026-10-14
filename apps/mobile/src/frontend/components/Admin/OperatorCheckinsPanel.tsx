/**
 * Operator check-ins on the Live games desk (DATA-01 F3). The sideline console records a GPS check-in;
 * nothing read it, so precise locations piled up with no use. The database now stores location rounded to
 * about 1 km and removes check-ins after 30 days on its own (PRIVACY_ENGINEERING, 2026-10-13); admins see
 * when operators checked in and can purge sooner, never keeping less than 7 days.
 * @sideEffects `admin_list_operator_checkins` and `admin_purge_operator_checkins` RPCs.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminEmpty, AdminNotice, AdminPanel, AdminRow } from '@/components/Admin/AdminChrome';
import { useAdminAction } from '@/hooks/useAdminAction';
import { fetchOperatorCheckins, purgeOperatorCheckins, type OperatorCheckin } from '@/lib/adminControls';

/** Retention the database enforces (`expire_operator_checkins`); keep in step with the migration. */
export const OPERATOR_CHECKIN_RETENTION_DAYS = 30;

/** @purpose Recent check-ins and the retention purge. */
export function OperatorCheckinsPanel() {
  const [rows, setRows] = useState<OperatorCheckin[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Purging deletes data, so it takes a second tap; useAdminAction stops a double tap from purging twice.
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchOperatorCheckins(30)); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not read check-ins.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const { busy, message, run } = useAdminAction(load);

  const purge = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    void run('purge', async () => {
      const removed = await purgeOperatorCheckins(OPERATOR_CHECKIN_RETENTION_DAYS);
      return `Removed ${removed} check-in${removed === 1 ? '' : 's'} older than ${OPERATOR_CHECKIN_RETENTION_DAYS} days.`;
    }, 'Could not purge check-ins.');
  };

  return (
    <AdminPanel title="Operator check-ins">
      <Text style={{ fontSize: 13 }}>{`When sideline operators checked in. Locations are rounded to about 1 km and removed automatically after ${OPERATOR_CHECKIN_RETENTION_DAYS} days. Purge now only to clear them sooner.`}</Text>
      {error ? <AdminNotice tone="danger" text={error} /> : null}
      {!error && rows.length === 0 ? <AdminEmpty text="No operator check-ins." /> : null}
      {rows.map((row) => (
        <AdminRow key={row.id} title={row.checkedInAt.replace('T', ' ').slice(0, 16)}
          meta={row.latitudeApprox == null || row.longitudeApprox == null ? 'No location recorded' : `Near ${row.latitudeApprox.toFixed(2)}, ${row.longitudeApprox.toFixed(2)}${row.gigId ? ' · gig linked' : ''}`} />
      ))}
      <AdminBtn kind="danger" label={busy ? 'Purging…' : confirming ? `Confirm: delete check-ins older than ${OPERATOR_CHECKIN_RETENTION_DAYS} days` : `Purge check-ins older than ${OPERATOR_CHECKIN_RETENTION_DAYS} days`} disabled={busy != null || Boolean(error)} onPress={purge} />
      {confirming ? <AdminBtn label="Cancel purge" onPress={() => setConfirming(false)} /> : null}
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </AdminPanel>
  );
}
