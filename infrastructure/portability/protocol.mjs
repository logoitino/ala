/** Exercise the installed app SDK against synthetic loopback-only APIs; these fixtures never certify a deployed backend. */
import http from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { resolveBackendConnection } from '../../packages/shared-types/backendConnection.ts';

const require=createRequire(new URL('../../apps/mobile/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const PUBLIC_KEY='sb_publishable_local_contract_fixture';
const USER_ID='00000000-0000-4000-8000-000000000001';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Refuse credential-bearing redirects and every origin except this one exact synthetic local listener. */
export function loopbackFetch(origin,transport=globalThis.fetch) {
  const parsed=new URL(origin);
  if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||!parsed.port||parsed.origin!==origin) throw new Error('Fixture must bind a literal loopback origin');
  return async(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.origin!==origin||url.username||url.password) throw new Error('Nonfixture request refused');
    const response=await transport(input,{...init,redirect:'manual'});
    if(response.status>=300&&response.status<400) throw new Error('Fixture redirect refused');
    return response;
  };
}

/** Requests are in-memory synthetic observations. Token/key values never enter the returned public result. */
export async function startFixture() {
  let origin,sessionToken,tokenSeq=0;
  const requests=[],objects=new Map();
  const user={id:USER_ID,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const token=()=>{
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const now=Math.floor(Date.now()/1000);
    sessionToken=encode({alg:'HS256',typ:'JWT'})+'.'+encode({iss:origin+'/auth/v1',sub:USER_ID,role:'authenticated',aud:'authenticated',exp:now+3600,iat:now,jti:String(++tokenSeq)})+'.fixture_signature';
    return {access_token:sessionToken,refresh_token:'fixture-refresh-'+tokenSeq,token_type:'bearer',expires_in:3600,user};
  };
  const server=http.createServer(async(req,res)=>{
    try {
      const chunks=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>65_536) throw new Error('Fixture request exceeds limit');chunks.push(chunk);}
      const bytes=Buffer.concat(chunks),url=new URL(req.url,origin),body=bytes.length&&req.headers['content-type']?.includes('json')?JSON.parse(bytes.toString('utf8')):null;
      requests.push({method:req.method,path:url.pathname,query:Object.fromEntries(url.searchParams),body,
        apiKeyMatches:req.headers.apikey===PUBLIC_KEY,authenticated:req.headers.authorization==='Bearer '+sessionToken});
      const send=(status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json',...headers});res.end(value===undefined?'':JSON.stringify(value));};
      if(req.headers.apikey!==PUBLIC_KEY) return send(401,{message:'fixture api key required'});
      if(url.pathname==='/auth/v1/token'&&req.method==='POST') {
        if(url.searchParams.get('grant_type')==='password'&&body?.email==='fixture@example.invalid'&&body?.password==='fixture-password') return send(200,token());
        if(url.searchParams.get('grant_type')==='refresh_token'&&body?.refresh_token==='fixture-refresh-'+tokenSeq) return send(200,token());
        return send(400,{message:'fixture login rejected'});
      }
      if(url.pathname==='/auth/v1/user'&&req.method==='GET') return req.headers.authorization==='Bearer '+sessionToken?send(200,user):send(401,{message:'fixture sign-in required'});
      if(url.pathname==='/auth/v1/logout'&&req.method==='POST') {sessionToken=undefined;return send(204);}
      if(url.pathname==='/rest/v1/compatibility_items'&&req.method==='GET') return send(200,[{id:USER_ID,name:'fixture-item'}],{'content-range':'0-0/1'});
      if(url.pathname==='/rest/v1/rpc/compatibility_echo'&&req.method==='POST') return send(200,{value:body?.value});
      const objectPrefix='/storage/v1/object/compatibility-media/';
      if(url.pathname.startsWith(objectPrefix)&&req.method==='POST') {
        const name=url.pathname.slice(objectPrefix.length);objects.set(name,bytes);return send(200,{Key:'compatibility-media/'+name,Id:USER_ID});
      }
      if(url.pathname.startsWith(objectPrefix)&&req.method==='GET') {
        const value=objects.get(url.pathname.slice(objectPrefix.length));
        if(!value) return send(404,{message:'fixture file missing'});
        res.writeHead(200,{'content-type':'text/plain'});res.end(value);return;
      }
      if(url.pathname==='/storage/v1/object/sign/compatibility-media/fixture.txt'&&req.method==='POST') return send(200,{signedURL:'/object/sign/compatibility-media/fixture.txt?token=fixture-signed'});
      if(url.pathname==='/storage/v1/object/compatibility-media'&&req.method==='DELETE') {
        for(const name of body?.prefixes??[]) objects.delete(name);
        return send(200,(body?.prefixes??[]).map(name=>({name})));
      }
      if(url.pathname==='/functions/v1/compatibility-ping'&&req.method==='POST') return send(200,{ok:true,value:body?.value});
      return send(404,{message:'unimplemented fixture route'});
    } catch {if(!res.headersSent)res.writeHead(400,{'content-type':'application/json'});res.end('{"message":"invalid synthetic request"}');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
  return {origin,requests,objects,close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}

/** The real SDK must preserve protocol paths, query encoding, caller token flow and bytes when the configured host changes. */
export async function runLocalContracts() {
  const fixture=await startFixture();
  try {
    const connection=resolveBackendConnection({url:fixture.origin,publicKey:PUBLIC_KEY});
    assert.equal(connection.status,'configured');
    const client=createClient(connection.connection.url,connection.connection.publicKey,{global:{fetch:loopbackFetch(fixture.origin)},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const gates=[];
    const query=await client.from('compatibility_items').select('id,name',{count:'exact'}).eq('id',USER_ID).order('name');
    assert.equal(query.error,null);assert.equal(query.count,1);assert.equal(query.data[0].id,USER_ID);
    const request=fixture.requests.at(-1);assert.equal(request.query.select,'id,name');assert.equal(request.query.id,'eq.'+USER_ID);assert.equal(request.query.order,'name.asc');gates.push('rest-query');
    const rpc=await client.rpc('compatibility_echo',{value:'local'});assert.equal(rpc.error,null);assert.deepEqual(rpc.data,{value:'local'});gates.push('database-rpc');
    const login=await client.auth.signInWithPassword({email:'fixture@example.invalid',password:'fixture-password'});assert.equal(login.error,null);assert.equal(login.data.user.id,USER_ID);gates.push('auth-password-shape');
    const current=await client.auth.getUser();assert.equal(current.error,null);assert.equal(current.data.user.id,USER_ID);assert.equal(fixture.requests.at(-1).authenticated,true);gates.push('auth-user-token-forwarding');
    const refresh=await client.auth.refreshSession();assert.equal(refresh.error,null);assert.notEqual(refresh.data.session.access_token,login.data.session.access_token);gates.push('auth-refresh-shape');
    const payload=Buffer.from('synthetic portable media\n');
    const upload=await client.storage.from('compatibility-media').upload('fixture.txt',payload,{contentType:'text/plain'});assert.equal(upload.error,null);assert.equal(sha(fixture.objects.get('fixture.txt')),sha(payload));
    const download=await client.storage.from('compatibility-media').download('fixture.txt');assert.equal(download.error,null);assert.equal(sha(Buffer.from(await download.data.arrayBuffer())),sha(payload));gates.push('storage-byte-roundtrip');
    const signed=await client.storage.from('compatibility-media').createSignedUrl('fixture.txt',60);assert.equal(signed.error,null);assert.equal(new URL(signed.data.signedUrl).origin,fixture.origin);gates.push('storage-signed-path-shape');
    const invoke=await client.functions.invoke('compatibility-ping',{body:{value:'local'}});assert.equal(invoke.error,null);assert.deepEqual(invoke.data,{ok:true,value:'local'});assert.equal(fixture.requests.at(-1).authenticated,true);gates.push('function-invoke');
    const removed=await client.storage.from('compatibility-media').remove(['fixture.txt']);assert.equal(removed.error,null);assert.equal(fixture.objects.size,0);gates.push('storage-remove');
    const logout=await client.auth.signOut();assert.equal(logout.error,null);assert.equal((await client.auth.getSession()).data.session,null);gates.push('auth-signout');
    assert.ok(fixture.requests.every(request=>request.apiKeyMatches));
    return {schemaVersion:1,scope:'synthetic-loopback-installed-sdk',passed:true,gates,requestCount:fixture.requests.length,providerContacted:false,readyToCutOver:false,
      notExercised:['real-database-and-rls','real-password-verification','oauth-and-mfa','realtime-websockets','edge-runtime','stripe','deployed-backend-parity']};
  } finally {await fixture.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await runLocalContracts(),null,2));}
  catch {console.error('Local SDK protocol contract failed; no provider or live compatibility is established');process.exitCode=1;}
}
