/**
 * Saved /admin/reports links open the canonical Analytics report. Keeping this compatibility entry avoids
 * a second dashboard, extra snapshot reads and a separate version of the same metrics in Manage desks.
 * @sideEffects Expo Router replaces the legacy desk with /admin/analytics under the existing admin shell.
 */
import { Redirect } from 'expo-router';

export function ReportsTool() {
  return <Redirect href="/admin/analytics" />;
}
