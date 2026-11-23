import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveBackendConnection } from '@tapuai/shared-types/backendConnection';

import { adminMfaHref, isAdminMfaRequired, readAdminMfaStep } from '@/lib/adminMfa';

/**
 * Routes reachable without a signed-in Supabase Auth session. Everything else in the portal —
 * Home, Trends, Audience, Revenue, Health, Product, Analytics, and Departments — requires one.
 * The `profiles.is_admin` check (who may actually SEE those desks once signed in) happens one layer
 * in, at `app/(protected)/layout.tsx`, because middleware can only redirect, not render an
 * "Access Restricted" state. `/login/mfa` is public here and checks the session itself.
 */
const PUBLIC_PATHS = ['/login', '/auth/callback'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * @purpose Close the "zero auth" hole on `apps/admin-portal` — this is the auth half of the fix; BACKEND's
 *   revoked `anon` grants on `schema.sql` are the other half (see `.claude/agents/admin.md`).
 * @sideEffects Reads/refreshes the Supabase session cookie on every request; redirects unauthenticated
 *   requests for a protected path to `/login?next=<path>`. SCALE-01: when `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` is on, a
 *   signed-in session whose token is not `aal2` is sent to `/login/mfa?next=<path>` (enroll or enter a code); the
 *   token was just validated by `getUser()`, so its `aal` claim is only decoded here. Switch off: unchanged.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const backend = resolveBackendConnection({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  const pathname = request.nextUrl.pathname;

  // Configuration failure cannot authorize a private desk. The public login keeps its setup notice.
  if (!backend.connection) {
    if (isPublicPath(pathname)) return response;
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(backend.connection.url, backend.connection.publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Re-validates against Supabase Auth (not just "a cookie exists") and refreshes it when it is close to
  // expiring, so Server Component loaders downstream get a live session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (user && !isPublicPath(pathname) && isAdminMfaRequired()) {
    const step = await readAdminMfaStep(supabase, user, 'local');
    if (step === 'enroll' || step === 'verify') {
      const redirect = NextResponse.redirect(new URL(adminMfaHref(`${pathname}${request.nextUrl.search}`), request.url));
      // Keep a token refreshed above; otherwise the next request would refresh it again.
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
