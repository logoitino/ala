'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';

/**
 * @purpose Sign out of the Next admin portal's Supabase Auth session (cookie-backed, so this also clears what
 *   `middleware.ts` / Server Component loaders see) and return to `/login`.
 */
export function SignOutButton() {
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
      className="rounded-full border border-emerald-900/15 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[var(--jade)] disabled:opacity-40"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
