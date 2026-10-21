import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminMfaHref,
  adminMfaRequired,
  adminMfaStep,
  isAdminMfaRequired,
  mfaErrorText,
  normalizeTotpCode,
  readAalClaim,
  readAdminMfaStep,
  safeNextPath,
  unverifiedTotpFactors,
  verifiedTotpFactors,
} from './adminMfa.ts';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const verified = { id: 'f-1', factor_type: 'totp', status: 'verified' };
const halfSetUp = { id: 'f-2', factor_type: 'totp', status: 'unverified' };
const phone = { id: 'f-3', factor_type: 'phone', status: 'verified' };

test('the switch is off unless explicitly turned on', () => {
  for (const raw of [undefined, null, '', '0', 'false', 'off', 'no', 'maybe', ' TRUE1 ']) {
    assert.equal(adminMfaRequired(raw), false, String(raw));
  }
  for (const raw of ['1', 'true', 'TRUE', ' on ', 'yes']) assert.equal(adminMfaRequired(raw), true, raw);
});

test('switch off: every session passes as before', () => {
  for (const currentLevel of [null, 'aal1', 'aal2'] as const) {
    assert.equal(adminMfaStep({ required: false, currentLevel, factors: [] }), 'off');
  }
});

test('switch on: only aal2 passes; aal1 or a missing claim is refused', () => {
  assert.equal(adminMfaStep({ required: true, currentLevel: 'aal2', factors: [verified] }), 'pass');
  assert.equal(adminMfaStep({ required: true, currentLevel: 'aal1', factors: [verified] }), 'verify');
  assert.equal(adminMfaStep({ required: true, currentLevel: null, factors: [verified] }), 'verify');
  assert.equal(adminMfaStep({ required: true, currentLevel: 'aal1', factors: [] }), 'enroll');
  assert.equal(adminMfaStep({ required: true, currentLevel: 'aal1', factors: undefined }), 'enroll');
  // A half-finished setup or a non-TOTP factor does not count as set up.
  assert.equal(adminMfaStep({ required: true, currentLevel: 'aal1', factors: [halfSetUp, phone] }), 'enroll');
});

test('factor filters split finished and half-finished TOTP setups', () => {
  assert.deepEqual(verifiedTotpFactors([verified, halfSetUp, phone]).map((f) => f.id), ['f-1']);
  assert.deepEqual(unverifiedTotpFactors([verified, halfSetUp, phone]).map((f) => f.id), ['f-2']);
  assert.deepEqual(verifiedTotpFactors(null), []);
});

test('reads the aal claim and fails closed on anything unreadable', () => {
  assert.equal(readAalClaim(jwt({ sub: 'u', aal: 'aal2' })), 'aal2');
  assert.equal(readAalClaim(jwt({ sub: 'u', aal: 'aal1', email: 'tēst@example.com' })), 'aal1');
  assert.equal(readAalClaim(jwt({ sub: 'u', aal: 'aal3' })), null);
  assert.equal(readAalClaim(jwt({ sub: 'u' })), null);
  assert.equal(readAalClaim('not-a-token'), null);
  assert.equal(readAalClaim('a.%%%.c'), null);
  assert.equal(readAalClaim(`a.${Buffer.from('{oops').toString('base64url')}.c`), null);
  assert.equal(readAalClaim(null), null);
});

test('codes: six digits, spaces and dashes ignored', () => {
  assert.equal(normalizeTotpCode('123456'), '123456');
  assert.equal(normalizeTotpCode(' 123 456 '), '123456');
  assert.equal(normalizeTotpCode('123-456'), '123456');
  for (const bad of ['', '12345', '1234567', '12a456']) assert.equal(normalizeTotpCode(bad), null, bad);
});

test('next paths stay on this site', () => {
  assert.equal(safeNextPath('/money?tab=1'), '/money?tab=1');
  for (const bad of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/a\nb']) {
    assert.equal(safeNextPath(bad), '/', String(bad));
  }
  assert.equal(adminMfaHref('/trends?w=7'), '/login/mfa?next=%2Ftrends%3Fw%3D7');
  assert.equal(adminMfaHref('//evil.example'), '/login/mfa?next=%2F');
});

test('MFA errors read as plain words', () => {
  assert.match(mfaErrorText({ code: 'mfa_totp_enroll_not_enabled', message: 'x' }), /not turned on/);
  assert.match(mfaErrorText({ code: 'mfa_verification_failed' }), /did not match/);
  assert.equal(mfaErrorText(new Error('Server said no')), 'Server said no');
  assert.equal(mfaErrorText(undefined), 'Two-step sign-in did not finish. Try again.');
});

type FakeCalls = { getSession: number; aal: string[] };
function fakeSupabase(token: string | null, freshLevel: string | null, calls: FakeCalls) {
  return {
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return { data: { session: token ? { access_token: token } : null }, error: null };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async (jwtArg: string) => {
          calls.aal.push(jwtArg);
          return { data: { currentLevel: freshLevel, nextLevel: 'aal2', currentAuthenticationMethods: [] }, error: null };
        },
      },
    },
  } as never;
}

async function withSwitch<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const before = process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA;
  if (value === undefined) delete process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA;
  else process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA = value;
  try {
    return await run();
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA;
    else process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA = before;
  }
}

test('portal switch off: no Supabase call at all', async () => {
  await withSwitch(undefined, async () => {
    const calls: FakeCalls = { getSession: 0, aal: [] };
    assert.equal(isAdminMfaRequired(), false);
    assert.equal(await readAdminMfaStep(fakeSupabase(jwt({ aal: 'aal1' }), 'aal1', calls), { factors: [] }, 'fresh'), 'off');
    assert.deepEqual(calls, { getSession: 0, aal: [] });
  });
});

test('portal switch on: middleware decodes, layout re-checks with Supabase Auth', async () => {
  await withSwitch('true', async () => {
    const token = jwt({ aal: 'aal1' });
    const local: FakeCalls = { getSession: 0, aal: [] };
    assert.equal(await readAdminMfaStep(fakeSupabase(token, 'aal2', local), { factors: [verified] }, 'local'), 'verify');
    assert.deepEqual(local.aal, []);

    const fresh: FakeCalls = { getSession: 0, aal: [] };
    // The server answer wins over the decoded claim on the fresh path.
    assert.equal(await readAdminMfaStep(fakeSupabase(token, 'aal2', fresh), { factors: [verified] }, 'fresh'), 'pass');
    assert.deepEqual(fresh.aal, [token]);

    const unknown: FakeCalls = { getSession: 0, aal: [] };
    assert.equal(await readAdminMfaStep(fakeSupabase(token, 'aal3', unknown), { factors: [] }, 'fresh'), 'enroll');
    const none: FakeCalls = { getSession: 0, aal: [] };
    assert.equal(await readAdminMfaStep(fakeSupabase(null, 'aal2', none), { factors: [verified] }, 'fresh'), 'verify');
    assert.deepEqual(none.aal, []);
  });
});
