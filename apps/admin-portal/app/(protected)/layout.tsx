import { redirect } from 'next/navigation';

import { AccessRestricted } from '@/components/AccessRestricted';
import { PortalSessionBoundary } from '@/components/PortalSessionBoundary';
import { adminMfaHref } from '@/lib/adminMfa';
import { getPortalSession } from '@/lib/authz';
import { isAdminPortalConfigured } from '@/lib/supabase';

/**
 * @purpose Gate every Home / Trends / Audience / Revenue / Health / Product / Analytics / Departments page
 *   behind Supabase Auth + `profiles.is_admin`. `middleware.ts` already redirects a request with no session at
 *   all to `/login`; this layer catches the case middleware cannot render — a real, signed-in session that is
 *   not an admin — and shows "Access Restricted" instead of the pages underneath, matching Expo `/admin`.
 *   SCALE-01: with `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` on, an admin session that is not `aal2` goes to `/login/mfa`
 *   and renders nothing here. `middleware.ts` makes the same check first on every request (with the real
 *   return path); this is the second, server-validated check. With the switch off nothing changes.
 * @sideEffects `getPortalSession` (Supabase `auth.getUser()` + a `profiles` SELECT for the signed-in user, plus
 *   one `aal` re-check when the MFA switch is on).
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // A missing/invalid backend cannot verify access. Login remains public and explains setup.
  if (!isAdminPortalConfigured()) redirect('/login');

  const session = await getPortalSession();
  if (!session) redirect('/login');
  if (!session.frameId) return <PortalSessionBoundary userId={session.userId} frameId={null} verificationId={session.verificationId}>{null}</PortalSessionBoundary>;
  if (!session.isAdmin) return <AccessRestricted email={session.email} />;
  if (session.mfaStep === 'enroll' || session.mfaStep === 'verify') redirect(adminMfaHref('/'));

  return <PortalSessionBoundary userId={session.userId} frameId={session.frameId} verificationId={session.verificationId}>{children}</PortalSessionBoundary>;
}
