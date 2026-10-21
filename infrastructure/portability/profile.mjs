/** Produce matching target connection files without copying source secrets, contacting providers or installing configuration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveBackendConnection } from '../../packages/shared-types/backendConnection.ts';
import { privateOutputPath, rejectPathAliases, requireOutsideRepository, privateOwnedEntry, requireAbsentOutput,
  promoteExclusive, createPrivateParents, removeOwnedOutput } from '../exit/setup.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const FILES=['mobile.env','admin.env','server.env','profile.json','README.md'];
const OWNER='tapuai-connection-profile/1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const manifestHash=({manifestSha256:ignored,...value})=>sha(JSON.stringify(value));

/** Reuse the existing strict bounded JSON parser; duplicate keys are rejected before Node's parser can discard them. */
async function readConfig(filename,root) {
  filename=privateOutputPath(filename,'Profile configuration');requireOutsideRepository(filename,root);
  const info=await privateOwnedEntry(filename);
  if(info.size>65_536) throw new Error('Profile configuration exceeds limit');
  const raw=await fs.readFile(filename,'utf8');
  const check=`import json,sys
def pairs(items):
    value={}
    for key,item in items:
        if key in value: raise ValueError('duplicate')
        value[key]=item
    return value
def invalid(value): raise ValueError('nonfinite')
json.loads(sys.stdin.read(),object_pairs_hook=pairs,parse_constant=invalid)
`;
  try {execFileSync('python3',['-c',check],{input:raw,stdio:['pipe','pipe','pipe'],timeout:30_000});}
  catch {throw new Error('Invalid private profile JSON');}
  const value=JSON.parse(raw);
  return validateProfile(value);
}

/** Connection keys are supplied as data, never CLI strings. No privilege-bearing key can become a client build variable. */
export function validateProfile(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['schemaVersion','backendUrl','apiOrigin','publicKey','_comment'].includes(key))
      ||value.schemaVersion!==1||!Object.hasOwn(value,'publicKey')) throw new Error('Invalid profile schema');
  const backend=resolveBackendConnection({url:value.backendUrl,publicKey:value.publicKey});
  const api=resolveBackendConnection({url:value.apiOrigin,publicKey:value.publicKey});
  if(backend.status!=='configured'||api.status!=='configured') throw new Error('Invalid public profile connection');
  return {schemaVersion:1,backendUrl:backend.connection.url,apiOrigin:api.connection.url,publicKey:backend.connection.publicKey};
}

function files(profile) {
  const env=(rows)=>'# Generated target connection only. Review privately before any build or installation.\n'+rows.map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n';
  return {
    'mobile.env':env([['EXPO_PUBLIC_SUPABASE_URL',profile.backendUrl],['EXPO_PUBLIC_SUPABASE_ANON_KEY',profile.publicKey],['EXPO_PUBLIC_API_ORIGIN',profile.apiOrigin]]),
    'admin.env':env([['NEXT_PUBLIC_SUPABASE_URL',profile.backendUrl],['NEXT_PUBLIC_SUPABASE_ANON_KEY',profile.publicKey]]),
    'server.env':env([['SUPABASE_URL',profile.backendUrl],['SUPABASE_ANON_KEY',profile.publicKey]])+'# Separately configure required server-only privileges and provider integrations. No service key is generated.\nSUPABASE_SERVICE_ROLE_KEY=\n',
    'profile.json':json({_comment:'Target public connection profile; service secrets, source credentials and customer data are excluded.',...profile}),
    'README.md':'# Portable target connection files\n\nThese files configure one compatible backend for both apps and their server routes.\nThey are generated from explicitly supplied public settings, never from source private files.\n\n- `mobile.env`: Expo public backend URL/key and web/API origin.\n- `admin.env`: Next public backend URL/key.\n- `server.env`: matching server backend URL/public key; required service key remains blank.\n- `profile.json`: normalized public settings.\n- `manifest.json`: exact original hashes/modes; no live compatibility claim.\n\nMerge the reviewed settings into your target build/runtime environment without replacing existing\napp flags, payment keys, OAuth redirects, private service credentials or other required settings.\nDo not source these generated files as shell commands; load them as dotenv data.\nExpo and Next public variables compile into the client: rebuild and install a matching release.\nA plain PostgreSQL endpoint cannot replace Auth/REST/RPC/Storage/Realtime/functions by itself.\nYour target must implement the app protocols and independently pass the migration acceptance gates.\n\nUse the exact current source export (`pnpm exit:release`) or the managed source cache.\nRun `pnpm portability:test` with existing installed dependencies to exercise synthetic local SDK contracts.\nThis does not prove real database/RLS, OAuth/MFA, Realtime sockets, Stripe or hosted parity.\nOffline installation also requires prepared dependency caches or reviewed runtime images.\n\nNo environment file was installed, no provider contacted and no traffic switched.\n',
  };
}

/** Verify exact fresh profile bytes/modes, including manifest integrity. Never interpret profile presence as service readiness. */
export async function verifyProfile(directory) {
  directory=privateOutputPath(directory,'Profile directory');await privateOwnedEntry(directory,true,0o700);
  const names=await fs.readdir(directory);
  if(names.length!==FILES.length+1||[...FILES,'manifest.json'].some(name=>!names.includes(name))) throw new Error('Profile tree changed');
  const filename=path.join(directory,'manifest.json');await privateOwnedEntry(filename,false,0o600);
  const manifest=JSON.parse(await fs.readFile(filename,'utf8'));
  if(manifest.owner!==OWNER||manifest.schemaVersion!==1||manifest.readyToCutOver!==false||manifest.compatibility!=='not-proven'
      ||manifest.files?.length!==FILES.length||manifest.manifestSha256!==manifestHash(manifest)) throw new Error('Profile manifest changed');
  const expected=new Set(FILES);
  for(const item of manifest.files) {
    if(!expected.delete(item.path)||item.mode!=='0600'||!/[a-f0-9]{64}/.test(item.sha256)) throw new Error('Profile file accounting changed');
    const file=path.join(directory,item.path);await privateOwnedEntry(file,false,0o600);
    if(sha(await fs.readFile(file))!==item.sha256) throw new Error('Profile content changed');
  }
  if(expected.size) throw new Error('Profile incomplete');
  return {integrity:'verified',manifestSha256:manifest.manifestSha256,readyToCutOver:false,compatibility:'not-proven'};
}

/** Publish an entirely new private folder. OS no-replace semantics and inode-scoped cleanup protect existing operator files. */
export async function createProfile({configFile,outputDir,root=ROOT}) {
  root=await fs.realpath(root);outputDir=privateOutputPath(outputDir,'Profile output');requireOutsideRepository(outputDir,root);
  await rejectPathAliases(outputDir);await requireAbsentOutput(outputDir);
  const profile=await readConfig(configFile,root),owned=[];
  let stage,published=false;
  try {
    await createPrivateParents(path.dirname(outputDir),owned);
    const directory=await fs.mkdtemp(path.join(path.dirname(outputDir),'.tapuai-profile-'));
    stage={path:directory,info:await fs.lstat(directory)};await fs.chmod(directory,0o700);
    const payload=files(profile),entries=[];
    for(const name of FILES) {
      await fs.writeFile(path.join(directory,name),payload[name],{flag:'wx',mode:0o600});await fs.chmod(path.join(directory,name),0o600);
      entries.push({path:name,mode:'0600',sha256:sha(payload[name])});
    }
    const manifest={_comment:'Original target profile integrity only; externally accepted service/data readiness is still required.',schemaVersion:1,owner:OWNER,
      createdAt:new Date().toISOString(),compatibility:'not-proven',readyToCutOver:false,files:entries};
    manifest.manifestSha256=manifestHash(manifest);
    await fs.writeFile(path.join(directory,'manifest.json'),json(manifest),{flag:'wx',mode:0o600});await fs.chmod(path.join(directory,'manifest.json'),0o600);
    await verifyProfile(directory);await rejectPathAliases(outputDir);await requireAbsentOutput(outputDir);
    promoteExclusive(directory,outputDir);stage=null;published=true;
    return {schemaVersion:1,outputDirectory:outputDir,manifestSha256:manifest.manifestSha256,configurationInstalled:false,providerContacted:false,readyToCutOver:false};
  } finally {
    await removeOwnedOutput(stage,true);
    if(!published) for(const item of owned.reverse()) await removeOwnedOutput(item);
  }
}

async function main(args) {
  if(args.length===1&&args[0]==='--help') {console.log('Usage: pnpm portability:profile --config-file PRIVATE_JSON --output-dir NEW_PRIVATE_EXTERNAL');return;}
  const options={},fields={'--config-file':'configFile','--output-dir':'outputDir'};
  for(let i=0;i<args.length;i+=2) {
    const name=fields[args[i]],value=args[i+1];
    if(!name||name in options||!value||value.startsWith('--')) throw new Error('Invalid profile arguments');
    options[name]=value;
  }
  if(!options.configFile||!options.outputDir) throw new Error('Profile input and output required');
  console.log(json(await createProfile(options)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {await main(process.argv.slice(2));} catch {console.error('portability:profile failed: invalid input, unsafe path or publication failure');process.exitCode=1;}
}
