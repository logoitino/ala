/** Changes in actual public app origins must invalidate an old expected backup project without leaking private key values. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sourceOriginMatches } from '../health_source.mjs';

async function fixture(fn) {
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'tapuai-health-source-')));
  const put=async(file,text)=>{await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),text);};
  try {await fn(root,put);} finally {await fs.rm(root,{recursive:true,force:true});}
}
test('all configured public URLs must match; key values stay uninterpreted and reads leave content untouched',()=>fixture(async(root,put)=>{
  await put('apps/mobile/.env.local','EXPO_PUBLIC_SUPABASE_URL="https://source.supabase.co/"\nSERVER_SECRET=$(touch forbidden)\n');
  await put('apps/admin-portal/.env.local','NEXT_PUBLIC_SUPABASE_URL=https://source.supabase.co\n');
  const before=await fs.readFile(path.join(root,'apps/mobile/.env.local'));
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),true);
  assert.deepEqual(await fs.readFile(path.join(root,'apps/mobile/.env.local')),before);
  await put('apps/admin-portal/.env.local','NEXT_PUBLIC_SUPABASE_URL=https://other.supabase.co\n');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),false);
}));
test('missing origins stay unproven and provided process public URL drift fails',()=>fixture(async(root)=>{
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),null);
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{EXPO_PUBLIC_SUPABASE_URL:'https://source.supabase.co'}),null);
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{EXPO_PUBLIC_SUPABASE_URL:'https://source.supabase.co',NEXT_PUBLIC_SUPABASE_URL:'https://source.supabase.co'}),true);
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}),false);
}));
test('missing one app and private production/development override origins stay unready',()=>fixture(async(root,put)=>{
  await put('apps/mobile/.env.local','EXPO_PUBLIC_SUPABASE_URL=https://source.supabase.co');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),null);
  await put('apps/admin-portal/.env.local','NEXT_PUBLIC_SUPABASE_URL=https://source.supabase.co');
  await put('apps/admin-portal/.env.production.local','export NEXT_PUBLIC_SUPABASE_URL=https://other.supabase.co');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),false);
  await put('apps/admin-portal/.env.production.local','export NEXT_PUBLIC_SUPABASE_URL=https://source.supabase.co');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),true);
  await put('apps/mobile/.env.development','export EXPO_PUBLIC_SUPABASE_URL=${UNRESOLVED}');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),false);
}));
test('duplicate links interpolated credentials and invalid routes never produce a match or disclose their values',()=>fixture(async(root,put)=>{
  for(const value of [
    'EXPO_PUBLIC_SUPABASE_URL=https://source.supabase.co\nEXPO_PUBLIC_SUPABASE_URL=https://source.supabase.co',
    'EXPO_PUBLIC_SUPABASE_URL=${PRIVATE_SECRET}',
    'EXPO_PUBLIC_SUPABASE_URL=https://user:PRIVATE_SECRET@source.supabase.co',
    'EXPO_PUBLIC_SUPABASE_URL=https://source.supabase.co/rest/v1',
  ]) {await put('apps/mobile/.env.local',value);assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),false);}
  const filename=path.join(root,'apps/mobile/.env.local');
  await fs.rename(filename,path.join(root,'private.env'));await fs.symlink(path.join(root,'private.env'),filename);
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',{}),false);
}));
test('server SUPABASE_URL override must match all public clients and cannot replace missing client evidence',()=>fixture(async(root,put)=>{
  const environment={EXPO_PUBLIC_SUPABASE_URL:'https://source.supabase.co',NEXT_PUBLIC_SUPABASE_URL:'https://source.supabase.co',SUPABASE_URL:'https://other.supabase.co'};
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',environment),false);
  environment.SUPABASE_URL='https://source.supabase.co';
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',environment),true);
  await put('apps/mobile/.env.production','SUPABASE_URL=https://other.supabase.co');
  assert.equal(await sourceOriginMatches(root,'https://source.supabase.co',environment),false);
  assert.equal(await sourceOriginMatches(root,'https://other.supabase.co',{SUPABASE_URL:'https://other.supabase.co'}),null);
}));
