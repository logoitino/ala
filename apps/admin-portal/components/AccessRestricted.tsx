import { SignOutButton } from '@/components/SignOutButton';

/**
 * @purpose Full-screen lock for a signed-in Supabase Auth session whose `profiles.is_admin` is not true —
 *   the same "Access Restricted" state Expo `/admin` shows (`AccessRestricted.tsx` there, gated by
 *   `isAdminAccess`), so a fan or athlete account that reaches the portal URL never sees Overview / Reports /
 *   Money / Soft-Wall / Profile / Features / People.
 */
export function AccessRestricted({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--canvas)] px-6 text-center">
      <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--gold)] uppercase">Tapua&apos;i admin</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink)]">Access Restricted</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
          This portal is only for Tapua&apos;i admins.{' '}
          {email ? (
            <>
              Signed in as <span className="font-bold text-[var(--ink)]">{email}</span>, but that account is not
              marked <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">profiles.is_admin</code>.
            </>
          ) : (
            'Sign in with an admin account.'
          )}{' '}
          An existing admin can grant access from Expo{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">/admin/people</code>.
        </p>
        <div className="mt-5 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
