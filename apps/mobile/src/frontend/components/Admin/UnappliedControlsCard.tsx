/**
 * Admin Home card for database updates that are written and not applied.
 * Fans no longer see that sentence. This card is the place that lists the
 * control, the migration file, and a link to the Expo desk.
 * @sideEffects Read-only RPC probes on mount. A missing function is the only "waiting" result.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { UNAPPLIED_CONTROLS, type UnappliedControl } from '@tapuai/shared-types/admin/unappliedControls';
import { AdminReportLink } from '@/components/Admin/Reports/AdminReportSection';
import { REPORT_INK as c, reportStyles as s } from '@/components/Admin/Reports/reportStyles';
import { isMissingFunction } from '@/lib/dbErrors';
import { untypedRpc } from '@/lib/rpc';

/** @purpose Which catalog rows are still missing on this database. */
export async function waitingControls(): Promise<UnappliedControl[]> {
  const checks = await Promise.all(UNAPPLIED_CONTROLS.map(async (control) => {
    try {
      const { error } = await untypedRpc(control.rpc, control.args);
      return isMissingFunction(error) ? control : null;
    } catch {
      return null;
    }
  }));
  return checks.filter((control): control is UnappliedControl => control !== null);
}

/** @purpose Home card. Hidden when every probed control is already on the database. */
export function UnappliedControlsCard() {
  const [waiting, setWaiting] = useState<UnappliedControl[] | null>(null);
  useEffect(() => {
    let live = true;
    void waitingControls().then((rows) => { if (live) setWaiting(rows); }).catch(() => { if (live) setWaiting([]); });
    return () => { live = false; };
  }, []);
  if (!waiting?.length) return null;
  return <View style={[s.section, { gap: 10 }]} accessibilityLabel="Database updates still waiting">
    <Text accessibilityRole="header" style={s.h2}>Database updates still waiting</Text>
    <Text style={s.sentence}>Fans do not see this. Open the desk in Expo admin to finish the control. Nothing here changes the database.</Text>
    {waiting.map((control) => <View key={control.id} style={{ gap: 4 }}>
      <Text style={[s.strong, { color: c.ink }]}>{control.label}</Text>
      <Text style={s.sentence}>{control.migration}</Text>
      <AdminReportLink label={`Open ${control.label}`} href={control.adminPath} />
    </View>)}
  </View>;
}
