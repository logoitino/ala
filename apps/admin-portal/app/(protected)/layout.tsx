import { redirect } from 'next/navigation';

import { AccessRestricted } from '@/components/AccessRestricted';
import { getPortalSession } from '@/lib/authz';
import { isAdminPortalConfigured } from '@/lib/supabase';

/**
 * @purpose Gate every Overview / Reports / Money / Soft-Wall (`/auth`) / Profile / Features / People page
 *   behind Supabase Auth + `profiles.is_admin`. `middleware.ts` already redirects a request with no session at
 *   all to `/login`; this layer catches the case middleware cannot render — a real, signed-in session that is
 *   not an admin — and shows "Access Restricted" instead of the pages underneath, matching Expo `/admin`.
 * @sideEffects `getPortalSession` (Supabase `auth.getUser()` + a `profiles` SELECT for the signed-in user).
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Env not configured: nothing to authenticate against yet. Let pages render their own
  // "Connect Supabase" setup notice rather than bouncing to a login page that cannot work either.
  if (!isAdminPortalConfigured()) return <>{children}</>;

  const session = await getPortalSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) return <AccessRestricted email={session.email} />;

  return <>{children}</>;
}
