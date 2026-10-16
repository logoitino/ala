/**
 * Local access-token verification (shared money core, `supabase/functions/_shared/money/accessToken.ts`) and the
 * session decision built on it. Real ES256 / RS256 key pairs come from Node's `crypto`; the JWKS download is a fake
 * `fetch`, so nothing leaves the machine. Covers valid, expired, wrong issuer / audience, tampered signature, unknown
 * key id, `alg: none`, HS256 fallback and JWKS failure fallback, plus the cache and key-confusion rules.
 */
import { createHmac, generateKeyPairSync, sign as nodeSign, webcrypto, type KeyObject } from 'node:crypto';

import {
  createAccessTokenVerifier,
  supabaseJwksUrl,
  type AccessTokenVerifierOptions,
  type FetchLike,
  type SubtleLike,
} from '../../../../../supabase/functions/_shared/money/accessToken.ts';
import { resolveSession } from '../../../../../supabase/functions/_shared/money/session.ts';

const PROJECT = 'https://proj.example.test';
const ISSUER = `${PROJECT}/auth/v1`;
const NOW_MS = Date.UTC(2026, 9, 14, 12, 0, 0);
const NOW_S = NOW_MS / 1000;
const subtle = webcrypto.subtle as unknown as SubtleLike;

const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ecOther = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaSmall = generateKeyPairSync('rsa', { modulusLength: 1024 });

const jwk = (key: KeyObject, kid: string, extra: Record<string, unknown> = {}) => ({
  ...(key.export({ format: 'jwk' }) as Record<string, unknown>),
  kid,
  use: 'sig',
  ...extra,
});
const JWKS = { keys: [jwk(ec.publicKey, 'ec-1', { alg: 'ES256' }), jwk(rsa.publicKey, 'rsa-1', { alg: 'RS256' })] };

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const goodClaims = (overrides: Record<string, unknown> = {}) => ({
  sub: 'user-123',
  email: 'fan@example.test',
  role: 'authenticated',
  aud: 'authenticated',
  iss: ISSUER,
  iat: NOW_S - 60,
  exp: NOW_S + 3600,
  ...overrides,
});

function token(opts: { alg?: string; kid?: string | null; claims?: Record<string, unknown>; key?: KeyObject; hmac?: string }) {
  const alg = opts.alg ?? 'ES256';
  const header: Record<string, unknown> = { alg, typ: 'JWT' };
  if (opts.kid !== null) header.kid = opts.kid ?? (alg === 'RS256' ? 'rsa-1' : 'ec-1');
  const input = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(opts.claims ?? goodClaims()))}`;
  let signature = '';
  if (alg === 'ES256') signature = b64(nodeSign('sha256', Buffer.from(input), { key: opts.key ?? ec.privateKey, dsaEncoding: 'ieee-p1363' }));
  else if (alg === 'RS256') signature = b64(nodeSign('sha256', Buffer.from(input), opts.key ?? rsa.privateKey));
  else if (alg === 'HS256') signature = createHmac('sha256', opts.hmac ?? 'legacy-secret').update(input).digest('base64url');
  return `${input}.${signature}`;
}

function setup(overrides: Partial<AccessTokenVerifierOptions> & { jwks?: unknown; clock?: { ms: number } } = {}) {
  const clock = overrides.clock ?? { ms: NOW_MS };
  let jwks: unknown = overrides.jwks ?? JWKS;
  const fetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => ({
    ok: true,
    status: 200,
    json: async () => jwks,
  }));
  const verify = createAccessTokenVerifier({
    supabaseUrl: PROJECT,
    apiKey: 'public-anon',
    fetch: fetchMock,
    subtle,
    now: () => clock.ms,
    ...overrides,
  });
  return { verify, fetchMock, clock, setJwks: (next: unknown) => { jwks = next; } };
}

describe('local access-token verification', () => {
  test('a valid ES256 token verifies and the JWKS is fetched once with the public key header', async () => {
    const { verify, fetchMock } = setup();
    expect(await verify(token({}))).toEqual({ outcome: 'verified', claims: goodClaims() });
    expect(await verify(token({ claims: goodClaims({ sub: 'user-456' }) }))).toMatchObject({ outcome: 'verified' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${ISSUER}/.well-known/jwks.json`);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ accept: 'application/json', apikey: 'public-anon' });
  });

  test('a valid RS256 token verifies', async () => {
    const { verify } = setup();
    expect(await verify(token({ alg: 'RS256' }))).toMatchObject({ outcome: 'verified', claims: { sub: 'user-123' } });
  });

  test('the JWKS URL ignores a trailing slash on the project URL', async () => {
    expect(supabaseJwksUrl(`${PROJECT}/`)).toBe(`${ISSUER}/.well-known/jwks.json`);
    const { verify } = setup({ supabaseUrl: `${PROJECT}/` });
    expect((await verify(token({}))).outcome).toBe('verified');
  });

  test.each([
    ['expired', goodClaims({ exp: NOW_S - 1 }), 'expired'],
    ['expiring this second', goodClaims({ exp: NOW_S }), 'expired'],
    ['not yet valid', goodClaims({ nbf: NOW_S + 60 }), 'not_yet_valid'],
    ['wrong audience', goodClaims({ aud: 'anon' }), 'wrong_audience'],
    ['no audience', goodClaims({ aud: undefined }), 'wrong_audience'],
    ['no subject', goodClaims({ sub: '' }), 'bad_claims'],
    ['no expiry', goodClaims({ exp: undefined }), 'bad_claims'],
  ])('%s is rejected', async (_label, claims, reason) => {
    const { verify } = setup();
    expect(await verify(token({ claims }))).toEqual({ outcome: 'rejected', reason });
    expect(await verify(token({ alg: 'RS256', claims }))).toEqual({ outcome: 'rejected', reason });
  });

  test('a foreign issuer is not decided locally: the auth server checks it (review P2)', async () => {
    const { verify } = setup();
    const claims = goodClaims({ iss: 'https://other.example.test/auth/v1' });
    expect(await verify(token({ claims }))).toEqual({ outcome: 'fallback', reason: 'issuer_mismatch' });
  });

  test('a past nbf and an audience list containing authenticated are accepted', async () => {
    const { verify } = setup();
    const claims = goodClaims({ nbf: NOW_S - 5, aud: ['other', 'authenticated'] });
    expect((await verify(token({ claims }))).outcome).toBe('verified');
  });

  test('clock skew leeway applies to exp', async () => {
    const { verify } = setup({ clockSkewSeconds: 30 });
    expect((await verify(token({ claims: goodClaims({ exp: NOW_S - 10 }) }))).outcome).toBe('verified');
  });

  test('a tampered signature, payload or foreign key is rejected', async () => {
    const { verify } = setup();
    const good = token({});
    const [h, p, s] = good.split('.');
    const sig = Buffer.from(s, 'base64url');
    sig[10] ^= 0xff;
    expect(await verify(`${h}.${p}.${sig.toString('base64url')}`)).toEqual({ outcome: 'rejected', reason: 'bad_signature' });
    const forgedPayload = b64(JSON.stringify(goodClaims({ sub: 'someone-else' })));
    expect(await verify(`${h}.${forgedPayload}.${s}`)).toEqual({ outcome: 'rejected', reason: 'bad_signature' });
    expect(await verify(token({ key: ecOther.privateKey }))).toEqual({ outcome: 'rejected', reason: 'bad_signature' });
    expect(await verify(`${h}.${p}.${s.slice(0, 20)}`)).toEqual({ outcome: 'rejected', reason: 'bad_signature' });
    const rsaGood = token({ alg: 'RS256' }).split('.');
    expect(await verify(`${rsaGood[0]}.${forgedPayload}.${rsaGood[2]}`)).toEqual({ outcome: 'rejected', reason: 'bad_signature' });
  });

  test('alg none is refused without fetching keys', async () => {
    const { verify, fetchMock } = setup();
    const unsigned = `${b64(JSON.stringify({ alg: 'none', kid: 'ec-1' }))}.${b64(JSON.stringify(goodClaims()))}.`;
    expect(await verify(unsigned)).toEqual({ outcome: 'rejected', reason: 'alg_none' });
    const upper = `${b64(JSON.stringify({ alg: 'NONE' }))}.${b64(JSON.stringify(goodClaims()))}.`;
    expect(await verify(upper)).toEqual({ outcome: 'rejected', reason: 'alg_none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('HS256 (legacy shared secret) falls back without fetching keys', async () => {
    const { verify, fetchMock } = setup();
    expect(await verify(token({ alg: 'HS256', kid: null }))).toEqual({ outcome: 'fallback', reason: 'symmetric_alg' });
    expect(await verify(token({ alg: 'HS256', kid: 'ec-1' }))).toEqual({ outcome: 'fallback', reason: 'symmetric_alg' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('an unknown kid falls back, and refreshes the keys once the cache is a minute old', async () => {
    const { verify, fetchMock, clock, setJwks } = setup();
    const rotated = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const rotatedToken = token({ kid: 'ec-2', key: rotated.privateKey });
    expect(await verify(rotatedToken)).toEqual({ outcome: 'fallback', reason: 'unknown_kid' });
    expect(await verify(rotatedToken)).toEqual({ outcome: 'fallback', reason: 'unknown_kid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    setJwks({ keys: [...JWKS.keys, jwk(rotated.publicKey, 'ec-2')] });
    clock.ms += 61_000;
    expect((await verify(token({ kid: 'ec-2', key: rotated.privateKey, claims: goodClaims({ exp: NOW_S + 3600 }) }))).outcome).toBe('verified');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('a missing kid, unsupported alg or malformed token falls back', async () => {
    const { verify } = setup();
    expect(await verify(token({ kid: null }))).toEqual({ outcome: 'fallback', reason: 'no_kid' });
    expect(await verify(`${b64(JSON.stringify({ alg: 'PS256', kid: 'rsa-1' }))}.e30.sig`)).toEqual({
      outcome: 'fallback',
      reason: 'unsupported_alg',
    });
    expect(await verify('private-jwt')).toEqual({ outcome: 'fallback', reason: 'malformed' });
    expect(await verify('a.b')).toEqual({ outcome: 'fallback', reason: 'malformed' });
    expect(await verify('!!!.e30.sig')).toEqual({ outcome: 'fallback', reason: 'malformed' });
  });

  test.each([
    ['a network error', async () => { throw new Error('offline'); }],
    ['a 503', async () => ({ ok: false, status: 503, json: async () => ({}) })],
    ['a body without keys', async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) })],
    ['invalid JSON', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })],
  ])('JWKS failure (%s) falls back and is not retried for 30 seconds', async (_label, failing) => {
    const clock = { ms: NOW_MS };
    const fetchMock = jest.fn(failing as FetchLike);
    const verify = createAccessTokenVerifier({ supabaseUrl: PROJECT, fetch: fetchMock, subtle, now: () => clock.ms });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'jwks_unavailable' });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'jwks_unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => JWKS }));
    clock.ms += 31_000;
    expect((await verify(token({ claims: goodClaims({ exp: NOW_S + 3600 }) }))).outcome).toBe('verified');
  });

  test('a JWKS download that hangs is aborted and falls back', async () => {
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const verify = createAccessTokenVerifier({ supabaseUrl: PROJECT, fetch: hanging, subtle, now: () => NOW_MS, fetchTimeoutMs: 20 });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'jwks_unavailable' });
  });

  test('an empty JWKS (legacy project) falls back', async () => {
    const { verify } = setup({ jwks: { keys: [] } });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'no_jwks_key' });
  });

  test('symmetric or encryption keys in the JWKS are ignored', async () => {
    const { verify } = setup({ jwks: { keys: [{ kty: 'oct', kid: 'ec-1', k: 'c2VjcmV0' }, { ...jwk(ec.publicKey, 'ec-1'), use: 'enc' }] } });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'no_jwks_key' });
  });

  test('a key that does not fit the token alg is rejected (no algorithm switching)', async () => {
    const { verify } = setup({
      jwks: { keys: [jwk(rsa.publicKey, 'rsa-1'), jwk(ec.publicKey, 'ec-1', { alg: 'RS256' }), jwk(ec.publicKey, 'ec-ops', { key_ops: ['sign'] })] },
    });
    expect(await verify(token({ alg: 'ES256', kid: 'rsa-1' }))).toEqual({ outcome: 'rejected', reason: 'key_mismatch' });
    expect(await verify(token({ alg: 'RS256', kid: 'ec-1', key: rsa.privateKey }))).toEqual({ outcome: 'rejected', reason: 'key_mismatch' });
    expect(await verify(token({ alg: 'ES256', kid: 'ec-1' }))).toEqual({ outcome: 'rejected', reason: 'key_mismatch' });
    expect(await verify(token({ alg: 'ES256', kid: 'ec-ops' }))).toEqual({ outcome: 'rejected', reason: 'key_mismatch' });
  });

  test('an RSA key under 2048 bits is not used', async () => {
    const { verify } = setup({ jwks: { keys: [jwk(rsaSmall.publicKey, 'rsa-small')] } });
    expect(await verify(token({ alg: 'RS256', kid: 'rsa-small', key: rsaSmall.privateKey }))).toEqual({
      outcome: 'fallback',
      reason: 'key_unusable',
    });
  });

  test('no WebCrypto means every token falls back', async () => {
    const { verify, fetchMock } = setup({ subtle: undefined });
    expect(await verify(token({}))).toEqual({ outcome: 'fallback', reason: 'no_webcrypto' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('the cache expires after about ten minutes', async () => {
    const { verify, fetchMock, clock } = setup();
    await verify(token({}));
    clock.ms += 9 * 60_000;
    await verify(token({ claims: goodClaims({ exp: NOW_S + 3600 }) }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock.ms += 2 * 60_000;
    await verify(token({ claims: goodClaims({ exp: NOW_S + 3600 }) }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('concurrent first requests share one download', async () => {
    const { verify, fetchMock } = setup();
    await Promise.all([verify(token({})), verify(token({ alg: 'RS256' })), verify(token({}))]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('session decision', () => {
  const liveUser = { id: 'live-user', email: 'live@example.test' };

  test('a locally verified token skips the auth server', async () => {
    const getUser = jest.fn();
    const { verify } = setup();
    expect(await resolveSession(token({}), { getUser, verifyLocally: verify })).toEqual({
      ok: true,
      checkedBy: 'local',
      user: { id: 'user-123', email: 'fan@example.test' },
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  test('a locally refused token is a failure with a provider-style code, no auth server call', async () => {
    const getUser = jest.fn();
    const { verify } = setup();
    expect(await resolveSession(token({ claims: goodClaims({ exp: NOW_S - 1 }) }), { getUser, verifyLocally: verify })).toEqual({
      ok: false,
      checkedBy: 'local',
      error: { code: 'jwt_expired', source: 'local' },
    });
    expect(await resolveSession(token({ claims: goodClaims({ aud: 'x' }) }), { getUser, verifyLocally: verify })).toMatchObject({
      error: { code: 'bad_jwt' },
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  test.each([
    ['HS256', () => token({ alg: 'HS256', kid: null }), {}],
    ['unknown kid', () => token({ kid: 'nope' }), {}],
    ['JWKS failure', () => token({}), { fetch: (async () => { throw new Error('offline'); }) as FetchLike }],
  ])('%s falls back to the live lookup', async (_label, make, options) => {
    const getUser = jest.fn().mockResolvedValue({ user: liveUser, error: null });
    const { verify } = setup(options);
    const jwt = make();
    expect(await resolveSession(jwt, { getUser, verifyLocally: verify })).toEqual({ ok: true, checkedBy: 'live', user: liveUser });
    expect(getUser).toHaveBeenCalledWith(jwt);
  });

  test('without verifyLocally (money-moving routes) even a valid token goes to the live lookup', async () => {
    const error = { code: 'session_not_found' };
    const getUser = jest.fn().mockResolvedValue({ user: null, error });
    expect(await resolveSession(token({}), { getUser })).toEqual({ ok: false, checkedBy: 'live', error });
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  test('a thrown live lookup propagates unchanged', async () => {
    const original = new Error('auth down');
    await expect(resolveSession('opaque', { getUser: () => Promise.reject(original) })).rejects.toBe(original);
  });
});
