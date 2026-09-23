'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient, isAdminPortalConfigured } from '@/lib/supabase';

type Mode = 'password' | 'magic-link';

/**
 * @purpose Sign-in for the Next admin portal — Supabase Auth email/password or a magic link, matching the
 *   Soft-Wall providers already configured for the fan app project (see `/auth` · Soft-Wall desk). The
 *   `profiles.is_admin` check happens after sign-in, in `app/(protected)/layout.tsx` — this form only
 *   establishes "is this a real Supabase Auth session", which `middleware.ts` requires before any portal page
 *   renders.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const configured = isAdminPortalConfigured();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFailed(true);
      setMessage('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local (same project as the Expo app).');
      return;
    }
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
            : undefined;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setMessage(`Magic link sent to ${email}. Open it on this device to finish signing in.`);
      }
    } catch (caught) {
      setFailed(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      style={{ boxShadow: '0 1px 3px rgba(16,22,26,0.06), 0 8px 32px rgba(16,22,26,0.08)' }}
    >
      <div className="bg-[var(--sidebar-bg)] px-6 py-5">
        <p className="text-[10px] font-extrabold tracking-[0.24em] text-emerald-400/80 uppercase">Tapua&apos;i</p>
        <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white">Admin Portal</h1>
      </div>
      <div className="p-6">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Admin only. Your Supabase Auth account also needs{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5">profiles.is_admin</code> set — an existing admin
          grants that from Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/people</code>.
        </p>

        {!configured ? (
          <p className="mt-4 rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            Copy <code>apps/admin-portal/.env.example</code> to <code>.env.local</code> with the project&apos;s
            NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY before signing in.
          </p>
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={
                  mode === 'password'
                    ? 'rounded-full bg-[var(--jade)] px-3 py-1.5 text-xs font-bold text-white'
                    : 'rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]'
                }
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('magic-link')}
                className={
                  mode === 'magic-link'
                    ? 'rounded-full bg-[var(--jade)] px-3 py-1.5 text-xs font-bold text-white'
                    : 'rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]'
                }
              >
                Magic link
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-[var(--ink)]">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--jade)] focus:outline-none"
                  placeholder="you@tapuai.app"
                />
              </label>
              {mode === 'password' ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-[var(--ink)]">Password</span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--jade)] focus:outline-none"
                    placeholder="••••••••"
                  />
                </label>
              ) : null}

              {message ? (
                <p
                  className={
                    failed
                      ? 'rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-3 py-2 text-xs font-semibold text-[var(--gold)]'
                      : 'rounded-xl border border-[var(--jade-soft)] bg-[var(--jade-soft)] px-3 py-2 text-xs font-semibold text-[var(--jade)]'
                  }
                >
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-[var(--jade)] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
              >
                {busy ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
