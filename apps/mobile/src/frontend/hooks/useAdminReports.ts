/** ADM-02: focused admin reports are isolated by identity; late reads cannot restore revoked data. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isAdminAccess } from '@/lib/roles';
import { emptyAdminReportData, fetchAdminReportData, type AdminReportSections } from '@/lib/adminReports';

/**
 * @purpose Load focused report slices only for the current authenticated admin.
 * @param sections Set a slice false to skip it; omitted slices load for the unified overview.
 * @sideEffects Existing admin RPCs and oversight SELECTs, isolated by authorization and refresh generation.
 */
export function useAdminReports(sections: AdminReportSections = {}) {
  const { user, profile, loading: authLoading } = useAuth();
  const focused = useIsFocused();
  const enabled = !authLoading && Boolean(user?.id) && isAdminAccess({ profile });
  // Studio opens editing chrome locally; only authenticated profile admins can load report data.
  const disabledReason = authLoading || enabled ? null : !user?.id
    ? 'Sign in with an admin account to load reports.'
    : 'Reports require an authenticated admin account. Studio preview does not grant report access.';
  const identity = enabled ? user!.id : '';
  const sectionKey = JSON.stringify(sections);
  const requested = useMemo(() => JSON.parse(sectionKey) as AdminReportSections, [sectionKey]);
  const token = useRef(0);
  const liveIdentity = useRef(identity);
  liveIdentity.current = identity;
  const [loaded, setLoaded] = useState(() => ({ identity: '', data: emptyAdminReportData() }));
  const [loading, setLoading] = useState(enabled && focused);
  const missing = useMemo(() => emptyAdminReportData(), [identity]);

  const refresh = useCallback(async () => {
    // A control retained from another account must not start a read or cancel this account's read.
    if (identity !== liveIdentity.current) return;
    const generation = ++token.current;
    if (!enabled || !focused) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchAdminReportData(requested);
    if (generation !== token.current || identity !== liveIdentity.current) return;
    setLoaded({ identity, data });
    setLoading(false);
  }, [enabled, focused, identity, requested]);

  useEffect(() => {
    // Revocation also drops stored data, so reauthorization cannot resurrect the old snapshot.
    if (!enabled) setLoaded({ identity: '', data: emptyAdminReportData() });
    void refresh();
    return () => { token.current += 1; };
  }, [enabled, refresh]);

  return { ...(loaded.identity === identity && enabled ? loaded.data : missing),
    enabled, disabledReason, loading: enabled && focused && loading, refresh };
}
