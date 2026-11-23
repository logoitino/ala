/** UX14 real SDK sport transport and multi-seed account-lifetime refusal; synthetic HTTP only. */
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, isOfflineActorChanged, type OfflineActorClient } from '@/lib/offlineActor';
import { saveSportConfig, deleteSportConfig, seedSportConfigs, fetchStoredSportConfigs, fetchSportConfigs } from '@/lib/sports';
import { GENERIC_SPORT_CONFIG } from '@/data/sports';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: require('@supabase/supabase-js').createClient('https://sport-test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) }));
const oldFetch=globalThis.fetch,oldUrl=process.env.EXPO_PUBLIC_SUPABASE_URL,oldKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let http:jest.Mock<ReturnType<typeof fetch>,Parameters<typeof fetch>>;
beforeEach(()=>{
 process.env.EXPO_PUBLIC_SUPABASE_URL='https://sport-test.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
 jest.spyOn(supabase.auth,'getSession').mockResolvedValue({data:{session:{user:{id:'user-A'},access_token:'synthetic-A'}},error:null} as never);
 http=jest.fn<ReturnType<typeof fetch>,Parameters<typeof fetch>>(async()=>new Response(JSON.stringify({sport:'Synthetic Sport'}),{headers:{'Content-Type':'application/json'}}));globalThis.fetch=http;
});
afterEach(()=>{jest.restoreAllMocks();globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=oldKey;});
it.each([
 ['save',(client:OfflineActorClient)=>saveSportConfig(GENERIC_SPORT_CONFIG,client)],
 ['delete',(client:OfflineActorClient)=>deleteSportConfig('sport-A',client)],
] as const)('%s keeps the captured owner token',async(_label,run)=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 jest.mocked(supabase.auth.getSession).mockResolvedValue({data:{session:{user:{id:'user-B'},access_token:'synthetic-B'}},error:null} as never);
 await run(client);expect(http.mock.calls.map(([,init])=>new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer synthetic-A']);
});
it('stops a multi-seed operation before the next HTTP when the initiating actor leaves',async()=>{
 let current=true;const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>current});
 http.mockImplementation(async()=>{current=false;return new Response(JSON.stringify({sport:'Synthetic Sport'}),{headers:{'Content-Type':'application/json'}});});
 let refusal: unknown; try { await seedSportConfigs(client); } catch (error) { refusal = error; } expect(isOfflineActorChanged(refusal)).toBe(true);
 expect(http).toHaveBeenCalledTimes(1);
});
it.each(['denied','network'])('configured bound read %s is an honest failure instead of successful starters',async(kind)=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 if(kind==='denied')http.mockImplementation(async()=>new Response(JSON.stringify({code:'42501',message:'Synthetic sport read denied'}),{status:403,headers:{'Content-Type':'application/json'}}));
 else http.mockRejectedValue(new Error('Synthetic sport offline'));
 await expect(fetchStoredSportConfigs(client)).rejects.toThrow();
});
it('missing get_sport_configs preserves null and seeded compatibility for a bound reader',async()=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 http.mockImplementation(async()=>new Response(JSON.stringify({code:'PGRST202',message:'Could not find the function public.get_sport_configs without parameters in the schema cache'}),{status:404,headers:{'Content-Type':'application/json'}}));
 expect(await fetchStoredSportConfigs(client)).toBeNull(); expect((await fetchSportConfigs(client)).length).toBeGreaterThan(0);
});

it('canonical [] and compatibility null remain unchanged for a captured read',async()=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 http.mockImplementation(async()=>new Response('[]',{headers:{'Content-Type':'application/json'}}));
 expect(await fetchStoredSportConfigs(client)).toEqual([]);expect((await fetchSportConfigs(client)).length).toBeGreaterThan(0);
 http.mockImplementation(async()=>new Response('null',{headers:{'Content-Type':'application/json'}}));expect(await fetchStoredSportConfigs(client)).toBeNull();
});
it('default decorative reader keeps its original null fallback',async()=>{
 http.mockImplementation(async()=>new Response(JSON.stringify({code:'42501',message:'Synthetic denied'}),{status:403,headers:{'Content-Type':'application/json'}}));
 expect(await fetchStoredSportConfigs()).toBeNull();
});
it('a denied error code stays terminal even when its message mentions a missing function',async()=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 http.mockImplementation(async()=>new Response(JSON.stringify({code:'42501',message:'Synthetic denied: could not find the function 42883'}),{status:403,headers:{'Content-Type':'application/json'}}));
 await expect(fetchStoredSportConfigs(client)).rejects.toThrow('Synthetic denied');
});
