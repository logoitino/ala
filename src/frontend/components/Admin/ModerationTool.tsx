import { AdminPage } from '@/components/Admin/AdminChrome';
import { ModerationTable } from '@/components/Admin/ModerationTable';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';

/**
 * @purpose Clear Highlight flags or take clips off Highlights ⚡.
 * @sideEffects `moderate_flagged_reel`.
 */
export function ModerationTool() {
  const dashboard = useAdminDashboard(true);
  return (
    <AdminPage
      title="Moderation"
      lede="Dismiss a flag or remove the clip from Highlights ⚡. Removed clips can be restored under Highlights."
      refreshing={dashboard.loading}
      onRefresh={() => void dashboard.refresh()}
      error={dashboard.error}
      saveMode="instant"
    >
      <ModerationTable
        flags={dashboard.flags}
        busyId={dashboard.busyId}
        onDismiss={(row) => void dashboard.moderate(row, 'dismiss')}
        onRemove={(row) => void dashboard.moderate(row, 'remove')}
      />
    </AdminPage>
  );
}
