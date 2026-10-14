/**
 * Routes the features report into the main admin application.
 * Shared report UI owns data and presentation; the enclosing admin shell gates access.
 */
import { AdminReportScreen } from '@/components/Admin/Reports/AdminReportScreen';

export default function AdminReportRoute() {
  return <AdminReportScreen page="features" />;
}
