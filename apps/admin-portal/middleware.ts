import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routes reachable without a signed-in Supabase Auth session. Everything else in the portal —
 * Home, Trends, Audience, Revenue, Health, Product, Analytics, and Departments — requires one.
 * The `profiles.is_admin` check (who may actually SEE those desks once signed in) happens one layer
 * in, at `app/(protected)/layout.tsx`, because middleware can only redirect, not render an
 * "Access Restricted" state.
 */
const PUBLIC_PATHS = ['/login', '/auth/callback'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * @purpose Close the "zero auth" hole on `apps/admin-portal` — this is the auth half of the fix; BACKEND's
 *   revoked `anon` grants on `schema.sql` are the other half (see `.claude/agents/admin.md`).
 * @sideEffects Reads/refreshes the Supabase session cookie on every request; redirects unauthenticated
 *   requests for a protected path to `/login?next=<path>`.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const pathname = request.nextUrl.pathname;

  // Env not configured yet: let pages render their existing "Connect Supabase" setup notice instead of
  // trapping the operator in a redirect loop before there is anything to sign in to.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
