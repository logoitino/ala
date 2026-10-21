/** Synthetic web-host boundary tests; adapter is mocked and no socket is opened. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Writable} from 'node:stream';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'ala-web-host-'));
try{
 await fs.mkdir(path.join(scratch,'dist/client'),{recursive:true});await fs.mkdir(path.join(scratch,'dist/server'),{recursive:true});
 await fs.writeFile(path.join(scratch,'dist/client/asset.svg'),'<svg>synthetic</svg>');
 await fs.writeFile(path.join(scratch,'dist/server/secret.txt'),'PRIVATE_SYNTHETIC_VALUE');
 await fs.symlink('../server/secret.txt',path.join(scratch,'dist/client/escape.txt'));
 let source=await fs.readFile(path.join(root,'infrastructure/containers/expo-server.mjs'),'utf8');
 source=source.replace("import { createServer } from 'node:http';","const createServer=(cb)=>{globalThis.testHandler=cb;return {listen(){},close(cb){cb()}}};");
 source=source.replace(/const require = createRequire\(import.meta.url\);\nconst routerRequire = createRequire\(require.resolve\('expo-router\/package.json'\)\);\nconst \{ createRequestHandler \} = routerRequire\('expo-server\/adapter\/http'\);/,"const createRequestHandler=()=>async(req,res)=>{res.writeHead(404);res.end('ROUTE_FALLBACK')};");
 await fs.writeFile(path.join(scratch,'host.mjs'),source);process.env.EXPO_DIST_DIR=path.join(scratch,'dist');await import(path.join(scratch,'host.mjs'));
 class Response extends Writable{
  constructor(){super();this.headers={};this.status=200;this.chunks=[];this.headersSent=false;}
  _write(chunk,encoding,cb){this.chunks.push(Buffer.from(chunk));cb();}
  setHeader(k,v){this.headers[k]=v;}
  writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);this.headersSent=true;}
 }
 async function request(url,method='GET'){
  const response=new Response();const done=new Promise((resolve,reject)=>{response.on('finish',resolve);response.on('error',reject)});
  await globalThis.testHandler({url,method},response);await done;return {status:response.status,headers:response.headers,body:Buffer.concat(response.chunks).toString()};
 }
 let checks=0;function check(value,name){if(!value)throw Error(name);checks++;console.log('PASS',name);}
 let r=await request('/healthz');check(r.status===200&&JSON.parse(r.body).status==='ok','healthz responds with process health');
 r=await request('/asset.svg');check(r.status===200&&r.body==='<svg>synthetic</svg>'&&r.headers['Content-Type']==='image/svg+xml','GET serves only exported client asset with correct MIME');
 r=await request('/asset.svg','HEAD');check(r.body===''&&Number(r.headers['Content-Length'])===20,'HEAD has content length without response body');
 r=await request('/..%2Fserver%2Fsecret.txt');check(r.status===404&&!r.body.includes('PRIVATE'),'encoded traversal cannot read server output');
 r=await request('/escape.txt');check(r.status===404&&!r.body.includes('PRIVATE'),'escaping client symlink cannot read server output');
 r=await request('/api/example','POST');check(r.status===404&&r.body==='ROUTE_FALLBACK','API POST falls through to Expo adapter');
 r=await request('/bad%ZZ');check(r.status===400,'malformed URL gets a bounded error');
 console.log(`${checks} synthetic host boundary tests passed; production SDK adapter inspected separately; no actual export/browser/Docker verified`);
}finally{await fs.rm(scratch,{recursive:true,force:true});}
