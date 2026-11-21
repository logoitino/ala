'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';

/**
 * @purpose Sign out of the Next admin portal's Supabase Auth session (cookie-backed, so this also clears what
 *   `middleware.ts` / Server Component loaders see) and return to `/login`. `tone="sidebar"` is the dark-nav style.
 */
export function SignOutButton({ tone = 'light', onBeforeSignOut }: { tone?: 'light' | 'sidebar'; onBeforeSignOut?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const flight = useRef(false);

  const signOut = async () => {
    if (flight.current) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    flight.current = true; setBusy(true); setFailure(null);
    try {
      onBeforeSignOut?.();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login'); router.refresh();
    } catch (error) { setFailure(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Sign-out did not finish. Try again.'); }
    finally { flight.current = false; setBusy(false); }
  };

  return (
    <><button
      type="button"
      disabled={busy}
      onClick={() => void signOut()}
      className={
        tone === 'sidebar'
          ? 'min-h-10 rounded-xl border border-[var(--sidebar-line)] px-4 py-2 text-sm font-bold text-[var(--sidebar-ink)] hover:border-[var(--sidebar-accent)] hover:text-white disabled:opacity-40 lg:w-full'
          : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--ink-soft)] hover:border-[var(--jade)] disabled:opacity-40'
      }
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>{failure ? <p role="alert" className="mt-2 text-xs text-[var(--gold)]">{failure}</p> : null}</>
  );
}
