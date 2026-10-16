/** Admin-only support state clears across identity changes; delayed reads/writes cannot revive another account's data. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isAdminAccess } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { fetchEngineeringSupport, recordSupportReview, registerSupportRelease, type SupportRead, type SupportReviewInput } from '@/lib/engineeringSupport';
const empty: SupportRead = { snapshot: null, error: null };
export function useEngineeringSupport() {
  const { user, profile, loading: authLoading } = useAuth();
  const focused = useIsFocused();
  const enabled = !authLoading && !!user?.id && isAdminAccess({ profile });
  const identity = enabled ? user!.id : '';
  const live = useRef(identity); live.current = identity;
  const generation = useRef(0);
  const [loaded, setLoaded] = useState({ identity: '', data: empty });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const writeSequence = useRef(0);
  const writing = useRef<{ identity: string; token: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'ok' | 'danger'>('ok');
  const refresh = useCallback(async () => {
    if (identity !== live.current) return;
    const token = ++generation.current;
    if (!enabled || !focused || identity !== live.current) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchEngineeringSupport();
    if (identity !== live.current || token !== generation.current) return;
    setLoaded({ identity, data }); setLoading(false);
  }, [enabled, focused, identity]);
  useEffect(() => { writing.current = null; setLoaded({ identity: '', data: empty }); setMessage(null); setBusy(false); setLoading(false); void refresh(); return () => { generation.current++; }; }, [refresh]);
  const mutate = async (action: (accessToken: string) => Promise<void>) => {
    if (!identity || identity !== live.current || writing.current?.identity === identity) return;
    const writeToken = ++writeSequence.current;
    writing.current = { identity, token: writeToken }; setBusy(true); setMessage(null);
    try {
      const session = await supabase.auth.getSession();
      if (identity !== live.current || session.data.session?.user.id !== identity) return;
      if (!session.data.session?.access_token) throw new Error('Sign in again before saving a support action.');
      await action(session.data.session.access_token);
      if (identity !== live.current) return;
      setMessageTone('ok'); setMessage('Server confirmed the change with your identity and time.'); await refresh();
    } catch (error) { if (identity === live.current) { setMessageTone('danger'); setMessage(error instanceof Error ? error.message : 'Action was not confirmed.'); } }
    finally { if (writing.current?.token === writeToken) { writing.current = null; if (identity === live.current) setBusy(false); } }
  };
  return { ...(enabled && loaded.identity === identity ? loaded.data : empty), enabled, identity, loading: enabled && loading, busy, message, messageTone, refresh,
    review: (input: SupportReviewInput) => mutate(token => recordSupportReview(input, token)),
    register: (text: string) => mutate(token => registerSupportRelease(text, token)),
    disabledReason: authLoading ? 'Checking admin access…' : enabled ? null : 'Engineering Support requires a signed-in admin. Preview roles do not grant access.' };
}
