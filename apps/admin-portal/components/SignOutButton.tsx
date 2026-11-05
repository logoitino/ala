'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';

/**
 * @purpose Sign out of the Next admin portal's Supabase Auth session (cookie-backed, so this also clears what
 *   `middleware.ts` / Server Component loaders see) and return to `/login`. `tone="sidebar"` is the dark-nav style.
 */
export function SignOutButton({ tone = 'light' }: { tone?: 'light' | 'sidebar' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
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
    </button>
  );
}
