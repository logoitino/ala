/** Private UI correlation only: verified server authority stays separate; raw Auth credentials/claims never leave memory. */
function identity(token: string, userId: string, requireUnexpired = true): string | null {
  try {
    const segments = token.split('.');
    if (segments.length !== 3 || segments.some(segment => !segment)) return null;
    const payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)
      || typeof userId !== 'string' || !userId || claims.sub !== userId
      || typeof claims.session_id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)
      || (claims.aal !== 'aal1' && claims.aal !== 'aal2')
      || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || (requireUnexpired && claims.exp <= Date.now() / 1000)) return null;
    return JSON.stringify(['tapuai-private-frame-v1', userId, claims.session_id.toLowerCase(), claims.aal]);
  } catch {
    return null;
  }
}

/** Only compare a previously accepted memory token with a current unexpired browser token; this never grants server access. */
export function samePortalSessionFrame(previousToken: string, nextToken: string, userId: string): boolean {
  const previous = identity(previousToken, userId, false);
  const next = identity(nextToken, userId);
  return Boolean(previous && next && previous === next);
}

export async function portalSessionFrame(token: string, userId: string): Promise<string | null> {
  try {
    const value = identity(token, userId);
    if (!value) return null;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      value,
    ));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
