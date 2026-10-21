/** Validate the public backend connection before SDK construction across native, browser and server callers. */

export type BackendConnectionInput = { url?: string; publicKey?: string };
export type BackendConnection = { url: string; publicKey: string };
export type BackendConnectionReason = 'missing-url' | 'missing-public-key' | 'invalid-url' | 'invalid-public-key' | 'unsafe-public-key';
export type BackendConnectionResult =
  | { status: 'configured'; connection: BackendConnection; reason: null }
  | { status: 'missing' | 'invalid'; connection: null; reason: BackendConnectionReason };

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SIGNED_ALGORITHMS = new Set(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512',
  'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512', 'EdDSA']);
const controls = /[\s\x00-\x1f\x7f]/;

function failure(status: 'missing' | 'invalid', reason: BackendConnectionReason): BackendConnectionResult {
  return { status, connection: null, reason };
}
function origin(value: string): string | null {
  if (value.length > 4096 || controls.test(value)) return null;
  // Check the original spelling before URL normalization can hide routing, backslashes or numeric aliases.
  const parts = /^(https?):\/\/([^/?#\\]+)\/?$/i.exec(value);
  if (!parts || /[@%]/.test(parts[2])) return null;
  const authority = /^(\[[^\]]+\]|[^:]+)(?::([0-9]{1,5}))?$/.exec(parts[2]);
  if (!authority || authority[2] !== undefined && (Number(authority[2]) < 1 || Number(authority[2]) > 65535)) return null;
  try {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
    const host = parsed.hostname;
    // WHATWG URL accepts non-DNS characters such as dollar signs in HTTPS hosts. Those would
    // become interpolation syntax in a generated public dotenv value, so enforce a portable hostname.
    if (!host.startsWith('[') && (host.length > 253 || host.split('.').some(label =>
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) return null;
    if (/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(host) && authority[1] !== host) return null;
    if (parsed.protocol === 'https:') return parsed.origin;
    if (!/^(?:127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(parts[2])) return null;
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== '[::1]') return null;
    return parsed.origin;
  } catch { return null; }
}

function base64Bytes(value: string): number[] | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  let bits = 0, buffer = 0;
  const bytes: number[] = [];
  for (const character of value) {
    buffer = (buffer << 6) | BASE64URL.indexOf(character); bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
    buffer &= (1 << bits) - 1;
  }
  // Nonzero unused bits are a malformed encoding, rather than a second spelling of the same JWT.
  return buffer === 0 ? bytes : null;
}
function objectPart(value: string): Record<string, unknown> | null {
  const bytes = base64Bytes(value);
  if (!bytes) return null;
  try {
    // Built-in URI decoding supplies UTF-8 validation without Buffer, atob, TextDecoder or a vendor import.
    const decoded = decodeURIComponent(bytes.map(byte => '%' + byte.toString(16).padStart(2, '0')).join(''));
    const object: unknown = JSON.parse(decoded);
    return object !== null && typeof object === 'object' && !Array.isArray(object) ? object as Record<string, unknown> : null;
  } catch { return null; }
}
function keyProblem(value: string): BackendConnectionReason | null {
  if (value.length > 8192 || controls.test(value)) return 'invalid-public-key';
  if (/^(?:sb_secret_|sk_live_|sk_test_|sk-|service_role(?:$|[_-])|secret(?:$|[_-]))/i.test(value)) return 'unsafe-public-key';
  if (value.startsWith('sb_publishable_')) return /^sb_publishable_[A-Za-z0-9_-]+$/.test(value) ? null : 'invalid-public-key';
  // The same public value travels through Expo/Next dotenv builds and runtime configuration.
  // Interpolation or quoting syntax could otherwise expand a privileged build variable into a client bundle.
  if (!value.includes('.')) return /^[A-Za-z0-9_-]+$/.test(value) ? null : 'invalid-public-key';
  // Dot-structured values intend to be JWTs; malformed tokens must not escape through the opaque-key case.
  const parts = value.split('.');
  if (parts.length !== 3) return 'invalid-public-key';
  const header = objectPart(parts[0]), claims = objectPart(parts[1]), signature = base64Bytes(parts[2]);
  if (!header || !claims || !signature?.length || typeof header.alg !== 'string' || !SIGNED_ALGORITHMS.has(header.alg)
      || header.typ !== undefined && header.typ !== 'JWT') return 'invalid-public-key';
  if (claims.role !== 'anon' || 'sub' in claims || 'session_id' in claims || claims.aud === 'authenticated'
      || Array.isArray(claims.aud) && claims.aud.includes('authenticated')) return 'unsafe-public-key';
  for (const name of ['iat', 'exp', 'nbf']) {
    if (claims[name] !== undefined && (typeof claims[name] !== 'number' || !Number.isFinite(claims[name]))) return 'invalid-public-key';
  }
  // This classifies public API key shape only; the remote backend still verifies JWT signature and validity.
  return null;
}

/** Pure configuration validation: no environment reads, credentials, network checks or fallback backend. */
export function resolveBackendConnection(input: BackendConnectionInput): BackendConnectionResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('invalid', 'invalid-url');
  if (input.url === undefined || input.url === '') return failure('missing', 'missing-url');
  if (typeof input.url !== 'string') return failure('invalid', 'invalid-url');
  const url = origin(input.url);
  if (!url) return failure('invalid', 'invalid-url');
  if (input.publicKey === undefined || input.publicKey === '') return failure('missing', 'missing-public-key');
  if (typeof input.publicKey !== 'string') return failure('invalid', 'invalid-public-key');
  const reason = keyProblem(input.publicKey);
  if (reason) return failure('invalid', reason);
  return { status:'configured', connection:{ url, publicKey:input.publicKey }, reason:null };
}
