/**
 * BOOKS-01: loads the Books desk snapshot for the signed-in admin only. Mirrors `useAdminReports`:
 * a late read from another account, or after admin access is revoked, never restores old figures.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { emptyBooksSnapshot, fetchBooksSnapshot, type BooksSnapshot } from '@/lib/bookkeeping';
import { isAdminAccess } from '@/lib/roles';

/**
 * @purpose Books snapshot plus refresh, isolated by admin identity and refresh generation.
 * @sideEffects `fetchBooksSnapshot` reads on focus and on refresh.
 */
export function useBooks() {
  const { user, profile, loading: authLoading } = useAuth();
  const focused = useIsFocused();
  const enabled = !authLoading && Boolean(user?.id) && isAdminAccess({ profile });
  const disabledReason = authLoading || enabled ? null : !user?.id
    ? 'Sign in with an admin account to open the books.'
    : 'The books require an authenticated admin account. Studio preview does not grant access.';
  const identity = enabled ? user!.id : '';
  const token = useRef(0);
  const liveIdentity = useRef(identity);
  liveIdentity.current = identity;
  const [loaded, setLoaded] = useState(() => ({ identity: '', data: emptyBooksSnapshot() }));
  const [loading, setLoading] = useState(enabled && focused);
  const missing = useMemo(() => emptyBooksSnapshot(), [identity]);

  const refresh = useCallback(async () => {
    if (identity !== liveIdentity.current) return;
    const generation = ++token.current;
    if (!enabled || !focused) { setLoading(false); return; }
    setLoading(true);
    let data: BooksSnapshot;
    try {
      data = await fetchBooksSnapshot();
    } catch (caught) {
      data = emptyBooksSnapshot();
      data.errors.revenue = caught instanceof Error ? caught.message : 'Could not read the books.';
    }
    if (generation !== token.current || identity !== liveIdentity.current) return;
    setLoaded({ identity, data });
    setLoading(false);
  }, [enabled, focused, identity]);

  useEffect(() => {
    if (!enabled) setLoaded({ identity: '', data: emptyBooksSnapshot() });
    void refresh();
    return () => { token.current += 1; };
  }, [enabled, refresh]);

  return { ...(loaded.identity === identity && enabled ? loaded.data : missing), enabled, disabledReason, loading: enabled && focused && loading, refresh };
}
