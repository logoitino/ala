/**
 * Main admin Home combines the selected Community Impact report with editing desks.
 * Data and interactions stay in the report UI behind the existing admin shell gate.
 */
import { AdminReportScreen } from '@/components/Admin/Reports/AdminReportScreen';

export default function AdminHomeScreen() {
  return <AdminReportScreen page="home" />;
}
