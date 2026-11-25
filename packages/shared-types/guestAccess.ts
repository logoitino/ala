/** GUEST-ACCESS-01 canonical preview and route/account policy shared by Expo and read-only admin oversight. */
export const GUEST_PREVIEW_HIGHLIGHTS = 3;
export type GuestHighlightPreview = { id: string; video_url: string; title: string; created_at: string };
/** Auth callbacks must finish before route authorization; every other destination needs an account. */
export function guestRouteNeedsAccount(pathname: string): boolean {
  return pathname !== '/' && pathname !== '/auth/callback';
}
/** Anonymous Supabase sessions have a uid but do not represent a registered account. */
export function hasAccountSession(session: { user?: { id?: string; is_anonymous?: boolean } } | null | undefined): boolean {
  return Boolean(session?.user?.id && session.user.is_anonymous !== true);
}
