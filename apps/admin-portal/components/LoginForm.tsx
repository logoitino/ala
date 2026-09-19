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
    <div className="w-full max-w-sm rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
      <p className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--gold)] uppercase">Tapua&apos;i admin portal</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink)]">Sign in</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Admin only. Your Supabase Auth account also needs <code className="rounded bg-emerald-50 px-1.5">profiles.is_admin</code> set —
        an existing admin grants that from Expo <code className="rounded bg-emerald-50 px-1.5">/admin/people</code>.
      </p>

      {!configured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
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
                  : 'rounded-full border border-emerald-900/15 px-3 py-1.5 text-xs font-bold text-slate-600'
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
                  : 'rounded-full border border-emerald-900/15 px-3 py-1.5 text-xs font-bold text-slate-600'
              }
            >
              Magic link
            </button>
          </div>

          <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-emerald-900/15 px-3 py-2 text-sm"
                placeholder="you@tapuai.app"
              />
            </label>
            {mode === 'password' ? (
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-slate-700">Password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-emerald-900/15 px-3 py-2 text-sm"
                  placeholder="••••••••"
                />
              </label>
            ) : null}

            {message ? (
              <p
                className={
                  failed
                    ? 'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900'
                    : 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-[var(--jade)]'
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
  );
}
