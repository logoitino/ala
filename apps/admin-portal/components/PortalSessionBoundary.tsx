'use client';

/** Hide retained private server frames at Auth boundaries; only a fresh server role/MFA gate may accept a new lifetime. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SignOutButton } from '@/components/SignOutButton';
import { portalSessionFrame, samePortalSessionFrame } from '@/lib/portalSessionFrame';
import { authPublication, getSupabaseBrowserClient, type PortalBrowserSession as Session } from '@/lib/supabase';

export function PortalSessionBoundary({ userId, frameId, verificationId, children }: {
  userId: string;
  frameId: string | null;
  verificationId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const latest = useRef({ userId, frameId, verificationId, router });
  latest.current = { userId, frameId, verificationId, router };
  const [accepted, setAccepted] = useState<{ frameId: string; verificationId: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const mounted = useRef(false);
  const generation = useRef(0);
  const blocked = useRef(new Set<string>());
  const acceptedToken = useRef<{ token: string; userId: string; frameId: string; verificationId: string } | null>(null);
  const inspect = useRef<(session: Session | null, epoch: number, refresh: boolean) => Promise<void>>(async () => {});
  const client = useRef<ReturnType<typeof getSupabaseBrowserClient>>(null);

  inspect.current = async (session, epoch, refresh) => {
    const expected = latest.current;
    const digest = session?.user.id === expected.userId && session.access_token
      ? await portalSessionFrame(session.access_token, expected.userId) : null;
    if (!mounted.current || epoch !== generation.current || expected.verificationId !== latest.current.verificationId) return;
    const matches = Boolean(digest && digest === expected.frameId && !blocked.current.has(expected.verificationId));
    acceptedToken.current = matches ? { token: session!.access_token, userId: expected.userId, frameId: digest!, verificationId: expected.verificationId } : null;
    setAccepted(matches ? { frameId: digest!, verificationId: expected.verificationId } : null);
    setChecking(false);
    if (refresh && !matches) {
      blocked.current.add(expected.verificationId);
      latest.current.router.refresh();
    }
  };

  useEffect(() => {
    mounted.current = true;
    client.current = getSupabaseBrowserClient();
    // Subscribe before inspecting the initial cookie session, so no transition is missed during that await.
    const subscription = client.current?.auth.onAuthStateChange((event, session) => {
      if (!mounted.current || !authPublication.isCurrent(session?.access_token)) return;
      const epoch = ++generation.current;
      const previous = acceptedToken.current;
      // Supabase also reconfirms an existing session on SIGNED_IN. Keep that accepted child state intact.
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && previous
        && session.user.id === previous.userId
        && previous.userId === latest.current.userId && previous.frameId === latest.current.frameId
        && previous.verificationId === latest.current.verificationId && !blocked.current.has(previous.verificationId)
        && samePortalSessionFrame(previous.token, session.access_token, previous.userId)) {
        acceptedToken.current = { ...previous, token: session.access_token };
        return;
      }
      acceptedToken.current = null;
      // Recovery can emit SIGNED_IN before the first digest. Its matching verified frame is still eligible;
      // a real prior signout or an accepted outgoing lifetime requires another server verification.
      const reverify = ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && Boolean(previous || blocked.current.has(latest.current.verificationId)))
        || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY';
      if (reverify) blocked.current.add(latest.current.verificationId);
      setAccepted(null);
      setChecking(Boolean(session));
      if (event === 'SIGNED_OUT' || !session) {
        setChecking(false);
        latest.current.router.replace('/login');
        return;
      }
      void inspect.current(session, epoch, reverify || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN');
    });
    return () => {
      mounted.current = false;
      ++generation.current;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const epoch = ++generation.current;
    setAccepted(null);
    setChecking(true);
    const read = async () => {
      try {
        const result = await client.current?.auth.getSession();
        if (!mounted.current || epoch !== generation.current) return;
        if (!result || result.error || !authPublication.isCurrent(result.data.session?.access_token)) {
          setChecking(false); return;
        }
        await inspect.current(result.data.session, epoch, false);
      } catch {
        if (mounted.current && epoch === generation.current) setChecking(false);
      }
    };
    void read();
  }, [userId, frameId, verificationId]);

  if (accepted && accepted.frameId === frameId && accepted.verificationId === verificationId && !blocked.current.has(verificationId)) return <>{children}</>;
  return <main className="mx-auto max-w-xl p-6" aria-busy={checking}>
    <p role={checking ? 'status' : 'alert'}>{checking ? 'Verifying admin access…' : 'Admin access needs a fresh session check.'}</p>
    {!checking ? <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="min-h-11 rounded-xl border px-4 font-bold" onClick={() => latest.current.router.refresh()}>Refresh access</button>
      <SignOutButton />
    </div> : null}
  </main>;
}
