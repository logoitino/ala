/** Validate portable public connection boundaries with the same TypeScript source consumed by app builds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveBackendConnection } from '../../../packages/shared-types/backendConnection.ts';

const publicKey = 'sb_publishable_synthetic_public_configuration';
const jwt = (claims = { role:'anon' }, header = { alg:'HS256', typ:'JWT' }) => [
  Buffer.from(JSON.stringify(header)).toString('base64url'), Buffer.from(JSON.stringify(claims)).toString('base64url'),
  Buffer.alloc(32, 7).toString('base64url'),
].join('.');
const result = (url, key = publicKey) => resolveBackendConnection({ url, publicKey:key });
const rejected = (url, key, reason = 'invalid-url') => assert.deepEqual(result(url, key), { status:'invalid', connection:null, reason });

test('two compatible provider origins share the exact contract without host-specific routing or key changes', () => {
  for (const [input, normalized] of [
    ['https://abcdefghijklmnopqrst.supabase.co/', 'https://abcdefghijklmnopqrst.supabase.co'],
    ['HTTPS://Backend.Owned-Company.COM:443/', 'https://backend.owned-company.com'],
    ['https://api.owned-company.com:8443', 'https://api.owned-company.com:8443'],
  ]) {
    assert.deepEqual(result(input), { status:'configured', connection:{ url:normalized, publicKey }, reason:null });
  }
  assert.equal(result('https://compatible.one', 'opaque-public-api-key').status, 'configured');
  assert.equal(result('https://compatible.two', 'opaque-public-api-key').status, 'configured');
});

test('missing values and runtime type mistakes never create a connection or fabricate credentials', () => {
  assert.deepEqual(resolveBackendConnection({}), { status:'missing', connection:null, reason:'missing-url' });
  assert.deepEqual(resolveBackendConnection({ url:'' }), { status:'missing', connection:null, reason:'missing-url' });
  assert.deepEqual(resolveBackendConnection({ url:'https://compatible.one' }), { status:'missing', connection:null, reason:'missing-public-key' });
  assert.deepEqual(result('https://compatible.one', ''), { status:'missing', connection:null, reason:'missing-public-key' });
  rejected(null, publicKey); rejected(123, publicKey);
  rejected('https://compatible.one', null, 'invalid-public-key');
  rejected('https://compatible.one', ['public'], 'invalid-public-key');
  assert.equal(resolveBackendConnection(null).status, 'invalid');
  assert.equal(resolveBackendConnection([]).status, 'invalid');
});

test('HTTP is confined to literal loopback with optional ports and normalized origins', () => {
  for (const [url, normalized] of [
    ['http://127.0.0.1:54321/', 'http://127.0.0.1:54321'], ['http://[::1]:8080', 'http://[::1]:8080'],
    ['http://127.0.0.1:80/', 'http://127.0.0.1'],
  ]) assert.deepEqual(result(url).connection, { url:normalized, publicKey });
  for (const url of ['http://localhost:8080', 'http://127.1', 'http://2130706433', 'http://0x7f000001',
    'http://127.000.000.001', 'http://[0:0:0:0:0:0:0:1]', 'http://0.0.0.0', 'http://192.168.0.1',
    'http://backend.owned-company.com', 'http://127.0.0.1:99999', 'ftp://127.0.0.1']) rejected(url);
});

test('raw routing, credentials, queries, fragments, slash normalization and whitespace/control ambiguity are refused', () => {
  for (const url of ['https://user:password@compatible.one', 'https://compatible.one/rest/v1', 'https://compatible.one/path/..',
    'https://compatible.one/%2e%2e', 'https://compatible.one//', 'https://compatible.one?key=x',
    'https://compatible.one?', 'https://compatible.one#', 'https://compatible.one/#route',
    'https://compatible.one\\auth', 'https://compatible%2eone', 'https://127.1', 'https://0x7f000001',
    'https://compatible.one:', 'https://compatible.one:0', ' https://compatible.one', 'https://compatible.one ',
    'https://compatible.\none', 'https://compatible.one\u0000', 'https://compatible.one\u007f',
    '//compatible.one', 'https://']) rejected(url);
  rejected('https://'+'a'.repeat(4096)+'.one');
});

test('known privileged secrets, authenticated sessions and service JWTs never reach SDK construction', () => {
  for (const key of ['sb_secret_synthetic', 'SB_SECRET_synthetic', 'sk_live_synthetic', 'sk_test_synthetic',
    'sk-synthetic', 'service_role_synthetic', 'secret-synthetic']) rejected('https://compatible.one', key, 'unsafe-public-key');
  for (const claims of [{ role:'service_role' }, { role:'authenticated', sub:'synthetic-user' },
    { role:'anon', sub:'synthetic-user' }, { role:'anon', session_id:'synthetic-session' },
    { role:'anon', aud:'authenticated' }, { role:'anon', aud:['authenticated'] }, {}]) {
    rejected('https://compatible.one', jwt(claims), 'unsafe-public-key');
  }
});

test('anon JWT shape is accepted unchanged without falsely authenticating signature, expiry or backend compatibility', () => {
  const key = jwt({ iss:'supabase', ref:'synthetic', role:'anon', iat:1, exp:2 });
  assert.deepEqual(result('https://compatible.one/', key), {
    status:'configured', connection:{ url:'https://compatible.one', publicKey:key }, reason:null,
  });
  assert.equal(result('https://compatible.one', jwt({ role:'anon', label:'Sāmoa 🌺' })).status, 'configured');
});

test('malformed intended JWT, non-object metadata, unsigned tokens and invalid time claims cannot pass as opaque keys', () => {
  for (const key of ['one.two', 'one.two.three.four', 'one.two.three', '.payload.signature', jwt()+'.',
    jwt().replace(/^[^.]+/, '%%%'), jwt().replace(/\.[^.]+$/, '.A'), jwt().replace(/\.[^.]+$/, '.AB'),
    jwt({ role:'anon' }, { alg:'none' }), jwt({ role:'anon' }, { alg:'HS256', typ:'not-JWT' }),
    jwt(['anon']), jwt(null), jwt({ role:'anon' }, []), jwt({ role:'anon', exp:'later' }),
    jwt({ role:'anon', iat:null }), jwt({ role:'anon', nbf:false })]) {
    rejected('https://compatible.one', key, 'invalid-public-key');
  }
});

test('key control/space values, empty publishable payload and bounded input failures have fixed redacted reasons', () => {
  for (const key of [' public', 'public ', 'public\nkey', 'public\tkey', 'public\u0000key', 'public\u007fkey',
    'sb_publishable_', 'sb_publishable_one.two.three', 'a'.repeat(8193)]) rejected('https://compatible.one', key, 'invalid-public-key');
  const secrets = ['sb_secret_hidden-value', jwt({ role:'service_role', private:'hidden-value' })];
  for (const key of secrets) {
    const text = JSON.stringify(result('https://compatible.one', key));
    assert.equal(text.includes(key), false); assert.equal(text.includes('hidden-value'), false);
  }
  assert.equal(JSON.stringify(result('https://user:hidden-value@compatible.one')).includes('hidden-value'), false);
});

test('portable opaque keys reject dotenv expansion and quoting syntax before a public build file can be emitted', () => {
  for (const key of ['${STRIPE_SECRET_KEY}', 'opaque$PRIVATE_SECRET', 'opaque"key', "opaque'key", 'opaque`key',
    'opaque\\key', 'opaque#key', 'opaque;key', 'opaque=key', 'opaque:key']) {
    rejected('https://compatible.one', key, 'invalid-public-key');
    assert.equal(JSON.stringify(result('https://compatible.one', key)).includes(key), false);
  }
  assert.equal(result('https://compatible.one', 'opaque_PUBLIC-token_123').status, 'configured');
  for (const url of ['https://api.${secret}.com', 'https://api.$secret.com', 'https://api."quote.com',
    'https://api.`tick.com', 'https://api.{value}.com', 'https://api.'+'a'.repeat(64)+'.com']) rejected(url);
});

test('resolver is deterministic, leaves caller input intact and executes when Node/browser decoding and env globals are absent', () => {
  const input = Object.freeze({ url:'https://compatible.one/', publicKey:jwt({ role:'anon' }) });
  assert.deepEqual(resolveBackendConnection(input), resolveBackendConnection(input));
  assert.equal(input.url, 'https://compatible.one/');
  const key = jwt({ role:'anon', label:'Sāmoa' });
  const script = `const {resolveBackendConnection}=await import(${JSON.stringify(new URL('../../../packages/shared-types/backendConnection.ts', import.meta.url).href)});\nglobalThis.Buffer=undefined; globalThis.atob=undefined; globalThis.TextDecoder=undefined; globalThis.process=undefined;\nconst result=resolveBackendConnection({url:'https://compatible.one',publicKey:${JSON.stringify(key)}});\nif(result.status!=='configured') throw Error('Portable globals failed');\n`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding:'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('actual package subpath export resolves the same TypeScript implementation under native Node24 stripping', () => {
  const script = `const {resolveBackendConnection}=await import('@tapuai/shared-types/backendConnection');\nconst result=resolveBackendConnection({url:'https://compatible.one',publicKey:'synthetic-public-api-key'});\nif(result.status!=='configured'||result.connection.url!=='https://compatible.one') throw Error('Package contract failed');\n`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd:new URL('../../../apps/mobile/', import.meta.url), encoding:'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
