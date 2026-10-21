/** Target configuration must stay consistent under actual dotenv loading and preserve private source/operator custody. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createProfile,verifyProfile,validateProfile} from '../profile.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const script=fileURLToPath(new URL('../profile.mjs',import.meta.url));
const profile={schemaVersion:1,backendUrl:'https://api.owned.example/',apiOrigin:'https://app.owned.example/',publicKey:'sb_publishable_synthetic_profile'};
async function fixture(fn) {
  const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'tapuai-profile-test-')));
  const configFile=path.join(base,'input.json'),outputDir=path.join(base,'output');
  await fs.writeFile(configFile,JSON.stringify(profile),{mode:0o600});
  try {await fn({base,configFile,outputDir});} finally {await fs.rm(base,{recursive:true,force:true});}
}
test('fresh matching target files preserve public values and private modes without source env copying',()=>fixture(async({base,configFile,outputDir})=>{
  await fs.writeFile(configFile,JSON.stringify({...profile,_comment:'PRIVATE_COMMENT_MARKER'}));
  const original=await fs.readFile(configFile);
  const result=await createProfile({configFile,outputDir});
  assert.equal(result.readyToCutOver,false);assert.equal(result.configurationInstalled,false);assert.equal(result.providerContacted,false);
  assert.equal((await fs.stat(outputDir)).mode&0o777,0o700);
  for(const name of await fs.readdir(outputDir)) {
    assert.equal((await fs.stat(path.join(outputDir,name))).mode&0o777,0o600);
    assert.ok(!(await fs.readFile(path.join(outputDir,name),'utf8')).includes('PRIVATE_COMMENT_MARKER'));
  }
  const python=`import sys,json
sys.path.insert(0,sys.argv[1])
from common import load_env
rows=[load_env(path) for path in sys.argv[2:]]
print(json.dumps([{k:v for k,v in row.items() if k in ('EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY','EXPO_PUBLIC_API_ORIGIN','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY')} for row in rows]))`;
  const rows=JSON.parse(execFileSync('python3',['-c',python,path.join(root,'infrastructure/backup'),...['mobile.env','admin.env','server.env'].map(name=>path.join(outputDir,name))],{encoding:'utf8'}));
  assert.equal(rows[0].EXPO_PUBLIC_SUPABASE_URL,'https://api.owned.example');
  assert.equal(rows[1].NEXT_PUBLIC_SUPABASE_URL,rows[0].EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(rows[2].SUPABASE_URL,rows[0].EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(rows[0].EXPO_PUBLIC_SUPABASE_ANON_KEY,profile.publicKey);
  assert.equal(rows[1].NEXT_PUBLIC_SUPABASE_ANON_KEY,profile.publicKey);
  assert.equal(rows[2].SUPABASE_ANON_KEY,profile.publicKey);assert.equal(rows[2].SUPABASE_SERVICE_ROLE_KEY,'');
  assert.deepEqual(await fs.readFile(configFile),original);
  assert.equal((await verifyProfile(outputDir)).integrity,'verified');
}));
test('Next actual dotenv loading keeps generated public settings unchanged without private-variable expansion',()=>fixture(async({base,configFile,outputDir})=>{
  await createProfile({configFile,outputDir});
  const target=path.join(base,'target');await fs.mkdir(target);await fs.copyFile(path.join(outputDir,'admin.env'),path.join(target,'.env.local'));
  const require=createRequire(new URL('../../../apps/admin-portal/package.json',import.meta.url));
  const envPackage=require.resolve('@next/env');
  const code=`const {loadEnvConfig}=require(process.argv[1]);const loaded=loadEnvConfig(process.argv[2],false,undefined,true);console.log(JSON.stringify({url:loaded.combinedEnv.NEXT_PUBLIC_SUPABASE_URL,key:loaded.combinedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}));`;
  const environment={...process.env,PRIVATE_SECRET:'SYNTHETIC_PRIVATE_EXPANSION'};
  delete environment.NEXT_PUBLIC_SUPABASE_URL;delete environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const loaded=JSON.parse(execFileSync(process.execPath,['-e',code,envPackage,target],{env:environment,encoding:'utf8'}));
  assert.equal(loaded.url,'https://api.owned.example');assert.equal(loaded.key,profile.publicKey);
  for(const value of ['${PRIVATE_SECRET}','opaque"key','opaque\\key','opaque#key','opaque`key']) assert.throws(()=>validateProfile({...profile,publicKey:value}),/Invalid public profile connection/);
  assert.throws(()=>validateProfile({...profile,backendUrl:'https://api.${PRIVATE_SECRET}.example'}));
}));
test('private strict input rejects missing duplicate unknown and secret configuration without emitting values',()=>fixture(async({configFile,outputDir})=>{
  for(const raw of [JSON.stringify({...profile,publicKey:'sb_secret_PRIVATE_MARKER'}),JSON.stringify({...profile,extra:'PRIVATE_MARKER'}),'{"schemaVersion":1,"schemaVersion":1}',JSON.stringify({...profile,apiOrigin:null})]) {
    await fs.writeFile(configFile,raw);await assert.rejects(createProfile({configFile,outputDir}));
    const result=spawnSync(process.execPath,[script,'--config-file',configFile,'--output-dir',outputDir],{encoding:'utf8'});
    assert.equal(result.status,1);assert.ok(!(result.stdout+result.stderr).includes('PRIVATE_MARKER'));
    await assert.rejects(fs.stat(outputDir),{code:'ENOENT'});
  }
}));
test('no overwrite private input or linked ancestry adoption; existing parents keep their modes',()=>fixture(async({base,configFile,outputDir})=>{
  await fs.mkdir(outputDir);await assert.rejects(createProfile({configFile,outputDir}),/already exists/);assert.deepEqual(await fs.readdir(outputDir),[]);
  await fs.rmdir(outputDir);await fs.chmod(configFile,0o644);await assert.rejects(createProfile({configFile,outputDir}),/private/);await fs.chmod(configFile,0o600);
  const alias=path.join(base,'alias');await fs.symlink(base,alias);await assert.rejects(createProfile({configFile,outputDir:path.join(alias,'target')}),/symlink/);
  await assert.rejects(createProfile({configFile,outputDir:path.join(root,'profiles-private')}),/outside/);
  await fs.chmod(base,0o755);await createProfile({configFile,outputDir});assert.equal((await fs.stat(base)).mode&0o777,0o755);
}));
test('exact integrity rejects changed public settings modes extra files and output links',()=>fixture(async({configFile,outputDir})=>{
  await createProfile({configFile,outputDir});const file=path.join(outputDir,'mobile.env'),original=await fs.readFile(file);
  await fs.appendFile(file,'EXPO_PUBLIC_SUPABASE_URL=https://another.example\n');await assert.rejects(verifyProfile(outputDir),/content changed/);await fs.writeFile(file,original);
  await fs.chmod(file,0o644);await assert.rejects(verifyProfile(outputDir),/private/);await fs.chmod(file,0o600);
  await fs.writeFile(path.join(outputDir,'unowned.txt'),'keep');await assert.rejects(verifyProfile(outputDir),/tree changed/);await fs.unlink(path.join(outputDir,'unowned.txt'));
  await fs.rename(file,file+'.original');await fs.symlink(file+'.original',file);await assert.rejects(verifyProfile(outputDir));
}));
