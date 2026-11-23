/** Real SDK Crew fallback dispatch keeps captured A credentials and refuses departed/denied writes. */
import { supabase } from '@/lib/supabase';
import { setCrewFollow } from '@/lib/crew';
import type { OfflineActor } from '@/lib/offlineActor';
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:require('@supabase/supabase-js').createClient('https://crew-test.invalid','public-test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}));
const owner='11111111-1111-4111-8111-111111111111',player='33333333-3333-4333-8333-333333333333';
const originalFetch=globalThis.fetch, originalUrl=process.env.EXPO_PUBLIC_SUPABASE_URL,originalKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live:boolean,actor:OfflineActor,http:jest.Mock<ReturnType<typeof fetch>,Parameters<typeof fetch>>;
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{live=true;actor={userId:owner,isCurrent:()=>live};process.env.EXPO_PUBLIC_SUPABASE_URL='https://crew-test.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-test-key';jest.spyOn(supabase.auth,'getSession').mockResolvedValue({data:{session:{user:{id:owner},access_token:'test-crew-A'}},error:null} as never);http=jest.fn<ReturnType<typeof fetch>,Parameters<typeof fetch>>(async()=>response({crew_count:1,squad_count:0,following:true,mutual:false}));globalThis.fetch = http as unknown as typeof fetch; });
afterEach(()=>{jest.restoreAllMocks();globalThis.fetch = originalFetch as unknown as typeof fetch; if(originalUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=originalUrl;if(originalKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=originalKey;});
it('retains the initiating credentials through missing-function fallback and graph refresh',async()=>{
 http.mockImplementationOnce(async()=>{jest.mocked(supabase.auth.getSession).mockResolvedValue({data:{session:{user:{id:'B'},access_token:'test-crew-B'}},error:null} as never);return response({code:'PGRST202',message:'Missing function'},404);});
 http.mockResolvedValueOnce(response(null));
 await expect(setCrewFollow(player,owner,true,actor)).resolves.toMatchObject({following:true});
 expect(http.mock.calls.map(([,init])=>new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer test-crew-A','Bearer test-crew-A','Bearer test-crew-A']);
});
it('refuses fallback after A leaves during the original RPC',async()=>{
 http.mockImplementationOnce(async()=>{live=false;return response({code:'PGRST202',message:'Missing function'},404);});
 await expect(setCrewFollow(player,owner,true,actor)).rejects.toThrow('account changed');
 expect(http).toHaveBeenCalledTimes(1);
});
it('keeps permission denial terminal instead of raw fallback',async()=>{
 http.mockResolvedValueOnce(response({code:'42501',message:'Denied'},403));
 await expect(setCrewFollow(player,owner,true,actor)).rejects.toThrow('Denied');
 expect(http).toHaveBeenCalledTimes(1);
});
