import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * @purpose Magic-link landing route for the Next admin portal's login page (`app/login`). Exchanges the
 *   Supabase Auth `code` query param for a session and writes it to cookies so `middleware.ts` and the
 *   `(protected)` layout's `profiles.is_admin` check see a signed-in user on the next request.
 * @sideEffects `supabase.auth.exchangeCodeForSession`; sets the Supabase session cookies.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (code && url && anon) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
}
