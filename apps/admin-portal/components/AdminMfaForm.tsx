/**
 * SCALE-01 second sign-in step (`/login/mfa`): set up an authenticator app once (`enroll`), or enter its code
 * (`verify`). Same card, colours and two fixed live regions as `LoginForm` (`role="alert"` for failures,
 * `role="status"` for progress). Only shown while `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` is on.
 * @sideEffects Supabase Auth TOTP calls through `lib/adminMfaClient.ts`. No database writes.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { mfaErrorText, normalizeTotpCode } from '@/lib/adminMfa';
import { startTotpSetup, verifiedTotpFactorId, verifyTotpCode, type TotpSetup } from '@/lib/adminMfaClient';

type Props = {
  /** `enroll`: no verified authenticator yet. `verify`: one exists. */
  mode: 'enroll' | 'verify';
  /** Same-site path to open after the code is accepted (already passed through `safeNextPath`). */
  next: string;
  email: string | null;
};

/**
 * @purpose The accessible enroll / verify form. On success it replaces the page with `next` and refreshes, so the
 *   server reads the new `aal2` cookie.
 */
export function AdminMfaForm({ mode, next, email }: Props) {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'setup' | 'verify' | 'load' | null>(mode === 'verify' ? 'load' : null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'verify') return;
    let live = true;
    verifiedTotpFactorId()
      .then((id) => {
        if (!live) return;
        setFactorId(id);
        if (!id) setFailure('No authenticator app is set up on this account. Reload the page to set one up.');
      })
      .catch((caught: unknown) => {
        if (live) setFailure(mfaErrorText(caught));
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [mode]);

  useEffect(() => {
    if (setup || (mode === 'verify' && factorId)) codeRef.current?.focus();
  }, [setup, factorId, mode]);

  const beginSetup = async () => {
    setBusy('setup');
    setFailure(null);
    try {
      const started = await startTotpSetup();
      setSetup(started);
      setFactorId(started.factorId);
    } catch (caught) {
      setFailure(mfaErrorText(caught));
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const digits = normalizeTotpCode(code);
    if (!digits) {
      setFailure('Enter the 6 digits from your authenticator app.');
      codeRef.current?.focus();
      return;
    }
    if (!factorId) return;
    setBusy('verify');
    setFailure(null);
    try {
      await verifyTotpCode(factorId, digits);
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setFailure(mfaErrorText(caught));
      setCode('');
      codeRef.current?.focus();
      setBusy(null);
    }
  };

  const showCodeForm = mode === 'verify' ? Boolean(factorId) : Boolean(setup);
  const statusText =
    busy === 'setup' ? 'Starting setup…' : busy === 'verify' ? 'Checking the code…' : busy === 'load' ? 'Loading…' : null;

  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      style={{ boxShadow: '0 1px 3px rgba(16,22,26,0.06), 0 8px 32px rgba(16,22,26,0.08)' }}
    >
      <div className="bg-[var(--sidebar-bg)] px-6 py-5">
        <p className="text-[10px] font-extrabold tracking-[0.24em] text-emerald-400/80 uppercase">Tapua&apos;i</p>
        <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white">Two-step sign-in</h1>
      </div>
      <div className="p-6">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          {mode === 'enroll'
            ? 'Admin desks need a second step. Set up an authenticator app once, then enter its code each time you sign in.'
            : 'Enter the 6-digit code from your authenticator app.'}
          {email ? (
            <>
              {' '}
              Signed in as <span className="font-bold text-[var(--ink)]">{email}</span>.
            </>
          ) : null}
        </p>

        {mode === 'enroll' && !setup ? (
          <button
            type="button"
            onClick={() => void beginSetup()}
            disabled={busy !== null}
            className="mt-5 w-full rounded-full bg-[var(--jade)] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {busy === 'setup' ? 'Starting setup…' : 'Set up an authenticator app'}
          </button>
        ) : null}

        {setup ? (
          <ol className="mt-5 space-y-4 text-sm text-[var(--ink)]">
            <li>
              <p className="font-bold">1. Scan this code with your authenticator app.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an inline SVG data URI. */}
              <img
                src={setup.qrCode}
                alt="QR code that adds Tapua'i Admin to your authenticator app"
                width={176}
                height={176}
                className="mt-2 rounded-xl border border-[var(--border)] bg-white p-2"
              />
              <p className="mt-2 text-[var(--ink-soft)]">Cannot scan it? Type this setup key into the app instead.</p>
              <code
                aria-label="Setup key"
                className="mt-1 block rounded bg-[var(--jade-soft)] px-2 py-1.5 font-mono text-xs break-all text-[var(--jade)] select-all"
              >
                {setup.secret}
              </code>
            </li>
            <li>
              <p className="font-bold">2. Enter the 6-digit code the app shows.</p>
            </li>
          </ol>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)} hidden={!showCodeForm}>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-[var(--ink)]">6-digit code</span>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 \-]*"
              maxLength={9}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-describedby="mfa-code-hint"
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 font-mono text-lg tracking-[0.3em] focus-visible:border-[var(--jade)]"
              placeholder="123456"
            />
            <span id="mfa-code-hint" className="mt-1 block text-xs text-[var(--ink-soft)]">
              The code changes every 30 seconds.
            </span>
          </label>
          <button
            type="submit"
            disabled={busy !== null || !factorId}
            className="w-full rounded-full bg-[var(--jade)] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {busy === 'verify' ? 'Checking…' : 'Verify'}
          </button>
        </form>

        {/* Both always mounted so screen readers register them before any text arrives. */}
        <div role="alert" aria-atomic="true" className="mt-3">
          {failure ? (
            <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-3 py-2 text-xs font-semibold text-[var(--gold)]">
              {failure}
            </p>
          ) : null}
        </div>
        <div role="status" aria-atomic="true">
          {statusText ? <span className="sr-only">{statusText}</span> : null}
        </div>

        <div className="mt-5 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
