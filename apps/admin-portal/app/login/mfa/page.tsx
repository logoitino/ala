/**
 * @purpose SCALE-01 second sign-in step for the Next admin portal. `middleware.ts` and `app/(protected)/layout.tsx`
 *   send an admin session that is not `aal2` here while `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` is on. Public in the
 *   middleware, so this page checks the session itself: no session goes to `/login`, a non-admin sees Access
 *   Restricted, an `aal2` session (or the switch off) goes straight on to `next`.
 * @sideEffects `getPortalSession` (Supabase `auth.getUser()`, a `profiles` SELECT and one `aal` re-check).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AccessRestricted } from '@/components/AccessRestricted';
import { AdminMfaForm } from '@/components/AdminMfaForm';
import { isAdminMfaRequired, safeNextPath } from '@/lib/adminMfa';
import { getPortalSession } from '@/lib/authz';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Two-step sign-in' };

export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);

  if (!isAdminPortalConfigured()) redirect('/login');
  if (!isAdminMfaRequired()) redirect(next);

  const session = await getPortalSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!session.isAdmin) return <AccessRestricted email={session.email} />;
  if (session.mfaStep !== 'enroll' && session.mfaStep !== 'verify') redirect(next);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-6 py-10">
      <AdminMfaForm mode={session.mfaStep} next={next} email={session.email} />
    </div>
  );
}
