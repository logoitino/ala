/**
 * Local verification of Supabase (GoTrue-compatible) access tokens with WebCrypto, shared by the Deno Edge Functions
 * and the Node / Metro API routes (PORT-01 identity seam, SCALE-04). It checks an ES256 or RS256 token against the
 * project's public signing keys (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cached about ten minutes), so a
 * request does not need a network round trip to the auth server.
 *
 * Three outcomes, by design:
 * - `verified`: signature, `exp`, `nbf` (when present), `iss`, `aud` and the key's `alg` / `kid` all check out.
 * - `rejected`: the token is definitely unusable (`alg: none`, a bad signature from a known key, expired, wrong
 *   issuer or audience). The caller answers 401 without asking the auth server.
 * - `fallback`: this path cannot decide (HS256 legacy project, no or unknown key id, JWKS unreachable, malformed
 *   token, no WebCrypto). The caller must ask the auth server (`supabase.auth.getUser`) exactly as before.
 *
 * Limit, stated plainly: a signature cannot show a sign-out or a revoked session before the token expires. Money-
 * moving actions (payouts, Connect account creation) must keep confirming the live session with `getUser` and must
 * not use this verifier. Never log the token or the claims.
 *
 * Runtime-neutral: `fetch`, `crypto.subtle` and the clock are injected; only web-standard globals (`atob`,
 * `TextEncoder`, `TextDecoder`, `AbortController`, `setTimeout`) are used, no `Deno` or `process`.
 */

/** The claims this app relies on after a successful local check. Other claims pass through untyped. */
export type AccessTokenClaims = {
  sub: string;
  exp: number;
  email?: string;
  role?: string;
  [claim: string]: unknown;
};

/** Why a token was refused outright (the caller answers 401 without the auth server). */
export type LocalRejectReason =
  | 'alg_none'
  | 'bad_signature'
  | 'key_mismatch'
  | 'bad_claims'
  | 'expired'
  | 'not_yet_valid'
  | 'wrong_audience';

/** Why the local path could not decide (the caller asks the auth server instead). */
export type LocalFallbackReason =
  | 'malformed'
  | 'symmetric_alg'
  | 'unsupported_alg'
  | 'no_kid'
  | 'no_jwks_key'
  | 'unknown_kid'
  | 'jwks_unavailable'
  | 'no_webcrypto'
  | 'key_unusable'
  // A token signed by our key whose `iss` differs from SUPABASE_URL (a self-hosted stack behind an internal address in the
  // E3 drill, or a custom domain): the auth server decides. Safe — it is the same check every token got before (review P2).
  | 'issuer_mismatch'
  | 'internal_error';

/** Result of one local check. Only `verified` carries claims. */
export type LocalVerifyResult =
  | { outcome: 'verified'; claims: AccessTokenClaims }
  | { outcome: 'rejected'; reason: LocalRejectReason }
  | { outcome: 'fallback'; reason: LocalFallbackReason };

/** The verifier a runtime keeps for one Supabase project. */
export type AccessTokenVerifier = (token: string) => Promise<LocalVerifyResult>;

/** The part of `fetch` the JWKS download needs; the runtime's global `fetch` satisfies it. */
export type FetchLike = (
  url: string,
  init: { signal?: AbortSignal; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The part of WebCrypto the check needs; `crypto.subtle` satisfies it on Deno and Node. */
export type SubtleLike = Pick<SubtleCrypto, 'importKey' | 'verify'>;

/** Options for one project's verifier. Only `supabaseUrl`, `fetch` and `subtle` are required. */
export type AccessTokenVerifierOptions = {
  supabaseUrl: string;
  fetch: FetchLike;
  /** `undefined` when the runtime has no WebCrypto; every token then falls back. */
  subtle: SubtleLike | undefined;
  /** The project's public (anon / publishable) key, sent as `apikey` in case the gateway asks for it. Never a secret. */
  apiKey?: string;
  /** Milliseconds since the epoch; injectable for tests. */
  now?: () => number;
  cacheTtlMs?: number;
  /** After a failed download, fall back immediately for this long instead of retrying on every request. */
  failureRetryMs?: number;
  /** An unknown `kid` triggers one fresh download only if the cached set is at least this old (key rotation). */
  unknownKidRefreshMs?: number;
  fetchTimeoutMs?: number;
  /** Leeway applied to `exp` and `nbf`, in seconds. Default 0. */
  clockSkewSeconds?: number;
};

/** About ten minutes, as agreed for SCALE-04. */
export const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
/** GoTrue's audience for signed-in users. */
export const ACCESS_TOKEN_AUDIENCE = 'authenticated';
/** Smallest RSA modulus accepted for RS256 keys (2048 bits). */
const MIN_RSA_MODULUS_BYTES = 256;

type Jwk = { kty: string; kid: string; alg?: string; use?: string; key_ops?: unknown; crv?: string; x?: string; y?: string; n?: string; e?: string };
type KeySet = { keys: Map<string, Jwk>; imported: Map<string, Promise<CryptoKey | null>>; fetchedAt: number };

/**
 * @purpose The issuer GoTrue stamps on access tokens for a project, used for the `iss` check.
 * @param supabaseUrl The project URL (trailing slashes ignored).
 * @returns `${supabaseUrl}/auth/v1`.
 */
export function supabaseAuthIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
}

/**
 * @purpose Where the project's public signing keys are published.
 * @param supabaseUrl The project URL.
 * @returns `${supabaseUrl}/auth/v1/.well-known/jwks.json`.
 */
export function supabaseJwksUrl(supabaseUrl: string): string {
  return `${supabaseAuthIssuer(supabaseUrl)}/.well-known/jwks.json`;
}

function base64UrlToBytes(segment: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(segment) || segment.length % 4 === 1) return null;
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((segment.length + 3) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(segment);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readJwks(body: unknown): Map<string, Jwk> | null {
  const list = body && typeof body === 'object' ? (body as { keys?: unknown }).keys : undefined;
  if (!Array.isArray(list)) return null;
  const keys = new Map<string, Jwk>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const jwk = raw as Jwk;
    if (typeof jwk.kid !== 'string' || !jwk.kid || typeof jwk.kty !== 'string') continue;
    // Only signing keys; a symmetric (`oct`) entry is never usable here and must never be imported.
    if (jwk.use !== undefined && jwk.use !== 'sig') continue;
    if (jwk.kty !== 'EC' && jwk.kty !== 'RSA') continue;
    keys.set(jwk.kid, jwk);
  }
  return keys;
}

/** The key must be the kind the token's `alg` names; otherwise the token is trying an algorithm switch. */
function keyFitsAlg(jwk: Jwk, alg: 'ES256' | 'RS256'): boolean {
  if (jwk.alg !== undefined && jwk.alg !== alg) return false;
  if (jwk.key_ops !== undefined && !(Array.isArray(jwk.key_ops) && jwk.key_ops.includes('verify'))) return false;
  if (alg === 'ES256') return jwk.kty === 'EC' && jwk.crv === 'P-256';
  return jwk.kty === 'RSA';
}

function algorithmFor(alg: 'ES256' | 'RS256') {
  return alg === 'ES256'
    ? { importParams: { name: 'ECDSA', namedCurve: 'P-256' }, verifyParams: { name: 'ECDSA', hash: 'SHA-256' } }
    : { importParams: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verifyParams: { name: 'RSASSA-PKCS1-v1_5' } };
}

function audienceMatches(aud: unknown): boolean {
  if (typeof aud === 'string') return aud === ACCESS_TOKEN_AUDIENCE;
  return Array.isArray(aud) && aud.includes(ACCESS_TOKEN_AUDIENCE);
}

/**
 * @purpose Create the local access-token verifier for one Supabase project, with its own JWKS cache.
 * @param options Project URL, injected `fetch` / `crypto.subtle`, optional clock and cache tuning.
 * @returns A function that classifies a token as verified, rejected or fallback. It never throws.
 * @sideEffects Downloads the project's JWKS at most once per cache window (plus one refresh for an unknown key id,
 *   and no retry for `failureRetryMs` after a failure). Logs nothing.
 */
export function createAccessTokenVerifier(options: AccessTokenVerifierOptions): AccessTokenVerifier {
  const now = options.now ?? (() => Date.now());
  const ttl = options.cacheTtlMs ?? JWKS_CACHE_TTL_MS;
  const failureRetryMs = options.failureRetryMs ?? 30_000;
  const unknownKidRefreshMs = options.unknownKidRefreshMs ?? 60_000;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 3_000;
  const skew = options.clockSkewSeconds ?? 0;
  const issuer = supabaseAuthIssuer(options.supabaseUrl);
  const url = supabaseJwksUrl(options.supabaseUrl);
  const subtle = options.subtle;

  let cached: KeySet | null = null;
  let failedAt: number | null = null;
  let inflight: Promise<KeySet | null> | null = null;

  async function download(): Promise<KeySet | null> {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), fetchTimeoutMs) : undefined;
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (options.apiKey) headers.apikey = options.apiKey;
      const response = await options.fetch(url, { signal: controller?.signal, headers });
      if (!response.ok) throw new Error(`jwks ${response.status}`);
      const keys = readJwks(await response.json());
      if (!keys) throw new Error('jwks shape');
      cached = { keys, imported: new Map(), fetchedAt: now() };
      failedAt = null;
      return cached;
    } catch {
      failedAt = now();
      return null;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  function refresh(): Promise<KeySet | null> {
    inflight ??= download().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function currentKeys(): Promise<KeySet | null> {
    const t = now();
    if (cached && t - cached.fetchedAt < ttl) return cached;
    if (failedAt !== null && t - failedAt < failureRetryMs) return null;
    return refresh();
  }

  async function findKey(kid: string): Promise<{ set: KeySet; jwk: Jwk } | LocalFallbackReason> {
    let set = await currentKeys();
    if (!set) return 'jwks_unavailable';
    let jwk = set.keys.get(kid);
    if (!jwk && now() - set.fetchedAt >= unknownKidRefreshMs && !(failedAt !== null && now() - failedAt < failureRetryMs)) {
      const fresh = await refresh();
      if (fresh) {
        set = fresh;
        jwk = fresh.keys.get(kid);
      }
    }
    if (jwk) return { set, jwk };
    return set.keys.size === 0 ? 'no_jwks_key' : 'unknown_kid';
  }

  function importKey(set: KeySet, jwk: Jwk, alg: 'ES256' | 'RS256'): Promise<CryptoKey | null> {
    const cacheKey = `${jwk.kid}:${alg}`;
    let pending = set.imported.get(cacheKey);
    if (!pending) {
      // Import only the public components, so stray fields (`d`, `key_ops`, `alg`) cannot change how the key is used.
      const material: JsonWebKey =
        alg === 'ES256' ? { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y } : { kty: 'RSA', n: jwk.n, e: jwk.e };
      const modulus = alg === 'RS256' && typeof jwk.n === 'string' ? base64UrlToBytes(jwk.n) : null;
      pending =
        alg === 'RS256' && (!modulus || modulus.length < MIN_RSA_MODULUS_BYTES)
          ? Promise.resolve(null)
          : (subtle as SubtleLike)
              .importKey('jwk', material, algorithmFor(alg).importParams, false, ['verify'])
              .catch(() => null);
      set.imported.set(cacheKey, pending);
    }
    return pending;
  }

  return async function verifyAccessToken(token: string): Promise<LocalVerifyResult> {
    const fallback = (reason: LocalFallbackReason): LocalVerifyResult => ({ outcome: 'fallback', reason });
    const reject = (reason: LocalRejectReason): LocalVerifyResult => ({ outcome: 'rejected', reason });
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return fallback('malformed');
      const header = decodeJsonSegment(parts[0]);
      if (!header || typeof header.alg !== 'string') return fallback('malformed');
      const alg = header.alg;
      // Refused here and never retried against the auth server: an unsigned token is never acceptable.
      if (alg.toLowerCase() === 'none') return reject('alg_none');
      // Legacy projects sign with a shared secret this path never holds; the auth server decides those.
      if (/^HS\d+$/i.test(alg)) return fallback('symmetric_alg');
      if (alg !== 'ES256' && alg !== 'RS256') return fallback('unsupported_alg');
      if (typeof header.kid !== 'string' || !header.kid) return fallback('no_kid');
      if (!subtle) return fallback('no_webcrypto');

      const found = await findKey(header.kid);
      if (typeof found === 'string') return fallback(found);
      if (!keyFitsAlg(found.jwk, alg)) return reject('key_mismatch');
      const key = await importKey(found.set, found.jwk, alg);
      if (!key) return fallback('key_unusable');

      const signature = base64UrlToBytes(parts[2]);
      // ES256 in a JWS is the raw 64-byte r||s pair, which is also WebCrypto's ECDSA format.
      if (!signature || (alg === 'ES256' && signature.length !== 64)) return reject('bad_signature');
      const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const valid = await subtle.verify(algorithmFor(alg).verifyParams, key, signature, signed);
      if (!valid) return reject('bad_signature');

      // Claims are read only after the signature holds, so an "expired" answer is never given for a forged token.
      const claims = decodeJsonSegment(parts[1]);
      if (!claims) return reject('bad_claims');
      const nowSeconds = now() / 1000;
      if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return reject('bad_claims');
      if (nowSeconds >= claims.exp + skew) return reject('expired');
      if (claims.nbf !== undefined) {
        if (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf)) return reject('bad_claims');
        if (nowSeconds + skew < claims.nbf) return reject('not_yet_valid');
      }
      if (claims.iss !== issuer) return fallback('issuer_mismatch');
      if (!audienceMatches(claims.aud)) return reject('wrong_audience');
      if (typeof claims.sub !== 'string' || !claims.sub) return reject('bad_claims');
      return { outcome: 'verified', claims: claims as AccessTokenClaims };
    } catch {
      return fallback('internal_error');
    }
  };
}
