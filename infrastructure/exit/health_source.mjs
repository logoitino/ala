/** Read the source capsule and exact process identity without capturing, repairing or exposing source/private bytes. */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncStatus } from './sync.mjs';
import { watcherStatus } from './watcher.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
/** Inspect only configured public API origins as data; local private key values are never returned or expanded. */
export async function sourceOriginMatches(repositoryRoot,expected,environment=process.env) {
  const normalize=value=>{
    if(typeof value!=='string'||!value||/[\s$`]/.test(value)) throw new Error('Invalid origin');
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||!['','/'].includes(url.pathname)||url.search||url.hash) throw new Error('Invalid origin');
    return url.origin;
  };
  try {
    expected=normalize(expected);
    let missing=false;
    const urls=[];
    for(const [directory,key] of [['apps/mobile','EXPO_PUBLIC_SUPABASE_URL'],['apps/admin-portal','NEXT_PUBLIC_SUPABASE_URL']]) {
      const appUrls=[];
      let publicObserved=false;
      const keys=[key,'SUPABASE_URL'];
      for(const name of keys) if(Object.hasOwn(environment,name)) {
        appUrls.push(normalize(environment[name]));
        if(name===key) publicObserved=true;
      }
      // A prepared move must survive build-mode changes. Conflicting declarations in any standard
      // dotenv file are unresolved configuration until the operator reconciles them explicitly.
      for(const name of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local','.env.test','.env.test.local']) {
      let text;
      try {
        const filename=path.join(repositoryRoot,directory,name),info=await fs.lstat(filename);
        if(!info.isFile()||info.isSymbolicLink()||info.size>65_536) throw new Error('Invalid public URL source');
        text=await fs.readFile(filename,'utf8');
      } catch(error) {if(error.code==='ENOENT') continue;throw error;}
      const found=new Set();
      for(const line of text.split(/\r?\n/)) {
        const match=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if(!keys.includes(match?.[1])) continue;
        const name=match[1];
        if(found.has(name)) throw new Error('Duplicate API URL');
        found.add(name);
        if(name===key) publicObserved=true;
        let value=match[2];
        if(value.startsWith('"')||value.startsWith("'")) {
          if(value.length<2||value.at(-1)!==value[0]) throw new Error('Invalid quoting');
          value=value.slice(1,-1);
        }
        appUrls.push(normalize(value));
      }
      }
      if(!publicObserved) missing=true;
      urls.push(...appUrls);
    }
    if(urls.some(url=>url!==expected)) return false;
    return missing?null:true;
  } catch {return false;}
}

async function main(args) {
const options={};
let expected;
try {
  while(args.length) {
    const key=args.shift(),value=args.shift();
    if(!['--state-dir','--target-id','--expected-source-url'].includes(key)||!value||value.startsWith('--')) throw new Error('Invalid option');
    if(key==='--expected-source-url') {if(expected!==undefined) throw new Error('Duplicate option');expected=value;continue;}
    const field=key==='--state-dir'?'stateDir':'targetId';
    if(field in options) throw new Error('Duplicate option');
    options[field]=value;
  }
  const source=await syncStatus(root,options);
  // Filter raw errors and any future extra receipt fields before crossing into an operational report.
  const safe={};
  for(const key of ['outcome','sourceCurrent','codeVerified','codeVerification','releaseVersion','sourceTreeHash',
    'capturedAt','lastCheckedAt','targetId']) if(key in source) safe[key]=source[key];
  safe.mapValid=source.mapValidation?.outcome==='passed';
  safe.configuredSourceMatchesExpected=expected===undefined?null:await sourceOriginMatches(root,expected);
  console.log(JSON.stringify({source:safe,watcher:await watcherStatus(root,options)}));
} catch {
  console.log(JSON.stringify({source:{sourceCurrent:false,codeVerified:false,mapValid:false},watcher:{active:false,state:'invalid-or-unobservable'}}));
  process.exitCode=2;
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
