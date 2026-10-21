/** Installed SDK contract tests must stay entirely local and never imply real service authentication, SQL or hosted parity. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loopbackFetch,runLocalContracts} from '../protocol.mjs';

test('actual installed SDK passes ten scoped local protocol flows and reports unexercised live services',async()=>{
  const result=await runLocalContracts();
  assert.equal(result.passed,true);assert.equal(result.gates.length,10);assert.equal(result.requestCount,11);
  assert.equal(result.providerContacted,false);assert.equal(result.readyToCutOver,false);
  for(const item of ['real-database-and-rls','oauth-and-mfa','realtime-websockets','stripe','deployed-backend-parity']) assert.ok(result.notExercised.includes(item));
  assert.ok(!JSON.stringify(result).includes('access_token'));assert.ok(!JSON.stringify(result).includes('fixture-password'));
});
test('transport refuses every other origin and credential URL before any request or DNS operation',async()=>{
  let calls=0;const transport=async()=>{calls++;return new Response('{}');};
  const fetch=loopbackFetch('http://127.0.0.1:12345',transport);
  for(const target of ['https://outside.invalid/rest/v1/items','http://127.0.0.1:12346/rest/v1/items','http://user:secret@127.0.0.1:12345/rest/v1/items',new Request('https://outside.invalid')]) await assert.rejects(fetch(target),/Nonfixture/);
  assert.equal(calls,0);
  for(const origin of ['https://outside.invalid','http://localhost:12345','http://127.0.0.1','http://127.0.0.1:12345/path']) assert.throws(()=>loopbackFetch(origin,transport));
});
test('credential redirects are manual and rejected without following their Location',async()=>{
  let options,calls=0;const fetch=loopbackFetch('http://127.0.0.1:12345',async(input,init)=>{options=init;calls++;return new Response('',{status:302,headers:{Location:'https://outside.invalid'}});});
  await assert.rejects(fetch('http://127.0.0.1:12345/auth/v1/user',{redirect:'follow',headers:{Authorization:'Bearer synthetic'}}),/redirect refused/);
  assert.equal(options.redirect,'manual');assert.equal(calls,1);
});
