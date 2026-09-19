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
      <p className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--gold)] uppercase">Tapua&apos;i admin</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)]">Access Restricted</h1>
      <p className="max-w-md text-sm leading-6 text-slate-600">
        This portal is only for Tapua&apos;i admins.{' '}
        {email ? (
          <>
            Signed in as <span className="font-bold">{email}</span>, but that account is not marked{' '}
            <code className="rounded bg-emerald-50 px-1.5 py-0.5 text-[var(--jade)]">profiles.is_admin</code>.
          </>
        ) : (
          'Sign in with an admin account.'
        )}{' '}
        An existing admin can grant access from Expo <code className="rounded bg-emerald-50 px-1.5 py-0.5">/admin/people</code>.
      </p>
      <SignOutButton />
    </div>
  );
}
