import { Platform } from 'react-native';

const MISSING_ORIGIN =
  'Payments are not set up in this build yet (EXPO_PUBLIC_API_ORIGIN is missing). Tell the Tapua\'i team.';

/**
 * @purpose Resolve an Expo API route (`/api/...`) against the hosted server. Metro answers relative paths in
 *   development, but an installed build has no dev server, so it needs the EAS Hosting origin baked in.
 * @param path Route path starting with `/api/`.
 * @param origin Hosted origin (defaults to `EXPO_PUBLIC_API_ORIGIN`); a trailing slash is ignored.
 * @param requireOrigin When true and no origin is set, throws a readable error instead of letting `fetch`
 *   fail on a relative URL. Defaults to release native builds.
 * @returns Absolute URL when an origin is set, otherwise the relative path.
 */
export function apiUrl(
  path: string,
  origin: string | undefined = process.env.EXPO_PUBLIC_API_ORIGIN,
  requireOrigin: boolean = !__DEV__ && Platform.OS !== 'web',
): string {
  const base = origin?.trim().replace(/\/+$/, '');
  if (base) return `${base}${path}`;
  if (requireOrigin) throw new Error(MISSING_ORIGIN);
  return path;
}
